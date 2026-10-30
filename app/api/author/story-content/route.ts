import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canEditAnyStory, canEditOwnStory } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// GET /api/author/story-content?uid=xxx — full story body for the editor.
// SERVER-SIDE OWNERSHIP CHECK: only the story author, a co-author, or an
// admin-tier editor (story.edit_any) may load it. Client-supplied IDs are
// never trusted — we re-verify against the DB.
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canEditOwnStory(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const ref = url.searchParams.get("uid") || url.searchParams.get("slug") || "";

    const supabase = getSupabaseAdmin();
    const canEditAny = canEditAnyStory(session.role);

    const { data: story, error } = await supabase
      .from("stories")
      .select("*")
      .or(`uid.eq.${ref},slug.eq.${ref}`)
      .maybeSingle();

    if (error || !story) {
      return NextResponse.json({ error: "গল্পটি পাওয়া যায়নি।" }, { status: 404 });
    }

    const isOwner = story.author_id === session.id;

    // Co-author check (story_coauthors table)
    let isCoAuthor = false;
    if (!isOwner && !canEditAny) {
      try {
        const { data: co } = await supabase
          .from("story_coauthors")
          .select("id")
          .eq("story_uid", story.uid || story.slug)
          .eq("user_id", session.id)
          .maybeSingle();
        isCoAuthor = !!co;
      } catch (e) {}
    }

    if (!isOwner && !isCoAuthor && !canEditAny) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      story: {
        slug: story.slug,
        fileSlug: story.slug,
        uid: story.uid || story.slug,
        title: story.title,
        category: story.category || "golpo",
        description: story.description || "",
        content: story.content || "",
        cover: story.cover || "",
        tags: Array.isArray(story.tags) ? story.tags.join(", ") : story.tags || "",
        previousPost: story.previous_post || "",
        publishedAt: story.published_at || story.updated_at || null,
        status: story.status || "draft",
        rejectionReason: story.rejection_reason || null,
        history: Array.isArray(story.history) ? story.history : [],
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
