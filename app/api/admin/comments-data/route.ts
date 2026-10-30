import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/admin-auth";

export const dynamic = 'force-dynamic';

export async function GET() {
  const { authorized } = await requirePermission("comments.hide");
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: comments, error } = await supabase
      .from("comments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch story titles for post_slugs
    const { data: stories } = await supabase
      .from("stories")
      .select("slug, uid, title");

    const titleMap = new Map<string, { title: string; link: string }>();
    if (stories) {
      for (const s of stories) {
        const link = `/${s.uid || s.slug}`;
        if (s.slug) titleMap.set(s.slug, { title: s.title, link });
        if (s.uid) titleMap.set(s.uid, { title: s.title, link });
      }
    }

    const mappedComments = (comments || []).map((c: any) => {
      const storyInfo = titleMap.get(c.post_slug);
      return {
        id: c.id,
        postSlug: c.post_slug,
        postTitle: storyInfo?.title || `গল্প (${c.post_slug})`,
        postLink: storyInfo?.link || `/${c.post_slug}`,
        userId: c.user_id,
        username: c.username,
        name: c.name,
        profilePic: c.profile_pic,
        content: c.content,
        parentCommentId: c.parent_comment_id,
        status: c.status,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      };
    });

    return NextResponse.json({ comments: mappedComments });
  } catch (error: any) {
    console.error("Admin fetch comments error:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}
