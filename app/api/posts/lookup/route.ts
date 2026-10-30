import { NextResponse } from "next/server";
import { normalizeRef } from "@/lib/posts";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { isAtLeast, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * GET /api/posts/lookup?ref=<slug | uid | full-url>
 * Returns the metadata (title, tags, category, author, cover, ...) of a
 * single post so editors can auto-import the previous post's details
 * (series linking).
 *
 * The story is fetched DIRECTLY from the stories table (no cached post
 * list), so a just-scheduled / just-published story is always found.
 *
 * Visibility: published posts are public. NOT-yet-published posts
 * (scheduled / pending) are only visible to the post's own author or an
 * admin/moderator — so a scheduled story's data can be imported by its
 * author for a series, but is never leaked to random visitors.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ref = searchParams.get("ref") || "";
    const q = normalizeRef(ref);
    if (!q) {
      return NextResponse.json({ error: "স্লাগ বা লিংক দিন।" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    // `content` is intentionally NOT selected: the response only returns
    // metadata, and pulling the full article body (up to ~65 KB) over the
    // wire only to discard it wasted bandwidth and JSON parsing on every
    // lookup. The visibility rules below are unchanged.
    const { data: post } = await supabase
      .from("stories")
      .select("uid, slug, title, description, category, tags, cover, author_id, previous_post, status, published_at, updated_at")
      .or(`slug.eq.${q},uid.eq.${q}`)
      .maybeSingle();

    if (!post) {
      return NextResponse.json({ error: "কোনো লেখা পাওয়া যায়নি।" }, { status: 404 });
    }

    // Resolve the author display name from the users table.
    let authorName = post.author_id || "";
    try {
      const { data: au } = await supabase
        .from("users")
        .select("name, username")
        .eq("id", post.author_id || "admin")
        .maybeSingle();
      if (au) authorName = au.name || au.username || post.author_id || "";
    } catch {}

    const isPublished = post.status === "published" && new Date(post.published_at || 0).getTime() <= Date.now();

    if (!isPublished) {
      const session = await getSession();
      const isAuthor = !!session && (session.id === post.author_id || session.username === post.author_id);
      const isAdmin = !!session && (isAtLeast(session.role, "moderator") || hasPermission(session.role, "story.review"));
      if (!isAuthor && !isAdmin) {
        return NextResponse.json({ error: "কোনো লেখা পাওয়া যায়নি।" }, { status: 404 });
      }
    }

    return NextResponse.json({
      uid: post.uid || "",
      slug: post.slug,
      title: post.title || "",
      description: post.description || "",
      tags: Array.isArray(post.tags) ? post.tags : [],
      category: post.category || "golpo",
      categoryName: post.category || "golpo",
      authorId: post.author_id || "admin",
      authorName,
      cover: post.cover || "",
      previousPost: post.previous_post ? post.previous_post.replace(/^\//, "") : null,
    });
  } catch (error: any) {
    console.error("Post lookup error:", error);
    return NextResponse.json({ error: "লেখা খুঁজে পাওয়া যায়নি।" }, { status: 500 });
  }
}
