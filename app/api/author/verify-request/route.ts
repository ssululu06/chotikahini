import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { notifyAdmins } from "@/lib/notify";

export const dynamic = "force-dynamic";

// GET — check the current user's verification request status
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const { data: req } = await supabase
      .from("verification_requests")
      .select("id, reason, status, created_at")
      .eq("user_id", session.id)
      .maybeSingle();

    return NextResponse.json({ request: req || null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST — submit an application for the verified author badge
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { reason } = await req.json();
    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: "আবেদনের কারণ লিখুন।" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // All non-user roles (authors, admins, managers) can apply for the verified badge
    if (!session.role || session.role === "user") {
      return NextResponse.json({ error: "শুধুমাত্র লেখকগণ ভেরিফিকেশন ব্যাজের জন্য আবেদন করতে পারবেন।" }, { status: 403 });
    }

    const { data: existing } = await supabase
      .from("verification_requests")
      .select("id, status")
      .eq("user_id", session.id)
      .maybeSingle();

    if (existing) {
      if (existing.status === "pending") {
        return NextResponse.json({ error: "আপনার আবেদনটি ইতোমধ্যে পর্যালোচনায় রয়েছে।" }, { status: 409 });
      }
      if (existing.status === "approved") {
        return NextResponse.json({ error: "আপনার ব্যাজ ইতোমধ্যে অনুমোদিত হয়েছে।" }, { status: 409 });
      }
      // Rejected — allow resubmit by updating the existing row (UNIQUE user_id)
      const { error: updErr } = await supabase
        .from("verification_requests")
        .update({ reason: reason.trim(), status: "pending", created_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
      await notifyAdmins(
        {
          type: "verification_request",
          actorId: session.id,
          actorName: session.name || session.username,
          snippet: `ভেরিফিকেশন ব্যাজের নতুন আবেদন: @${session.username} — ${reason.trim().slice(0, 120)}`,
        },
        supabase
      );
      return NextResponse.json({ success: true, message: "ভেরিফিকেশন ব্যাজের আবেদনটি সফলভাবে জমা হয়েছে! অ্যাডমিন পর্যালোচনা করে অনুমোদন দেবেন।" });
    }

    await supabase.from("verification_requests").insert({
      user_id: session.id,
      reason: reason.trim(),
      status: "pending",
    });

    // Notify every real admin/superadmin (FK-safe)
    await notifyAdmins(
      {
        type: "verification_request",
        actorId: session.id,
        actorName: session.name || session.username,
        snippet: `ভেরিফিকেশন ব্যাজের আবেদন: @${session.username} — ${reason.trim().slice(0, 120)}`,
      },
      supabase
    );

    return NextResponse.json({ success: true, message: "ভেরিফিকেশন ব্যাজের আবেদনটি সফলভাবে জমা হয়েছে! অ্যাডমিন পর্যালোচনা করে অনুমোদন দেবেন।" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
