import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Comments for a video.
 *
 * We reuse the existing `comments` table instead of adding columns: a video
 * comment is keyed by the synthetic `post_slug` value `video:<uuid>`, with
 * `post_id` left NULL so the post foreign key stays satisfied. No schema
 * migration required.
 */

const MAX_CONTENT = 2000;

function videoKey(id: string) {
  return `video:${id}`;
}

function slugFromKey(postSlug: string): string | null {
  return postSlug.startsWith("video:") ? postSlug.slice(6) : null;
}

interface RouteContext {
  params: { id: string };
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Only expose comments for a video that is actually published.
    const { data: video } = await supabaseAdmin
      .from("video_posts")
      .select("id")
      .eq("id", params.id)
      .eq("status", "published")
      .maybeSingle();

    if (!video) {
      return NextResponse.json({ error: "ভিডিও পাওয়া যায়নি" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("comments")
      .select(
        "id, post_slug, user_id, username, name, profile_pic, content, parent_comment_id, status, created_at, updated_at",
      )
      .eq("post_slug", videoKey(params.id))
      .neq("status", "hidden")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[video-comments] list failed:", error);
      return NextResponse.json({ error: "মন্তব্য লোড করা যায়নি" }, { status: 500 });
    }

    return NextResponse.json({
      comments: (data || []).map((c: any) => ({
        id: c.id,
        videoId: slugFromKey(c.post_slug),
        userId: c.user_id,
        username: c.username,
        name: c.name,
        profilePic: c.profile_pic,
        content: c.content,
        parentId: c.parent_comment_id,
        createdAt: c.created_at,
      })),
    });
  } catch (e) {
    console.error("[video-comments] GET error:", e);
    return NextResponse.json({ error: "মন্তব্য লোড করা যায়নি" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "মন্তব্য লিখতে লগইন করুন।" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => null);
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const parentId =
      typeof body?.parentId === "string" && body.parentId.trim()
        ? body.parentId.trim()
        : null;

    if (!content) {
      return NextResponse.json({ error: "মন্তব্য খালি রাখা যাবে না।" }, { status: 400 });
    }
    if (content.length > MAX_CONTENT) {
      return NextResponse.json(
        { error: `মন্তব্য অনেক বড় (সর্বোচ্চ ${MAX_CONTENT} অক্ষর)।` },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Confirm the video exists and is published — don't let people comment on
    // drafts or arbitrary ids.
    const { data: video } = await supabaseAdmin
      .from("video_posts")
      .select("id")
      .eq("id", params.id)
      .eq("status", "published")
      .maybeSingle();

    if (!video) {
      return NextResponse.json({ error: "ভিডিও পাওয়া যায়নি" }, { status: 404 });
    }

    // A reply must point at a comment that belongs to THIS video.
    if (parentId) {
      const { data: parent } = await supabaseAdmin
        .from("comments")
        .select("id")
        .eq("id", parentId)
        .eq("post_slug", videoKey(params.id))
        .maybeSingle();
      if (!parent) {
        return NextResponse.json(
          { error: "যে মন্তব্যের উত্তর দিচ্ছেন তা পাওয়া যায়নি।" },
          { status: 400 },
        );
      }
    }

    const id = `vc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const nowIso = new Date().toISOString();

    const { error } = await supabaseAdmin.from("comments").insert({
      id,
      post_slug: videoKey(params.id),
      post_id: null, // videos aren't post_metadata rows
      user_id: session.id,
      username: session.username,
      name: session.name || session.username,
      profile_pic: session.profilePic || null,
      content,
      parent_comment_id: parentId,
      status: "approved",
      created_at: nowIso,
      updated_at: nowIso,
    });

    if (error) {
      console.error("[video-comments] insert failed:", error);
      return NextResponse.json(
        { error: "মন্তব্য পাঠানো যায়নি। আবার চেষ্টা করুন।" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      comment: {
        id,
        videoId: params.id,
        userId: session.id,
        username: session.username,
        name: session.name || session.username,
        profilePic: session.profilePic || null,
        content,
        parentId,
        createdAt: nowIso,
      },
    });
  } catch (e) {
    console.error("[video-comments] POST error:", e);
    return NextResponse.json(
      { error: "মন্তব্য পাঠানো যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 },
    );
  }
}