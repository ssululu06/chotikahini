import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { authorized } = await requirePermission("reports.manage");
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: reports } = await supabase
      .from("reports")
      .select("id, reporter_id, target_type, target_id, reason, status, created_at")
      .order("created_at", { ascending: false });

    // Resolve reporter info in a separate query (avoids FK-schema dependency)
    let reporterMap = new Map<string, { username: string; name: string; profile_pic: string }>();
    try {
      const ids = [...new Set((reports || []).map((r: any) => r.reporter_id).filter(Boolean))];
      if (ids.length > 0) {
        const { data: reporters } = await supabase
          .from("users")
          .select("id, username, name, profile_pic")
          .in("id", ids);
        if (reporters) {
          for (const r of reporters) {
            reporterMap.set(r.id, { username: r.username, name: r.name, profile_pic: r.profile_pic });
          }
        }
      }
    } catch (e) {}

    const enriched = (reports || []).map((r: any) => ({
      id: r.id,
      reporter_id: r.reporter_id,
      target_type: r.target_type,
      target_id: r.target_id,
      reason: r.reason,
      status: r.status,
      created_at: r.created_at,
      reporter: reporterMap.get(r.reporter_id) || null,
    }));

    return NextResponse.json({ reports: enriched });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { authorized } = await requirePermission("reports.manage");
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, status } = await req.json();
    if (!id || !["pending", "reviewed", "dismissed"].includes(status)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    await supabase.from("reports").update({ status }).eq("id", id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}