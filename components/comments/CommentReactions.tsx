"use client";

import { useState, useEffect, useCallback } from "react";
import { Heart, ThumbsUp, Laugh, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  commentId: string;
}

const REACTION_META: { key: string; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { key: "love", icon: Heart, label: "ভালোবাসা" },
  { key: "thumbs_up", icon: ThumbsUp, label: "পছন্দ" },
  { key: "laugh", icon: Laugh, label: "হাসি" },
  { key: "wow", icon: AlertCircle, label: "আশ্চর্য" },
];

export function CommentReactions({ commentId }: Props) {
  const { user, openAuthModal } = useAuth();
  const [reactions, setReactions] = useState<Record<string, { count: number; reacted: boolean }>>({});

  const fetchReactions = useCallback(() => {
    fetch(`/api/comments/reactions?commentId=${commentId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.reactions) setReactions(d.reactions);
      })
      .catch(() => {});
  }, [commentId]);

  useEffect(() => {
    fetchReactions();
  }, [commentId, user, fetchReactions]);

  const toggleReaction = async (emoji: string) => {
    if (!user) {
      openAuthModal();
      return;
    }

    const cur = reactions[emoji] || { count: 0, reacted: false };
    const nextReacted = !cur.reacted;
    const nextCount = nextReacted ? cur.count + 1 : Math.max(0, cur.count - 1);

    // Optimistic UI update
    setReactions((prev) => ({ ...prev, [emoji]: { count: nextCount, reacted: nextReacted } }));

    try {
      await fetch("/api/comments/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, emoji }),
      });
    } catch {
      fetchReactions();
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {REACTION_META.map(({ key, icon: Icon, label }) => {
        const { count = 0, reacted = false } = reactions[key] || {};
        return (
          <button
            key={key}
            onClick={() => toggleReaction(key)}
            title={label}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all border ${
              reacted
                ? "bg-accent/15 border-accent text-accent font-semibold scale-105"
                : "bg-surface-alt border-border text-fg-muted hover:border-fg/30 hover:text-fg"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {count > 0 && <span className="text-[11px] font-mono">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
