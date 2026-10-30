"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function SavePostButton({ postSlug }: { postSlug: string }) {
  const { user, refreshSession, openAuthModal } = useAuth();
  const [loading, setLoading] = useState(false);

  const isSaved = user?.savedPosts?.includes(postSlug) || false;

  const toggleSave = async () => {
    if (!user) {
      openAuthModal();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/user/save-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postSlug })
      });

      if (res.ok) {
        await refreshSession();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleSave}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        isSaved 
          ? "bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20" 
          : "bg-surface-alt text-fg-muted hover:text-fg hover:bg-surface-hover border border-border"
      } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
      title={isSaved ? "Unsave Post" : "Save Post"}
    >
      <Bookmark className={`w-3.5 h-3.5 ${isSaved ? "fill-current" : ""}`} />
      {isSaved ? "Saved" : "Save"}
    </button>
  );
}
