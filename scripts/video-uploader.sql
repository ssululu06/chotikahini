-- ============================================================================
-- Add `uploader_name` to video_posts so we can display the original
-- uploader / channel name on every card and detail page.
--
-- WHY: admin may add the video but the *actual* uploader on the source
-- platform (e.g. "NatashaRecords", "@coolguy420") is the content owner
-- the visitor cares about. Admin can type or overwrite it manually.
--
-- Both statements are idempotent.
-- ============================================================================

ALTER TABLE public.video_posts
  ADD COLUMN IF NOT EXISTS uploader_name TEXT;

ALTER TABLE public.video_posts
  DROP CONSTRAINT IF EXISTS video_posts_uploader_name_check;
ALTER TABLE public.video_posts
  ADD CONSTRAINT video_posts_uploader_name_check
  CHECK (uploader_name IS NULL OR char_length(uploader_name) <= 120);
