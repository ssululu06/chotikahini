import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { notifyAdmins } from "@/lib/notify";
import { getSession } from "@/lib/auth";
import { hasPermission, isAtLeast } from "@/lib/permissions";
import { safeIdentifier } from "@/lib/utils";
import crypto from "crypto";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const postSlug = searchParams.get("postSlug");

    if (!postSlug) {
      return NextResponse.json({ error: "Missing postSlug" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Videos use the synthetic slug `video:<uuid>` and have no row in
    // `stories`, so the publication gate below is skipped for them.
    const isVideoSlug = postSlug.startsWith("video:");

    // Check if story is published before returning comments to public
    if (!isVideoSlug) {
      const { data: story } = await supabase
        .from("stories")
        .select("status, author_id, published_at")
        .or(`slug.eq.${postSlug},uid.eq.${postSlug}`)
        .maybeSingle();

      if (story) {
        const session = await getSession();
        const isPublished = story.status === "published" && (!story.published_at || new Date(story.published_at).getTime() <= Date.now());
        if (!isPublished) {
          const isAuthor = !!session && (session.id === story.author_id);
          const isAdmin = !!session && (hasPermission(session.role, "comments.view") || isAtLeast(session.role, "moderator"));
          if (!isAuthor && !isAdmin) {
            return NextResponse.json({ comments: [] });
          }
        }
      }
    } else {
      // Mirror the video API's guard: only published videos are commentable.
      const { data: video } = await supabase
        .from("video_posts")
        .select("id")
        .eq("id", postSlug.slice(6))
        .eq("status", "published")
        .maybeSingle();

      if (!video) {
        return NextResponse.json({ error: "ভিডিও পাওয়া যায়নি" }, { status: 404 });
      }
    }

    // Join with users table to get live name/profilePic — no denormalized copies
    const { data: comments, error } = await supabase
      .from("comments")
      .select(`
        id, post_slug, post_id, user_id, username, name, profile_pic, content, parent_comment_id, status, is_pinned, is_spoiler, created_at, updated_at,
        users:user_id ( username, name, profile_pic, role )
      `)
      .eq("post_slug", postSlug)
      .neq("status", "hidden")
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Map to camelCase, user info comes live from FK join. Earlier rows written
    // by the video-comment API denormalised username/name onto the comment
    // itself — fall back to those when the FK comes up empty so the UI still
    // has something to render for legacy rows.
    const mappedComments = (comments || []).map((c: any) => ({
      id: c.id,
      postSlug: c.post_slug,
      postId: c.post_id,
      userId: c.user_id,
      username: c.users?.username || c.username || "",
      name: c.users?.name || c.users?.username || c.name || "",
      profilePic: c.users?.profile_pic ?? c.profile_pic ?? null,
      role: c.users?.role || "user",
      content: c.content,
      parentCommentId: c.parent_comment_id,
      status: c.status,
      isPinned: !!c.is_pinned,
      isSpoiler: !!c.is_spoiler,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));

    // Pinned comments float to the top (only top-level pins)
    mappedComments.sort((a: any, b: any) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(a.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({ comments: mappedComments });

  } catch (error: any) {
    console.error("GET comments error:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const { postSlug: rawPostSlug, content, parentCommentId, isSpoiler } = await req.json();
    // Video comments live under the synthetic slug `video:<uuid>`, which
    // safeIdentifier rejects (colon is a PostgREST filter metacharacter).
    // Strip the prefix before sanitising and re-attach it afterwards so both
    // stories and videos share one comment implementation.
    const isVideoSlug = typeof rawPostSlug === "string" && rawPostSlug.startsWith("video:");
    const sanitised = safeIdentifier(
      isVideoSlug ? rawPostSlug.slice(6) : rawPostSlug,
    );
    const postSlug = sanitised
      ? isVideoSlug
        ? `video:${sanitised}`
        : sanitised
      : "";

    if (!postSlug || !content || content.trim().length === 0) {
      return NextResponse.json({ error: "Invalid comment data" }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: "Comment is too long (max 2000 characters)" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check if story is published before allowing comments. Videos are not
    // rows in `stories`, so the slug filter is skipped entirely for them —
    // it also keeps the colon out of a PostgREST `.or()` filter value.
    if (!isVideoSlug) {
      const { data: story } = await supabase
        .from("stories")
        .select("status, author_id, published_at")
        .or(`slug.eq.${postSlug},uid.eq.${postSlug}`)
        .maybeSingle();

      if (story) {
        const isPublished = story.status === "published" && (!story.published_at || new Date(story.published_at).getTime() <= Date.now());
        if (!isPublished) {
          const isAuthor = session.id === story.author_id;
          const isAdmin = hasPermission(session.role, "comments.create") && hasPermission(session.role, "story.review");
          if (!isAuthor && !isAdmin) {
            return NextResponse.json({ error: "অননুমোদিত বা অপেক্ষমাণ গল্পে মন্তব্য করা যাবে না।" }, { status: 403 });
          }
        }
      }
    }

    // Resolve post_id from post_metadata for normalized FK. Videos have no
    // post_metadata row, so they always insert with a NULL post_id.
    const { data: postMeta } = isVideoSlug
      ? { data: null as any }
      : await supabase
          .from("post_metadata")
          .select("id, author_id")
          .eq("slug", postSlug)
          .maybeSingle();

    const newCommentId = "cmt_" + crypto.randomUUID().replace(/-/g, "").substring(0, 12);

    let targetUserId: string | null = null;
    if (parentCommentId) {
      const { data: parent } = await supabase
        .from("comments")
        .select("user_id")
        .eq("id", parentCommentId)
        .single();
      if (parent) targetUserId = parent.user_id;
    } else if (postMeta?.author_id && postMeta.author_id !== session.id) {
      // Notify the post author when someone comments (not a reply)
      targetUserId = postMeta.author_id;
    }

    // Check if comment contains external links/URLs
    const urlRegex = /(https?:\/\/|www\.|[a-zA-Z0-9-]+\.(com|net|org|io|me|bd|cc|lol|tk|ml|ga|cf|gq|xyz|online|site|tech|info))/i;
    const containsLink = urlRegex.test(content);
    const initialStatus = containsLink ? "hidden" : "approved";

    const { error: insertError } = await supabase
      .from("comments")
      .insert({
        id: newCommentId,
        post_slug: postSlug,
        post_id: postMeta?.id || null,          // FK to post_metadata
        user_id: session.id,
        // Denormalised user columns kept in sync with the session so comment
        // lists render even before the FK join (see /api/comments GET). The
        // username column is NOT NULL on the table — omitting it triggered a
        // 500 ("Failed to post comment") on every article comment.
        username: session.username,
        name: session.name || session.username,
        profile_pic: session.profilePic || null,
        content: content.trim(),
        parent_comment_id: parentCommentId || null,
        is_spoiler: isSpoiler === true,
        status: initialStatus,
      });

    if (insertError) throw insertError;

    // Send Admin Notification if comment contains link for moderation
    if (containsLink) {
      await notifyAdmins(
        {
          type: "comment_report",
          actorName: session.name || session.username,
          snippet: `কমেন্টে লিংক চিহ্নিত হয়েছে! অ্যাডমিন পর্যালোচনার জন্য ওয়েটিং। (@${session.username})`,
        },
        supabase
      );

      return NextResponse.json({
        success: true,
        pendingApproval: true,
        message: "আপনার কমেন্টে ওয়েবসাইট বা স্প্যাম লিংক থাকায় তা পর্যালোচনার জন্য সংরক্ষিত হয়েছে। এডমিন অনুমোদনের পর প্রদর্শিত হবে।"
      });
    }

    // Send Notification — no duplicate profile data stored
    if (targetUserId && targetUserId !== session.id) {
      const snippet = content.trim();
      const notifType = parentCommentId ? "reply" : "comment";
      try {
        await supabase.from("notifications").insert({
          id: "notif_" + crypto.randomUUID().replace(/-/g, "").substring(0, 12),
          user_id: targetUserId,
          type: notifType,
          actor_id: session.id,           // FK → users, no name/pic duplication
          post_slug: postSlug,
          post_id: postMeta?.id || null,  // FK → post_metadata
          comment_id: newCommentId,
          snippet: snippet.length > 50 ? snippet.substring(0, 50) + "..." : snippet,
          is_read: false
        });
      } catch (e) {
        console.error("Notification insert error:", e);
      }
    }

    // Return comment with live user data
    const newComment = {
      id: newCommentId,
      postSlug,
      postId: postMeta?.id || null,
      userId: session.id,
      username: session.username,
      name: session.name || session.username,
      profilePic: session.profilePic || null,
      role: session.role || "user",
      content: content.trim(),
      parentCommentId: parentCommentId || null,
      status: "approved",
      isPinned: false,
      isSpoiler: isSpoiler === true,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };

    return NextResponse.json({ success: true, comment: newComment });

  } catch (error: any) {
    console.error("POST comment error:", error);
    return NextResponse.json({ error: "Failed to post comment. Please try again." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("id");
    if (!commentId) {
      return NextResponse.json({ error: "Comment ID required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const canHide = hasPermission(session.role, "comments.hide") || hasPermission(session.role, "comments.delete_permanent");

    // Only comment owner or authorized moderator/admin can delete
    const query = supabase.from("comments").delete().eq("id", commentId);
    if (!canHide) {
      query.eq("user_id", session.id);
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE comment error:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canHide = hasPermission(session.role, "comments.hide");
    if (!canHide) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id, status } = await req.json();
    if (!id || !["approved", "hidden"].includes(status)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("comments").update({ status }).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH comment error:", error);
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
  }
}
