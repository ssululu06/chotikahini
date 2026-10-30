import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { isVideoSectionEnabled } from "@/lib/config";
import { bodyHasOnlyOwnVideoLinks, resolveVideosInText } from "@/lib/video-link-resolver";

export const dynamic = "force-dynamic";

/**
 * Blunt "any link at all" check, used only while the video section is off.
 * When it's on, `bodyHasOnlyOwnVideoLinks` is the finer-grained test that lets
 * embeddable video URLs through while still rejecting spam links.
 */
const ANY_LINK_RE =
  /(https?:\/\/|www\.|[a-zA-Z0-9-]+\.(com|net|org|io|me|bd|cc|lol|tk|ml|ga|cf|gq|xyz|online|site|tech|info))/i;

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const postId = Number(params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: raw, error } = await supabase
      .from("posts")
      .select(`
        id, user_id, content, story_slug, story_title, story_cover, likes_count, reposts_count, comments_count, status, created_at, updated_at,
        users:user_id ( id, username, name, profile_pic, role, is_verified )
      `)
      .eq("id", postId)
      .maybeSingle();

    if (error) throw error;
    if (!raw || raw.status !== "published") {
      return NextResponse.json({ error: "পোস্টটি পাওয়া যায়নি" }, { status: 404 });
    }

    const u = Array.isArray(raw.users) ? raw.users[0] : raw.users;

    const session = await getSession();
    let liked = false;
    let reposted = false;
    if (session) {
      const [likeRes, repostRes] = await Promise.all([
        supabase.from("posts_likes").select("post_id").eq("post_id", postId).eq("user_id", session.id).maybeSingle(),
        supabase.from("posts_reposts").select("post_id").eq("post_id", postId).eq("user_id", session.id).maybeSingle(),
      ]);
      liked = !!likeRes.data;
      reposted = !!repostRes.data;
    }

    return NextResponse.json({
      post: {
        id: raw.id,
        userId: raw.user_id,
        content: raw.content,
        likesCount: raw.likes_count,
        repostsCount: raw.reposts_count,
        commentsCount: raw.comments_count,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        liked,
        reposted,
        videos: await resolveVideosInText(raw.content || "", isVideoSectionEnabled()),
        story: raw.story_slug
          ? { slug: raw.story_slug, title: raw.story_title || raw.story_slug, cover: raw.story_cover || null }
          : null,
        user: u
          ? {
              id: u.id,
              username: u.username,
              name: u.name,
              profilePic: u.profile_pic,
              role: u.role,
              isVerified: u.is_verified,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error("GET /api/community/posts/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch post" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "লগইন করুন" }, { status: 401 });

    const postId = Number(params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
    }

    const { content } = await req.json();
    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: "পোস্ট খালি হতে পারে না" }, { status: 400 });
    }
    if (content.trim().length > 2000) {
      return NextResponse.json({ error: "পোস্ট সর্বোচ্চ ২০০০ অক্ষর হতে পারে" }, { status: 400 });
    }

    // External links are not allowed in community-post text (spam guard).
    // The ONE exemption is a link to a video WE published, which renders as
    // an inline player instead of a clickable target — the reader never
    // gets bounced off-site.
    const videoOn = isVideoSectionEnabled();
    if (videoOn && !(await bodyHasOnlyOwnVideoLinks(content.trim()))) {
      return NextResponse.json({
        error: "পোস্টে শুধু আমাদের সাইটের ভিডিও লিংক (যেমন /videos/…) দেওয়া যাবে",
      }, { status: 400 });
    }
    if (!videoOn && ANY_LINK_RE.test(content.trim())) {
      return NextResponse.json({ error: "পোস্টের লেখায় এক্সটার্নাল লিংক দেওয়া যাবে না" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: post } = await supabase
      .from("posts")
      .select("user_id, content")
      .eq("id", postId)
      .maybeSingle();

    if (!post) return NextResponse.json({ error: "পোস্টটি পাওয়া যায়নি" }, { status: 404 });

    const canEditAny = hasPermission(session.role, "posts.edit_own") && hasPermission(session.role, "story.edit_any");
    if (post.user_id !== session.id && !canEditAny) {
      return NextResponse.json({ error: "অনুমতি নেই" }, { status: 403 });
    }

    // Record edit history (before overwriting) so admins can review changes
    if (post.content !== content.trim()) {
      try {
        await supabase.from("posts_history").insert({
          post_id: postId,
          content: post.content,
          edited_by: session.id,
        });
      } catch (e) {
        // History failure must not block the edit
      }
    }

    const { data: updated, error } = await supabase
      .from("posts")
      .update({ content: content.trim(), updated_at: new Date().toISOString() })
      .eq("id", postId)
      .select("id, user_id, content, likes_count, reposts_count, comments_count, created_at, updated_at")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      post: {
        id: updated.id,
        userId: updated.user_id,
        content: updated.content,
        likesCount: updated.likes_count,
        repostsCount: updated.reposts_count,
        commentsCount: updated.comments_count,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
        // The edit may have introduced (or removed) a video link, so
        // re-resolve — PostCard replaces the row wholesale with this.
        videos: await resolveVideosInText(updated.content || "", videoOn),
      },
    });
  } catch (error: any) {
    console.error("PATCH /api/community/posts/[id] error:", error);
    return NextResponse.json({ error: "আপডেট ব্যর্থ" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "লগইন করুন" }, { status: 401 });

    const postId = Number(params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: post } = await supabase
      .from("posts")
      .select("user_id")
      .eq("id", postId)
      .maybeSingle();

    if (!post) return NextResponse.json({ error: "পোস্টটি পাওয়া যায়নি" }, { status: 404 });

    const canModerate = hasPermission(session.role, "posts.moderate");
    if (post.user_id !== session.id && !canModerate) {
      return NextResponse.json({ error: "অনুমতি নেই" }, { status: 403 });
    }

    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/community/posts/[id] error:", error);
    return NextResponse.json({ error: "ডিলিট ব্যর্থ" }, { status: 500 });
  }
}