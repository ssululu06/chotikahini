"use client";

import { useEffect, useState } from "react";
import { List, ChevronRight } from "lucide-react";

interface Heading {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents({ content }: { content: string }) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Parse h2 and h3 headers strictly from story content container to avoid widget/comment duplication
    const contentBox = document.querySelector(".prose-custom") || document.querySelector("article");
    if (!contentBox) return;

    const elements = Array.from(contentBox.querySelectorAll("h2, h3"));
    const seenTexts = new Set<string>();
    const items: Heading[] = [];

    elements.forEach((el, idx) => {
      const rawText = (el.textContent || "").trim();
      if (!rawText || seenTexts.has(rawText.toLowerCase())) return;
      seenTexts.add(rawText.toLowerCase());

      const id = el.id || `heading-${idx}`;
      el.id = id;
      items.push({
        id,
        text: rawText,
        level: el.tagName === "H2" ? 2 : 3,
      });
    });

    setHeadings(items);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "0px 0px -60% 0px" }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [content]);

  if (headings.length < 2) return null;

  return (
    <div className="my-6 border border-border bg-surface-alt rounded-2xl p-4 shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between font-bold text-sm text-fg"
      >
        <span className="flex items-center gap-2">
          <List className="w-4 h-4 text-accent" /> সূচিপত্র ({headings.length}টি অনুচ্ছেদ)
        </span>
        <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
      </button>

      {isOpen && (
        <nav className="mt-3 pt-3 border-t border-border space-y-1.5 text-xs">
          {headings.map((h) => (
            <a
              key={h.id}
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`block transition-colors py-1 px-2 rounded-lg ${
                h.level === 3 ? "pl-5" : ""
              } ${
                activeId === h.id
                  ? "bg-accent/10 text-accent font-semibold"
                  : "text-fg-muted hover:text-fg hover:bg-surface-hover"
              }`}
            >
              {h.text}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
