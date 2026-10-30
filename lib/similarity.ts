// ─────────────────────────────────────────────────────────────
// Content similarity detection — used to show admins how much a
// new/edited post matches existing posts (duplicate-content check).
//
// Uses bigram Jaccard similarity which is robust for Bengali text:
// two texts sharing many two-word sequences are very likely copies.
// ─────────────────────────────────────────────────────────────

/** Normalize text: lowercase, collapse punctuation & whitespace. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[।,;:!?()"'‘’“”\-—–…·•*#_\[\]{}|\\/`~@$%^&+=<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokenize into words (length > 1 to skip single letters). */
export function tokenizeWords(text: string): string[] {
  return normalizeText(text).split(" ").filter((w) => w.length > 1);
}

/** Build a set of word bigrams ("একটি গল্প", "গল্প পড়া", ...). */
export function bigrams(text: string): Set<string> {
  const words = tokenizeWords(text);
  const set = new Set<string>();
  for (let i = 0; i < words.length - 1; i++) {
    set.add(words[i] + " " + words[i + 1]);
  }
  return set;
}

/** Jaccard similarity between two sets (0..1). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const item of smaller) {
    if (larger.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Similarity percentage (0–100) between two texts using bigram Jaccard.
 */
export function similarityPercent(a: string, b: string): number {
  return Math.round(jaccard(bigrams(a), bigrams(b)) * 100);
}

export interface SimilarityMatch {
  uid: string | null;
  slug: string;
  title: string;
  similarity: number; // 0–100
  authorName?: string;
}

/**
 * Compare content against every published story in the database.
 * Used by the submit-story API to auto-flag duplicates on submission.
 * Threshold is 0–1 (0.70 = 70% match).
 *
 * Uses the ADVANCED weighted score (word-bigram Jaccard + containment +
 * character-trigram Jaccard) so genuinely similar Bengali text is detected
 * even when word order / morphology differs — plain bigram Jaccard alone
 * almost always returns ~0% for slightly reworded content.
 */
export async function checkStorySimilarity(
  content: string,
  title: string,
  currentUid: string | null | undefined,
  threshold: number
): Promise<{
  isDuplicate: boolean;
  matchedStory: { uid: string; slug: string; title: string; similarityPercent: number } | null;
  matches: { uid: string; slug: string; title: string; similarityPercent: number }[];
}> {
  try {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    const supabase = getSupabaseAdmin();

    const { data: stories } = await supabase
      .from("stories")
      .select("uid, slug, title, content")
      .neq("status", "hidden")
      .limit(2000);

    const candidates = (stories || [])
      .map((s: any) => ({
        uid: s.uid ?? null,
        slug: s.slug,
        title: s.title,
        content: s.content || "",
      }))
      .filter((c: any) => c.content && c.content.trim().length >= 100 && c.uid !== currentUid && c.slug !== currentUid);

    const queryText = content + " " + title;
    const queryPrep = preprocessForSimilarity(queryText);

    const scored = candidates.map((c) => {
      const otherText = c.content + " " + c.title;
      const otherPrep = preprocessForSimilarity(otherText);
      return { ...c, similarityPercent: Math.round(scorePreprocessed(queryPrep, otherPrep) * 100) };
    });

    scored.sort((a, b) => b.similarityPercent - a.similarityPercent);

    const topMatch = scored[0] || null;
    const isDuplicate = topMatch !== null && topMatch.similarityPercent >= threshold * 100;

    return {
      isDuplicate,
      matchedStory: topMatch ? { uid: topMatch.uid || "", slug: topMatch.slug, title: topMatch.title, similarityPercent: topMatch.similarityPercent } : null,
      matches: scored.slice(0, 5).map((m) => ({ uid: m.uid || "", slug: m.slug, title: m.title, similarityPercent: m.similarityPercent })),
    };
  } catch (e) {
    return { isDuplicate: false, matchedStory: null, matches: [] };
  }
}

/**
 * Compare content against a list of candidate posts and return the
 * top matches sorted by similarity descending.
 * Optionally exclude a current post (by uid/slug) so editing doesn't
 * match itself.
 *
 * Uses the advanced weighted score (word-bigram Jaccard + containment +
 * char-trigram Jaccard) for much better accuracy on Bengali text than
 * plain bigram Jaccard alone.
 */
