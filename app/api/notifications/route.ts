import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Notifications are strictly per-recipient. Every role — including admin /
    // superadmin — only sees notifications whose `user_id` matches their own
    // session id. Previous versions matched by `username` or a literal
    // "superadmin" string, which leaked other users' notifications.
    const query = supabase
      .from("notifications")
      .select("id, user_id, type, actor_id, actor_name, actor_profile_pic, post_slug, post_id, comment_id, snippet, is_read, created_at")
      .eq("user_id", session.id);

    const { data: notifications, error } = await query
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    // Resolve actor names/pics in one extra query (actor_id has no FK in schema)
    let actorMap = new Map<string, { name: string; profilePic: string }>();
    try {
      const actorIds = [...new Set((notifications || []).map((n: any) => n.actor_id).filter(Boolean))];
      if (actorIds.length > 0) {
        const { data: actors } = await supabase
          .from("users")
          .select("id, name, username, profile_pic")
          .in("id", actorIds);
        if (actors) {
          for (const a of actors) {
            actorMap.set(a.id, { name: a.name || a.username || "", profilePic: a.profile_pic || null });
          }
        }
      }
    } catch (e) {}

    const formatted = (notifications || []).map((n: any) => ({
      id: n.id,
      userId: n.user_id,
      type: n.type,
      actorId: n.actor_id,
      actorName: n.actor_name || actorMap.get(n.actor_id)?.name || "কেউ",
      actorProfilePic: n.actor_profile_pic || actorMap.get(n.actor_id)?.profilePic || null,
      postSlug: n.post_slug,
      postId: n.post_id,
      commentId: n.comment_id,
      snippet: n.snippet,
      isRead: n.is_read,
      createdAt: n.created_at
    }));

    return NextResponse.json({ notifications: formatted });
  } catch (error: any) {
    console.error("GET notifications error:", error);
    return NextResponse.json({ error: "নোটিফিকেশন লোড করতে সমস্যা হয়েছে।" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const supabase = getSupabaseAdmin();

    if (body.markAllRead) {
      // Mark all notifications as read
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", session.id)
        .eq("is_read", false);
    } else if (body.id) {
      // Mark single notification as read
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", body.id)
        .eq("user_id", session.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH notifications error:", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
