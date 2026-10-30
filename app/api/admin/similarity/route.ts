import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { canEditAnyStory } from "@/lib/permissions";
import { findSimilarPosts } from "@/lib/similarity";

export const dynamic = "force-dynamic";

// POST /api/admin/similarity
// body: { content, excludeRef? }
// Returns the top posts whose content most closely matches the given
// content, with a percentage. Admin-tier roles only.
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !canEditAnyStory(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content, title, excludeRef } = await req.json();
    const fullContent = String(content || "");
    if (fullContent.trim().length < 100) {
      return NextResponse.json({ matches: [], maxSimilarity: 0, totalChecked: 0 });
    }

    // Compare the FULL article text (content + title) so the result is not
    // driven by the title alone.
    const queryText = `${title || ""} ${fullContent}`.trim();

    const supabase = getSupabaseAdmin();

    // Fetch published + pending stories (title, uid, slug, author, content)
    const { data: stories } = await supabase
      .from("stories")
      .select("uid, slug, title, content, author_id")
      .neq("status", "hidden")
      .limit(3000);

    const candidates = (stories || [])
      .map((s: any) => ({
        uid: s.uid,
        slug: s.slug,
        title: s.title,
        content: s.content || "",
        authorName: s.author_id || "",
      }))
      .filter((c: any) => c.content && c.content.trim().length >= 100);

    const matches = findSimilarPosts(
      queryText,
      candidates,
      excludeRef ? String(excludeRef) : null,
      6
    );

    const maxSimilarity = matches.length > 0 ? matches[0].similarity : 0;

    return NextResponse.json({
      matches,
      maxSimilarity,
      totalChecked: candidates.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
