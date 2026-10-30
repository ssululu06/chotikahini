import { NextResponse } from "next/server";
import { getSession, setSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postSlug } = await req.json();
    if (!postSlug) {
      return NextResponse.json({ error: "postSlug is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Resolve post_id for normalized FK
    const { data: pm } = await supabase
      .from("post_metadata")
      .select("id")
      .eq("slug", postSlug)
      .maybeSingle();

    // Check if already saved (prefer post_id match, fallback to slug)
    const existingQuery = pm?.id
      ? supabase.from("bookmarks").select("id").eq("user_id", session.id).eq("post_id", pm.id).maybeSingle()
      : supabase.from("bookmarks").select("id").eq("user_id", session.id).eq("post_slug", postSlug).maybeSingle();

    const { data: existing } = await existingQuery;

    let saved = false;
    if (existing) {
      // Remove bookmark
      await supabase.from("bookmarks").delete().eq("id", existing.id);
      saved = false;
    } else {
      // Add bookmark with post_id FK
      await supabase.from("bookmarks").insert({
        user_id: session.id,
        post_slug: postSlug,
        post_id: pm?.id || null,
      });
      saved = true;
    }

    // Fetch updated list for session sync
    const { data: allBookmarks } = await supabase
      .from("bookmarks")
      .select("post_slug")
      .eq("user_id", session.id);

    const savedPosts = (allBookmarks || []).map((b: any) => b.post_slug);
    await setSession({ ...session, savedPosts });

    return NextResponse.json({ success: true, saved, savedPosts });
  } catch (error: any) {
    console.error("Save post error:", error);
    return NextResponse.json({ error: "Failed to save post" }, { status: 500 });
  }
}
