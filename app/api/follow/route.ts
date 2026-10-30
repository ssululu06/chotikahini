import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

// GET: get followers/following with user details for a given author
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const authorId = url.searchParams.get("authorId");

    const supabase = getSupabaseAdmin();

    if (authorId) {
      const { data: followers, count } = await supabase
        .from("user_follows")
        .select(`
          user_id, created_at,
          users:user_id ( username, name, profile_pic )
        `, { count: "exact" })
        .eq("author_id", authorId);

      const mappedFollowers = (followers || []).map((f: any) => ({
        userId: f.user_id,
        username: f.users?.username || "",
        name: f.users?.name || f.users?.username || "",
        profilePic: f.users?.profile_pic || null,
        createdAt: f.created_at,
      }));

      return NextResponse.json({ followers: mappedFollowers, count: count || 0 });
    }

    // If no authorId, return current user's following list with details
    const session = await getSession();
    if (!session) return NextResponse.json({ following: [], count: 0 });

    const { data: following, count } = await supabase
      .from("user_follows")
      .select(`
        author_id, created_at,
        authors:author_id ( username, name, profile_pic )
      `, { count: "exact" })
      .eq("user_id", session.id);

    const mappedFollowing = (following || []).map((f: any) => ({
      authorId: f.author_id,
      username: f.authors?.username || "",
      name: f.authors?.name || f.authors?.username || "",
      profilePic: f.authors?.profile_pic || null,
      createdAt: f.created_at,
    }));

    return NextResponse.json({ following: mappedFollowing, count: count || 0 });
  } catch {
    return NextResponse.json({ followers: [], following: [], count: 0 });
  }
}

// POST: follow or unfollow an author
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { authorId, action } = await req.json();
    if (!authorId || !["follow", "unfollow"].includes(action)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (authorId === session.id) {
      return NextResponse.json({ error: "নিজেকে ফলো করা যাবে না" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (action === "follow") {
      await supabase
        .from("user_follows")
        .upsert(
          { user_id: session.id, author_id: authorId },
          { onConflict: "user_id,author_id" }
        );
    } else {
      await supabase
        .from("user_follows")
        .delete()
        .eq("user_id", session.id)
        .eq("author_id", authorId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Follow action error:", error);
    return NextResponse.json({ error: "ফলো করতে সমস্যা হয়েছে" }, { status: 500 });
  }
}
