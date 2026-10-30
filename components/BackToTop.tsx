"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-35 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl
        bg-fg text-surface shadow-lg transition-all duration-200
        hover:opacity-80 active:scale-95
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
      aria-label="পৃষ্ঠার উপরে যান"
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
