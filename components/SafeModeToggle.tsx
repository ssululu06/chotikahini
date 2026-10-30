"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const STORAGE_KEY = "chittakkho_safe_mode";

/**
 * Global "Safe Mode" toggle — when ON, all post cover images are blurred
 * (better for public places). Preference is saved in localStorage and the
 * `safe-mode` class is applied to <html> so CSS can blur every cover.
 */
export function SafeModeToggle() {
  const [safe, setSafe] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) === "1";
      setSafe(saved);
      document.documentElement.classList.toggle("safe-mode", saved);
    } catch {}
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !safe;
    setSafe(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {}
    document.documentElement.classList.toggle("safe-mode", next);
  };

  if (!mounted) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 inset-x-0 pointer-events-none z-[70]">
      <div className="container-page flex justify-start">
        <button
          type="button"
          onClick={toggle}
          className={`pointer-events-auto inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold shadow-lg border transition-all ${
            safe
              ? "bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700"
              : "bg-surface text-fg border-border hover:bg-surface-hover"
          }`}
          title={safe ? "সেফ মোড চালু — কভার ব্লার করা আছে" : "সেফ মোড বন্ধ — কভার ব্লার বন্ধ"}
          aria-pressed={safe}
        >
          {safe ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {safe ? "সেফ মোড" : "সেফ মোড বন্ধ"}
        </button>
      </div>
    </div>
  );
}
