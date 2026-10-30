/**
 * keyword-engine.ts
 *
 * Central SEO keyword engine. Reads search.md once at build time and
 * provides structured keyword clusters, intent matching, and
 * relevance scoring for the entire website.
 *
 * search.md is NEVER exposed to the client — it is used only to
 * generate optimized SEO metadata.
 */

import fs from "fs";
import path from "path";

/* ── Types ──────────────────────────────────────────────────────── */

export type SearchIntent = "informational" | "navigational" | "commercial" | "transactional";

export interface Keyword {
  term: string;
  normalized: string;
  clusterId: string;
  intent: SearchIntent;
  volume: number; // relative priority 1–10
}

export interface KeywordCluster {
  id: string;
  name: string;
  keywords: Keyword[];
  intent: SearchIntent;
  /** Category IDs this cluster maps to (for auto-tagging) */
  categoryIds: string[];
  /** Tags this cluster suggests */
  suggestedTags: string[];
  /** High-value SEO phrases from this cluster */
  primaryPhrases: string[];
}

export interface KeywordMatch {
  cluster: KeywordCluster;
  score: number;
  matchedTerms: string[];
}

/* ── Cluster definitions (hand-curated from search.md data) ─────── */

const CLUSTER_DEFS: Omit<KeywordCluster, "keywords">[] = [
  {
    id: "choti-golpo",
    name: "চটি গল্প",
    intent: "informational",
    categoryIds: ["prem", "hot"],
    suggestedTags: ["চটি গল্প", "বাংলা চটি", "গল্প", "বাংলা গল্প"],
    primaryPhrases: ["বাংলা চটি গল্প", "চটি গল্প", "বাংলা চটি কাহিনী", "bangla choti golpo"],
  },
  {
    id: "choda-chudi",
    name: "চোদাচুদি",
    intent: "informational",
    categoryIds: ["hot", "bibahito"],
    suggestedTags: ["চোদাচুদি", "সেক্স কাহিনী", "সেক্স কথা", "চোদাচুদি গল্প"],
    primaryPhrases: ["চোদাচুদি", "চোদাচুদি গল্প", "সেক্স কাহিনী", "সেক্সের গল্প"],
  },
  {
    id: "panu-golpo",
    name: "পানু গল্প",
    intent: "informational",
    categoryIds: ["hot", "tarona"],
    suggestedTags: ["পানু গল্প", "বাংলা পানু", "পানু", "আঞ্চলিক গল্প"],
    primaryPhrases: ["পানু গল্প", "বাংলা পানু গল্প", "panu golpo", "bangla panu golpo"],
  },
  {
    id: "family-relations",
    name: "পরিবারিক সম্পর্ক",
    intent: "informational",
    categoryIds: ["bodhu", "porokiya", "prem"],
    suggestedTags: ["ভাবি-দেবর", "ভাই-বোন", "পরিবারিক", "বৌদি", "চাচা-খালা"],
    primaryPhrases: ["ভাবি দেবর", "ভাই বোন", "বৌদি দেবর", "পরিবারিক গল্প"],
  },
  {
    id: "boudi-debor",
    name: "বৌদি-দেবর",
    intent: "informational",
    categoryIds: ["bodhu", "porokiya"],
    suggestedTags: ["বৌদি", "দেবর", "ভাবি", "বৌদি-দেবর গল্প"],
    primaryPhrases: ["বৌদি দেবর", "ভাবি দেবর", "বৌদি", "দেবর ভাবি"],
  },
  {
    id: "bhai-bon",
    name: "ভাই-বোন",
    intent: "informational",
    categoryIds: ["prem", "porokiya"],
    suggestedTags: ["ভাই-বোন", "ভাইবোন", "ভাই বোনের গল্প"],
    primaryPhrases: ["ভাই বোন", "ভাইবোনের গল্প", "ভাই বোন প্রেম"],
  },
  {
    id: "specific-authors",
    name: "নির্দিষ্ট লেখক",
    intent: "navigational",
    categoryIds: ["prem", "hot"],
    suggestedTags: ["আশাপূর্ণা দেবী", "হুমায়ূন আহমেদ", "মহাভারত"],
    primaryPhrases: ["ashapurna devi choto golpo", "humayun ahmed", "mahabharat choti golpo"],
  },
  {
    id: "variations-misspellings",
    name: "বানান ভিন্নতা",
    intent: "informational",
    categoryIds: [],
    suggestedTags: [],
    primaryPhrases: [],
  },
  {
    id: "latest-new",
    name: "নতুন গল্প",
    intent: "informational",
    categoryIds: [],
    suggestedTags: ["নতুন চটি", "নতুন গল্প", "latest bangla choti"],
    primaryPhrases: ["নতুন চটি গল্প", "latest bangla choti", "new choti golpo"],
  },
];

