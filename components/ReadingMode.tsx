"use client";

import { useState, useEffect } from "react";
import { BookOpen, X, Minus, Plus, Moon, Sun, RotateCcw } from "lucide-react";
import { ArticleContent } from "./ArticleContent";

interface ReadingModeProps {
  title: string;
  authorName: string;
  categoryName?: string;
  readingTime?: string;
  content: string;
}

export function ReadingMode({ title, authorName, categoryName, readingTime, content }: ReadingModeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(18); // px
  const [isDark, setIsDark] = useState(false);

  // Lock background scroll when reading mode is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-accent/10 text-accent hover:bg-accent hover:text-surface transition-all shadow-sm border border-accent/20"
        title="রিডিং মোড অন করুন"
      >
        <BookOpen className="w-4 h-4" />
        <span>রিডিং মোড</span>
      </button>

      {isOpen && (
        <div
          className={`fixed inset-0 z-50 overflow-y-auto transition-colors duration-300 ${
            isDark ? "bg-zinc-950 text-zinc-100" : "bg-amber-50/40 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {/* Top Control Header */}
          <div
            className={`sticky top-0 z-10 px-4 py-3 border-b backdrop-blur-md flex items-center justify-between gap-4 ${
              isDark
                ? "bg-zinc-900/90 border-zinc-800 text-zinc-200"
                : "bg-surface/90 border-border text-fg"
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <BookOpen className="w-5 h-5 text-accent shrink-0" />
              <div className="truncate">
                <p className="text-xs font-bold truncate">{title}</p>
                <p className="text-[10px] opacity-70 truncate">লেখক: @{authorName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Font Size decrease */}
              <button
                onClick={() => setFontSize((s) => Math.max(14, s - 2))}
                className="p-1.5 rounded-lg border border-border hover:bg-surface-hover transition-colors text-xs font-bold"
                title="লেখার আকার কমান"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <span className="text-xs font-mono px-1 font-bold">{fontSize}px</span>

              {/* Font Size increase */}
              <button
                onClick={() => setFontSize((s) => Math.min(32, s + 2))}
                className="p-1.5 rounded-lg border border-border hover:bg-surface-hover transition-colors text-xs font-bold"
                title="লেখার আকার বাড়ান"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              {/* Reset font size */}
              <button
                onClick={() => setFontSize(18)}
                className="p-1.5 rounded-lg border border-border hover:bg-surface-hover transition-colors text-xs opacity-70 hover:opacity-100"
                title="মূল ফন্ট রিসেট"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Dark / Light Toggle */}
              <button
                onClick={() => setIsDark((d) => !d)}
                className="p-1.5 rounded-lg border border-border hover:bg-surface-hover transition-colors"
                title={isDark ? "লাইট মোড" : "ডার্ক মোড"}
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-accent" />}
              </button>

              {/* Close Reading Mode */}
              <button
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-accent text-surface text-xs font-bold hover:opacity-90 transition-opacity ml-2"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">বন্ধ করুন</span>
              </button>
            </div>
          </div>

          {/* Clean Distraction-Free Reader Area */}
          <main className="max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-8">
            <header className="space-y-3 text-center border-b border-border/50 pb-8">
              {categoryName && (
                <span className="text-xs font-bold uppercase tracking-widest text-accent bg-accent/10 px-3 py-1 rounded-full">
                  {categoryName}
                </span>
              )}
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-snug">{title}</h1>
              <p className="text-sm opacity-80 font-medium">
                লেখক: <span className="font-bold">{authorName}</span> {readingTime && `• ${readingTime}`}
              </p>
            </header>

            <div
              style={{ fontSize: `${fontSize}px`, lineHeight: "1.95" }}
              className="prose-custom font-serif text-justify whitespace-pre-wrap leading-relaxed tracking-normal"
            >
              <ArticleContent source={content} />
            </div>

            <footer className="pt-10 border-t border-border/50 text-center space-y-4">
              <p className="text-sm font-bold text-accent">~ গল্প সমাপ্ত ~</p>
              <button
                onClick={() => setIsOpen(false)}
                className="px-6 py-2.5 rounded-2xl bg-accent text-surface font-bold text-sm hover:opacity-90 transition-all shadow-md"
              >
                রিডিং মোড থেকে বের হন
              </button>
            </footer>
          </main>
        </div>
      )}
    </>
  );
}
