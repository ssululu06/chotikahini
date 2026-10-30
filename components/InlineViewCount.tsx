"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

// Client-side in-memory cache to prevent duplicate fetch calls when cards re-render
const clientViewCache = new Map<string, number>();

export function InlineViewCount({ slug }: { slug: string }) {
  const [views, setViews] = useState<number>(() => (slug && clientViewCache.get(slug)) || 0);

  useEffect(() => {
    let isMounted = true;
    if (!slug) return;

    if (clientViewCache.has(slug)) {
      setViews(clientViewCache.get(slug)!);
      return;
    }

    try {
      fetch(`/api/views?slug=${encodeURIComponent(slug)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d && typeof d.views === "number") {
            clientViewCache.set(slug, d.views);
            if (isMounted) {
              setViews(d.views);
            }
          }
        })
        .catch(() => {});
    } catch (_) {}

    return () => { isMounted = false; };
  }, [slug]);

  return (
    <span 
      className="inline-flex items-center gap-1 text-xs font-semibold text-fg dark:text-zinc-200"
      title={`${views} বার পড়া হয়েছে`}
    >
      <Eye className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
      <span>{views}</span>
    </span>
  );
}
