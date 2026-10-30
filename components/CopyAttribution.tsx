"use client";

import { useEffect, useRef } from "react";
import { copyAttribution } from "@/config/copy";

/**
 * Lightweight copy-event handler.
 *
 * When a user copies text from the article area, the configured
 * attribution text is automatically appended to the clipboard.
 *
 * - Preserves the exact selected text.
 * - Appends only once (idempotent check via marker).
 * - Does nothing when `copyAttribution.enabled` is false.
 * - Works on desktop and mobile browsers where the `copy` event is supported.
 */
export function CopyAttribution() {
  const markerRef = useRef("__CATT__");

  useEffect(() => {
    if (!copyAttribution.enabled) return;

    const marker = markerRef.current;
    const attribution = copyAttribution.text.trim();
    const separator = copyAttribution.separator;

    const handler = (e: ClipboardEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const raw = selection.toString();
      if (!raw) return;

      // If the attribution is already present, do not append again.
      if (raw.includes(attribution)) return;

      const enriched = raw + separator + attribution;

      e.clipboardData?.setData("text/plain", enriched);

      // Also try to set HTML if the browser supports it — keeps the
      // attribution as readable text inside HTML copies without formatting.
      try {
        const htmlSelection = document.getSelection()?.getRangeAt(0);
        if (htmlSelection) {
          const container = document.createElement("div");
          container.appendChild(htmlSelection.cloneContents());
          const htmlEnriched =
            container.innerHTML + separator.replace(/\n/g, "<br>") + attribution.replace(/\n/g, "<br>");
          e.clipboardData?.setData("text/html", htmlEnriched);
        }
      } catch {
        // Non-critical — plain text copy still works.
      }

      e.preventDefault();
    };

    document.addEventListener("copy", handler);
    return () => document.removeEventListener("copy", handler);
  }, []);

  // This component renders nothing.
  return null;
}
