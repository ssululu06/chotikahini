-- 1. Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT,
  role TEXT DEFAULT 'user',
  name TEXT,
  profile_pic TEXT,
  bio TEXT,
  saved_posts JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id TEXT PRIMARY KEY,
  post_slug TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  name TEXT,
  profile_pic TEXT,
  content TEXT NOT NULL,
  parent_comment_id TEXT,
  status TEXT DEFAULT 'approved',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_comments_post_slug ON public.comments(post_slug);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);

-- 3. Create likes table
CREATE TABLE IF NOT EXISTS public.post_likes (
  id TEXT PRIMARY KEY,
  post_slug TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  username TEXT,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_slug, user_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_post_slug ON public.post_likes(post_slug);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.post_likes(user_id);

-- 4. Create reactions table (for future use)
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_slug TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_slug, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reactions_post_slug ON public.post_reactions(post_slug);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON public.post_reactions(user_id);

-- 5. Create post_views table
CREATE TABLE IF NOT EXISTS public.post_views (
  post_slug TEXT PRIMARY KEY,
  view_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  actor_profile_pic TEXT,
  post_slug TEXT,
  comment_id TEXT,
  snippet TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);


-- 7. Create chat_messages table (Group Chat)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON public.chat_messages(created_at);

-- 8. Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user2_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user1_id, user2_id)
);

-- 9. Create private_messages table
CREATE TABLE IF NOT EXISTS public.private_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_conversation ON public.private_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_pm_sender_receiver ON public.private_messages(sender_id, receiver_id);

-- 9. Create bookmarks table
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_slug TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_slug, user_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON public.bookmarks(user_id);

-- 10. Create reading_history table
CREATE TABLE IF NOT EXISTS public.reading_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_slug TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_slug, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reading_history_user ON public.reading_history(user_id);

-- 11. Create user_follows table
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, author_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_user ON public.user_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_author ON public.user_follows(author_id);


-- Row Level Security (RLS) Setup
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_history ENABLE ROW LEVEL SECURITY;

-- Note: In this application, since we use custom Next.js JWT auth (setSession)
-- rather than Supabase Auth, the Supabase Anon key does not have a concept of auth.uid().
-- For secure operations, the Next.js server uses the SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
-- For client-side fetching where safe, we allow read access to everyone.

-- Allow public read access to comments, likes, reactions, views, users
-- SECURITY: users table is NOT publicly readable (contains emails/password hashes).
-- Profile data flows through server API routes using the service role key.
DROP POLICY IF EXISTS "Allow public read comments" ON public.comments;
CREATE POLICY "Allow public read comments" ON public.comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public read post_likes" ON public.post_likes;
CREATE POLICY "Allow public read post_likes" ON public.post_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public read post_reactions" ON public.post_reactions;
CREATE POLICY "Allow public read post_reactions" ON public.post_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public read post_views" ON public.post_views;
CREATE POLICY "Allow public read post_views" ON public.post_views FOR SELECT USING (true);
-- SECURITY: chat_messages are private — no public read policy.
-- Realtime chat requires authenticated per-user policies; use the API for reads.

-- Notifications, private_messages, bookmarks, reading_history are read only by the service role key, so no public read policy.

-- Create a function to automatically delete group chat messages older than 5 hours
CREATE OR REPLACE FUNCTION delete_old_group_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM public.chat_messages
  WHERE created_at < NOW() - INTERVAL '5 hours';
END;
$$ LANGUAGE plpgsql;

-- Announcements table — powers the site-wide announcement banner.
CREATE TABLE IF NOT EXISTS public.announcements (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text        TEXT NOT NULL DEFAULT '',
  active      BOOLEAN DEFAULT false,
  color       TEXT DEFAULT 'blue',
  link        TEXT DEFAULT '',
  created_by  TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read announcements" ON public.announcements;
CREATE POLICY "Allow public read announcements" ON public.announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all anon" ON public.announcements;
DROP POLICY IF EXISTS "Allow insert anon" ON public.announcements;
DROP POLICY IF EXISTS "Allow update anon" ON public.announcements;
DROP POLICY IF EXISTS "Allow delete anon" ON public.announcements;

-- If you have pg_cron enabled, you can run this to schedule it every hour:
-- SELECT cron.schedule('delete_old_group_messages_cron', '0 * * * *', 'SELECT delete_old_group_messages()');