export function findSimilarPosts(
  content: string,
  candidates: { uid?: string | null; slug: string; title: string; content?: string; authorName?: string }[],
  excludeRef?: string | null,
  limit = 5
): SimilarityMatch[] {
  const query = content || "";
  if (query.trim().length < 100) return [];

  const queryPrep = preprocessForSimilarity(query);
  const scored: SimilarityMatch[] = [];

  for (const post of candidates) {
    const ref = post.uid || post.slug;
    if (excludeRef && (ref === excludeRef || post.slug === excludeRef)) continue;

    const otherContent = post.content || "";
    if (!otherContent || otherContent.trim().length < 100) continue;

    const otherPrep = preprocessForSimilarity(otherContent);
    const score = Math.round(scorePreprocessed(queryPrep, otherPrep) * 100);
    if (score >= 20) {
      scored.push({
        uid: post.uid ?? null,
        slug: post.slug,
        title: post.title,
        similarity: score,
        authorName: post.authorName,
      });
    }
  }

  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}
// ─────────────────────────────────────────────────────────────
// ADVANCED similarity — more accurate than plain bigram Jaccard.
//
// Combines three signals:
//   1. Word-bigram Jaccard   — shared two-word sequences
//   2. Containment           — how much of the SHORTER text is copied
//                              inside the longer one (catches copied
//                              segments inside long stories)
//   3. Character-trigram Jaccard — robust to word-order & morphology
//      changes (Bengali inflection)
//
// Threshold-friendly: scores near 70%+ are strong duplication signals.
// ─────────────────────────────────────────────────────────────

/** Character trigrams of the normalized text (skips whitespace). */
export function charTrigrams(text: string): Set<string> {
  const norm = normalizeText(text).replace(/\s/g, "");
  const set = new Set<string>();
  if (norm.length < 3) return set;
  for (let i = 0; i <= norm.length - 3; i++) {
    set.add(norm.slice(i, i + 3));
  }
  return set;
}

/** Containment: fraction of the smaller set present in the larger (0..1). */
export function containment(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  let overlap = 0;
  for (const item of smaller) {
    if (larger.has(item)) overlap++;
  }
  return overlap / smaller.size;
}

/** Combined advanced similarity score (0..1). */
export function advancedSimilarity(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  if (!normA || !normB) return 0;

  const ab = bigrams(normA);
  const bb = bigrams(normB);
  if (ab.size === 0 || bb.size === 0) return 0;

  const jac = jaccard(ab, bb);
  const cont = containment(ab, bb);
  const ctJac = jaccard(charTrigrams(normA), charTrigrams(normB));

  // Weighted: Jaccard 40%, containment 35%, char-trigram 25%
  return 0.4 * jac + 0.35 * cont + 0.25 * ctJac;
}

/** Advanced similarity as a percentage (0–100). */
export function advancedSimilarityPercent(a: string, b: string): number {
  return Math.round(advancedSimilarity(a, b) * 100);
}

/**
 * Pre-processed text for fast bulk comparison — pre-computes all the
 * n-gram sets ONCE so pairwise comparison is cheap.
 */
export interface PreprocessedText {
  words: string[];
  bigramSet: Set<string>;
  trigramSet: Set<string>;
}

/** Pre-compute n-gram sets for a text (for bulk similarity scanning). */
export function preprocessForSimilarity(text: string): PreprocessedText {
  const norm = normalizeText(text);
  const words = tokenizeWords(norm);
  const bigramSet = bigrams(norm);
  const trigramSet = charTrigrams(norm);
  return { words, bigramSet, trigramSet };
}

/** Fast pairwise score between two pre-processed texts (0..1). */
export function scorePreprocessed(a: PreprocessedText, b: PreprocessedText): number {
  if (a.bigramSet.size === 0 || b.bigramSet.size === 0) return 0;
  const jac = jaccard(a.bigramSet, b.bigramSet);
  const cont = containment(a.bigramSet, b.bigramSet);
  const ctJac = jaccard(a.trigramSet, b.trigramSet);
  return 0.4 * jac + 0.35 * cont + 0.25 * ctJac;
}
