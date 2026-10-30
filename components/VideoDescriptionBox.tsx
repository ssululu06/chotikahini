"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * YouTube-style collapsible description box. The first ~180 chars are shown
 * by default with a fade; clicking "আরও দেখান" expands the full text.
 *
 * Empty descriptions render nothing — no orphan boxes.
 */
export function VideoDescriptionBox({ text }: { text: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;

  const previewLen = 220;
  const needsTruncation = text.length > previewLen;
  const visible = !needsTruncation || expanded ? text : text.slice(0, previewLen);

  return (
    <section
      className="rounded-2xl bg-surface-alt/60 px-4 py-3 text-[15px] leading-7 text-fg-muted"
      aria-label="বিবরণ"
    >
      <p
        className={
          "font-latin " +
          (expanded
            ? "whitespace-pre-line"
            : "whitespace-pre-line [text-wrap:pretty]")
        }
      >
        {visible}
        {!expanded && needsTruncation ? "…" : null}
      </p>
      {needsTruncation ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-fg hover:underline"
        >
          {expanded ? "লুকান" : "আরও দেখান"}
          <ChevronDown
            className={"h-3 w-3 transition-transform " + (expanded ? "rotate-180" : "")}
          />
        </button>
      ) : null}
    </section>
  );
}
