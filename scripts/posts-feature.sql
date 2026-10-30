-- ── 1. Posts table (short-form micro-posts, like Twitter/Reddit) ──
CREATE TABLE IF NOT EXISTS public.posts (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  story_slug TEXT,
  story_title TEXT,
  story_cover TEXT,
  likes_count INTEGER NOT NULL DEFAULT 0,
  reposts_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow admins/moderators to ban a user from posting (1 = can post, 0 = banned)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_post INTEGER NOT NULL DEFAULT 1;

-- ── 5. Post edit history (stored before each edit, admin can review) ──
CREATE TABLE IF NOT EXISTS public.posts_history (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  edited_by TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_posts_history_post ON public.posts_history(post_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);

-- ── 2. Post likes ──
CREATE TABLE IF NOT EXISTS public.posts_likes (
  post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_posts_likes_user ON public.posts_likes(user_id);

-- ── 3. Post reposts ──
CREATE TABLE IF NOT EXISTS public.posts_reposts (
  post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_posts_reposts_user ON public.posts_reposts(user_id);

-- ── 4. Post comments ──
CREATE TABLE IF NOT EXISTS public.posts_comments (
  id TEXT PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_posts_comments_post ON public.posts_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_posts_comments_user ON public.posts_comments(user_id);