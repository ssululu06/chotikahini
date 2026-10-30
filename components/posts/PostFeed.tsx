"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PostComposer } from "./PostComposer";
import { PostCard } from "./PostCard";
import { AdSlot } from "@/components/AdSlot";
import type { Post } from "@/lib/posts-types";
import { Flame, Clock } from "lucide-react";
import { AD_300x250_HTML } from "@/lib/ad-config";

const FEED_AD_HTML = AD_300x250_HTML;

interface PostFeedProps {
  initialPosts?: Post[];
  showComposer?: boolean;
  sort?: "latest" | "hot";
  adInterval?: number;
}

export function PostFeed({ initialPosts = [], showComposer = true, sort: initialSort = "latest", adInterval = 5 }: PostFeedProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [loading, setLoading] = useState(initialPosts.length === 0);
  const [sort, setSort] = useState<"latest" | "hot">(initialSort);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const sortRef = useRef(sort);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (reset = false) => {
    setLoading(true);
    const pageOffset = reset ? 0 : offsetRef.current;
    try {
      const res = await fetch(`/api/community/posts?sort=${sortRef.current}&limit=20&offset=${pageOffset}`);
      const json = await res.json();
      if (res.ok) {
        setPosts((prev) => (reset ? json.posts : [...prev, ...json.posts]));
        setHasMore(json.hasMore);
        offsetRef.current = reset ? json.posts.length : offsetRef.current + json.posts.length;
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }, []);

  // IntersectionObserver for infinite scroll (Facebook-style)
  useEffect(() => {
    if (!hasMore || loading) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadPage(false);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadPage]);

  useEffect(() => {
    sortRef.current = sort;
    offsetRef.current = 0;
    loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  const handlePosted = (newPost: any) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handleDeleted = (id: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdated = (updated: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const renderItems = () => {
    const items: React.ReactNode[] = [];
    posts.forEach((post, index) => {
      items.push(
        <PostCard key={post.id} post={post} onUpdated={handleUpdated} onDeleted={handleDeleted} />
      );
      if ((index + 1) % adInterval === 0) {
        items.push(
          <AdSlot key={`feed-ad-${index}`} id={`feed-ad-${index}`} html={FEED_AD_HTML} />
        );
      }
    });
    return items;
  };

  return (
    <div className="space-y-4">
      {showComposer && (
        <PostComposer onPosted={handlePosted} />
      )}

      <div className="flex items-center gap-1 bg-surface-alt rounded-2xl border border-border p-1 w-fit">
        <button
          onClick={() => setSort("latest")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
            sort === "latest" ? "bg-fg text-surface shadow-sm" : "text-fg-muted hover:text-fg"
          }`}
        >
          <Clock className="w-4 h-4" /> সাম্প্রতিক
        </button>
        <button
          onClick={() => setSort("hot")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
            sort === "hot" ? "bg-fg text-surface shadow-sm" : "text-fg-muted hover:text-fg"
          }`}
        >
          <Flame className="w-4 h-4" /> জনপ্রিয়
        </button>
      </div>

      {loading && posts.length === 0 ? (
        <div className="text-center py-12 text-fg-muted animate-pulse">পোস্ট লোড হচ্ছে...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-fg-muted">
          <p>এখনো কোনো পোস্ট নেই।</p>
          <p className="text-sm mt-1">প্রথম পোস্টটি করুন!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {renderItems()}
        </div>
      )}

      {/* Sentinel for infinite scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="h-4" />
      )}

      {loading && posts.length > 0 && (
        <div className="text-center py-4 text-sm text-fg-muted animate-pulse">আরও লোড হচ্ছে...</div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="text-center py-4 text-xs text-fg-subtle">সব পোস্ট দেখানো হয়েছে</div>
      )}
    </div>
  );
}