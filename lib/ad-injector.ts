/**
 * Safely overrides document.write and document.writeln to support dynamic script execution
 * inside real DOM elements during client-side navigation in Next.js.
 *
 * The override routes ad provider content into the correct container div instead of
 * blanking the page (which would happen if document.write were called after the initial
 * page load ends). This also ensures ad blockers or network errors never crash the site.
 */

let _overrideApplied = false;
let _originalDocumentWrite: ((...args: any[]) => any) | null = null;

function applyOverride() {
  if (typeof window === "undefined") return;
  _originalDocumentWrite = document.write;

  document.write = function (content: string) {
    const currentScript = document.currentScript;
    const container =
      (currentScript && (currentScript.parentNode as HTMLElement)) ||
      (window as any).__activeAdContainer ||
      null;

    if (container && container.nodeType === 1) {
      const temp = document.createElement("div");
      temp.innerHTML = content;

      const anchor = currentScript || null;
      while (temp.firstChild) {
        const child = temp.firstChild;
        if (anchor) {
          container.insertBefore(child, anchor);
        } else {
          container.appendChild(child);
        }

        if (child instanceof HTMLScriptElement) {
          const newScript = document.createElement("script");
          for (const attr of Array.from(child.attributes)) {
            newScript.setAttribute(attr.name, attr.value);
          }
          newScript.textContent = child.textContent;
          container.insertBefore(newScript, child);
          child.remove();
        }
      }
    } else if (document.readyState === "loading") {
      _originalDocumentWrite!.call(document, content);
    }
    // else: document.write called after page load without a container
    // (e.g. an ad provider ran outside our injection context). Silently
    // drop the content instead of calling document.open() which would
    // replace the entire page with a blank document.
  };

  document.writeln = function (content: string) {
    document.write(content + "\n");
  };
}

export function setupDocumentWriteOverride() {
  if (typeof window === "undefined") return;
  if (_overrideApplied) {
    // If something (e.g. an ad blocker extension) restored the native
    // document.write, re-apply our override so the page stays safe.
    if (document.write !== (applyOverride as any)._wrapped) {
      applyOverride();
      (applyOverride as any)._wrapped = document.write;
    }
    return;
  }
  _overrideApplied = true;
  applyOverride();
  // Store the wrapped function so we can detect if it was overwritten
  (applyOverride as any)._wrapped = document.write;
}

// Global promise chain to serialize ad script execution across components
let adQueuePromise: Promise<void> = Promise.resolve();
const SCRIPT_TIMEOUT = 3000;

function runAdScript(oldScript: HTMLScriptElement, parentNode: Node): Promise<void> {
  return new Promise((resolveScript) => {
    try {
      const newScript = document.createElement("script");
      for (const attr of Array.from(oldScript.attributes)) {
        newScript.setAttribute(attr.name, attr.value);
      }
      if (oldScript.textContent) {
        newScript.textContent = oldScript.textContent;
      }

      newScript.async = false;

      const timer = setTimeout(resolveScript, SCRIPT_TIMEOUT);
      const done = () => {
        clearTimeout(timer);
        resolveScript();
      };

      if (oldScript.src) {
        newScript.onload = () => {
          setTimeout(done, 50);
        };
        newScript.onerror = done;
      } else {
        setTimeout(done, 25);
      }

      parentNode.insertBefore(newScript, oldScript);
      oldScript.remove();
    } catch (err) {
      console.error("[ads] script injection error:", err);
      resolveScript();
    }
  });
}

function injectNow(container: HTMLElement, html: string): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      container.innerHTML = "";

      const temp = document.createElement("div");
      temp.innerHTML = html;

      const nodes = Array.from(temp.childNodes);
      let scriptPromise = Promise.resolve();

      for (const node of nodes) {
        scriptPromise = scriptPromise.then(() => {
          try {
            if (!container.isConnected) return;
            container.appendChild(node);
            if (node instanceof HTMLScriptElement) {
              return runAdScript(node, container);
            }
            if (node instanceof HTMLElement) {
              const nestedScripts = Array.from(node.querySelectorAll("script"));
              let nestedPromise = Promise.resolve();
              for (const s of nestedScripts) {
                nestedPromise = nestedPromise.then(() => runAdScript(s, s.parentNode || node));
              }
              return nestedPromise;
            }
          } catch (err) {
            console.error("[ads] node injection error:", err);
          }
        });
      }

      scriptPromise.then(() => setTimeout(resolve, 100));
    } catch (err) {
      console.error("[ads] injectNow error:", err);
      setTimeout(resolve, 100);
    }
  });
}

/**
 * Injects raw HTML containing script tags into a container in the real DOM.
 * It manually recreates and runs script tags to ensure they execute.
 * This runs inside a global queue to ensure ads are loaded and executed sequentially,
 * avoiding parallel overrides of window.atOptions.
 */
export function injectAdIntoElement(container: HTMLElement, html: string) {
  if (typeof window === "undefined") return;

  setupDocumentWriteOverride();

  if (container.dataset.adInjected === "true") return;
  container.dataset.adInjected = "true";

  adQueuePromise = adQueuePromise
    .then(() => {
      if (!container.isConnected) {
        delete container.dataset.adInjected;
        return;
      }
      (window as any).__activeAdContainer = container;
      return injectNow(container, html);
    })
    .catch((err) => {
      console.error("[ads] Injection failed:", err);
    })
    .finally(() => {
      (window as any).__activeAdContainer = null;
    });
}

/**
 * Marks a container as not-yet-injected so it can be re-injected on the next
 * navigation (used when a container persists across route changes).
 */
export function resetAdInjection(container: HTMLElement | null | undefined) {
  if (!container || typeof window === "undefined") return;
  delete container.dataset.adInjected;
}