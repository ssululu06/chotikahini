-- ============================================================================
-- Fix stale two-segment embed URLs from the previous broken resolver.
--
-- ROOT CAUSE:
--   The old resolver produced URLs of the form
--     https://www.xvideos.com/embedframe/<id>/<title-slug>
--   which 404s. xvideos serves X-Frame-Options: SAMEORIGIN on the 404, which
--   surfaces to the visitor as "refused to connect".
--
--   The correct shape is /embedframe/<id> only (one segment), which returns
--   200 with no X-Frame-Options. We update existing rows accordingly.
--
-- IDEMPOTENT: only updates rows that match the broken pattern. Safe to re-run.
-- ============================================================================

-- xvideos: /embedframe/<id>/<slug>  ->  /embedframe/<id>
-- Use a regex to find the two-segment form with a non-empty title slug.
UPDATE public.video_posts
   SET embed_url = REGEXP_REPLACE(embed_url, '^https?://www\.xvideos\.com/embedframe/([a-z0-9]+)/[^/?#]+$', 'https://www.xvideos.com/embedframe/\1'),
       updated_at = NOW()
 WHERE embed_url ~ '^https?://www\.xvideos\.com/embedframe/([a-z0-9]+)/[^/?#]+$';
