import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { authorized } = await requirePermission("audit_logs.view");
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: logs } = await supabase
      .from("admin_audit_logs")
      .select("id, actor_id, actor_username, action, target_type, target_id, prev_state, new_state, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    return NextResponse.json({ logs: logs || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}