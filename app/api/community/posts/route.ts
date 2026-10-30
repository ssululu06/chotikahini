import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { isVideoSectionEnabled } from "@/lib/config";
import { bodyHasOnlyOwnVideoLinks, resolveVideosInText } from "@/lib/video-link-resolver";

export const dynamic = "force-dynamic";

const POSTS_PER_PAGE = 20;
const MAX_CONTENT_LENGTH = 2000;

/**
 * Blunt "any link at all" check, used only while the video section is off
 * (no embeddable player can be offered, so every URL stays banned). When
 * the section is on, `bodyHasOnlyOwnVideoLinks` is the finer-grained test that
 * lets video URLs through while still rejecting spam links.
 */
const ANY_LINK_RE =
  /(https?:\/\/|www\.|[a-zA-Z0-9-]+\.(com|net|org|io|me|bd|cc|lol|tk|ml|ga|cf|gq|xyz|online|site|tech|info))/i;

/**
 * Build the client-facing shape of a post row, resolving any video links in
 * its text on the way through.
 *
 * Resolution is done here (server-side) because every consumer of community
 * posts is a client component, and our own `/videos/<id>` links need a DB
 * read. Doing it once per request means the feed, a user's own-post list and
 * the single-post view all stay in sync for free.
 *
 * `videoOn` is read once per request rather than per post — the flag can't
 * change mid-loop, and `getFeatures()` is cached anyway.
 */
async function serializePost(p: any, videoOn: boolean) {
  const u = Array.isArray(p.users) ? p.users[0] : p.users;
  return {
    id: p.id,
    userId: p.user_id,
    content: p.content,
    likesCount: p.likes_count,
    repostsCount: p.reposts_count,
    commentsCount: p.comments_count,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    videos: await resolveVideosInText(p.content || "", videoOn),
    story: p.story_slug
      ? { slug: p.story_slug, title: p.story_title || p.story_slug, cover: p.story_cover || null }
      : null,
    user: u
      ? { id: u.id, username: u.username, name: u.name, profilePic: u.profile_pic, role: u.role, isVerified: u.is_verified }
      : null,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sort = searchParams.get("sort") || "latest"; // latest | hot
    const limit = Math.min(Number(searchParams.get("limit")) || POSTS_PER_PAGE, 50);
    const offset = Number(searchParams.get("offset")) || 0;

    const supabase = getSupabaseAdmin();
    const videoOn = isVideoSectionEnabled();

    if (sort === "hot") {
      const { data: allPosts, error } = await supabase
        .from("posts")
        .select(`
          id, user_id, content, story_slug, story_title, story_cover, likes_count, reposts_count, comments_count, created_at, updated_at,
          users:user_id ( id, username, name, profile_pic, role, is_verified )
        `)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      if (!allPosts) return NextResponse.json({ posts: [], total: 0, hasMore: false });

      const now = Date.now();
      const scored = allPosts.map((p: any) => {
        const hours = (now - new Date(p.created_at).getTime()) / 3600000;
        const score = (p.likes_count * 3 + p.reposts_count * 4 + p.comments_count * 2) / Math.pow(hours + 2, 1.5);
        return { ...p, _score: score };
      });
      scored.sort((a: any, b: any) => b._score - a._score);

      const page = scored.slice(offset, offset + limit);
      return NextResponse.json({
        posts: await Promise.all(page.map((p: any) => serializePost(p, videoOn))),
        total: scored.length,
        hasMore: offset + limit < scored.length,
      });
    }

    const { data: posts, error, count } = await supabase
      .from("posts")
      .select(`
        id, user_id, content, story_slug, story_title, story_cover, likes_count, reposts_count, comments_count, created_at, updated_at,
        users:user_id ( id, username, name, profile_pic, role, is_verified )
      `, { count: "exact" })
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      posts: await Promise.all((posts || []).map((p: any) => serializePost(p, videoOn))),
      total: count || 0,
      hasMore: (offset + limit) < (count || 0),
    });
  } catch (error: any) {
    console.error("GET /api/community/posts error:", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "লগইন করুন" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Banned users cannot post
    const { data: actor } = await supabase
      .from("users")
      .select("can_post")
      .eq("id", session.id)
      .maybeSingle();
    if (actor && Number(actor.can_post) === 0) {
      return NextResponse.json({ error: "আপনাকে পোস্ট করার অনুমতি দেওয়া নেই" }, { status: 403 });
    }

    const { content, storySlug, storyTitle, storyCover } = await req.json();
    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: "পোস্ট খালি হতে পারে না" }, { status: 400 });
    }
    if (content.trim().length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ error: `পোস্ট সর্বোচ্চ ${MAX_CONTENT_LENGTH} অক্ষর হতে পারে` }, { status: 400 });
    }

    // External links are not allowed in community-post text — the feed is a
    // spam magnet for drive-by link drops. The ONE exemption is a link to a
    // video WE published (/videos/<id>), which the reader gets as an inline
    // player instead of a clickable target. Third-party video links are not
    // accepted here (unlike story bodies, which do allow any embeddable URL)
    // so a community post can never bounce the reader off-site.
    const videoOn = isVideoSectionEnabled();
    if (videoOn && !(await bodyHasOnlyOwnVideoLinks(content.trim()))) {
      return NextResponse.json({
        error: "পোস্টে শুধু আমাদের সাইটের ভিডিও লিংক (যেমন /videos/…) দেওয়া যাবে",
      }, { status: 400 });
    }
    if (!videoOn && ANY_LINK_RE.test(content.trim())) {
      return NextResponse.json({ error: "পোস্টের লেখায় এক্সটার্নাল লিংক দেওয়া যাবে না" }, { status: 400 });
    }

    // If a story is being attached, validate it exists (internal link only)
    let story: { slug: string; title: string; cover: string | null } | null = null;
    if (storySlug) {
      const { data: st } = await supabase
        .from("stories")
        .select("slug, title, cover, status")
        .or(`slug.eq.${storySlug},uid.eq.${storySlug}`)
        .maybeSingle();
      if (st) {
        story = { slug: st.slug, title: st.title || st.slug, cover: st.cover || null };
      }
    } else if (storyTitle) {
      story = { slug: storySlug, title: storyTitle, cover: storyCover || null };
    }

    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        user_id: session.id,
        content: content.trim(),
        story_slug: story?.slug || null,
        story_title: story?.title || null,
        story_cover: story?.cover || null,
      })
      .select("id, user_id, content, story_slug, story_title, story_cover, likes_count, reposts_count, comments_count, created_at, updated_at")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      post: {
        id: post.id,
        userId: post.user_id,
        content: post.content,
        likesCount: post.likes_count,
        repostsCount: post.reposts_count,
        commentsCount: post.comments_count,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        // Resolve on the echo too, so the newly-created post renders its
        // inline player immediately without the feed needing to refetch.
        videos: await resolveVideosInText(post.content || "", videoOn),
        story: story ? { slug: story.slug, title: story.title, cover: story.cover } : null,
        user: { id: session.id, username: session.username, name: session.name, profilePic: session.profilePic, role: session.role, isVerified: session.isVerified },
      },
    });
  } catch (error: any) {
    console.error("POST /api/community/posts error:", error);
    return NextResponse.json({ error: "পোস্ট করতে ব্যর্থ" }, { status: 500 });
  }
}