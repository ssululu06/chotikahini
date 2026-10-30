-- ============================================================================
-- chat_messages schema expansion
--
-- WHY: app/api/chat/messages/route.ts inserts
--      (user_id, username, name, profile_pic, message, role)
--      but scripts/setup-supabase.sql created chat_messages with ONLY
--      (id, user_id, message, created_at).
--      Supabase PostgREST rejects the whole INSERT when unknown columns are
--      present, so nothing was ever persisted — the message only appeared
--      locally and vanished on refresh.
--
-- Also adds `is_system` so the publish→global-chat announcement can be posted
-- by a system/bot row instead of impersonating a real user.
--
-- Run this ONCE in Supabase SQL Editor. Idempotent.
-- ============================================================================

-- 1. Columns used by the insert path (profile_pic / name / username / role)
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS username    TEXT,
  ADD COLUMN IF NOT EXISTS name        TEXT,
  ADD COLUMN IF NOT EXISTS profile_pic TEXT,
  ADD COLUMN IF NOT EXISTS role        TEXT DEFAULT 'user';

-- 2. System/bot flag for automated announcements
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

-- 3. Relax the NOT NULL on user_id so a system row can exist without a user.
--    Kept as TEXT (no FK) so bot rows don't need a real users row.
--    NOTE: only drop it if the FK constraint blocks system inserts; the
--    current NOT NULL is handled by giving system rows a 'system' owner id.

-- 4. Index for the group-chat read path (latest N, ascending created_at)
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
  ON public.chat_messages(created_at DESC);

-- 5. Make sure public read stays available for the group chat feed
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read chat_messages" ON public.chat_messages;
CREATE POLICY "Allow public read chat_messages"
  ON public.chat_messages FOR SELECT USING (true);

-- 6. Realtime publication — the client subscribes to postgres_changes on this
--    table, so it must be in the `supabase_realtime` publication.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;

-- 7. Existing rows backfilled so reads of older messages keep working
UPDATE public.chat_messages
   SET username = COALESCE(username, 'unknown'),
       name     = COALESCE(name, username, 'unknown'),
       role     = COALESCE(role, 'user'),
       is_system= COALESCE(is_system, false)
 WHERE username IS NULL OR role IS NULL OR is_system IS NULL;