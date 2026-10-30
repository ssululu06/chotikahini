import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/admin-auth";

export async function GET() {
  const { authorized } = await requirePermission("notifications.manage");
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: rawMessages, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("type", "contact_message")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch contact messages:", error);
      return NextResponse.json({ messages: [] });
    }

    const messages = (rawMessages || []).map((m) => {
      let details = { name: m.actor_name || "অজ্ঞাত", email: "", subject: "যোগাযোগ বার্তা", message: "" };
      try {
        if (m.snippet) {
          details = { ...details, ...JSON.parse(m.snippet) };
        }
      } catch (e) {}

      return {
        id: m.id,
        name: details.name || m.actor_name || "অজ্ঞাত",
        email: details.email || "",
        subject: details.subject || "যোগাযোগের বার্তা",
        message: details.message || m.snippet || "",
        isRead: m.is_read === true,
        createdAt: m.created_at,
      };
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Failed to fetch contact messages", error);
    return NextResponse.json({ messages: [] }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { authorized } = await requirePermission("notifications.manage");
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, isRead } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: Boolean(isRead) })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { authorized } = await requirePermission("notifications.manage");
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("notifications").delete().eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }
}
