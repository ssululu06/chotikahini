"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Eye, Heart, Flame } from "lucide-react";
import { enToBnNumber } from "@/lib/utils";

interface TrendingPost {
  slug: string;
  uid?: string;
  title: string;
  cover: string | null;
  categoryName: string;
  likeCount: number;
  viewCount: number;
}

export function TrendingPosts() {
  const [posts, setPosts] = useState<TrendingPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trending")
      .then(r => r.ok ? r.json() : { trending: [] })
      .then(d => setPosts(d.trending || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-12 bg-surface-alt rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {posts.map((post, i) => (
        <Link
          key={post.uid || post.slug}
          href={`/${post.uid || post.slug}`}
          className="flex items-center gap-3 p-2.5 rounded-xl bg-surface border border-border hover:border-fg/30 transition-all group"
        >
          <span className="text-base font-bold text-fg-subtle w-5 text-center leading-none flex-shrink-0">
            {enToBnNumber(i + 1)}
          </span>
          {post.cover ? (
            <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 border border-border relative">
              <Image src={post.cover} alt={post.title} width={36} height={36} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-lg bg-surface-alt flex items-center justify-center flex-shrink-0 text-fg-subtle">
              <Flame className="w-4 h-4" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-fg group-hover:text-fg-muted transition-colors line-clamp-1">
              {post.title}
            </p>
            {post.categoryName && (
              <p className="text-[10px] text-fg-subtle mt-0.5">{post.categoryName}</p>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-fg-muted flex-shrink-0">
            <span className="flex items-center gap-1" title="মোট ভিউ">
              <Eye className="w-3.5 h-3.5" />
              <span>{enToBnNumber(post.viewCount)}</span>
            </span>
            {post.likeCount > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                <span>{enToBnNumber(post.likeCount)}</span>
              </span>
            )}
            </div>
        </Link>
      ))}
    </div>
  );
}
