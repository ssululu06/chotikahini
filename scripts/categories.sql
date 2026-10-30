-- =============================================================
-- Categories table (DB-based category management — replaces GitHub)
-- Run this standalone in the Supabase SQL Editor.
-- =============================================================

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

INSERT INTO public.categories (id, name, icon, description) VALUES
  ('hot', 'গরম গল্প', 'feather', 'একদম ঝকঝকে রস বের করা মজার গল্প'),
  ('bodhu', 'গৃহ বধূ', 'feather', 'ঘরের বুকে নিয়ে গল্প'),
  ('tarona', 'যৌন তাড়না', 'feather', 'বয়স্ক বা ডিভোর্সিদের গল্প'),
  ('obibahito', 'অবিবাহিত', 'feather', 'অবিবাহিতদের কাহিনী'),
  ('bibahito', 'বিবাহিত', 'feather', 'বিবাহিত স্বামী-স্ত্রী এর কাহিনী'),
  ('porokiya', 'পরকিয়া', 'feather', 'কে কে ধোঁকা দিচ্ছে'),
  ('kumari', 'কুমারী', 'feather', 'সদ্য রূপ ঝলকানো মেয়েদের গল্প'),
  ('prem', 'প্রেম', 'feather', 'প্রেমিক-প্রেমিকাদের পরান জুড়ানো গল্প'),
  ('pesha', 'পেশাজীবী', 'feather', 'পেশাজীবী কপোতদের গল্প'),
  ('paribarik', 'পাবিবারিক', 'feather', 'পারিবারিক গল্প'),
  ('somokami', 'সমকামী', 'feather', 'সমকামীদের গল্প'),
  ('aloukik', 'অলৌকিক', 'feather', 'ভূত পরীদের নিয়ে গল্প')
ON CONFLICT (id) DO NOTHING;
