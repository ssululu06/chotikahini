"use client";

import { useEffect, useRef } from "react";

/**
 * Client-only component that re-executes <script> elements inside
 * the rendered MDX content after hydration and on route changes.
 *
 * Some third-party embeds (ads, analytics) insert <script> tags via
 * raw HTML in MDX.  React does not execute script elements that are
 * added to the DOM during rendering, so we find and re-run them here.
 */
export function ScriptInjector() {
  const keyRef = useRef(0);

  useEffect(() => {
    const container = document.querySelector(".prose-custom");
    if (!container) return;

    const scripts = container.querySelectorAll<HTMLScriptElement>(
      "script:not([data-si-executed])",
    );

    for (const old of scripts) {
      if (old.dataset.siExecuted) continue;

      const nu = document.createElement("script");
      // Copy attributes
      for (const attr of old.attributes) {
        if (attr.name === "data-si-executed") continue;
        nu.setAttribute(attr.name, attr.value);
      }
      // Copy inline code (if any)
      nu.textContent = old.textContent;
      nu.dataset.siExecuted = "true";

      // Mark original so we don't re-process it
      old.dataset.siExecuted = "true";

      // Insert the fresh script right after the old one
      old.parentNode?.insertBefore(nu, old.nextSibling);
    }

    // Bump key so the effect re-runs on every render cycle
    keyRef.current += 1;
  });

  return null;
}
