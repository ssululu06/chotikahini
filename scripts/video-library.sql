-- Run once in the Supabase SQL Editor.
-- Video files are not uploaded or stored; only provider URLs and post metadata live here.
create table if not exists public.video_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  description text check (description is null or char_length(description) <= 500),
  source_url text check (source_url is null or source_url like 'https://%'),
  embed_url text check (embed_url is null or embed_url like 'https://%'),
  thumbnail_url text check (thumbnail_url is null or thumbnail_url like 'https://%'),
  credit text check (credit is null or char_length(credit) <= 160),
  status text not null default 'draft' check (status in ('draft', 'published', 'deleted')),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

-- Migrate the earlier upload-based table without deleting existing records.
alter table public.video_posts add column if not exists source_url text;
alter table public.video_posts add column if not exists embed_url text;
alter table public.video_posts add column if not exists thumbnail_url text;
alter table public.video_posts add column if not exists credit text;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'video_posts' and column_name = 'storage_path'
  ) then
    alter table public.video_posts alter column storage_path drop not null;
    alter table public.video_posts alter column content_type drop not null;
    alter table public.video_posts alter column file_size drop not null;
  end if;
end
$$;

create index if not exists video_posts_publication_idx
  on public.video_posts (published_at desc)
  where status = 'published';

alter table public.video_posts enable row level security;
