-- scripts/video-description-uploader.sql
--
-- For every published video: append the uploader/channel name as the last
-- line of the `description` column, so the visible bottom of every
-- description credits the source channel.
--
-- Safe to run repeatedly — it only appends when the marker line is not
-- already present, so re-running this script is a no-op.
--
-- Run this in the Supabase SQL Editor.
--
-- What this script does NOT do:
--   * It does not modify or rewrite the original copy. The original text
--     stays above; a separator and one attribution line are appended below.
--   * It does not invent an uploader for rows where uploader_name is null.
--     Null stays null in description (we only annotate what we know).
--   * It does not change views/likes/comments columns.

update public.video_posts v
set description = coalesce(
  -- If description was null/empty, just emit the credit line on its own.
  nullif(v.description, ''),
  ''
)
|| case
     when v.uploader_name is null or v.uploader_name = '' then ''
     when v.description is null or v.description = '' then '— ' || v.uploader_name
     -- Skip the join if the description already ends with the credit line.
     when v.description ilike '%' || chr(8212) || ' ' || v.uploader_name
          then ''
     else E'\n\n' || chr(8212) || ' ' || v.uploader_name
   end
where v.status = 'published'
  and v.uploader_name is not null;
