import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { commentId, postSlug } = await req.json();
    if (!commentId) {
      return NextResponse.json({ error: "commentId required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("comment_reports")
      .upsert(
        {
          comment_id: commentId,
          post_slug: postSlug || null,
          reported_by: session.id,
          status: "pending",
        },
        { onConflict: "comment_id,reported_by" }
      );

    // Ignore duplicate report (23505) — idempotent
    if (error && error.code !== "23505") {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Report error:", error);
    return NextResponse.json({ error: "রিপোর্ট করতে সমস্যা হয়েছে" }, { status: 500 });
  }
}
