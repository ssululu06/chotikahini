// ─────────────────────────────────────────────────────────────
// Share Suggestions — Opportunity-Score ranking engine.
//
// Replaces the old "sort ascending by view_count, slice 8" logic in
// `app/api/admin/share-suggestions/route.ts`. The old approach had
// three flaws:
//   1. Zero-view stories always dominated, regardless of quality.
//   2. The same posts surfaced every day (no rotation, no cooldown).
//   3. No signal from engagement (likes/comments), only raw views.
//
// New approach — score every published story on five dimensions
// plus a cooldown penalty, then rank the top candidates. Top 3 are
// returned (per the requirement "দিনে ৩টার বেশি সাজেশন দিবে না").
//
// The output JSON also carries a `reasons` array so the admin UI
// can show why each story was picked (transparency).
// ─────────────────────────────────────────────────────────────

export interface SuggestionCandidate {
  slug: string;
  uid: string;
  title: string;
  cover: string;
  authorName?: string;
  categoryId?: string | null;
  tags?: string[];
  publishedAt: string;            // ISO
  readingMinutes: number;         // estimated, can be 0
  featured: boolean;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  previousSuggestedDates: string[]; // ISO dates (YYYY-MM-DD), most-recent first
  lastSuggestedDaysAgo: number | null; // null = never
}

export interface ScoredSuggestion extends SuggestionCandidate {
  score: number;
  reasons: string[];
}

export interface RankOptions {
  /** Max suggestions to return. Default 3. */
  limit?: number;
  /** How many days back a story stays in "cooling" mode. Default 14. */
  cooldownDays?: number;
  /** Current date for deterministic tests. Default new Date(). */
  now?: Date;
}

/** Number of days since a story was published (>= 0). */
function lifeDays(publishedAt: string, now: Date): number {
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return 0;
  const ms = now.getTime() - t;
  return Math.max(0, ms / 86_400_000);
}

/** Map a value in [0, max] to [0, 1] with smooth saturation. */
function saturate(x: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, x / max));
}

/** 0..1 — how "underperforming" a story is, given its age and views. */
function underperformance(
  views: number,
  days: number,
): { score: number; reason: string } {
  // We compare log(lifeDays+1) vs log(views+1). Equal logs == healthy.
  // Older posts naturally accumulate more views, so a near-zero or
  // negative residual means the post has been *ignored*.
  const life = Math.log10(days + 1);
  const seen = Math.log10(views + 1);
  const residual = Math.max(0, life - seen); // 0..∞
  const score = saturate(residual, 2); // saturate at residual>=2
  if (score === 0) {
    return { score: 0, reason: "ভিউ স্বাভাবিক" };
  }
  if (score > 0.66) {
    return { score, reason: `বয়স অনুযায়ী ভিউ অনেক কম (${Math.round(days)} দিন, ${views} ভিউ)` };
  }
  return { score, reason: `পুরনো গল্প হলেও ভিউ কম` };
}

/** 0..1 — engagement rate, with a floor so 1-view posts aren't 100% ratio. */
function engagementRate(
  likes: number,
  comments: number,
  views: number,
): { score: number; reason: string } {
  const denom = Math.max(views, 10);
  const rate = (likes + comments) / denom;
  // Empirically a great story hits ~5% engagement. Saturate at 5%.
  const score = saturate(rate, 0.05);
  if (score >= 0.6) {
    return { score, reason: `উচ্চ engagement (${likes} লাইক, ${comments} কমেন্ট)` };
  }
  if (likes + comments > 0) {
    return { score, reason: `ইনগেজমেন্ট আছে (${likes} লাইক, ${comments} কমেন্ট)` };
  }
  return { score: 0, reason: "কোনো ইনগেজমেন্ট নেই" };
}

/** 0..1 — recency boost. Strong first 30 days, slow decay to 1 year. */
function freshness(
  days: number,
): { score: number; reason: string } {
  if (days < 0) return { score: 0, reason: "ভবিষ্যতের তারিখ" };
  if (days <= 30) return { score: 1, reason: `নতুন প্রকাশিত (${Math.round(days)} দিন আগে)` };
  if (days <= 90) return { score: 0.66, reason: `${Math.round(days)} দিন আগে প্রকাশিত` };
  if (days <= 180) return { score: 0.33, reason: `${Math.round(days)} দিন আগে প্রকাশিত` };
  if (days <= 365) return { score: 0.15, reason: "এক বছরের কাছাকাছি" };
  return { score: 0, reason: "এক বছরের বেশি পুরনো" };
}

