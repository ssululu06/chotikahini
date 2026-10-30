-- =============================================================
-- Crawler schedule setup — run this in Supabase SQL Editor.
-- Creates the site_settings table (missing piece) + seeds the
-- crawler schedule so crawled stories publish 1 per hour.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read site_settings" ON public.site_settings;
CREATE POLICY "Allow public read site_settings" ON public.site_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all anon" ON public.site_settings;
DROP POLICY IF EXISTS "Allow insert anon" ON public.site_settings;
DROP POLICY IF EXISTS "Allow update anon" ON public.site_settings;
DROP POLICY IF EXISTS "Allow delete anon" ON public.site_settings;
REVOKE ALL ON public.site_settings FROM anon;
REVOKE ALL ON public.site_settings FROM authenticated;

-- Seed the crawler schedule: 1 story per 60 minutes
INSERT INTO public.site_settings (key, value, updated_at)
VALUES (
  'crawler_config',
  jsonb_build_object(
    'intervalMinutes', 60,
    'lastPublishAt', to_char(now() - interval '61 minutes', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  ),
  now()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();
