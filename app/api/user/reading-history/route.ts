import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();

    // reading_history JOIN stories for title/cover/slug
    const { data, error } = await supabase
      .from("reading_history")
      .select("post_slug, last_read_at, stories(uid, title, cover, category)")
      .eq("user_id", session.id)
      .order("last_read_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const history = (data || []).map((row: any) => ({
      slug: row.post_slug,
      lastReadAt: row.last_read_at,
      title: row.stories?.title || null,
      cover: row.stories?.cover || null,
      category: row.stories?.category || null,
      uid: row.stories?.uid || row.post_slug,
    }));

    return NextResponse.json({ history });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
