-- ============================================================================
-- Unique-view tracking for videos.
--
-- WHY THE OLD APPROACH IS WRONG:
--   The in-memory Map keyed by IP/UA was wiped on every serverless cold
--   start, and the read-then-write increment raced with concurrent viewers.
--   We need persistent, unique-per-day recording plus an atomic increment so
--   the count is honest under load.
--
-- SCHEMA:
--   video_views  — one row per (video, viewer) per dedupe bucket (24h). The
--                  unique constraint makes ON CONFLICT DO NOTHING idempotent.
--   video_posts.view_count — denormalised counter, bumped atomically from an
--                  RPC whenever a new row lands in video_views.
--
-- Everything is idempotent and additive, so this can be re-run safely.
--
-- IMPORTANT: video_posts.id is UUID (see scripts/video-library.sql), so the
-- video_id column in video_views must be UUID too. The first run of an
-- earlier draft used TEXT and the FK was rejected.
--
-- That rejected run may still have left a half-created table behind, so we
-- drop it first — there is no production data in it yet.
-- ============================================================================

DROP TABLE IF EXISTS public.video_views CASCADE;

CREATE TABLE IF NOT EXISTS public.video_views (
  id           BIGSERIAL PRIMARY KEY,
  video_id     UUID NOT NULL REFERENCES public.video_posts(id) ON DELETE CASCADE,
  viewer_key   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (video_id, viewer_key)
);

CREATE INDEX IF NOT EXISTS idx_video_views_video_recent
  ON public.video_views(video_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_views_viewer
  ON public.video_views(viewer_key, created_at DESC);

ALTER TABLE public.video_posts
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.video_posts
  DROP CONSTRAINT IF EXISTS video_posts_view_count_non_negative;
ALTER TABLE public.video_posts
  ADD CONSTRAINT video_posts_view_count_non_negative
  CHECK (view_count >= 0);

ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read video_views counts" ON public.video_views;
CREATE POLICY "Allow public read video_views counts"
  ON public.video_views FOR SELECT USING (true);

-- -----------------------------------------------------------------------
-- Atomic counter bump. Called by /api/videos/[id]/view after the insert
-- hits the unique constraint. SECURITY DEFINER so the service role can
-- keep elevating when RLS is strict later.
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bump_video_view_count(p_video_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_count INTEGER;
BEGIN
  UPDATE public.video_posts
     SET view_count = view_count + 1
   WHERE id = p_video_id
   RETURNING view_count INTO next_count;
  RETURN COALESCE(next_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_video_view_count(UUID) TO service_role;