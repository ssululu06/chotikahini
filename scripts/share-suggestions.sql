-- ─────────────────────────────────────────────────────────────
-- Share Suggestions — daily rotation + cooldown tracking
--
-- Purpose: the admin "শেয়ার করার সাজেস্ট" panel ranks published
-- stories worth promoting. To avoid showing the same three stories
-- every single day, we log which stories were suggested and how
-- many times, so the ranking engine can:
--   • enforce a cooldown (a suggested story drops in priority)
--   • rotate through the backlog instead of repeating
--   • skip stories already shared recently
--
-- Run this in Supabase → SQL Editor. Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────

-- 1. Log of every suggestion the engine has ever served.
CREATE TABLE IF NOT EXISTS public.share_suggestion_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_slug   TEXT        NOT NULL,
  post_uid    TEXT,
  story_title TEXT,
  -- admin who viewed the suggestion panel
  actor_id    TEXT        REFERENCES public.users(id) ON DELETE SET NULL,
  score       NUMERIC(8,3),
  served_on   DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Rotation bookkeeping — one row per served-day per admin.
--    Guarantees "max N suggestions per day" even across refreshes
--    and multiple browser tabs.
CREATE TABLE IF NOT EXISTS public.share_suggestion_daily (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      TEXT        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  served_on     DATE        NOT NULL DEFAULT CURRENT_DATE,
  served_count  INTEGER     NOT NULL DEFAULT 0,
  served_slugs  TEXT[]      NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (actor_id, served_on)
);

CREATE INDEX IF NOT EXISTS idx_share_suggestion_log_slug
  ON public.share_suggestion_log (post_slug);
CREATE INDEX IF NOT EXISTS idx_share_suggestion_log_served_on
  ON public.share_suggestion_log (served_on DESC);
CREATE INDEX IF NOT EXISTS idx_share_suggestion_log_actor_day
  ON public.share_suggestion_log (actor_id, served_on DESC);

-- 3. RLS — admin-only. These tables are read/written exclusively by
--    service-role server routes after a permission check, so direct
--    anon/authenticated access is denied outright.
ALTER TABLE public.share_suggestion_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_suggestion_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct client access to share_suggestion_log"
  ON public.share_suggestion_log;
CREATE POLICY "No direct client access to share_suggestion_log"
  ON public.share_suggestion_log FOR ALL USING (false);

DROP POLICY IF EXISTS "No direct client access to share_suggestion_daily"
  ON public.share_suggestion_daily;
CREATE POLICY "No direct client access to share_suggestion_daily"
  ON public.share_suggestion_daily FOR ALL USING (false);

-- 4. Seed a synthetic row so the engine always has history context.
--    (Optional — safe to skip.)
-- INSERT INTO public.share_suggestion_log (post_slug, score)
-- VALUES ('__seed__', 0);