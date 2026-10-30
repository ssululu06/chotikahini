import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabase";
import { preprocessForSimilarity, scorePreprocessed } from "@/lib/similarity";

export const dynamic = "force-dynamic";

// Module-level cache: recompute at most every 10 minutes. The full
// pairwise scan is O(n²), so we never want it on every request.
let cache: { at: number; data: any } | null = null;
const CACHE_TTL = 10 * 60 * 1000;

// GET /api/admin/story-similarity
// For every story returns the highest similarity % against any OTHER
// story, plus the matched story title. Admins/authors use this to spot
// duplicates.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Any author-tier role can see similarity for their own stories.
    const canSeeAll = hasPermission(session.role, "story.review");
    if (session.role === "user" || (!canSeeAll && session.role !== "author")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (cache && Date.now() - cache.at < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    const supabase = getSupabaseAdmin();

    // Fetch stories (authors only fetch their own; reviewers fetch all)
    let query = supabase
      .from("stories")
      .select("uid, slug, title, content, author_id, status")
      .limit(5000);

    if (!canSeeAll) {
      query = query.eq("author_id", session.id);
    }

    const { data: stories } = await query;
    if (!stories || stories.length === 0) {
      const empty = { results: [], total: 0 };
      return NextResponse.json(empty);
    }

    // Pre-process each story's n-grams once
    const prepared = (stories as any[]).map((s) => ({
      uid: s.uid,
      slug: s.slug,
      title: s.title,
      status: s.status,
      authorId: s.author_id,
      text: preprocessForSimilarity(s.content || ""),
    }));

    const results: any[] = [];

    for (let i = 0; i < prepared.length; i++) {
      const a = prepared[i];
      if (a.text.bigramSet.size < 5) {
        // Very short text — can't judge similarity meaningfully
        results.push({ uid: a.uid, slug: a.slug, title: a.title, status: a.status, maxSimilarity: 0, matched: null });
        continue;
      }

      let best = 0;
      let bestMatch: any = null;

      for (let j = 0; j < prepared.length; j++) {
        if (i === j) continue;
        const b = prepared[j];
        if (b.text.bigramSet.size < 5) continue;
        const score = scorePreprocessed(a.text, b.text);
        if (score > best) {
          best = score;
          bestMatch = { uid: b.uid, slug: b.slug, title: b.title };
        }
      }

      results.push({
        uid: a.uid,
        slug: a.slug,
        title: a.title,
        status: a.status,
        maxSimilarity: Math.round(best * 100),
        matched: bestMatch,
      });
    }

    const data = { results, total: prepared.length };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
