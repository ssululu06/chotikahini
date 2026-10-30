-- ============================================================================
-- Video view counter + optional manual category.
--
-- WHY: `video_posts` currently has no way to record popularity, so the
-- "আরও ভিডিও" ranking had nothing but recency to work with. Adding a
-- denormalized counter keeps the read path a single indexed lookup instead
-- of a COUNT over an events table.
--
-- Both statements are idempotent.
-- ============================================================================

ALTER TABLE public.video_posts
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- Keep the counter non-negative even if a bad client sends one.
ALTER TABLE public.video_posts
  DROP CONSTRAINT IF EXISTS video_posts_view_count_non_negative;
ALTER TABLE public.video_posts
  ADD CONSTRAINT video_posts_view_count_non_negative
  CHECK (view_count >= 0);

-- Faster suggestion ranking: only published rows, newest first.
CREATE INDEX IF NOT EXISTS idx_video_posts_status_published
  ON public.video_posts(status, published_at DESC);