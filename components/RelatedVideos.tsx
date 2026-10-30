import { getSupabaseAdmin } from "@/lib/supabase";
import { VideoCard, VideoRailItem } from "./VideoCard";

/**
 * "আরও ভিডিও" section for a single video page.
 *
 * Ranking is intentionally simple and explainable — `video_posts` has no tag
 * column, so we score purely on title/description token overlap, then let
 * recency and popularity break ties. Runs on the server, so the links are
 * crawlable and the section paints with zero extra client requests.
 */

interface Props {
  videoId: string;
  excludeId: string;
  title: string;
  limit?: number;
  /** "grid" for the mobile stacked view, "rail" for the desktop sidebar. */
  layout?: "grid" | "rail";
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "to", "for", "with",
  "video", "free", "com", "www", "http", "https", "html",
]);

function tokenize(input: string): string[] {
  return Array.from(
    new Set(
      input
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
    ),
  );
}

const baseColumns = "id, title, description, thumbnail_url, uploader_name, published_at";

export async function RelatedVideos({
  excludeId,
  title,
  limit = 4,
  layout = "grid",
}: Props) {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  // `view_count` is optional (scripts/video-views.sql) — fall back when the
  // column isn't there so the section never hard-fails.
  let { data, error } = await supabase
    .from("video_posts")
    .select(`${baseColumns}, view_count`)
    .eq("status", "published")
    .not("embed_url", "is", null)
    .lte("published_at", nowIso)
    .neq("id", excludeId)
    .order("published_at", { ascending: false })
    .limit(60);

  if (error) {
    const fallback = await supabase
      .from("video_posts")
      .select(baseColumns)
      .eq("status", "published")
      .not("embed_url", "is", null)
      .lte("published_at", nowIso)
      .neq("id", excludeId)
      .order("published_at", { ascending: false })
      .limit(60);
    if (fallback.error) {
      console.error("[videos] related query failed:", fallback.error);
      return null;
    }
    data = fallback.data as any;
  }

const candidates = (data || []) as Array<{
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    uploader_name?: string | null;
    published_at: string | null;
    view_count?: number | null;
  }>;

  if (candidates.length === 0) return null;

  const sourceTokens = tokenize(title);

  const scored = candidates.map((v) => {
    const tokens = tokenize(`${v.title} ${v.description || ""}`);
    const overlap = tokens.filter((t) => sourceTokens.includes(t)).length;
    // Recency tie-breaker, normalised to roughly 0..1 over a 90-day window.
    const ageDays = v.published_at
      ? (Date.now() - new Date(v.published_at).getTime()) / 86_400_000
      : 999;
    const recency = Math.max(0, 1 - ageDays / 90);
    // Popularity, log-scaled so one viral video can't dominate the list.
    const views = Number.isFinite(v.view_count) ? (v.view_count as number) : 0;
    const popularity = views > 0 ? Math.log10(views + 1) / 3 : 0;
    return { video: v, score: overlap * 10 + recency * 3 + popularity * 4 };
  });

  scored.sort((a, b) => b.score - a.score);

  const picked = scored.slice(0, limit).map(({ video }) => ({
    id: video.id,
    title: video.title,
    description: video.description,
    thumbnailUrl: video.thumbnail_url,
    publishedAt: video.published_at,
    uploaderName: video.uploader_name ?? null,
    viewCount: video.view_count ?? 0,
  }));

  if (picked.length === 0) return null;

  if (layout === "rail") {
    return (
      <section aria-label="আরও ভিডিও">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">
          <span className="h-4 w-1 rounded-full bg-blue-600 dark:bg-blue-400" />
          আরও ভিডিও
        </h2>
        <div className="space-y-0.5">
          {picked.map((video, i) => (
            <VideoRailItem key={video.id} video={video} rank={i + 1} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-12 border-t border-border pt-10" aria-label="আরও ভিডিও">
      <h2 className="mb-6 text-xl font-semibold text-fg">আরও ভিডিও</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        {picked.map((video) => (
          <VideoCard
            key={video.id}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            video={video}
          />
        ))}
      </div>
    </section>
  );
}