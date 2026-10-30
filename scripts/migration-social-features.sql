-- =============================================================
-- Cittakkho Social & Engagement Feature Migrations (Phase 3–4)
-- Run this in the Supabase SQL Editor AFTER setup-supabase.sql
-- =============================================================

-- 1. Comment Reactions (❤️👍😂😮) — one row per user per emoji per comment
CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON public.comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user ON public.comment_reactions(user_id);
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
-- SECURITY: closed — read-only via server API (service role key).

-- 2. User Report System — reports for stories & comments
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('story', 'comment')),
  target_id TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reporter_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
-- SECURITY: closed — read-only via server API (service role key).

-- 3. Comment Pinning — story author / admin can pin a comment
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_comments_pinned ON public.comments(is_pinned);

-- 3b. Spoiler Tag — comments can be flagged as spoilers and blurred
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_spoiler BOOLEAN DEFAULT false;

-- 4. Scheduled Publishing (Admin only) — auto-publish timestamp on stories
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_stories_scheduled ON public.stories(scheduled_at);

-- 5. Author Verification Badge ✓
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- 6. User XP (level system bonus points for future gamification)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;

-- 7. Story reading progress — per-user % completion for author analytics
CREATE TABLE IF NOT EXISTS public.story_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_slug TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  percent INTEGER DEFAULT 0 CHECK (percent BETWEEN 0 AND 100),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_slug, user_id)
);
CREATE INDEX IF NOT EXISTS idx_story_progress_slug ON public.story_progress(post_slug);
ALTER TABLE public.story_progress ENABLE ROW LEVEL SECURITY;
-- SECURITY: closed — read-only via server API (service role key).

-- 8. Co-Author Support — many-to-many authors per story
CREATE TABLE IF NOT EXISTS public.story_coauthors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  story_uid TEXT NOT NULL REFERENCES public.stories(uid) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_uid, user_id)
);
CREATE INDEX IF NOT EXISTS idx_story_coauthors_story ON public.story_coauthors(story_uid);
CREATE INDEX IF NOT EXISTS idx_story_coauthors_user ON public.story_coauthors(user_id);
ALTER TABLE public.story_coauthors ENABLE ROW LEVEL SECURITY;
-- SECURITY: closed — read-only via server API (service role key).

-- 9. Verification Requests — authors apply for the verified badge
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
-- SECURITY: closed — read-only via server API (service role key).

-- 10. Author Applications — regular users apply to become authors
CREATE TABLE IF NOT EXISTS public.author_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  username TEXT,
  real_name TEXT,
  sample_link TEXT,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
ALTER TABLE public.author_applications ENABLE ROW LEVEL SECURITY;
-- SECURITY: closed — read-only via server API (service role key).

-- 11. Deletion Requests — limited admins hide content; superadmin approves permanent delete
CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('story', 'comment', 'user')),
  target_id TEXT NOT NULL,
  requested_by TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;
-- SECURITY: closed — read-only via server API (service role key).

-- 12. Audit Log — lightweight record of sensitive administrative actions
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id TEXT,
  actor_username TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  prev_state JSONB,
  new_state JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.admin_audit_logs(created_at);
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
-- SECURITY: closed — read-only via server API (service role key).

-- 13. Categories — stored in the DB (GitHub JSON is no longer used)
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'feather',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read categories" ON public.categories;
CREATE POLICY "Allow public read categories" ON public.categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all anon" ON public.categories;
DROP POLICY IF EXISTS "Allow insert anon" ON public.categories;
DROP POLICY IF EXISTS "Allow update anon" ON public.categories;
DROP POLICY IF EXISTS "Allow delete anon" ON public.categories;
REVOKE ALL ON public.categories FROM anon;
REVOKE ALL ON public.categories FROM authenticated;

-- Seed with the default categories
INSERT INTO public.categories (id, name, icon, description) VALUES
  ('hot', 'গরম গল্প', 'feather', 'একদম ঝকঝকে রস বের করা মজার গল্প'),
  ('bodhu', 'গৃহ বধূ', 'feather', 'ঘরের বুকে নিয়ে গল্প'),
  ('tarona', 'যৌন তাড়না', 'feather', 'বয়স্ক বা ডিভোর্সিদের গল্প'),
  ('obibahito', 'অবিবাহিত', 'feather', 'অবিবাহিতদের কাহিনী'),
  ('bibahito', 'বিবাহিত', 'feather', 'বিবাহিত স্বামী-স্ত্রী এর কাহিনী'),
  ('porokiya', 'পরকিয়া', 'feather', 'কে কে ধোঁকা দিচ্ছে'),
  ('kumari', 'কুমারী', 'feather', 'সদ্য রূপ ঝলকানো মেয়েদের গল্প'),
  ('prem', 'প্রেম', 'feather', 'প্রেমিক-প্রেমিকাদের পরান জুড়ানো গল্প'),
  ('pesha', 'পেশাজীবী', 'feather', 'পেশাজীবী কপোতদের গল্প'),
  ('paribarik', 'পাবিবারিক', 'feather', 'পারিবারিক গল্প'),
  ('somokami', 'সমকামী', 'feather', 'সমকামীদের গল্প'),
  ('aloukik', 'অলৌকিক', 'feather', 'ভূত পরীদের নিয়ে গল্প')
ON CONFLICT (id) DO NOTHING;

-- 14. Site Settings — all site data (config, navigation) stored in the DB.
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read site_settings" ON public.site_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all anon" ON public.site_settings;
DROP POLICY IF EXISTS "Allow insert anon" ON public.site_settings;
DROP POLICY IF EXISTS "Allow update anon" ON public.site_settings;
DROP POLICY IF EXISTS "Allow delete anon" ON public.site_settings;
REVOKE ALL ON public.site_settings FROM anon;
REVOKE ALL ON public.site_settings FROM authenticated;

-- 15. Trusted Author — auto-approve submissions from trusted authors
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_trusted BOOLEAN DEFAULT false;

-- 16. Crawler Sources — auto-post monitoring of external story domains
CREATE TABLE IF NOT EXISTS public.crawler_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  category TEXT DEFAULT 'golpo',
  default_tags TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  last_crawled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(url)
);
ALTER TABLE public.crawler_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read crawler_sources" ON public.crawler_sources FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all anon" ON public.crawler_sources;
DROP POLICY IF EXISTS "Allow insert anon" ON public.crawler_sources;
DROP POLICY IF EXISTS "Allow update anon" ON public.crawler_sources;
DROP POLICY IF EXISTS "Allow delete anon" ON public.crawler_sources;
REVOKE ALL ON public.crawler_sources FROM anon;
REVOKE ALL ON public.crawler_sources FROM authenticated;

-- Add optional feed URL column to crawler_sources (RSS/Atom per source).
ALTER TABLE public.crawler_sources ADD COLUMN IF NOT EXISTS feed_url TEXT;
