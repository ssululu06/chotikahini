import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

// Returns all comments for the currently logged-in user, enriched with post titles
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: comments, error } = await supabase
      .from("comments")
      .select("*")
      .eq("user_id", session.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Build slug → title map from published posts
    const { getAllPosts } = await import("@/lib/posts");
    let slugTitleMap: Record<string, string> = {};
    try {
      const posts = getAllPosts({ includePending: true });
      for (const p of posts) {
        if (p.title) {
          if (p.slug) slugTitleMap[p.slug] = p.title;
          if (p.fileSlug) slugTitleMap[p.fileSlug] = p.title;
          if (p.uid) slugTitleMap[p.uid] = p.title;
        }
      }
    } catch {}

    const enriched = (comments || []).map((c: any) => ({
      id: c.id,
      postSlug: c.post_slug,
      userId: c.user_id,
      username: c.username,
      name: c.name,
      profilePic: c.profile_pic,
      content: c.content,
      parentCommentId: c.parent_comment_id,
      status: c.status,
      createdAt: c.created_at,
      postTitle: slugTitleMap[c.post_slug] || null,
    }));

    return NextResponse.json({ comments: enriched });
  } catch (error: any) {
    console.error("GET all comments error:", error);
    return NextResponse.json({ error: "মতামত লোড করতে সমস্যা হয়েছে।" }, { status: 500 });
  }
}
