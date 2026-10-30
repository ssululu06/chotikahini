-- ============================================================
-- Cittakkho: Supabase Native Stories Schema & RLS Policies
-- ============================================================

-- 1. Create public.stories table for all new content
CREATE TABLE IF NOT EXISTS public.stories (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uid              TEXT UNIQUE NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT DEFAULT '',
  content          TEXT NOT NULL,
  author_id        TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  category         TEXT DEFAULT 'golpo',
  tags             TEXT[] DEFAULT '{}',
  cover            TEXT DEFAULT '',
  previous_post    TEXT DEFAULT '',
  status           TEXT DEFAULT 'published', -- 'published', 'pending', 'revision_requested', 'rejected', 'draft'
  featured         BOOLEAN DEFAULT false,
  history          JSONB DEFAULT '[]'::jsonb,
  rejection_reason TEXT DEFAULT '',
  published_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stories_slug        ON public.stories(slug);
CREATE INDEX IF NOT EXISTS idx_stories_uid         ON public.stories(uid);
CREATE INDEX IF NOT EXISTS idx_stories_author     ON public.stories(author_id);
CREATE INDEX IF NOT EXISTS idx_stories_status     ON public.stories(status);
CREATE INDEX IF NOT EXISTS idx_stories_category   ON public.stories(category);
CREATE INDEX IF NOT EXISTS idx_stories_published  ON public.stories(published_at DESC);

-- Enable Row Level Security
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Policy 1: Public read access for published stories
DROP POLICY IF EXISTS "Allow public read for published stories" ON public.stories;
CREATE POLICY "Allow public read for published stories"
  ON public.stories FOR SELECT
  USING (status = 'published');

-- Policy 2: Authors can read their own stories regardless of status
DROP POLICY IF EXISTS "Allow authors to read own stories" ON public.stories;
CREATE POLICY "Allow authors to read own stories"
  ON public.stories FOR SELECT
  USING (auth.uid()::text = author_id);

-- Policy 3: Admins can do anything
DROP POLICY IF EXISTS "Allow admins full access to stories" ON public.stories;
CREATE POLICY "Allow admins full access to stories"
  ON public.stories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()::text
      AND public.users.role IN ('admin', 'superadmin')
    )
  );

-- Link post_metadata table to stories if necessary
ALTER TABLE public.post_metadata ADD COLUMN IF NOT EXISTS story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE;

-- 12. Add reading_time column (computed from content at save time so list
-- queries don't need to fetch full bodies, which breaks Next.js caching)
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS reading_time TEXT DEFAULT '';

-- 13. Backfill reading_time for existing stories using the same 200 wpm estimate
-- the app's `reading-time` library uses (minimum 1 minute).
UPDATE public.stories
SET reading_time = GREATEST(1, CEIL(array_length(regexp_split_to_array(trim(content), '\s+'), 1)::numeric / 200))::text || ' min read'
WHERE (reading_time IS NULL OR reading_time = '')
  AND content IS NOT NULL
  AND length(trim(content)) > 0;
