import { getSupabaseAdmin } from "@/lib/supabase";
import { VIDEOS_PER_PAGE } from "@/lib/constants";

/**
 * Shared video listing primitive — used by `/videos` and the paginated
 * `/videos/page/[num]`. Returns the slice plus total count so the caller
 * can build pagination.
 *
 * Filters to *published* rows and to videos whose publish time has
 * arrived (lets admins schedule a future publish). Defaults to newest-
 * first so the first page is the freshest.
 */

export interface VideoListRow {
  id: string;
  title: string;
  description: string | null;
  source_url: string;
  embed_url: string;
  thumbnail_url: string | null;
  uploader_name: string | null;
  published_at: string;
  view_count?: number | null;
}

export interface VideoPage {
  videos: VideoListRow[];
  total: number;
  pageSize: number;
  page: number;
  totalPages: number;
}

const BASE_COLUMNS =
  "id, title, description, source_url, embed_url, thumbnail_url, uploader_name, published_at";

export async function listPublishedVideos({
  page = 1,
  pageSize = VIDEOS_PER_PAGE,
}: { page?: number; pageSize?: number } = {}): Promise<VideoPage> {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.max(1, Math.floor(pageSize));
  const offset = (safePage - 1) * safeSize;
  const upper = offset + safeSize;

  // One query with `range` so we don't double-count under concurrent
  // inserts. PostgREST range expects `range(start, end)` inclusive.
  let videos: VideoListRow[] | null = null;
  let total = 0;

  const paged = await supabase
    .from("video_posts")
    .select(`${BASE_COLUMNS}, view_count`, { count: "exact" })
    .eq("status", "published")
    .not("embed_url", "is", null)
    .lte("published_at", nowIso)
    .order("published_at", { ascending: false })
    .range(offset, upper - 1);

  if (!paged.error) {
    videos = (paged.data as unknown as VideoListRow[]) || null;
    total = paged.count ?? 0;
  } else {
    // Fallback: drop view_count (optional column, added by migration).
    const fb = await supabase
      .from("video_posts")
      .select(BASE_COLUMNS, { count: "exact" })
      .eq("status", "published")
      .not("embed_url", "is", null)
      .lte("published_at", nowIso)
      .order("published_at", { ascending: false })
      .range(offset, upper - 1);
    videos = (fb.data as unknown as VideoListRow[]) || null;
    total = fb.count ?? 0;
  }

  const rows = videos ?? [];
  const totalPages = Math.max(1, Math.ceil(total / safeSize));

  return {
    videos: rows,
    total,
    pageSize: safeSize,
    page: safePage,
    totalPages,
  };
}