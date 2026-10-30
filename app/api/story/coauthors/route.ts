import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/story/coauthors?storyUid=xxx — returns co-authors for a story
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const storyUid = url.searchParams.get("storyUid");
    if (!storyUid) {
      return NextResponse.json({ coauthors: [] });
    }

    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("story_coauthors")
      .select("user_id, users(id, username, name, profile_pic, is_verified)")
      .eq("story_uid", storyUid);

    const coauthors = (data || []).map((r: any) => ({
      userId: r.user_id,
      username: r.users?.username || "",
      name: r.users?.name || r.users?.username || "",
      profilePic: r.users?.profile_pic || null,
      isVerified: r.users?.is_verified === true,
    }));

    return NextResponse.json({ coauthors });
  } catch (e: any) {
    return NextResponse.json({ coauthors: [] });
  }
}