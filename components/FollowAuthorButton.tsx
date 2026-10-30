"use client";

import { useState, useEffect } from "react";
import { UserPlus, UserCheck, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { enToBnNumber } from "@/lib/utils";

export function FollowAuthorButton({ authorId }: { authorId: string }) {
  const { user } = useAuth();
  const [followers, setFollowers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowingAction, setIsFollowingAction] = useState(false);

  useEffect(() => {
    fetch(`/api/follow?authorId=${authorId}`)
      .then(r => r.ok ? r.json() : { followers: [] })
      .then(d => setFollowers(d.followers || []))
      .catch(() => setFollowers([]))
      .finally(() => setLoading(false));
  }, [authorId]);

  const isSelf = user && (user.id?.toLowerCase() === authorId.toLowerCase() || user.username?.toLowerCase() === authorId.toLowerCase());
  const isFollowing = user ? followers.some(f => f.userId === user.id) : false;

  const toggleFollow = async () => {
    if (!user) {
      alert("ফলো করতে হলে আপনাকে লগিন করতে হবে।");
      return;
    }
    if (isFollowingAction) return;

    setIsFollowingAction(true);
    const action = isFollowing ? "unfollow" : "follow";

    // Optimistic update
    if (action === "follow") {
      setFollowers(prev => [...prev, { userId: user.id, authorId }]);
    } else {
      setFollowers(prev => prev.filter(f => f.userId !== user.id));
    }

    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorId, action })
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      // Revert optimistic update
      if (action === "unfollow") {
        setFollowers(prev => [...prev, { userId: user.id, authorId }]);
      } else {
        setFollowers(prev => prev.filter(f => f.userId !== user.id));
      }
    } finally {
      setIsFollowingAction(false);
    }
  };

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-fg-subtle">
        ...
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-xs text-fg-subtle">
        <Users className="w-3.5 h-3.5 text-fg-muted" />
        {enToBnNumber(followers.length)} জন ফলোয়ার
      </span>
      {!isSelf && (
        <button
          onClick={toggleFollow}
          disabled={isFollowingAction}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
            isFollowing
              ? "bg-surface-alt border border-border text-fg-muted hover:text-red-500"
              : "bg-fg text-surface hover:opacity-90 shadow-sm"
          }`}
        >
          {isFollowing ? (
            <>
              <UserCheck className="w-3.5 h-3.5" />
              ফলো করছেন
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" />
              ফলো করুন
            </>
          )}
        </button>
      )}
    </div>
  );
}
