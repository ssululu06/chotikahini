// ─────────────────────────────────────────────────────────────
// Post views — single source of truth.
//
// Two tables exist in Supabase:
//   • `post_view_counts`  — normalized, FK → post_metadata(id)
//   • `post_views`        — legacy, keyed by post_slug
//
// A given post can theoretically have a row in *both* (legacy from
// before the migration, normalized after). To keep every UI consistent
// we always read with the same precedence:
//
//   1. If the post has a metadata row → use post_view_counts.
//   2. Otherwise → use legacy post_views.
//
// This is the same precedence used by `app/api/views/route.ts`, which
// is where the views are *written*. Reading with the same rule means
// admin panel, share-suggestions, trending, and the public reader
// all show the same number for the same post.
//
// Why this file: callers used to inline the same `.from(...).select`
// pattern and drift over time (e.g. picking up counts only when
// BOTH tables had rows, double counting, or missing legacy rows on
// posts that never landed in post_metadata). One helper, one rule.
// ─────────────────────────────────────────────────────────────

import { getSupabaseAdmin } from "@/lib/supabase";

export interface PostRef {
  id?: string | null;        // post_metadata.id (UUID when migrated)
  slug: string;
}

interface ViewResult {
  /** Best-effort view count for the post, or 0 if neither table has it. */
  views: number;
  /** Which table the answer came from — useful for debugging stale data. */
  source: "post_view_counts" | "post_views" | "none";
}

/** Fetch the view count for a single post with the canonical precedence. */
export async function getPostViews(post: PostRef): Promise<ViewResult> {
  const supabase = getSupabaseAdmin();

  // 1. New normalized table — only valid when we have a metadata row id.
  if (post.id) {
    const { data } = await supabase
      .from("post_view_counts")
      .select("view_count")
      .eq("post_id", post.id)
      .maybeSingle();
    if (data && typeof data.view_count === "number") {
      return { views: Number(data.view_count) || 0, source: "post_view_counts" };
    }
  }

  // 2. Legacy fallback — by slug.
  const { data } = await supabase
    .from("post_views")
    .select("view_count")
    .eq("post_slug", post.slug)
    .maybeSingle();
  if (data && typeof data.view_count === "number") {
    return { views: Number(data.view_count) || 0, source: "post_views" };
  }

  return { views: 0, source: "none" };
}

/**
 * Bulk fetch view counts for many posts in two queries (one per table)
 * and stitch them back into a single Map keyed by slug. Posts that
 * don't appear in either table map to 0.
 *
 * Posts with an `id` always prefer the normalized count; only posts
 * without a metadata id fall back to the legacy table. This matches
 * the per-post helper so the two paths cannot disagree.
 */
export async function getPostViewsBySlug(
  posts: PostRef[],
): Promise<Map<string, ViewResult>> {
  const out = new Map<string, ViewResult>();

  if (posts.length === 0) return out;

  const supabase = getSupabaseAdmin();

  // Pull both tables in parallel. Use `in` queries — Postgres resolves
  // them as index scans so cost stays flat regardless of input size.
  const idList = Array.from(
    new Set(posts.map((p) => p.id).filter((id): id is string => !!id)),
  );

  const [normalizedResult, legacyResult] = await Promise.all([
    idList.length > 0
      ? supabase
          .from("post_view_counts")
          .select("post_id, view_count")
          .in("post_id", idList)
      : Promise.resolve({ data: [] as { post_id: string; view_count: number }[], error: null }),
    supabase
      .from("post_views")
      .select("post_slug, view_count")
      .in(
        "post_slug",
        posts.map((p) => p.slug),
      ),
  ]);

  const normalizedById = new Map<string, number>();
  for (const row of normalizedResult.data || []) {
    normalizedById.set(row.post_id, Number(row.view_count) || 0);
  }
  const legacyBySlug = new Map<string, number>();
  for (const row of legacyResult.data || []) {
    legacyBySlug.set(row.post_slug, Number(row.view_count) || 0);
  }

  for (const p of posts) {
    if (p.id && normalizedById.has(p.id)) {
      out.set(p.slug, {
        views: normalizedById.get(p.id)!,
        source: "post_view_counts",
      });
      continue;
    }
    const legacy = legacyBySlug.get(p.slug);
    if (legacy !== undefined) {
      out.set(p.slug, { views: legacy, source: "post_views" });
      continue;
    }
    out.set(p.slug, { views: 0, source: "none" });
  }

  return out;
}
