"use client";

import { useEffect, useState } from "react";

import { AD_300x250_HTML } from "@/lib/ad-config";

interface AdSlotProps {
  id: string;
  html?: string;
  label?: string;
  className?: string;
  minHeight?: number;
}

export function AdSlot({
  id,
  html = AD_300x250_HTML,
  label = "বিজ্ঞাপন",
  className = "",
  minHeight = 260,
}: AdSlotProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // If the passed HTML is old ExoClick 5990126, replace with valid Adsterra
  const activeHtml =
    !html || html.includes("5990126") ? AD_300x250_HTML : html;

  const iframeDocument = activeHtml.includes("<!DOCTYPE") || activeHtml.includes("<html")
    ? activeHtml
    : `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: transparent;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  </style>
</head>
<body>
  ${activeHtml}
</body>
</html>`;

  return (
    <div
      id={id}
      className={`ad-slot rounded-2xl border border-border/70 bg-surface-alt/40 p-3 text-center max-w-full overflow-hidden flex flex-col items-center justify-center transition-all ${className}`}
      style={{ minHeight }}
    >
      {label && (
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-subtle">
          {label}
        </div>
      )}
      <div className="w-full flex items-center justify-center overflow-hidden">
        <iframe
          title={`Ad-${id}`}
          srcDoc={iframeDocument}
          width="300"
          height="250"
          scrolling="no"
          frameBorder="0"
          className="border-0 mx-auto"
          style={{
            border: 0,
            width: "100%",
            maxWidth: "300px",
            height: "250px",
            borderRadius: "12px",
            overflow: "hidden",
          }}
          loading="lazy"
        />
      </div>
    </div>
  );
}
