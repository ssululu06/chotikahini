"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import type { PostMeta } from "@/lib/posts";
import { PostCard } from "./PostCard";
import { AdSlot } from "./AdSlot";

import { AD_300x250_HTML } from "@/lib/ad-config";

const SEARCH_AD_HTML = AD_300x250_HTML;

const KNOWN_CATEGORIES = [
  { id: "golpo", name: "গল্প" },
  { id: "hot", name: "গরম গল্প" },
  { id: "prem", name: "প্রেম" },
  { id: "real", name: "রিয়াল লাইফ" },
  { id: "aloukik", name: "অলৌকিক" },
  { id: "thriller", name: "থ্রিলার" },
  { id: "romance", name: "রোমান্স" },
];

export function SearchInput() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [author, setAuthor] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState<PostMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const buildUrl = useCallback((value: string, cat: string, tg: string, auth: string) => {
    const params = new URLSearchParams();
    if (value.trim().length >= 1) params.set("q", value.trim());
    if (cat) params.set("category", cat);
    if (tg) params.set("tag", tg);
    if (auth) params.set("author", auth);
    return `/api/search?${params.toString()}`;
  }, []);

  const runSearch = useCallback(async (value: string, cat: string, tg: string, auth: string) => {
    abortRef.current?.abort();
    const hasAny = value.trim().length >= 1 || cat || tg || auth;
    if (!hasAny) {
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
      const res = await fetch(buildUrl(value, cat, tg, auth), {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Search request failed");
      const data: PostMeta[] = await res.json();
      setResults(data);
    } catch {
      if (!controller.signal.aborted) {
        setResults([]);
        setError("সার্চ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => {
    const id = setTimeout(() => runSearch(query, category, tag, author), 250);
    return () => clearTimeout(id);
  }, [query, category, tag, author, runSearch]);

  const clearAll = () => {
    setQuery("");
    setCategory("");
    setTag("");
    setAuthor("");
    setResults([]);
    setError("");
  };

  return (
    <div className="space-y-8">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="শিরোনাম, বিষয়বস্তু বা ট্যাগ খুঁজুন..."
          className="input-field pl-11 pr-20 py-3.5 text-sm placeholder:text-fg-subtle"
          autoFocus
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {(query || category || tag || author) && (
            <button
              onClick={clearAll}
              className="p-1.5 text-fg-subtle hover:text-fg transition-colors"
              aria-label="সব ফিল্টার মুছুন"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold ${
              showFilters || category || tag || author
                ? "bg-accent/10 text-accent"
                : "text-fg-subtle hover:text-fg hover:bg-surface-hover"
            }`}
            title="অ্যাডভান্সড ফিল্টার"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">ফিল্টার</span>
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-surface border border-border rounded-2xl animate-fade-in">
          <div>
            <label className="block text-[11px] font-bold text-fg-muted uppercase tracking-wider mb-1.5">ক্যাটাগরি</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field"
            >
              <option value="">সব ক্যাটাগরি</option>
              {KNOWN_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-fg-muted uppercase tracking-wider mb-1.5">ট্যাগ</label>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="যেমন: রোমান্স, থ্রিলার"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-fg-muted uppercase tracking-wider mb-1.5">লেখক</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="লেখকের নাম বা ইউজারনেম"
              className="input-field"
            />
          </div>
        </div>
      )}

      {(category || tag || author) && !showFilters && (
        <div className="flex flex-wrap gap-2">
          {category && (
            <button onClick={() => setCategory("")} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold">
              ক্যাটাগরি: {category} <X className="w-3 h-3" />
            </button>
          )}
          {tag && (
            <button onClick={() => setTag("")} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold">
              ট্যাগ: {tag} <X className="w-3 h-3" />
            </button>
          )}
          {author && (
            <button onClick={() => setAuthor("")} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold">
              লেখক: {author} <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {loading && (
        <p className="text-sm text-fg-subtle">খোঁজা হচ্ছে...</p>
      )}

      {!loading && error && (
        <div className="text-center py-16 rounded-2xl border border-border bg-surface-alt">
          <p className="text-sm text-fg-muted">{error}</p>
        </div>
      )}

      {!loading && !error && (query || category || tag || author) && results.length === 0 && (
        <div className="text-center py-16 rounded-2xl border border-border bg-surface-alt">
          <p className="text-sm text-fg-muted">
            {query ? `&ldquo;${query}&rdquo; &mdash; ` : ""}এই বিষয়ে কিছু খুঁজে পাওয়া যায়নি
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <p className="text-sm text-fg-muted">
          মোট {results.length}টি ফলাফল পাওয়া গেছে
        </p>
      )}

      {results.length > 0 && (
        <div className="card-grid">
          {results.flatMap((post, index) => {
            const items: React.ReactNode[] = [
              <PostCard key={post.uid || post.slug} post={post} />,
            ];
            if ((index + 1) % 4 === 0) {
              items.push(
                <AdSlot key={`search-ad-${index}`} id={`search-ad-${index}`} html={SEARCH_AD_HTML} />,
              );
            }
            return items;
          })}
        </div>
      )}
    </div>
  );
}
