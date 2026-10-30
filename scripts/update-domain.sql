-- Update the canonical site URL in the site_settings table.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor) once.
--
-- This ensures the sitemap, robots.txt, Open Graph tags, and canonical
-- <link> all point to the new domain instead of the old Vercel URL.
--
-- NOTE: the app deep-merges this DB row over the built-in defaults, so a
-- partial row (missing themeColors/seo) is safe — defaults fill the gaps.

UPDATE site_settings
SET value = value || jsonb_build_object(
  'url', 'https://chotikahini.vercel.app/',
  'seo', COALESCE(value->'seo', '{}'::jsonb)
            || jsonb_build_object(
                 'canonicalUrl', 'https://chotikahini.vercel.app/',
                 'organization', COALESCE(value->'seo'->'organization', '{}'::jsonb)
                                  || jsonb_build_object('url', 'https://chotikahini.vercel.app/')
               )
)
WHERE key = 'config';

-- Verify (should print chotikahini.vercel.app)
SELECT key,
       value->>'url'            AS url,
       value->'seo'->>'canonicalUrl' AS canonical_url
FROM site_settings
WHERE key = 'config';
