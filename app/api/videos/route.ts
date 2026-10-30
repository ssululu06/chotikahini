import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getSupabaseAdmin()
    .from("video_posts")
    .select(
      "id, title, description, source_url, embed_url, thumbnail_url, uploader_name, created_at, published_at",
    )
    .eq("status", "published")
    .not("embed_url", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(60);

  if (error) {
    console.error("[videos] public list failed:", error);
    return NextResponse.json({ error: "ভিডিও লোড করা যায়নি।" }, { status: 500 });
  }
  return NextResponse.json({ videos: data || [] });
}