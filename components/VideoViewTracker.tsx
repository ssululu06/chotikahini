"use client";

import { useEffect } from "react";

/**
 * Fires a single POST to /api/videos/[id]/view when the page settles.
 *
 * The endpoint de-dupes per IP for 30 minutes so a single session doesn't
 * inflate the counter. Render this anywhere on the detail page — it has no
 * UI of its own.
 */
export function VideoViewTracker({ videoId }: { videoId: string }) {
  useEffect(() => {
    const id = setTimeout(() => {
      fetch(`/api/videos/${videoId}/view`, {
        method: "POST",
        keepalive: true,
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(id);
  }, [videoId]);
  return null;
}