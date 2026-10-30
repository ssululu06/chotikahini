"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, FileText, ArrowRight } from "lucide-react";
import type { PostMeta } from "@/lib/posts";

export function SearchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PostMeta[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setError("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const fetchResults = useCallback(async (value: string) => {
    abortRef.current?.abort();
    if (value.trim().length < 1) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Search request failed");
      const data: PostMeta[] = await res.json();
      setResults(data);
      setSelectedIndex(0);
    } catch {
      if (!controller.signal.aborted) {
        setResults([]);
        setError("সার্চ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults(query);
  }, [query, fetchResults]);

  const navigate = useCallback(
    (slug: string) => {
      router.push(`/${slug}`);
      onClose();
    },
    [router, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        navigate(results[selectedIndex].slug);
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [results, selectedIndex, navigate, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="search-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Search articles"
    >
      <div className="search-modal">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-fg-subtle" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="শিরোনাম, বিষয়বস্তু বা ট্যাগ খুঁজুন..."
            className="flex-1 py-4 bg-transparent text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
            autoComplete="off"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-border bg-surface-alt px-1.5 py-0.5 text-[10px] font-medium text-fg-subtle">
            <span>ESC</span>
          </kbd>
          <button
            onClick={onClose}
            className="btn-ghost p-1.5"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading && (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-fg-subtle">খোঁজা হচ্ছে...</p>
          </div>
        )}

        {!loading && error && (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-fg-subtle">{error}</p>
          </div>
        )}

        {!loading && !error && query.trim().length >= 1 && results.length === 0 && (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-fg-subtle">
              &ldquo;{query}&rdquo; &mdash; কোন ফলাফল পাওয়া যায়নি
            </p>
          </div>
        )}

        {results.length > 0 && (
          <ul className="max-h-[320px] overflow-y-auto py-2" role="listbox">
            {results.map((post, i) => (
              <li
                key={post.uid || post.slug}
                role="option"
                aria-selected={i === selectedIndex}
              >
                <button
                  onClick={() => navigate(post.uid || post.slug)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                    i === selectedIndex
                      ? "bg-surface-alt"
                      : "hover:bg-surface-alt"
                  }`}
                >
                  <FileText className="h-4 w-4 shrink-0 mt-0.5 text-fg-subtle" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg truncate">
                      {post.title}
                    </p>
                    <p className="text-xs text-fg-subtle truncate mt-0.5">
                      {post.description}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-1 text-fg-subtle" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {!loading && query.trim().length < 1 && (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-fg-subtle">
              অন্তত ১টি অক্ষর টাইপ করে খোঁজা শুরু করুন
            </p>
            <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-fg-subtle">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface-alt px-1.5 py-0.5 font-medium">
                  ↑
                </kbd>
                <kbd className="rounded border border-border bg-surface-alt px-1.5 py-0.5 font-medium">
                  ↓
                </kbd>
                <span>নেভিগেট</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface-alt px-1.5 py-0.5 font-medium">
                  ↵
                </kbd>
                <span>খুলুন</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface-alt px-1.5 py-0.5 font-medium">
                  ESC
                </kbd>
                <span>বন্ধ করুন</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