/** 0..1 — quality proxy from reading time. Sweet-spot 2-7 min. */
function quality(
  readingMinutes: number,
  featured: boolean,
): { score: number; reason: string } {
  if (featured) {
    return { score: 0.4, reason: "ইতোমধ্যে featured" };
  }
  if (readingMinutes < 1) {
    return { score: 0, reason: "খুব ছোট লেখা" };
  }
  if (readingMinutes >= 2 && readingMinutes <= 7) {
    return { score: 1, reason: `${readingMinutes} মিনিটের পড়ার সময়` };
  }
  if (readingMinutes > 7 && readingMinutes <= 12) {
    return { score: 0.7, reason: `${readingMinutes} মিনিটের দীর্ঘ লেখা` };
  }
  return { score: 0.4, reason: "মাঝারি দৈর্ঘ্যের লেখা" };
}

/**
 * Cooldown penalty — pushes recently-shown stories to the bottom of
 * the ranking. Penalty gets stronger the more recent the last show,
 * and scales with how many times it has been shown.
 */
function cooldownPenalty(
  lastSuggestedDaysAgo: number | null,
  previousCount: number,
  cooldownDays: number,
): { penalty: number; reason: string } {
  if (lastSuggestedDaysAgo === null) {
    return { penalty: 0, reason: "এখনো সাজেস্ট হয়নি" };
  }
  if (lastSuggestedDaysAgo < cooldownDays) {
    // Linear ramp: just-shown gets full penalty, near-end-of-cooldown barely any.
    const freshness = saturate(1 - lastSuggestedDaysAgo / cooldownDays, 1);
    const repetitionBoost = Math.min(0.5, previousCount * 0.1);
    const penalty = Math.min(1.5, 0.6 * freshness + repetitionBoost);
    return {
      penalty,
      reason: `${lastSuggestedDaysAgo} দিন আগে সাজেস্ট হয়েছে (${previousCount} বার)`,
    };
  }
  return {
    penalty: 0,
    reason: `কুলডাউন শেষ (${lastSuggestedDaysAgo} দিন)`,
  };
}

/**
 * Diversity bonus — wants to spread suggestions across categories.
 * `seenCategoryCounts` is mutated by reference so the caller can run
 * it across the ranked list.
 */
function diversityBoost(
  candidate: SuggestionCandidate,
  seenCategoryCounts: Map<string, number>,
): { score: number; reason: string } {
  const cat = candidate.categoryId || "_uncategorized";
  const seen = seenCategoryCounts.get(cat) || 0;
  if (seen === 0) {
    seenCategoryCounts.set(cat, 1);
    return { score: 0.15, reason: `নতুন ক্যাটাগরি: ${cat}` };
  }
  seenCategoryCounts.set(cat, seen + 1);
  if (seen >= 2) {
    return { score: -0.2, reason: `${cat} ক্যাটাগরিতে আগেও সাজেস্ট` };
  }
  return { score: 0, reason: `${cat} ক্যাটাগরিতে পুনরাবৃত্তি` };
}

/**
 * Rank candidates by Opportunity Score.
 * Pure function — no DB, no side effects.
 */
