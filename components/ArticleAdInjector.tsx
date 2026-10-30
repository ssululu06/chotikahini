"use client";

import { useEffect } from "react";
import { AD_300x250_HTML } from "@/lib/ad-config";

export function ArticleAdInjector({ source }: { source: string }) {
  useEffect(() => {
    // Find the container element
    const container = document.querySelector(".prose-custom");
    if (!container) return;

    // Find all direct children
    const children = Array.from(container.children);

    // Identify paragraph blocks that are eligible for ad insertion.
    // Must be top-level <p> tags, must contain text, and must NOT contain forbidden elements.
    const paragraphs: Element[] = [];
    children.forEach((child) => {
      if (child.tagName.toLowerCase() === "p") {
        const hasImg = child.querySelector("img") !== null;
        const hasSvg = child.querySelector("svg") !== null;
        const hasIframe = child.querySelector("iframe") !== null;
        const hasPre = child.querySelector("pre") !== null;
        const hasCode = child.querySelector("code") !== null;
        
        // Skip custom spacers or short/empty paragraphs
        if (child.classList.contains("blank-line-spacer")) return;

        const text = child.textContent?.trim() || "";

        if (!hasImg && !hasSvg && !hasIframe && !hasPre && !hasCode && text.length > 0) {
          paragraphs.push(child);
        }
      }
    });

    let adsInserted = 0;
    const maxAds = 3;

    // Insert ads evenly through the article paragraphs
    for (let i = 2; i < paragraphs.length; i += 4) {
      if (adsInserted >= maxAds) break;

      const p = paragraphs[i];
      const adId = `injected-article-ad-${adsInserted}`;

      // Prevent duplicate injection if we run multiple times
      if (document.getElementById(adId)) {
        adsInserted += 1;
        continue;
      }

      const adWrapper = document.createElement("div");
      adWrapper.id = adId;
      adWrapper.className = "article-ad my-8 flex flex-col items-center justify-center text-center mx-auto w-full max-w-full overflow-hidden min-h-[260px] rounded-2xl border border-border/70 bg-surface-alt/40 p-3";

      const label = document.createElement("div");
      label.className = "mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-subtle";
      label.textContent = "বিজ্ঞাপন";
      adWrapper.appendChild(label);

      const iframe = document.createElement("iframe");
      iframe.title = `Article Ad ${adsInserted + 1}`;
      iframe.srcdoc = AD_300x250_HTML;
      iframe.width = "300";
      iframe.height = "250";
      iframe.setAttribute("scrolling", "no");
      iframe.setAttribute("frameborder", "0");
      iframe.style.border = "0";
      iframe.style.width = "100%";
      iframe.style.maxWidth = "300px";
      iframe.style.height = "250px";
      iframe.style.borderRadius = "12px";
      iframe.style.overflow = "hidden";
      iframe.loading = "lazy";

      adWrapper.appendChild(iframe);

      if (p.nextSibling) {
        p.parentNode?.insertBefore(adWrapper, p.nextSibling);
      } else {
        p.parentNode?.appendChild(adWrapper);
      }

      adsInserted += 1;
    }

    // Clean up function on unmount / re-run
    return () => {
      for (let index = 0; index < maxAds; index += 1) {
        const ad = document.getElementById(`injected-article-ad-${index}`);
        if (ad) {
          ad.remove();
        }
      }
    };
  }, [source]);

  return null;
}
