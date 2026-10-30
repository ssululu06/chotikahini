-- =============================================================
-- Cittakkho — SECURITY HARDENING MIGRATION (safe & idempotent)
-- Run this in the Supabase SQL Editor AFTER setup-supabase.sql.
--
-- SCOPE (minimal & safe):
--   Only closes the CRITICAL leak: the `users` table was publicly
--   readable, exposing every user's email and password_hash via the
--   anon key. Everything else (chat, notifications, etc.) is left
--   working as the application depends on it.
--
--   The app reads/writes ALL data through server API routes using
--   the SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS — so closing
--   public read on users does NOT break the site.
-- =============================================================

-- ── 1. USERS — revoke public read (emails / password_hash!) ──
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Allow public read users" ON public.users;
    DROP POLICY IF EXISTS "Allow all anon" ON public.users;
    DROP POLICY IF EXISTS "Allow insert anon" ON public.users;
    DROP POLICY IF EXISTS "Allow update anon" ON public.users;
    DROP POLICY IF EXISTS "Allow delete anon" ON public.users;
    REVOKE ALL ON public.users FROM anon;
    REVOKE ALL ON public.users FROM authenticated;
  END IF;
END $$;

-- ── 2. BLOCK ANON WRITES on sensitive tables (reads stay open) ──
-- Comments/likes/views are still publicly readable (UI needs them).
-- No table's public READ is removed here except `users`.
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'comments','post_likes','post_reactions','post_views',
    'notifications','chat_messages','conversations','private_messages',
    'bookmarks','reading_history','reports','story_progress',
    'verification_requests','deletion_requests','author_applications',
    'admin_audit_logs','comment_reactions','story_coauthors','user_follows',
    'post_metadata','page_visits','announcements'
  ]
  LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "Allow all anon" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Allow insert anon" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Allow update anon" ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Allow delete anon" ON public.%I', tbl);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon', tbl);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', tbl);
    END IF;
  END LOOP;
END $$;

-- Service role key keeps full access (not affected by REVOKE).
-- NOTE: chat_messages public READ is intentionally preserved so the
-- live chat Realtime subscription keeps working. If you want fully
-- private chat, implement Supabase Auth + per-user RLS policies.

-- ── 3. RESTORE chat read if an earlier hardening script dropped it ──
DO $$
BEGIN
  IF to_regclass('public.chat_messages') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Allow public read chat_messages" ON public.chat_messages;
    CREATE POLICY "Allow public read chat_messages" ON public.chat_messages FOR SELECT USING (true);
  END IF;
END $$;
