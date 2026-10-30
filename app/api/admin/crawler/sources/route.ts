import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "content.create")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("crawler_sources").select("*").order("created_at", { ascending: false });
    return NextResponse.json({ sources: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "content.create")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { url, category, default_tags, feed_url } = await req.json();
    const cleanUrl = String(url || "").trim();
    if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
      return NextResponse.json({ error: "সঠিক URL দিন।" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("crawler_sources").insert({
      url: cleanUrl,
      category: (category || "golpo").trim(),
      default_tags: (default_tags || "").trim(),
      feed_url: (feed_url || "").trim() || null,
      active: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "content.create")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID আবশ্যক।" }, { status: 400 });
    const supabase = getSupabaseAdmin();
    await supabase.from("crawler_sources").delete().eq("id", id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
