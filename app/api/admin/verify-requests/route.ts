import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const { authorized } = await requirePermission("users.verify");
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: requests } = await supabase
      .from("verification_requests")
      .select("id, user_id, reason, status, created_at")
      .order("created_at", { ascending: false });

    // Resolve applicant details
    let userMap = new Map<string, { username: string; name: string; profile_pic: string; email: string; storyCount: number }>();
    try {
      const ids = [...new Set((requests || []).map((r: any) => r.user_id).filter(Boolean))];
      if (ids.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, username, name, profile_pic, email");
        if (users) {
          for (const u of users) userMap.set(u.id, { username: u.username, name: u.name, profile_pic: u.profile_pic, email: u.email, storyCount: 0 });
        }

        // Count published stories per applicant
        const { data: stories } = await supabase
          .from("stories")
          .select("author_id")
          .eq("status", "published")
          .in("author_id", ids);
        if (stories) {
          for (const s of stories) {
            const info = userMap.get(s.author_id);
            if (info) info.storyCount++;
          }
        }
      }
    } catch (e) {}

    const enriched = (requests || []).map((r: any) => {
      const u = userMap.get(r.user_id) || { username: r.user_id, name: "", profile_pic: null, email: null, storyCount: 0 };
      return {
        id: r.id,
        userId: r.user_id,
        reason: r.reason,
        status: r.status,
        createdAt: r.created_at,
        username: u.username,
        name: u.name,
        profilePic: u.profile_pic,
        email: u.email,
        storyCount: u.storyCount,
      };
    });

    return NextResponse.json({ requests: enriched });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Approve / reject a verification request
export async function PATCH(req: Request) {
  const { authorized, session } = await requirePermission("users.verify");
  if (!authorized || !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, status } = await req.json();
    if (!id || !["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: reqRow } = await supabase
      .from("verification_requests")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!reqRow) return NextResponse.json({ error: "আবেদনটি পাওয়া যায়নি।" }, { status: 404 });

    await supabase.from("verification_requests").update({ status }).eq("id", id);

    if (status === "approved") {
      await supabase.from("users").update({ is_verified: true }).eq("id", reqRow.user_id);
      // Notify the applicant
      try {
        await supabase.from("notifications").insert({
          user_id: reqRow.user_id,
          type: "verification_approved",
          snippet: "অভিনন্দন! আপনার লেখক ভেরিফিকেশন ব্যাজ অনুমোদন করা হয়েছে।",
          is_read: false,
        });
      } catch (e) {}
    }

    logAudit(session, { action: "users.verify", targetType: "user", targetId: reqRow.user_id, newState: { status } });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
