import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { notificationId } = await req.json();
    if (!notificationId) {
      return NextResponse.json({ error: "notificationId is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Only mark as read if (a) the notification belongs to this user and
    // (b) it isn't already read — this also avoids needless writes & keeps
    // `updated_at` honest when nothing changed. The `user_id` filter is a
    // privacy guard: a caller can never mutate another user's notifications.
    const { data: updated, error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", session.id)
      .neq("is_read", true)
      .select("id, is_read")
      .maybeSingle();

    if (error) throw error;

    // No row matched (id doesn't exist OR it belongs to a different user).
    // Surface that as 404 so the client can fall back to its local state
    // instead of assuming the mark-as-read succeeded.
    if (!updated) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, isRead: true });
  } catch (error: any) {
    console.error("Read notification error:", error);
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 });
  }
}
