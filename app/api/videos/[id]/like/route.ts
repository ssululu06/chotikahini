import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Video likes, stored in the shared `post_likes` table under the synthetic
 * slug `video:<uuid>` — identical trick to video comments, so no schema
 * migration is needed and the existing (post_slug, user_id) unique index
 * does the de-duplication work for us.
 */

interface RouteContext {
  params: { id: string };
}

function videoKey(id: string) {
  return `video:${id}`;
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getSession();

    const { count } = await supabase
      .from("post_likes")
      .select("id", { count: "exact", head: true })
      .eq("post_slug", videoKey(params.id));

    let likedByMe = false;
    if (session) {
      const { data } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_slug", videoKey(params.id))
        .eq("user_id", session.id)
        .maybeSingle();
      likedByMe = !!data;
    }

    return NextResponse.json({ count: count ?? 0, likedByMe });
  } catch (e) {
    console.error("[video-like] GET error:", e);
    return NextResponse.json({ error: "লাইক লোড করা যায়নি" }, { status: 500 });
  }
}

export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "লাইক দিতে লগইন করুন।" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const slug = videoKey(params.id);

    // Confirm the video is published before allowing a like.
    const { data: video } = await supabase
      .from("video_posts")
      .select("id")
      .eq("id", params.id)
      .eq("status", "published")
      .maybeSingle();

    if (!video) {
      return NextResponse.json({ error: "ভিডিও পাওয়া যায়নি" }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from("post_likes")
      .select("id")
      .eq("post_slug", slug)
      .eq("user_id", session.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("post_likes").delete().eq("id", existing.id);
      const { count } = await supabase
        .from("post_likes")
        .select("id", { count: "exact", head: true })
        .eq("post_slug", slug);
      return NextResponse.json({ liked: false, count: count ?? 0 });
    }

    const { error } = await supabase.from("post_likes").insert({
      id: `vl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
      post_slug: slug,
      user_id: session.id,
      username: session.username,
      name: session.name || session.username,
    });

    if (error) {
      console.error("[video-like] insert failed:", error);
      return NextResponse.json({ error: "লাইক দেওয়া যায়নি" }, { status: 500 });
    }

    const { count } = await supabase
      .from("post_likes")
      .select("id", { count: "exact", head: true })
      .eq("post_slug", slug);

    return NextResponse.json({ liked: true, count: count ?? 1 });
  } catch (e) {
    console.error("[video-like] POST error:", e);
    return NextResponse.json({ error: "লাইক দেওয়া যায়নি" }, { status: 500 });
  }
}