/* ── Raw keyword loading ────────────────────────────────────────── */

const searchMdPath = path.join(process.cwd(), "search.md");

function loadRawKeywords(): string[] {
  try {
    const content = fs.readFileSync(searchMdPath, "utf-8");
    return content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("Keyword"));
  } catch {
    console.warn("[keyword-engine] search.md not found — using empty keyword set");
    return [];
  }
}

function normalizeTerm(term: string): string {
  return term
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\s-]+/g, " ")
    .trim();
}

/* ── Build the keyword database ─────────────────────────────────── */

function buildKeywordDatabase(): { clusters: KeywordCluster[]; allKeywords: Keyword[] } {
  const raw = loadRawKeywords();
  const termSet = new Set(raw.map(normalizeTerm));
  const clusters: KeywordCluster[] = [];

  for (const def of CLUSTER_DEFS) {
    const keywords: Keyword[] = [];
    const seen = new Set<string>();

    for (const rawTerm of raw) {
      const normalized = normalizeTerm(rawTerm);

      // Assign keyword to cluster based on matching heuristics
      let belongs = false;
      const lc = normalized;

      if (def.id === "choti-golpo" && /choti|চটি|choto|গল্প|golpo|story/.test(lc) && !/panu|পানু/.test(lc)) {
        if (!/চোদা|সেক্স|ভাবি|বৌদি|ভাই.*বোন|ashapurna|humayun|mahabharat/.test(lc)) belongs = true;
      }
      if (def.id === "choda-chudi" && /চোদা|সেক্স|সেক্স/.test(lc)) belongs = true;
      if (def.id === "panu-golpo" && /panu|পানু/.test(lc)) belongs = true;
      if (def.id === "family-relations" && /ভাবি|বৌদি|ভাই.*বোন|পরিবার/.test(lc)) belongs = true;
      if (def.id === "boudi-debor" && /ভাবি|বৌদি|দেবর/.test(lc)) belongs = true;
      if (def.id === "bhai-bon" && /ভাই.*বোন|ভাইবোন/.test(lc)) belongs = true;
      if (def.id === "specific-authors" && /ashapurna|humayun|mahabharat|বাংলা.*বই/.test(lc)) belongs = true;
      if (def.id === "latest-new" && /new|latest|নতুন/.test(lc)) belongs = true;
      if (def.id === "variations-misspellings" && /com$|^www\b|bd |free |indian|collection|wordpress/.test(lc)) belongs = true;

      if (belongs && !seen.has(normalized)) {
        seen.add(normalized);
        keywords.push({
          term: rawTerm,
          normalized,
          clusterId: def.id,
          intent: def.intent,
          volume: rawTerm.length > 10 ? 7 : 5, // longer phrases often more specific
        });
      }
    }

    // If a cluster got no direct matches, include any remaining unassigned keywords
    // as fallback for the variations cluster
    if (keywords.length > 0 || def.id !== "variations-misspellings") {
      clusters.push({ ...def, keywords });
    }
  }

  // Collect all unassigned keywords into variations-misspellings
  const assigned = new Set(clusters.flatMap((c) => c.keywords.map((k) => k.normalized)));
  const unassigned: Keyword[] = [];
  for (const term of raw) {
    const n = normalizeTerm(term);
    if (!assigned.has(n)) {
      unassigned.push({
        term,
        normalized: n,
        clusterId: "variations-misspellings",
        intent: "informational",
        volume: 3,
      });
    }
  }
  if (unassigned.length > 0) {
    const vIdx = clusters.findIndex((c) => c.id === "variations-misspellings");
    if (vIdx >= 0) clusters[vIdx].keywords.push(...unassigned);
    else {
      const vDef = CLUSTER_DEFS.find((c) => c.id === "variations-misspellings")!;
      clusters.push({ ...vDef, keywords: unassigned });
    }
  }

  const allKeywords = clusters.flatMap((c) => c.keywords);
  return { clusters, allKeywords };
}

