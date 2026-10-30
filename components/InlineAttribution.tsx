"use client";

import { useEffect, useRef } from "react";
import { inlineAttribution } from "@/config/copy";

/**
 * Client-only injector that inserts inline attribution dividers
 * into rendered article content after every N paragraphs.
 *
 * Runs after hydration so it avoids interfering with MDX compilation
 * or SSR.  Dividers are real DOM elements — visible, selectable, and
 * included in text copies.
 */
export function InlineAttribution() {
  const injectedRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    const cfg = inlineAttribution;
    if (!cfg.enabled || cfg.interval < 1) return;

    const container = document.querySelector(".prose-custom");
    if (!container) return;

    // Collect only top-level <p> elements (direct children of prose-custom)
    const paragraphs: HTMLParagraphElement[] = [];
    for (const child of container.children) {
      if (child.tagName === "P" && child.closest(".prose-custom") === container) {
        paragraphs.push(child as HTMLParagraphElement);
      }
    }

    let count = 0;
    const injected: HTMLDivElement[] = [];

    for (const p of paragraphs) {
      count++;
      if (count % cfg.interval !== 0) continue;

      const div = document.createElement("div");
      div.className = "inline-attribution not-prose";
      div.innerHTML = `
        <span class="ia-sep">━━━━━</span>
        <span class="ia-text">${cfg.text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")}</span>
        <span class="ia-sep">━━━━━</span>
      `.trim();
      p.parentNode?.insertBefore(div, p.nextSibling);
      injected.push(div);
    }

    injectedRef.current = injected;

    return () => {
      for (const el of injectedRef.current) {
        el.remove();
      }
      injectedRef.current = [];
    };
  }, []);

  return null;
}
