import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Toggle comment pinning — story author or authorized admin/moderator can pin
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { commentId } = await req.json();
    if (!commentId) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // Load comment + its story to verify permission
    const { data: comment } = await supabase
      .from("comments")
      .select("id, post_slug, user_id, is_pinned, post_id")
      .eq("id", commentId)
      .maybeSingle();

    if (!comment) return NextResponse.json({ error: "কমেন্টটি পাওয়া যায়নি।" }, { status: 404 });

    const isAdmin = hasPermission(session.role, "comments.pin");

    // Story author lookup (via stories.author_id on slug/uid)
    let isStoryAuthor = false;
    if (!isAdmin) {
      const { data: story } = await supabase
        .from("stories")
        .select("author_id")
        .or(`slug.eq.${comment.post_slug},uid.eq.${comment.post_slug}`)
        .maybeSingle();
      isStoryAuthor = !!story && story.author_id === session.id;

      // Fallback via post_metadata
      if (!isStoryAuthor && comment.post_id) {
        const { data: meta } = await supabase
          .from("post_metadata")
          .select("author_id")
          .eq("id", comment.post_id)
          .maybeSingle();
        isStoryAuthor = !!meta && meta.author_id === session.id;
      }
    }

    if (!isAdmin && !isStoryAuthor) {
      return NextResponse.json({ error: "শুধুমাত্র গল্পের লেখক বা অ্যাডমিন কমেন্ট পিন করতে পারেন।" }, { status: 403 });
    }

    const nextPinned = !comment.is_pinned;
    const { error } = await supabase
      .from("comments")
      .update({ is_pinned: nextPinned, updated_at: new Date().toISOString() })
      .eq("id", commentId);

    if (error) throw error;

    return NextResponse.json({ success: true, isPinned: nextPinned });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
