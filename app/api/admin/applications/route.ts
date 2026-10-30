import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { authorized } = await requirePermission("authors.manage");
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: applications, error } = await supabase
      .from("author_applications")
      .select(`
        id, username, real_name, sample_link, message, status, created_at, reviewed_at,
        users:user_id ( id, name, email, profile_pic )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ applications: applications || [] });
  } catch (e) {
    return NextResponse.json({ applications: [] });
  }
}

export async function POST(req: Request) {
  try {
    const { authorized } = await requirePermission("authors.manage");
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getSession();
    const { action, appId } = await req.json();
    if (!action || !appId) {
      return NextResponse.json({ error: "Missing action or appId" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch the application
    const { data: app, error: fetchErr } = await supabase
      .from("author_applications")
      .select("*")
      .eq("id", appId)
      .single();

    if (fetchErr || !app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    // Update application status
    const { error: updateErr } = await supabase
      .from("author_applications")
      .update({
        status: newStatus,
        reviewer_id: session?.id || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", appId);

    if (updateErr) throw updateErr;

    // If approved → upgrade user role + send notification
    if (action === "approve" && app.user_id) {
      await supabase
        .from("users")
        .update({ role: "author" })
        .eq("id", app.user_id);

      // Send notification
      try {
        await supabase.from("notifications").insert({
          id: "notif_" + Date.now(),
          user_id: app.user_id,
          type: "author_approved",
          actor_id: session?.id || null,
          snippet: "আপনার লেখক আবেদন অনুমোদিত হয়েছে! এখন আপনি গল্প জমা দিতে পারবেন।",
          is_read: false,
        });
      } catch {}
    }

    logAudit(session, { action: "authors.manage", targetType: "author_application", targetId: appId, prevState: { status: app.status }, newState: { status: newStatus } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Admin application action error:", error);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