/* ── Cached singleton ───────────────────────────────────────────── */

let db: ReturnType<typeof buildKeywordDatabase> | null = null;

function getDb() {
  if (!db) db = buildKeywordDatabase();
  return db;
}

/* ── Public API ─────────────────────────────────────────────────── */

/** Get all keyword clusters */
export function getAllClusters(): KeywordCluster[] {
  return getDb().clusters;
}

/** Get all keywords as a flat list */
export function getAllKeywords(): Keyword[] {
  return getDb().allKeywords;
}

/** Get a cluster by ID */
export function getCluster(id: string): KeywordCluster | undefined {
  return getDb().clusters.find((c) => c.id === id);
}

/**
 * Memoized results of the full cluster scan, keyed by the normalized
 * text. The scan is O(clusters × keywords) with a string `includes()`
 * per keyword, and it runs for every story render (metadata, related
 * posts, SEO description). The same text is scanned repeatedly within a
 * single request, so caching the sorted match list removes that work.
 *
 * The cached value is the FULL sorted list — each caller slices it to
 * its own `limit`, so different limits share one computation.
 */
const matchCache = new Map<string, KeywordMatch[]>();
const MATCH_CACHE_MAX = 500;

/**
 * Find the best-matching keyword cluster(s) for a given text
 * (title + description + content). Returns matches sorted by
 * relevance score descending.
 */
export function findMatchingClusters(
  text: string,
  limit = 3,
): KeywordMatch[] {
  if (!text) return [];

  const lc = text.normalize("NFC").toLowerCase();

  const cached = matchCache.get(lc);
  if (cached) return cached.slice(0, limit);

  const matches: KeywordMatch[] = [];

  for (const cluster of getDb().clusters) {
    if (cluster.keywords.length === 0) continue;

    const matchedTerms: string[] = [];
    let score = 0;

    for (const kw of cluster.keywords) {
      if (lc.includes(kw.normalized)) {
        matchedTerms.push(kw.term);
        score += kw.volume;
      }
    }

    // Bonus for title matches
    const titleText = lc.split("\n")[0] || "";
    for (const kw of cluster.keywords) {
      if (titleText.includes(kw.normalized)) {
        score += kw.volume * 2;
      }
    }

    if (score > 0) {
      matches.push({ cluster, score, matchedTerms });
    }
  }

  matches.sort((a, b) => b.score - a.score);

  // Bound the cache so a crawler sweeping arbitrary text cannot grow
  // memory without limit.
  if (matchCache.size >= MATCH_CACHE_MAX) matchCache.clear();
  matchCache.set(lc, matches);

  return matches.slice(0, limit);
}

/**
 * Generate SEO-optimized title for a post using keyword data.
 * Falls back gracefully when no cluster matches.
 */
export function generateSeoTitle(
  title: string,
  matches?: KeywordMatch[],
): string {
  if (!matches || matches.length === 0) return title;

  const top = matches[0];
  const primary = top.cluster.primaryPhrases[0] || top.cluster.name;

  // If the title already contains the primary phrase, keep it as-is
  if (primary && title.normalize("NFC").toLowerCase().includes(primary.toLowerCase())) {
    return title;
  }

  // Google typically displays the first 50-60 characters of a title tag.
  // If we can fit the primary keyword phrase within 60 chars, append it.
  if (primary && (title.length + primary.length + 3) <= 60) {
    return `${title} - ${primary}`;
  }

  return title;
}

/**
 * Generate SEO-optimized meta description for a post.
 */
export function generateSeoDescription(
  description: string,
  matches?: KeywordMatch[],
  maxLength = 160,
): string {
  if (!matches || matches.length === 0) return description.slice(0, maxLength);

  const top = matches[0];
  const phrase = top.cluster.primaryPhrases[0];

  // If description already contains a keyword, keep it
  for (const kw of top.cluster.keywords) {
    if (description.normalize("NFC").toLowerCase().includes(kw.normalized)) {
      return description.slice(0, maxLength);
    }
  }

  // Prepend a keyword phrase naturally
  if (phrase && description.length > 0) {
    const enriched = `${phrase} — ${description}`;
    if (enriched.length <= maxLength) return enriched;
  }

  return description.slice(0, maxLength);
}

