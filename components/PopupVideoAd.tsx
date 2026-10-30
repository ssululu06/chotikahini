"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function PopupVideoAd() {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pathname && pathname.startsWith("/admin")) return;

    const container = containerRef.current;
    if (!container) return;

    // Reset container and create a fresh clean <ins> tag with no prior state
    container.innerHTML = "";

    const ins = document.createElement("ins");
    ins.className = "eas6a97888e31";
    ins.setAttribute("data-zoneid", "5990126");
    container.appendChild(ins);

    const executeServe = () => {
      try {
        const win = window as any;
        win.AdProvider = win.AdProvider || [];
        win.AdProvider.push({ serve: {} });
      } catch (err) {
        console.error("[video-ad] serve error:", err);
      }
    };

    // Immediate serve request
    executeServe();

    // Fallback retry for asynchronous script hydration
    const timer = setTimeout(executeServe, 800);

    return () => {
      clearTimeout(timer);
    };
  }, [pathname]);

  if (pathname && pathname.startsWith("/admin")) return null;

  return <div ref={containerRef} id="popup-video-ad-container" suppressHydrationWarning />;
}
