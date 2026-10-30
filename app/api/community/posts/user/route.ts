import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { isVideoSectionEnabled } from "@/lib/config";
import { resolveVideosInText } from "@/lib/video-link-resolver";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);
    const offset = Number(searchParams.get("offset")) || 0;

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const videoOn = isVideoSectionEnabled();
    const { data: posts, error, count } = await supabase
      .from("posts")
      .select(`
        id, user_id, content, story_slug, story_title, story_cover, likes_count, reposts_count, comments_count, created_at, updated_at,
        users:user_id ( id, username, name, profile_pic, role, is_verified )
      `, { count: "exact" })
      .eq("user_id", userId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const session = await getSession();
    let likedMap: Record<number, boolean> = {};
    let repostedMap: Record<number, boolean> = {};

    if (session && posts && posts.length > 0) {
      const ids = posts.map((p: any) => p.id);
      const [likes, reposts] = await Promise.all([
        supabase.from("posts_likes").select("post_id").in("post_id", ids).eq("user_id", session.id),
        supabase.from("posts_reposts").select("post_id").in("post_id", ids).eq("user_id", session.id),
      ]);
      if (likes.data) likes.data.forEach((l: any) => { likedMap[l.post_id] = true; });
      if (reposts.data) reposts.data.forEach((r: any) => { repostedMap[r.post_id] = true; });
    }

    return NextResponse.json({
      posts: await Promise.all(
        (posts || []).map(async (p: any) => {
          const u = Array.isArray(p.users) ? p.users[0] : p.users;
          return {
            id: p.id,
            userId: p.user_id,
            content: p.content,
            likesCount: p.likes_count,
            repostsCount: p.reposts_count,
            commentsCount: p.comments_count,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
            liked: likedMap[p.id] || false,
            reposted: repostedMap[p.id] || false,
            videos: await resolveVideosInText(p.content || "", videoOn),
            story: p.story_slug
              ? { slug: p.story_slug, title: p.story_title || p.story_slug, cover: p.story_cover || null }
              : null,
            user: u
              ? { id: u.id, username: u.username, name: u.name, profilePic: u.profile_pic, role: u.role, isVerified: u.is_verified }
              : null,
          };
        }),
      ),
      total: count || 0,
      hasMore: (offset + limit) < (count || 0),
    });
  } catch (error: any) {
    console.error("GET /api/community/posts/user error:", error);
    return NextResponse.json({ error: "Failed to fetch user posts" }, { status: 500 });
  }
}