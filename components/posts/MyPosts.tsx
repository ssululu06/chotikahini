"use client";

import { useState, useEffect, useRef } from "react";
import { PostCard } from "@/components/posts/PostCard";
import { PostComposer } from "@/components/posts/PostComposer";
import type { Post } from "@/lib/posts-types";

export function MyPosts({ userId }: { userId?: string | null }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const userIdRef = useRef(userId);

  const loadPage = async (reset = false) => {
    const uid = userIdRef.current;
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const pageOffset = reset ? 0 : offsetRef.current;
    try {
      const res = await fetch(`/api/community/posts/user?userId=${encodeURIComponent(uid)}&limit=20&offset=${pageOffset}`);
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
  };

  useEffect(() => {
    userIdRef.current = userId;
    offsetRef.current = 0;
    loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handlePosted = (newPost: any) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handleDeleted = (id: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdated = (updated: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  return (
    <div className="space-y-4">
      <PostComposer onPosted={handlePosted} placeholder="নতুন পোস্ট লিখুন..." />

      {loading && posts.length === 0 ? (
        <div className="text-center py-10 text-fg-muted animate-pulse">লোড হচ্ছে...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-10 text-fg-muted">
          <p>আপনি এখনো কোনো পোস্ট করেননি।</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <button
          onClick={() => loadPage(false)}
          className="w-full py-3 text-sm font-medium text-fg-muted hover:text-fg bg-surface-alt hover:bg-surface-hover rounded-xl border border-border transition-colors"
        >
          আরও দেখুন...
        </button>
      )}
    </div>
  );
}