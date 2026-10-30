import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { notifyAdmins } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "লগিন করুন" }, { status: 401 });

    const { targetType, targetId, reason } = await req.json();
    if (!targetType || !targetId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Prevent duplicate reports from same user
    const { data: existing } = await supabase
      .from("reports")
      .select("id")
      .eq("reporter_id", session.id)
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "আপনি ইতোমধ্যে এটি রিপোর্ট করেছেন।" }, { status: 409 });
    }

    await supabase.from("reports").insert({
      reporter_id: session.id,
      target_type: targetType,
      target_id: String(targetId),
      reason: reason || null,
    });

    // Notify every real admin/superadmin (FK-safe)
    await notifyAdmins(
      {
        type: "report",
        actorId: session.id,
        actorName: session.name || session.username,
        postSlug: targetType === "story" ? String(targetId) : null,
        commentId: targetType === "comment" ? String(targetId) : null,
        snippet: `${targetType === "story" ? "গল্প" : "কমেন্ট"} রিপোর্ট: ${reason || "কারণ উল্লেখ নেই"}`,
      },
      supabase
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
