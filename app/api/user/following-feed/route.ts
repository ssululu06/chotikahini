import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();

    // Get list of authors user follows (user_follows uses user_id/author_id)
    const { data: followData } = await supabase
      .from("user_follows")
      .select("author_id")
      .eq("user_id", session.id);

    if (!followData || followData.length === 0) {
      return NextResponse.json({ stories: [] });
    }

    const followingIds = followData.map((f: any) => f.author_id);

    // Get stories from followed authors (published only)
    const { data: stories } = await supabase
      .from("stories")
      .select("uid, slug, title, description, cover, category, tags, author_id, created_at, users(name, profile_pic, username)")
      .in("author_id", followingIds)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(30);

    const result = (stories || []).map((s: any) => ({
      uid: s.uid,
      slug: s.slug,
      title: s.title,
      description: s.description,
      cover: s.cover,
      category: s.category,
      tags: s.tags,
      authorId: s.author_id,
      authorUsername: s.users?.username || s.author_id,
      authorName: s.users?.name || s.users?.username || s.author_id,
      authorProfilePic: s.users?.profile_pic,
      createdAt: s.created_at,
    }));

    return NextResponse.json({ stories: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
