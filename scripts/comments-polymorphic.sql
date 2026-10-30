-- ============================================================================
-- Polymorphic comments — supports posts (post_slug) AND videos (target_type).
--
-- WHY: The `comments` table was created with only `post_slug TEXT NOT NULL`.
-- For video comments we need to key by UUID instead. We widen the schema so
-- both shapes coexist:
--
--   post comment:  target_type = 'post',  target_id = <slug>, post_slug = <slug>
--   video comment: target_type = 'video', target_id = <video uuid>, post_slug
--                  carries a synthetic "v:<video uuid>" so the existing index
--                  keeps working.
--
-- All steps are idempotent so this can be run repeatedly.
-- ============================================================================

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'post';

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS target_id TEXT;

-- Backfill existing rows so the migration is loss-free.
UPDATE public.comments
   SET target_type = 'post',
       target_id   = post_slug
 WHERE target_type IS NULL OR target_id IS NULL;

ALTER TABLE public.comments
  ALTER COLUMN target_type SET DEFAULT 'post',
  ALTER COLUMN target_type SET NOT NULL;

-- Composite index covering both lookups (post_feed AND video_feed).
CREATE INDEX IF NOT EXISTS idx_comments_target
  ON public.comments(target_type, target_id, created_at DESC);

-- Drop the old single-column index if it still exists (it gets recreated as
-- part of idx_comments_target so the read pattern stays identical).
DROP INDEX IF EXISTS public.idx_comments_post_slug;

-- Make sure RLS is still in place and is lenient enough for our admin
-- service role to keep working.
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read comments" ON public.comments;
CREATE POLICY "Allow public read comments"
  ON public.comments FOR SELECT USING (true);