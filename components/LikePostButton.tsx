"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function LikePostButton({ postSlug }: { postSlug: string }) {
  const { user } = useAuth();
  const [likes, setLikes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    async function fetchLikes() {
      try {
        const res = await fetch(`/api/likes?slug=${postSlug}`);
        if (res.ok) {
          const data = await res.json();
          setLikes(data.likes || []);
        }
      } catch (err) {
        console.error("Failed to fetch likes", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLikes();
  }, [postSlug]);

  const hasLiked = user ? likes.some(l => l.userId === user.id) : false;

  const toggleLike = async () => {
    if (!user) {
      alert("পছন্দ করতে হলে আপনাকে লগিন করতে হবে।");
      return;
    }
    if (isLiking) return;

    setIsLiking(true);
    const action = hasLiked ? "unlike" : "like";

    // Optimistic UI update
    if (action === "like") {
      setLikes(prev => [...prev, { userId: user.id, slug: postSlug }]);
    } else {
      setLikes(prev => prev.filter(l => l.userId !== user.id));
    }

    try {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: postSlug, action })
      });
      if (!res.ok) {
        throw new Error("Failed");
      }
    } catch (e) {
      // Revert optimistic update
      alert("দুঃখিত, কোনো একটি সমস্যা হয়েছে।");
      if (action === "unlike") {
        setLikes(prev => [...prev, { userId: user.id, slug: postSlug }]);
      } else {
        setLikes(prev => prev.filter(l => l.userId !== user.id));
      }
    } finally {
      setIsLiking(false);
    }
  };

  if (loading) {
    return (
      <button disabled className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
        <Heart className="w-4 h-4" />
        ...
      </button>
    );
  }

  return (
    <button
      onClick={toggleLike}
      disabled={isLiking}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
        hasLiked 
          ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40"
          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
      }`}
    >
      <Heart className={`w-4 h-4 ${hasLiked ? "fill-current" : ""}`} />
      <span>{likes.length > 0 ? likes.length : "পছন্দ করুন"}</span>
    </button>
  );
}
