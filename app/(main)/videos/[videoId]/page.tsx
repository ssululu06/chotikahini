import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Play, User } from "lucide-react";
import { buildMetadata } from "@/lib/metadata";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveEmbed } from "@/lib/embed-resolver";
import { isVideoSectionEnabled } from "@/lib/config";
import { VideoComments } from "@/components/VideoComments";
import { VideoLikeButton } from "@/components/VideoLikeButton";
import { RelatedVideos } from "@/components/RelatedVideos";
import { VideoViewTracker } from "@/components/VideoViewTracker";
import { VideoDetailMeta } from "@/components/VideoDetailMeta";
import { VideoDescriptionBox } from "@/components/VideoDescriptionBox";

interface VideoPageProps {
  params: { videoId: string };
}

interface PublishedVideo {
  id: string;
  title: string;
  description: string | null;
  source_url: string;
  embed_url: string;
  thumbnail_url: string | null;
  uploader_name: string | null;
  published_at: string | null;
  view_count?: number | null;
}

async function getPublishedVideo(videoId: string): Promise<PublishedVideo | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("video_posts")
    .select("id, title, description, source_url, embed_url, thumbnail_url, uploader_name, published_at")
    .eq("id", videoId)
    .eq("status", "published")
    .not("embed_url", "is", null)
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("[videos] detail query failed:", error);
    return null;
  }
  const video = (data as PublishedVideo | null) || null;
  if (!video) return null;

  // Self-heal legacy rows: some videos were saved before the save-time
  // normalisation existed, so `embed_url` still holds the provider's *watch*
  // page. Watch pages send `X-Frame-Options: SAMEORIGIN`, which is exactly
  // the "it used to play and now it doesn't" symptom — the frame refuses to
  // connect. `resolveEmbed` is a pure URL rewrite, so rewriting here fixes
  // those rows for every visitor without a data migration.
  const embedUrl = resolveEmbed(video.embed_url)?.embedUrl ?? video.embed_url;

  return { ...video, embed_url: embedUrl };
}

export async function generateMetadata({ params }: VideoPageProps): Promise<Metadata> {
  // When the video section is killed site-wide, every detail page is 404
  // — and so is the meta, so search engines see noindex and de-index.
  if (!isVideoSectionEnabled()) {
    return buildMetadata({ title: "ভিডিও পাওয়া যায়নি", robots: "noindex, nofollow" });
  }
  const video = await getPublishedVideo(params.videoId);
  if (!video) return buildMetadata({ title: "ভিডিও পাওয়া যায়নি", robots: "noindex, nofollow" });
  return buildMetadata({
    title: video.title,
    description: video.description || video.title,
    url: `/videos/${video.id}`,
    image: video.thumbnail_url || undefined,
  });
}

export default async function VideoDetailPage({ params }: VideoPageProps) {
  if (!isVideoSectionEnabled()) notFound();

  const video = await getPublishedVideo(params.videoId);
  if (!video) notFound();

  const supabase = getSupabaseAdmin();

  // Fire both counts in parallel — they're independent reads.
  const [likeRes, viewRes] = await Promise.all([
    supabase
      .from("post_likes")
      .select("id", { count: "exact", head: true })
      .eq("post_slug", `video:${video.id}`),
    supabase
      .from("video_posts")
      .select("view_count")
      .eq("id", video.id)
      .maybeSingle(),
  ]);

  const likeCount = likeRes.count ?? 0;
  // view_count is only present once scripts/video-views-unique.sql has run;
  // fall back to counting rows in video_views so the number is never blank.
  let viewCount = (viewRes.data as any)?.view_count ?? 0;
  if (!viewCount) {
    const { count } = await supabase
      .from("video_views")
      .select("id", { count: "exact", head: true })
      .eq("video_id", video.id);
    viewCount = count ?? 0;
  }

  return (
    <main className="min-h-[70vh] pb-16">
      <VideoViewTracker videoId={video.id} />

      <div className="container-page pt-4 sm:pt-6">
        <Link
          href="/videos"
          className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-fg-muted transition hover:bg-surface-hover hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          সব ভিডিও
        </Link>
      </div>

      {/* Two-column on desktop: sticky-ish player rail + sidebar of cards.
          On mobile it stacks — player first, then meta, then everything. */}
      <div className="container-page grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* ---------- Primary column ---------- */}
        <div className="min-w-0">
          <div className="overflow-hidden rounded-2xl bg-black shadow-xl ring-1 ring-black/10">
            <div className="aspect-video w-full">
              <iframe
                src={video.embed_url}
                title={video.title}
                referrerPolicy="no-referrer"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {video.uploader_name ? (
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-alt text-fg-muted">
                  <User className="h-4 w-4" />
                </span>
                <span className="font-latin text-[15px] font-semibold text-fg lg:text-base">
                  {video.uploader_name}
                </span>
              </div>
            ) : null}
            <h1 className="font-latin text-2xl font-bold leading-snug tracking-tight text-fg sm:text-[28px] lg:text-[32px]">
              {video.title}
            </h1>

            <VideoDetailMeta
              publishedAt={video.published_at}
              viewCount={viewCount}
              likeCount={likeCount}
            />

            <div className="flex flex-wrap items-center gap-3">
              <VideoLikeButton videoId={video.id} initialCount={likeCount} />
              <a
                href={video.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-surface-alt px-4 text-sm font-semibold text-fg transition hover:bg-surface-hover"
              >
                <Play className="h-4 w-4" />
                মূল সাইটে দেখুন
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </a>
            </div>

            <VideoDescriptionBox text={video.description} />
          </div>

          <VideoComments videoId={video.id} />
        </div>

        {/* ---------- Sidebar / related rail ---------- */}
        <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <RelatedVideos
            videoId={video.id}
            excludeId={video.id}
            title={video.title}
            layout="rail"
            limit={12}
          />
        </aside>
      </div>
    </main>
  );
}