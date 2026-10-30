"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { AD_160x300_HTML } from "@/lib/ad-config";

export function GlobalBodyAdInjector() {
  const pathname = usePathname();

  useEffect(() => {
    // Disable ads on admin pages
    if (pathname && pathname.startsWith("/admin")) return;

    const renderStickyAd = (containerId: string, title: string) => {
      const container = document.getElementById(containerId);
      if (!container || container.querySelector("iframe")) return;

      container.innerHTML = "";
      const iframe = document.createElement("iframe");
      iframe.title = title;
      iframe.srcdoc = AD_160x300_HTML;
      iframe.width = "160";
      iframe.height = "300";
      iframe.setAttribute("scrolling", "no");
      iframe.setAttribute("frameborder", "0");
      iframe.style.border = "0";
      iframe.style.width = "160px";
      iframe.style.height = "300px";
      iframe.style.overflow = "hidden";
      iframe.loading = "lazy";
      container.appendChild(iframe);
    };

    renderStickyAd("sticky-ad-left", "বাম পাশের বিজ্ঞাপন");
    renderStickyAd("sticky-ad-right", "ডান পাশের বিজ্ঞাপন");
  }, [pathname]);

  return null;
}
