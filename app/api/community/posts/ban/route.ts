import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "লগইন করুন" }, { status: 401 });

    if (!hasPermission(session.role, "posts.ban")) {
      return NextResponse.json({ error: "অনুমতি নেই" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const { data: target } = await getSupabaseAdmin()
      .from("users")
      .select("can_post")
      .eq("id", userId)
      .maybeSingle();

    return NextResponse.json({ banned: !!(target && Number(target.can_post) === 0) });
  } catch (error: any) {
    console.error("GET /api/community/posts/ban error:", error);
    return NextResponse.json({ error: "অপারেশন ব্যর্থ" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "লগইন করুন" }, { status: 401 });

    if (!hasPermission(session.role, "posts.ban")) {
      return NextResponse.json({ error: "অনুমতি নেই" }, { status: 403 });
    }

    const { userId, banned } = await req.json();
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }
    if (banned === undefined) {
      return NextResponse.json({ error: "banned status required" }, { status: 400 });
    }

    // Cannot ban another admin/superadmin
    if (banned) {
      const { data: target } = await getSupabaseAdmin()
        .from("users")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      if (target && (target.role === "superadmin" || (target.role === "admin" && !hasPermission(session.role, "admin.manage")))) {
        return NextResponse.json({ error: "এই ব্যবহারকারীকে বান করা যাবে না" }, { status: 403 });
      }
    }

    const { error } = await getSupabaseAdmin()
      .from("users")
      .update({ can_post: banned ? 0 : 1 })
      .eq("id", userId);

    if (error) throw error;

    return NextResponse.json({ success: true, banned });
  } catch (error: any) {
    console.error("POST /api/community/posts/ban error:", error);
    return NextResponse.json({ error: "অপারেশন ব্যর্থ" }, { status: 500 });
  }
}