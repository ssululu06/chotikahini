"use client";

import { CommentSection } from "@/components/comments/CommentSection";

/**
 * Comment block for a video detail page.
 *
 * This is a thin wrapper around the article `CommentSection` rather than a
 * parallel implementation. Both surfaces store rows in the same `comments`
 * table under a synthetic key — videos use `video:<uuid>`, stories use their
 * own slug — and `/api/comments` understands both forms. Sharing one
 * component means the composer, the spoiler toggle, reactions, reporting,
 * pinning and reply threading can never drift apart between the two.
 *
 * Pinning is intentionally disabled for videos (`authorId` is not passed):
 * there is no per-video "story author" role to grant it, so the control stays
 * admin-only, exactly as it is on articles.
 */
export function VideoComments({ videoId }: { videoId: string }) {
  return <CommentSection postSlug={`video:${videoId}`} />;
}