export function rankSuggestionCandidates(
  candidates: SuggestionCandidate[],
  options: RankOptions = {},
): ScoredSuggestion[] {
  const limit = options.limit ?? 3;
  const cooldownDays = options.cooldownDays ?? 14;
  const now = options.now ?? new Date();

  const seenCategoryCounts = new Map<string, number>();
  const scored: ScoredSuggestion[] = [];

  for (const c of candidates) {
    const days = lifeDays(c.publishedAt, now);
    const up = underperformance(c.viewCount, days);
    const er = engagementRate(c.likeCount, c.commentCount, c.viewCount);
    const fr = freshness(days);
    const qu = quality(c.readingMinutes, !!c.featured);

    const base =
      0.4 * up.score +
      0.25 * er.score +
      0.15 * fr.score +
      0.1 * qu.score;

    const cd = cooldownPenalty(
      c.lastSuggestedDaysAgo,
      c.previousSuggestedDates.length,
      cooldownDays,
    );

    // Diversity — applied only when scoring for the *final ranking*,
    // so the same category doesn't hog the top 3. We run a second
    // pass below; here we just compute the pre-diversity score.
    const scoreAfterCooldown = Math.max(0, base - cd.penalty);

    scored.push({
      ...c,
      score: scoreAfterCooldown, // diversity applied below
      reasons: [
        up.reason,
        er.reason,
        fr.reason,
        qu.reason,
        ...(cd.penalty > 0 ? [cd.reason] : [cd.reason]),
      ],
    });
  }

  // Provisional ranking without diversity
  // 1. Drop stories still in cooldown from the *competitive* ranking.
  //    A penalty alone isn't enough when only a handful of posts have
  //    any meaningful score — a freshly-served story would still beat
  //    every long-shot candidate and re-surface the next day. Hard-
  //    excluding them for the duration of the cooldown guarantees the
  //    "same story again tomorrow" complaint doesn't happen.
  //    Ineligible stories still go into the fallback pool below so
  //    the panel never goes empty.
  const eligible = scored.filter(
    (c) => c.lastSuggestedDaysAgo === null || c.lastSuggestedDaysAgo >= cooldownDays,
  );
  const ineligible = scored.filter(
    (c) => c.lastSuggestedDaysAgo !== null && c.lastSuggestedDaysAgo < cooldownDays,
  );

  const provisional = eligible.slice().sort((a, b) => b.score - a.score);

  // Take a wider top window to give diversity a chance to swap in
  // fresh categories over already-shown-but-not-cooling stories.
  const topWindow = provisional.slice(0, Math.max(limit * 3, 10));

  const reranked = topWindow
    .map((c) => {
      const dv = diversityBoost(c, seenCategoryCounts);
      const finalScore = Math.max(0, c.score + dv.score);
      const reasons = [...c.reasons];
      if (dv.reason) reasons.push(dv.reason);
      return { ...c, score: finalScore, reasons };
    })
    .sort((a, b) => b.score - a.score);

  let picked = reranked.slice(0, limit);

  // FILL-A: the eligible pool ran dry before we had `limit` picks.
  // Top up from the cooldown pool so the admin always gets a full
  // board — and take the *least recently served* ones first so the
  // board still rotates instead of showing the same top story.
  if (picked.length < limit && ineligible.length > 0) {
    const taken = new Set(picked.map((c) => c.slug));
    const topUp = ineligible
      .filter((c) => !taken.has(c.slug))
      .sort((a, b) => {
        const ad = a.lastSuggestedDaysAgo ?? Infinity;
        const bd = b.lastSuggestedDaysAgo ?? Infinity;
        if (ad !== bd) return bd - ad; // longest wait first
        return Date.parse(a.publishedAt) - Date.parse(b.publishedAt);
      })
      .slice(0, limit - picked.length)
      .map((c) => ({
        ...c,
        reasons: [
          ...c.reasons,
          `কুলডাউনে আছে (${c.lastSuggestedDaysAgo} দিন আগে সাজেস্ট) — নতুন গল্প না থাকায় দেখানো হয়েছে`,
        ],
      }));
    picked = [...picked, ...topUp];
  }

  // FALLBACK: nothing scored at all (e.g. the views/engagement tables
  // came back empty). Surface the longest-waiting stories rather than
  // showing the admin an empty box.
  if (picked.length === 0 && scored.length > 0) {
    picked = [...scored]
      .sort((a, b) => {
        const ad = a.lastSuggestedDaysAgo ?? Infinity;
        const bd = b.lastSuggestedDaysAgo ?? Infinity;
        if (ad !== bd) return bd - ad; // longest wait first
        return Date.parse(a.publishedAt) - Date.parse(b.publishedAt);
      })
      .slice(0, limit)
      .map((c) => ({
        ...c,
        score: 0,
        reasons: ["ফলব্যাক: কোনো ভালো স্কোর পাওয়া যায়নি, ঘুরিয়ে দেখাচ্ছে"],
      }));
  }

  return picked;
}

