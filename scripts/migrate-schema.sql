-- ============================================================
-- Cittakkho: Normalized Architecture Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. post_metadata: Canonical story identity table
-- Links MDX content (via uid/slug) to Supabase relational data
CREATE TABLE IF NOT EXISTS public.post_metadata (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mdx_uid      TEXT UNIQUE NOT NULL,
  slug         TEXT NOT NULL,
  author_id    TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  status       TEXT DEFAULT 'published',
  category     TEXT,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_slug    ON public.post_metadata(slug);
CREATE INDEX IF NOT EXISTS idx_pm_uid     ON public.post_metadata(mdx_uid);
CREATE INDEX IF NOT EXISTS idx_pm_author  ON public.post_metadata(author_id);
CREATE INDEX IF NOT EXISTS idx_pm_status  ON public.post_metadata(status);

-- 2. author_applications: Move from GitHub JSON to Supabase
CREATE TABLE IF NOT EXISTS public.author_applications (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  username     TEXT,
  real_name    TEXT,
  sample_link  TEXT,
  message      TEXT,
  status       TEXT DEFAULT 'pending',
  reviewer_id  TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_apps_user   ON public.author_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_apps_status ON public.author_applications(status);
-- Prevent multiple pending from same user
CREATE UNIQUE INDEX IF NOT EXISTS idx_apps_pending ON public.author_applications(user_id) WHERE status = 'pending';

-- 3. announcements: Move from private/announcement.json to Supabase
CREATE TABLE IF NOT EXISTS public.announcements (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text        TEXT NOT NULL DEFAULT '',
  active      BOOLEAN DEFAULT false,
  color       TEXT DEFAULT 'blue',
  link        TEXT DEFAULT '',
  created_by  TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. comment_reports: Move from private/reports.json to Supabase
CREATE TABLE IF NOT EXISTS public.comment_reports (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id   TEXT NOT NULL,
  post_slug    TEXT,
  reported_by  TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'pending',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, reported_by)
);
CREATE INDEX IF NOT EXISTS idx_reports_comment ON public.comment_reports(comment_id);
CREATE INDEX IF NOT EXISTS idx_reports_status  ON public.comment_reports(status);

-- 5. Add post_id FK columns to existing tables (alongside post_slug for backward compat)
ALTER TABLE public.comments        ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.post_metadata(id) ON DELETE CASCADE;
ALTER TABLE public.post_likes      ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.post_metadata(id) ON DELETE CASCADE;
ALTER TABLE public.post_reactions  ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.post_metadata(id) ON DELETE CASCADE;
ALTER TABLE public.bookmarks       ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.post_metadata(id) ON DELETE CASCADE;
ALTER TABLE public.reading_history ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.post_metadata(id) ON DELETE CASCADE;
ALTER TABLE public.notifications   ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.post_metadata(id) ON DELETE SET NULL;

-- 6. Add indexes for new FK columns
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_id    ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_post_id ON public.bookmarks(post_id);

-- 7. Replace post_views with a proper relational table (keeping old for migration)
-- New table: post_view_counts with FK to post_metadata
CREATE TABLE IF NOT EXISTS public.post_view_counts (
  post_id      UUID PRIMARY KEY REFERENCES public.post_metadata(id) ON DELETE CASCADE,
  view_count   INTEGER DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 8. RLS for new tables
ALTER TABLE public.post_metadata       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_view_counts    ENABLE ROW LEVEL SECURITY;

-- Public read for post_metadata, announcements and post_view_counts
DROP POLICY IF EXISTS "Allow public read post_metadata" ON public.post_metadata;
CREATE POLICY "Allow public read post_metadata" ON public.post_metadata FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read announcements" ON public.announcements;
CREATE POLICY "Allow public read announcements" ON public.announcements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read post_view_counts" ON public.post_view_counts;
CREATE POLICY "Allow public read post_view_counts" ON public.post_view_counts FOR SELECT USING (true);

-- 9. Seed current announcement from JSON (run after creating table)
-- INSERT INTO public.announcements (text, active, color, link)
-- VALUES ('', true, 'red', '');

-- 10. Function to backfill post_id from post_slug using post_metadata
CREATE OR REPLACE FUNCTION backfill_post_ids()
RETURNS void AS $$
BEGIN
  -- Backfill comments
  UPDATE public.comments c
  SET post_id = pm.id
  FROM public.post_metadata pm
  WHERE pm.slug = c.post_slug AND c.post_id IS NULL;

  -- Backfill likes
  UPDATE public.post_likes l
  SET post_id = pm.id
  FROM public.post_metadata pm
  WHERE pm.slug = l.post_slug AND l.post_id IS NULL;

  -- Backfill bookmarks
  UPDATE public.bookmarks b
  SET post_id = pm.id
  FROM public.post_metadata pm
  WHERE pm.slug = b.post_slug AND b.post_id IS NULL;

  -- Backfill reading_history
  UPDATE public.reading_history r
  SET post_id = pm.id
  FROM public.post_metadata pm
  WHERE pm.slug = r.post_slug AND r.post_id IS NULL;

  -- Backfill post_reactions
  UPDATE public.post_reactions pr
  SET post_id = pm.id
  FROM public.post_metadata pm
  WHERE pm.slug = pr.post_slug AND pr.post_id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Call after seeding post_metadata:
-- SELECT backfill_post_ids();

-- 11. Migrate post_views → post_view_counts (after seeding post_metadata)
-- INSERT INTO public.post_view_counts (post_id, view_count)
-- SELECT pm.id, COALESCE(pv.view_count, 0)
-- FROM public.post_metadata pm
-- LEFT JOIN public.post_views pv ON pv.post_slug = pm.slug
-- ON CONFLICT (post_id) DO UPDATE SET view_count = EXCLUDED.view_count;
