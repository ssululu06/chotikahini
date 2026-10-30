import { NextResponse } from "next/server";
import { getAllPostsAsync } from "@/lib/posts";
import { CACHE_TAGS, cachedRead } from "@/lib/cache";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Public trending list (story metadata + counts only — no user data).
 * Served from the CDN so the sidebar widget does not invoke a function
 * on every page view. The internal `cachedRead` already keeps the DB
 * work to once per revalidate window across all instances.
 */
const TRENDING_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
  "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

const getTrending = cachedRead(
  "trending",
  async () => {
    const posts = await getAllPostsAsync();
    if (!posts.length) return [];

    const supabase = getSupabaseAdmin();
    // These tables grow with every like/view, so each read is bounded to
    // the number of published stories rather than pulling the full table.
    const postLimit = Math.max(posts.length * 5, 2000);
    const [
      { data: likes, error: likesError },
      { data: legacyViews, error: viewsError },
      { data: metadata, error: metadataError },
    ] = await Promise.all([
        supabase.from("post_likes").select("post_slug").limit(postLimit),
        supabase.from("post_views").select("post_slug, view_count").limit(postLimit),
        supabase.from("post_metadata").select("id, slug").limit(postLimit),
      ]);
    if (likesError) throw likesError;
    if (viewsError && viewsError.code !== "42P01" && viewsError.code !== "PGRST205") {
      throw viewsError;
    }
    if (metadataError && metadataError.code !== "42P01" && metadataError.code !== "PGRST205") {
      throw metadataError;
    }

    const likeCounts: Record<string, number> = {};
    const viewCounts: Record<string, number> = {};
    const normalizedViewCounts = new Map<string, number>();
    const metadataBySlug = new Map((metadata || []).map((row) => [row.slug, row.id]));
    for (const like of likes || []) {
      if (like.post_slug) likeCounts[like.post_slug] = (likeCounts[like.post_slug] || 0) + 1;
    }
    for (const view of legacyViews || []) {
      if (view.post_slug) viewCounts[view.post_slug] = view.view_count || 0;
    }
    let normalizedViewsAvailable = false;
    if (!metadataError && metadataBySlug.size > 0) {
      const { data: normalizedViews, error: normalizedViewsError } = await supabase
        .from("post_view_counts")
        .select("post_id, view_count")
        .limit(postLimit);
      if (normalizedViewsError && normalizedViewsError.code !== "42P01" && normalizedViewsError.code !== "PGRST205") {
        throw normalizedViewsError;
      }
      normalizedViewsAvailable = !normalizedViewsError;
      for (const view of normalizedViews || []) {
        normalizedViewCounts.set(view.post_id, view.view_count || 0);
      }
    }
    if (viewsError && !normalizedViewsAvailable) {
      throw viewsError;
    }

    const scoredPosts = posts.map((post) => {
      const likeCount = likeCounts[post.slug] || 0;
      const postId = metadataBySlug.get(post.slug);
      const viewCount =
        (postId ? normalizedViewCounts.get(postId) : undefined) ??
        viewCounts[post.slug] ??
        0;
      return {
        slug: post.slug,
        uid: post.uid,
        title: post.title,
        cover: post.cover || null,
        categoryName: post.categoryName || "",
        likeCount,
        viewCount,
      };
    });

    return scoredPosts
      .sort((a, b) => b.viewCount - a.viewCount || b.likeCount - a.likeCount)
      .slice(0, 5);
  },
  {
    revalidate: 15,
    tags: [CACHE_TAGS.posts],
    ttlMs: 5_000,
    staleMs: 0,
  },
);

export async function GET() {
  try {
    const trending = await getTrending();
    return NextResponse.json(
      { trending },
      { headers: TRENDING_CACHE_HEADERS },
    );
  } catch (error) {
    console.error("Trending fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch trending stories" }, { status: 500 });
  }
}