/**
 * Generate keyword-rich tags for a post based on keyword clusters.
 */
export function generateTags(
  existingTags: string[],
  matches?: KeywordMatch[],
): string[] {
  const tagSet = new Set(existingTags.map((t) => t.normalize("NFC")));

  if (matches) {
    for (const m of matches) {
      for (const tag of m.cluster.suggestedTags) {
        tagSet.add(tag);
      }
    }
  }

  return Array.from(tagSet).slice(0, 8);
}

/**
 * Generate Open Graph / Twitter title.
 */
export function generateSocialTitle(title: string): string {
  // Social titles can be slightly punchier — keep within ~60 chars
  return title.length <= 60 ? title : title.slice(0, 57).replace(/\s+\S*$/, "") + "…";
}

/**
 * Generate unique keywords meta tag value for a page.
 */
export function generateKeywordsTag(
  matches?: KeywordMatch[],
  existingKeywords?: string,
): string {
  const parts = new Set<string>();

  if (existingKeywords) {
    for (const k of existingKeywords.split(",").map((s) => s.trim())) {
      parts.add(k);
    }
  }

  if (matches) {
    for (const m of matches) {
      for (const kw of m.cluster.keywords) {
        parts.add(kw.term);
      }
    }
  }

  return Array.from(parts).slice(0, 15).join(", ");
}

/**
 * Generate sitemap priority based on keyword relevance.
 * Homepage = 1.0, highly relevant posts get 0.9, others get 0.7.
 */
export function generateSitemapPriority(
  isHomepage: boolean,
  matches?: KeywordMatch[],
): number {
  if (isHomepage) return 1.0;
  if (!matches || matches.length === 0) return 0.6;
  const topScore = matches[0].score;
  if (topScore >= 10) return 0.9;
  if (topScore >= 5) return 0.8;
  return 0.7;
}

/**
 * Generate category suggestions from keyword clusters.
 */
export function generateCategorySuggestions(matches?: KeywordMatch[]): string[] {
  if (!matches) return [];
  const cats = new Set<string>();
  for (const m of matches) {
    for (const c of m.cluster.categoryIds) {
      cats.add(c);
    }
  }
  return Array.from(cats);
}

/**
 * Generate internal linking suggestions: slugs of other posts that
 * share keyword clusters.
 */
export function generateInternalLinkSuggestions(
  currentSlug: string,
  matches: KeywordMatch[],
  allSlugs: string[],
): string[] {
  if (matches.length === 0) return [];

  const matchedClusterIds = new Set(matches.map((m) => m.cluster.id));

  // In a full implementation, you'd cross-reference against a
  // precomputed index of post → cluster mappings. For now, return
  // the cluster info so the caller can use it.
  return Array.from(matchedClusterIds);
}

/**
 * Generate JSON-LD keywords string for article schema.
 */
export function generateJsonLdKeywords(matches?: KeywordMatch[]): string {
  if (!matches || matches.length === 0) return "";
  const terms = new Set<string>();
  for (const m of matches) {
    for (const kw of m.cluster.keywords) {
      terms.add(kw.term);
    }
  }
  return Array.from(terms).slice(0, 10).join(", ");
}

/**
 * Get all unique keyword phrases (for sitemap, RSS, etc.)
 */
export function getAllKeywordPhrases(): string[] {
  const phrases = new Set<string>();
  for (const cluster of getDb().clusters) {
    for (const phrase of cluster.primaryPhrases) {
      if (phrase) phrases.add(phrase);
    }
  }
  return Array.from(phrases);
}

/** Detect if two posts share keyword cluster relevance */
export function postsAreKeywordRelated(
  postAText: string,
  postBText: string,
): boolean {
  const matchesA = findMatchingClusters(postAText, 2);
  const matchesB = findMatchingClusters(postBText, 2);
  if (matchesA.length === 0 || matchesB.length === 0) return false;

  const clusterIdsA = new Set(matchesA.map((m) => m.cluster.id));
  const clusterIdsB = new Set(matchesB.map((m) => m.cluster.id));

  for (const id of clusterIdsA) {
    if (clusterIdsB.has(id)) return true;
  }
  return false;
}
