import { NextResponse } from "next/server";
import { getAllPostsAsync } from "@/lib/posts";

export const dynamic = "force-dynamic";

/**
 * Public post index (slug / title / category / tags only — no user data).
 * Served from the CDN so repeat reads do not invoke the function; the
 * underlying data is already cached via lib/cache.ts and is invalidated
 * by `clearPostsCache()` on every story write.
 */
const POSTS_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
  "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

export async function GET() {
  const posts = await getAllPostsAsync();
  const minimalPosts = posts.map(p => ({
    slug: p.slug,
    title: p.title,
    categoryId: p.categoryId,
    categoryName: p.categoryName || p.categoryId,
    tags: p.tags || []
  }));
  return NextResponse.json(minimalPosts, {
    headers: POSTS_CACHE_HEADERS,
  });
}