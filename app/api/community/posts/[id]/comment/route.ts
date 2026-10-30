import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const postId = Number(params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: comments, error } = await supabase
      .from("posts_comments")
      .select(`
        id, post_id, user_id, content, status, created_at, updated_at,
        users:user_id ( id, username, name, profile_pic, role, is_verified )
      `)
      .eq("post_id", postId)
      .neq("status", "hidden")
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      comments: (comments || []).map((c: any) => {
        const u = Array.isArray(c.users) ? c.users[0] : c.users;
        return {
          id: c.id,
          postId: c.post_id,
          userId: c.user_id,
          content: c.content,
          status: c.status,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          user: u
            ? {
                id: u.id,
                username: u.username,
                name: u.name,
                profilePic: u.profile_pic,
                role: u.role,
                isVerified: u.is_verified,
              }
            : null,
        };
      }),
    });
  } catch (error: any) {
    console.error("GET /api/community/posts/[id]/comment error:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "লগইন করুন" }, { status: 401 });

    const supabase = getSupabaseAdmin();

    // Banned users cannot comment
    const { data: actor } = await supabase
      .from("users")
      .select("can_post")
      .eq("id", session.id)
      .maybeSingle();
    if (actor && Number(actor.can_post) === 0) {
      return NextResponse.json({ error: "আপনাকে মন্তব্য করার অনুমতি দেওয়া নেই" }, { status: 403 });
    }

    const postId = Number(params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
    }

    const { content } = await req.json();
    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: "কমেন্ট খালি হতে পারে না" }, { status: 400 });
    }
    if (content.trim().length > 2000) {
      return NextResponse.json({ error: "কমেন্ট সর্বোচ্চ ২০০০ অক্ষর হতে পারে" }, { status: 400 });
    }

    const { data: post } = await supabase
      .from("posts")
      .select("id, user_id, comments_count")
      .eq("id", postId)
      .maybeSingle();

    if (!post) return NextResponse.json({ error: "পোস্টটি পাওয়া যায়নি" }, { status: 404 });

    const newCommentId = "pc_" + crypto.randomUUID().replace(/-/g, "").substring(0, 12);
    const urlRegex = /(https?:\/\/|www\.|[a-zA-Z0-9-]+\.(com|net|org|io|me|bd|cc|lol|tk|ml|ga|cf|gq|xyz|online|site|tech|info))/i;
    const containsLink = urlRegex.test(content.trim());
    const initialStatus = containsLink ? "hidden" : "approved";

    const { data: comment, error } = await supabase
      .from("posts_comments")
      .insert({
        id: newCommentId,
        post_id: postId,
        user_id: session.id,
        content: content.trim(),
        status: initialStatus,
      })
      .select("id, post_id, user_id, content, status, created_at, updated_at")
      .single();

    if (error) throw error;

    await supabase
      .from("posts")
      .update({ comments_count: (post.comments_count || 0) + 1 })
      .eq("id", postId);

    if (post.user_id && post.user_id !== session.id) {
      try {
        const snippet = content.trim();
        await supabase.from("notifications").insert({
          id: "notif_" + crypto.randomUUID().replace(/-/g, "").substring(0, 12),
          user_id: post.user_id,
          type: "post_comment",
          actor_id: session.id,
          snippet: snippet.length > 50 ? snippet.substring(0, 50) + "..." : snippet,
          is_read: false,
          created_at: new Date().toISOString(),
        });
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      pendingApproval: initialStatus === "hidden",
      comment: {
        id: comment.id,
        postId: comment.post_id,
        userId: comment.user_id,
        content: comment.content,
        status: comment.status,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        user: {
          id: session.id,
          username: session.username,
          name: session.name || session.username,
          profilePic: session.profilePic,
          role: session.role,
          isVerified: session.isVerified,
        },
      },
    });
  } catch (error: any) {
    console.error("POST /api/community/posts/[id]/comment error:", error);
    return NextResponse.json({ error: "কমেন্ট করতে ব্যর্থ" }, { status: 500 });
  }
}