"use client";

import { useCallback, useRef, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { useTheme } from "./ThemeProvider";

const GISCUS_ATTRS = {
  src: "https://giscus.app/client.js",
  "data-repo": "",
  "data-repo-id": "",
  "data-category": "Announcements",
  "data-category-id": "",
  "data-mapping": "pathname",
  "data-strict": "0",
  "data-reactions-enabled": "1",
  "data-emit-metadata": "0",
  "data-input-position": "bottom",
  "data-lang": "bn",
  crossorigin: "anonymous",
  async: "",
};

export function GiscusComments() {
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const { theme } = useTheme();

  const loadGiscus = useCallback(() => {
    if (initialized.current || !ref.current) return;
    initialized.current = true;

    const script = document.createElement("script");
    Object.entries(GISCUS_ATTRS).forEach(([key, value]) => {
      script.setAttribute(key, value);
    });
    ref.current.appendChild(script);
  }, []);

  useEffect(() => {
    if (ref.current && !ref.current.querySelector("script")) {
      loadGiscus();
    }
  }, [loadGiscus]);

  return (
    <section className="mt-12 pt-10 border-t border-border">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-fg mb-6">
        <MessageCircle className="h-5 w-5" />
        মন্তব্য
      </h2>
      <div ref={ref} />
      <p className="text-xs text-fg-subtle mt-4">
        * Giscus কাজ করতে GitHub রিপোজিটরি কনফিগারেশন প্রয়োজন।
        বিস্তারিত{' '}
        <a
          href="https://giscus.app"
          target="_blank"
          rel="noopener noreferrer"
          className="link"
        >
          giscus.app
        </a>
      </p>
    </section>
  );
}
