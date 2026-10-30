-- ============================================================
-- ANALYTICS MIGRATION (run once in Supabase SQL Editor)
-- Adds:
--   1. page_visits  — raw visit log for unique-visitor & daily analytics
--   2. users.last_seen_at — "active user" tracking column
-- ============================================================

-- 1. Raw page visit log
CREATE TABLE IF NOT EXISTS public.page_visits (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL,                     -- story UID / slug / page path
  visitor_id TEXT NOT NULL,               -- anonymous browser visitor fingerprint
  user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL, -- logged-in user (if any)
  referrer TEXT,                          -- where the visitor came from
  user_agent TEXT,
  country TEXT,                           -- from Vercel x-vercel-ip-country header
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_visits_slug ON public.page_visits(slug, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_visits_visitor ON public.page_visits(visitor_id);
CREATE INDEX IF NOT EXISTS idx_page_visits_user ON public.page_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_page_visits_day ON public.page_visits(viewed_at);

ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;

-- Reads/writes happen server-side with the SERVICE ROLE key (bypasses RLS).
-- No public policy is created so raw visitor data is never exposed to the client.

-- 2. Active-user tracking column
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_last_seen_at ON public.users(last_seen_at);
