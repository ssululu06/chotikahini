import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { notifyAdmins } from "@/lib/notify";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: app } = await supabase
      .from("author_applications")
      .select("*")
      .eq("user_id", session.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ application: app || null });
  } catch (error) {
    return NextResponse.json({ application: null });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role && session.role !== "user") {
      return NextResponse.json({ error: "You are already an author, admin or manager." }, { status: 400 });
    }

    const { realName, sampleLink, message } = await req.json();
    if (!realName || !sampleLink) {
      return NextResponse.json({ error: "Name and Sample Link are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check for existing pending application (unique index handles this but let's give a good error)
    const { data: existing } = await supabase
      .from("author_applications")
      .select("id, status")
      .eq("user_id", session.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "আপনার একটি pending আবেদন ইতিমধ্যে আছে।" }, { status: 400 });
    }

    const { error } = await supabase.from("author_applications").insert({
      user_id: session.id,
      username: session.username,
      real_name: realName.trim(),
      sample_link: sampleLink.trim(),
      message: message?.trim() || "",
      status: "pending",
    });

    if (error) throw error;

    // Notify every real admin/superadmin (FK-safe). Plain-text snippet.
    notifyAdmins(
      {
        type: "author_application",
        actorId: session.id,
        actorName: session.name || session.username,
        snippet: `লেখক আবেদন: @${session.username} (${realName.trim()})`,
      },
      supabase
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Author apply error:", error);
    if (error?.code === "23505") {
      return NextResponse.json({ error: "আপনার একটি pending আবেদন ইতিমধ্যে আছে।" }, { status: 400 });
    }
    return NextResponse.json({ error: "আবেদন করতে সমস্যা হয়েছে।" }, { status: 500 });
  }
}