/**
 * Aggregate engagement counters from raw PostgREST rows.
 * Accepts likes/comments rows where each has either `post_slug` or
 * `post_id` so it works against both legacy and migrated schemas.
 */
export function aggregateEngagement(
  likes: Array<{ post_slug?: string; post_id?: string }>,
  comments: Array<{ post_slug?: string; post_id?: string }>,
  metadata: Array<{ id: string; slug: string }>,
): {
  bySlug: Map<string, { likes: number; comments: number }>;
  idToSlug: Map<string, string>;
} {
  const idToSlug = new Map<string, string>();
  for (const m of metadata) idToSlug.set(m.id, m.slug);

  const bySlug = new Map<string, { likes: number; comments: number }>();
  const lookup = (row: { post_slug?: string; post_id?: string }) => {
    if (row.post_slug) return row.post_slug;
    if (row.post_id && idToSlug.get(row.post_id)) {
      return idToSlug.get(row.post_id)!;
    }
    return null;
  };
  for (const l of likes) {
    const slug = lookup(l);
    if (!slug) continue;
    const entry = bySlug.get(slug) || { likes: 0, comments: 0 };
    entry.likes += 1;
    bySlug.set(slug, entry);
  }
  for (const c of comments) {
    const slug = lookup(c);
    if (!slug) continue;
    const entry = bySlug.get(slug) || { likes: 0, comments: 0 };
    entry.comments += 1;
    bySlug.set(slug, entry);
  }
  return { bySlug, idToSlug };
}

/**
 * Convert raw row counts into SuggestionCandidate[].
 * Drops posts not yet published and posts missing a slug/uid.
 */
export function buildCandidatesFromPosts(
  posts: Array<{
    slug: string;
    uid?: string | null;
    title: string;
    cover?: string;
    authorName?: string;
    categoryId?: string | null;
    tags?: string[];
    publishedAt: string;
    status: string;
    readingTime?: string;
    featured?: boolean;
  }>,
  viewCountBySlug: Map<string, number>,
  engagementBySlug: Map<string, { likes: number; comments: number }>,
  servedDatesBySlug: Map<string, string[]>, // YYYY-MM-DD most-recent-first
): SuggestionCandidate[] {
  const now = Date.now();
  return posts
    .filter(
      (post) =>
        post.status === "published" &&
        Number.isFinite(Date.parse(post.publishedAt)) &&
        Date.parse(post.publishedAt) <= now &&
        post.slug &&
        (post.uid || post.slug),
    )
    .map((p) => {
      const views = viewCountBySlug.get(p.slug) || 0;
      const eng = engagementBySlug.get(p.slug) || { likes: 0, comments: 0 };
      const servedDates = servedDatesBySlug.get(p.slug) || [];

      let lastSuggestedDaysAgo: number | null = null;
      if (servedDates.length > 0) {
        const t = Date.parse(servedDates[0] + "T00:00:00Z");
        if (!Number.isNaN(t)) {
          lastSuggestedDaysAgo = Math.max(
            0,
            Math.floor((Date.now() - t) / 86_400_000),
          );
        }
      }

      return {
        slug: p.slug,
        uid: p.uid || p.slug,
        title: p.title,
        cover: p.cover || "",
        authorName: p.authorName,
        categoryId: p.categoryId ?? null,
        tags: p.tags || [],
        publishedAt: p.publishedAt,
        readingMinutes: parseReadingMinutes(p.readingTime),
        featured: !!p.featured,
        viewCount: views,
        likeCount: eng.likes,
        commentCount: eng.comments,
        previousSuggestedDates: servedDates,
        lastSuggestedDaysAgo,
      };
    });
}

/** "5 min read" / "5 মিনিট" / "৫ মিনিট" → 5 */
export function parseReadingMinutes(text?: string | null): number {
  if (!text) return 0;
  const cleaned = String(text).replace(/[০-৯]/g, (d) =>
    "০১২৩৪৫৬৭৮৯".indexOf(d).toString(),
  );
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  return match ? Math.round(parseFloat(match[1])) : 0;
}
