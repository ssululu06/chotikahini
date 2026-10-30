"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Heart, Loader2 } from "lucide-react";

/**
 * Toggle-style like button for a single video.
 *
 * SSR ships an initial count so the page is meaningful on first paint; the
 * hook fetches `/api/videos/[id]/like` to learn whether the current viewer
 * already liked and POSTs to toggle.
 */

interface Props {
  videoId: string;
  initialCount: number;
}

export function VideoLikeButton({ videoId, initialCount }: Props) {
  const { user, openAuthModal } = useAuth();
  const [count, setCount] = useState<number>(initialCount);
  const [liked, setLiked] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  // Hydrate the "liked" state for the signed-in viewer on mount.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}/like`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (typeof data.count === "number") setCount(data.count);
        if (typeof data.likedByMe === "boolean") setLiked(data.likedByMe);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, videoId]);

  const toggle = async () => {
    if (busy) return;
    if (!user) {
      openAuthModal();
      return;
    }

    setBusy(true);
    // Optimistic update — reverts on failure.
    const wasLiked = liked;
    const wasCount = count;
    setLiked(!wasLiked);
    setCount(wasLiked ? Math.max(0, wasCount - 1) : wasCount + 1);

    try {
      const res = await fetch(`/api/videos/${videoId}/like`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("toggle_failed");
      const data = await res.json();
      if (typeof data.count === "number") setCount(data.count);
      if (typeof data.liked === "boolean") setLiked(data.liked);
    } catch {
      setLiked(wasLiked);
      setCount(wasCount);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={liked}
      aria-label={liked ? "লাইক সরান" : "লাইক দিন"}
      className={
        liked
          ? "inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:scale-105 active:scale-95"
          : "inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg-muted transition hover:scale-105 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-600 active:scale-95"
      }
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart
          className={"h-4 w-4 " + (liked ? "fill-current" : "")}
        />
      )}
      <span>{liked ? "লাইক করা হয়েছে" : "লাইক দিন"}</span>
      <span
        className={
          liked
            ? "rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-bold text-white"
            : "rounded-full border border-border px-1.5 py-0.5 text-[11px] font-bold text-fg"
        }
      >
        {bnNum(count)}
      </span>
    </button>
  );
}

function bnNum(n: number): string {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(n).replace(/[0-9]/g, (d) => digits[Number(d)]);
}