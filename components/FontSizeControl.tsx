"use client";

import { useState, useEffect, useCallback } from "react";
import { Type } from "lucide-react";

export function FontSizeControl() {
  const [size, setSize] = useState<"sm" | "md" | "lg" | "xl">("md");
  const [visible, setVisible] = useState(false);

  const applySize = useCallback((s: string) => {
    const fontSizes: Record<string, string> = {
      sm: "15px",
      md: "18px",
      lg: "22px",
      xl: "26px"
    };
    
    const lineHeights: Record<string, string> = {
      sm: "1.6",
      md: "1.75",
      lg: "1.85",
      xl: "1.95"
    };

    const targetSize = fontSizes[s] || "18px";
    const targetLineHeight = lineHeights[s] || "1.75";

    document.documentElement.style.setProperty('--article-fs', targetSize);
    document.documentElement.style.setProperty('--article-lh', targetLineHeight);
  }, []);

  useEffect(() => {
    const saved = (localStorage.getItem("cittakkho_font_size") as "sm" | "md" | "lg" | "xl") || "md";
    setSize(saved);
    applySize(saved);
    
    // Slight delay to show widget after hydration
    setTimeout(() => {
      setVisible(true);
    }, 100);
  }, [applySize]);

  const changeSize = (newSize: "sm" | "md" | "lg" | "xl") => {
    setSize(newSize);
    localStorage.setItem("cittakkho_font_size", newSize);
    applySize(newSize);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-3 left-3 sm:bottom-6 sm:left-4 z-35 flex items-center gap-1 sm:gap-1.5 bg-surface/90 backdrop-blur-md border border-border rounded-full shadow-xl px-2 sm:px-3 py-1 sm:py-1.5">
      <Type className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-fg-muted" />
      <span className="text-xs text-fg-muted font-medium hidden sm:inline">ফন্ট:</span>
      {(["sm", "md", "lg", "xl"] as const).map((s, i) => {
        const labels = ["ছোট", "সাধারণ", "বড়", "খুব বড়"];
        const fontLabels = ["ক-", "ক", "ক+", "ক++"];
        return (
          <button
            key={s}
            onClick={() => changeSize(s)}
            className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-bold transition-all ${
              size === s 
                ? "bg-fg text-surface shadow-sm" 
                : "text-fg-muted hover:bg-surface-alt hover:text-fg"
            }`}
            title={`ফন্ট সাইজ: ${labels[i]}`}
          >
            {fontLabels[i]}
          </button>
        );
      })}
    </div>
  );
}
