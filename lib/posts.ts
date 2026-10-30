import { cache } from "react";
import readingTime from "reading-time";
import { getAllCategoryConfigs, getCategoryConfig, getAuthor } from "./config";
import { getCoverPool, isCoverAvailable } from "./cover";
import { postsAreKeywordRelated } from "./keyword-engine";
import { getSupabaseAdmin } from "./supabase";
import { normalizeRef } from "./utils";
import { cachedRead, clearMemoryCache, invalidateTags, CACHE_TAGS } from "./cache";
import { clearOgCache } from "./og-cache";

/* ── Types ──────────────────────────────────────────────────────── */

export interface PostMeta {
  slug: string;
  uid: string | null;
  fileSlug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  scheduledAt?: string | null;
  authorId: string;
  authorName: string;
  authorImage: string;
  authorBio: string;
  authorVerified?: boolean;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  tags: string[];
  cover: string;
  featured: boolean;
  readingTime: string;
  previousPost: string | null;
  nextPost?: string | null;
  sourceUrl?: string | null;
  status: "published" | "pending" | "revision_requested" | "rejected" | "draft";
  comments: { name: string; date: string; comment: string }[];
  source?: "mdx" | "supabase";
}

export interface Post extends PostMeta {
  content: string;
}

function getReadingTime(text: string): string {
  const stats = readingTime(text || "");
  return stats.text;
}

let cachedPosts: Post[] | null = null;

/**
 * Flush every tier of the post cache after a write:
 *  • L1 in-process memory (this instance)
 *  • L2 Next.js Data Cache + CDN copies (by tag, all instances)
 *  • Rendered OG images (title/cover of an edited story changes its card)
 * Called by every story write (publish / edit / delete / user rename).
 */
export function clearPostsCache() {
  cachedPosts = null;
  clearMemoryCache(); // drop all L1 entries (posts, content, search, users)
  invalidateTags(CACHE_TAGS.posts);
  clearOgCache();
}

interface StoryRow {
  id?: string;
  uid?: string;
  slug?: string;
  title?: string;
  description?: string;
  author_id?: string;
  category?: string;
  tags?: string[] | null;
  cover?: string;
  featured?: boolean;
  previous_post?: string;
  status?: string;
  published_at?: string;
  updated_at?: string;
  scheduled_at?: string | null;
  created_at?: string;
  rejection_reason?: string;
  history?: unknown;
  content?: string;
  reading_time?: string;
}

type UserInfoMap = Map<string, { id: string; name: string; profilePic: string; bio: string; isVerified: boolean }>;

function mapStoryToPost(s: StoryRow, userMap: UserInfoMap, includeContent = false): Post {
  // Don't substitute `"admin"` for null `author_id` — that silently
  // attributed every orphan story to a phantom admin user, inflating
  // counts and leaking ghost posts. Leave the key empty so the userMap
  // lookup fails and the UI falls back to "অজ্ঞাত লেখক".
  const rawAuthorKey = (s.author_id ?? "").toString().toLowerCase().trim();
  const relationalUser = rawAuthorKey ? userMap.get(rawAuthorKey) : undefined;
  const authorObj = rawAuthorKey ? getAuthor(rawAuthorKey) : null;

  const categoryId = s.category || "golpo";
  const cat = getCategoryConfig(categoryId);

  const authorName = relationalUser?.name || authorObj?.name || "অজ্ঞাত লেখক";
  const authorImage = relationalUser?.profilePic || authorObj?.image || "";
  const authorBio = relationalUser?.bio || authorObj?.bio || "";
  const content = includeContent ? s.content || "" : "";

  return {
    slug: s.slug || "",
    uid: s.uid || s.id || null,
    fileSlug: s.slug || "",
    title: s.title || "Untitled",
    description: s.description || "",
    publishedAt: s.published_at || s.created_at || new Date().toISOString(),
    scheduledAt: s.scheduled_at || null,
    updatedAt: s.updated_at || s.published_at || new Date().toISOString(),
    authorId: rawAuthorKey,
    authorName,
    authorImage,
    authorBio,
    authorVerified: relationalUser?.isVerified || false,
    categoryId,
    categoryName: cat?.name || categoryId,
    categoryIcon: cat?.icon || "",
    tags: Array.isArray(s.tags) ? s.tags : [],
    cover: s.cover || "",
    featured: s.featured === true,
    readingTime: s.reading_time || getReadingTime(content || s.description || ""),
    previousPost: s.previous_post ? s.previous_post.replace(/^\//, "") : null,
    sourceUrl: null,
    status: (s.status as Post["status"]) || "published",
    comments: [],
    content,
    source: "supabase",
  };
}

export { normalizeRef } from "./utils";

/**
 * Raw users list — shared across requests/instances (L1 memory + L2 Data
 * Cache). Throwing on error (instead of returning []) is deliberate: a failed
 * query must NEVER be cached, otherwise a transient DB hiccup would serve
 * "no posts" for the entire TTL.
 */
const getRawUsers = cachedRead(
  "raw-users",
  async () => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("users")
      .select("id, username, name, profile_pic, bio, is_verified");
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },
  { revalidate: 15, tags: [CACHE_TAGS.users, CACHE_TAGS.posts], ttlMs: 5_000, staleMs: 0 }
);

/**
 * Raw stories list (heavy `history` / `content` columns omitted).
 * `includePending` separates the public feed from the admin feed, so the two
 * variants get independent cache entries.
 */
const getRawStories = cachedRead(
  "raw-stories",
  async (includePending: boolean) => {
    const supabase = getSupabaseAdmin();
    const rows: StoryRow[] = [];
    const pageSize = 500;

    for (let offset = 0; ; offset += pageSize) {
      let query = supabase
        .from("stories")
        .select(
          "uid, slug, title, description, author_id, category, tags, cover, featured, previous_post, status, published_at, updated_at, scheduled_at, created_at, rejection_reason, reading_time"
        )
        .order("uid", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (!includePending) query = query.eq("status", "published");
      const { data, error } = await query;
      if (error) throw error;

      const page = (data || []) as StoryRow[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }

    return rows;
  },
  {
    revalidate: 15,
    tags: [CACHE_TAGS.posts],
    keyParts: ([includePending]) => [includePending ? "all" : "published"],
    ttlMs: 5_000,
    staleMs: 0,
  }
);

interface PublishedStoryAuthorRow {
  author_id: string | null;
  published_at: string | null;
  created_at: string | null;
}

const getPublishedStoryAuthorCounts = cachedRead(
  "published-story-author-counts",
  async () => {
    const supabase = getSupabaseAdmin();
    const counts: Record<string, number> = {};
    const pageSize = 1000;
    const now = Date.now();

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("stories")
        .select("author_id, published_at, created_at")
        .eq("status", "published")
        .order("uid", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      const rows = (data || []) as PublishedStoryAuthorRow[];
      for (const row of rows) {
        const authorId = row.author_id?.toLowerCase().trim();
        const publishedAt = row.published_at || row.created_at;
        if (
          !authorId ||
          !publishedAt ||
          new Date(publishedAt).getTime() > now
        ) {
          continue;
        }
        counts[authorId] = (counts[authorId] || 0) + 1;
      }

      if (rows.length < pageSize) break;
    }

    return counts;
  },
  {
    revalidate: 15,
    tags: [CACHE_TAGS.posts],
    ttlMs: 5_000,
    staleMs: 0,
  }
);

export async function getPublishedStoryCountsAsync(): Promise<Record<string, number>> {
  return getPublishedStoryAuthorCounts();
}

/**
 * Builds the per-request user map on top of the shared, cached raw rows.
 *
 * Cache tiers (system design):
 *   request  → React cache()        dedupe within one render pass
 *   process  → L1 memory            instant, per serverless instance
 *   platform → L2 Next Data Cache   survives cold starts, shared by all
 *   edge     → CDN Cache-Control    set on the JSON endpoints
 */
const fetchStoriesFromDb = cache(async (includePending: boolean) => {
  const [usersResult, storiesResult] = await Promise.allSettled([
    getRawUsers(),
    getRawStories(includePending),
  ]);

  const users = usersResult.status === "fulfilled" ? usersResult.value : [];
  const dbStories = storiesResult.status === "fulfilled" ? storiesResult.value : [];

  const userMap: UserInfoMap = new Map();
  for (const u of users) {
    const info = {
      id: u.id,
      name: u.name || u.username || "অজ্ঞাত লেখক",
      profilePic: u.profile_pic || "",
      bio: u.bio || "",
      isVerified: u.is_verified === true,
    };
    if (u.id) userMap.set(String(u.id).toLowerCase(), info);
    if (u.username) userMap.set(String(u.username).toLowerCase(), info);
  }

  // Fallback: fill in any author ids that the bulk users query missed.
  await ensureAuthorsInMap(userMap, dbStories);

  return { userMap, dbStories };
});

/**
 * If the bulk user query failed or missed some authors, fall back to
 * querying them individually so story pages never show "অজ্ঞাত লেখক".
 */
async function ensureAuthorsInMap(userMap: UserInfoMap, stories: any[]): Promise<void> {
  const missingIds = new Set<string>();
  for (const s of stories) {
    const aid = s.author_id?.toString().toLowerCase().trim();
    if (aid && aid !== "admin" && !userMap.has(aid)) missingIds.add(aid);
  }
  if (missingIds.size === 0) return;
  try {
    const supabase = getSupabaseAdmin();
    // One round-trip with `.in()` instead of N sequential `.maybeSingle()`
    // queries. `id` matches the user_id column directly; no `.or()` is
    // needed and no string interpolation into a filter — this dodges the
    // PostgREST injection class entirely for this path.
    const { data: rows, error } = await supabase
      .from("users")
      .select("id, username, name, profile_pic, bio, is_verified")
      .in("id", Array.from(missingIds));
    if (error) return;
    for (const au of rows || []) {
      const lower = au.id.toLowerCase();
      userMap.set(lower, {
        id: au.id,
        name: au.name || au.username || "অজ্ঞাত লেখক",
        profilePic: au.profile_pic || "",
        bio: au.bio || "",
        isVerified: au.is_verified === true,
      });
      if (au.username) {
        userMap.set(au.username.toLowerCase(), userMap.get(lower)!);
      }
    }
  } catch {}
}

/**
 * Single Source of Truth: Fetch ALL stories directly from Supabase Database.
 */
/**
 * Deterministic 32-bit string hash — used to pick a stable cover image
 * per post (same post → same image, across every page & cache generation).
 */
function stableHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export const getAllPostsAsync = cache(async (options?: { includeFuture?: boolean; includePending?: boolean }): Promise<Post[]> => {
  const posts: Post[] = [];

  try {
    const { userMap, dbStories } = await fetchStoriesFromDb(!!options?.includePending);

    for (const s of dbStories) {
      posts.push(mapStoryToPost(s, userMap));
    }
  } catch (e) {
    console.error("[posts] Database query exception:", e);
  }

  // Sort by publishedAt (newest first)
  posts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // Filter out future-dated posts unless explicitly opted in.
  if (!options?.includeFuture) {
    const now = Date.now();
    const visible = posts.filter((p) => new Date(p.publishedAt).getTime() <= now);
    if (visible.length !== posts.length) {
      posts.length = 0;
      posts.push(...visible);
    }
  }

  // Compute nextPost links based on previousPost references
  //
  // The map is keyed with `normalizeRef`, the same normalization used to
  // look a reference up. Keying it with a plain `.toLowerCase()` meant
  // references stored as full URLs or `read/…` paths never matched and
  // every one of them fell through to the O(N) `posts.find()` scan below
  // (O(N²) overall). Normalizing both sides makes the map authoritative.
  const slugToPost = new Map<string, Post>();
  for (const post of posts) {
    if (post.slug) slugToPost.set(normalizeRef(post.slug), post);
    if (post.fileSlug) slugToPost.set(normalizeRef(post.fileSlug), post);
    if (post.uid) slugToPost.set(normalizeRef(post.uid), post);
    if (post.title) slugToPost.set(normalizeRef(post.title), post);
    post.nextPost = null;
  }

  for (const post of posts) {
    if (post.previousPost) {
      const ref = normalizeRef(post.previousPost);
      const prev = slugToPost.get(ref) || posts.find(p =>
        p.slug.toLowerCase() === ref ||
        p.fileSlug.toLowerCase() === ref ||
        (p.uid && p.uid.toLowerCase() === ref) ||
        p.title.toLowerCase().trim() === ref
      );
      if (prev && prev.slug !== post.slug) {
        prev.nextPost = post.slug;
        post.previousPost = prev.slug; // normalize to actual slug
      }
    }
  }

  // Assign fallback covers deterministically by the post's own identifier,
  // so a post ALWAYS shows the SAME cover everywhere (cards + post page).
  // This is display-only and very fast (Set lookup). To persist the
  // assignment permanently, use the admin "কভার ঠিক করুন" backfill action.
  const pool = getCoverPool();
  if (pool.files.length > 0) {
    for (const post of posts) {
      if (!isCoverAvailable(post.cover)) {
        const hashKey = post.uid || post.slug || post.title || "";
        const idx = stableHash(hashKey) % pool.files.length;
        post.cover = `${pool.urlDir}${pool.files[idx]}`;
      }
    }
  }

  cachedPosts = posts;
  return posts;
});

/**
 * Synchronous backward compatibility functions (working off cached/preloaded posts).
 */
export function getAllPosts(options?: { includeFuture?: boolean; includePending?: boolean }): Post[] {
  return cachedPosts || [];
}

export function getPostBySlugSync(slug: string): Post | null {
  const posts = getAllPosts({ includeFuture: true, includePending: true });
  const q = (slug || "").replace(/^https?:\/\/[^\/]+\//, "").replace(/^\//, "").replace(/\.mdx$/i, "").toLowerCase().trim();
  if (!q) return null;
  return posts.find((p) => p.slug.toLowerCase() === q || p.uid?.toLowerCase() === q || p.fileSlug.toLowerCase() === q || p.title.toLowerCase().trim() === q) || null;
}

export function getPostBySlug(slug: string): Post | null {
  return getPostBySlugSync(slug);
}

/**
 * Fetches the full story body for a single post (content excluded from bulk listings).
 */
/**
 * Full story body for a single post — cached per identifier (uid or slug).
 * Story bodies are large, so this is the single biggest bandwidth saver when
 * the same post is viewed repeatedly.
 */
const getStoryContent = cachedRead(
  "story-content",
  async (q: string) => {
    const supabase = getSupabaseAdmin();
    const { data: byUid, error: uidError } = await supabase
      .from("stories")
      .select("content")
      .eq("uid", q)
      .maybeSingle();
    if (!uidError && byUid?.content) return byUid.content as string;

    const { data: bySlug, error: slugError } = await supabase
      .from("stories")
      .select("content")
      .eq("slug", q)
      .maybeSingle();
    if (slugError) throw slugError;
    return (bySlug?.content as string) || "";
  },
  { revalidate: 15, tags: [CACHE_TAGS.posts], keyParts: ([q]) => [q], ttlMs: 5_000, staleMs: 0 }
);

export async function getPostContentByIdentifierAsync(identifier: string): Promise<string> {
  const q = normalizeRef(identifier);
  if (!q) return "";
  try {
    return await getStoryContent(q);
  } catch (e) {
    console.error("[posts] Content fetch exception:", e);
    return "";
  }
}

export async function getPostBySlugAsync(slug: string): Promise<Post | null> {
  const posts = await getAllPostsAsync({ includeFuture: true, includePending: true });
  const q = (slug || "").replace(/^https?:\/\/[^\/]+\//, "").replace(/^\//, "").replace(/\.mdx$/i, "").toLowerCase().trim();
  if (!q) return null;
  const post = posts.find((p) => p.slug.toLowerCase() === q || p.uid?.toLowerCase() === q || p.fileSlug.toLowerCase() === q || p.title.toLowerCase().trim() === q) || null;
  if (!post) return null;

  const content = await getPostContentByIdentifierAsync(post.uid || post.slug);
  if (content) {
    post.content = content;
    post.readingTime = getReadingTime(content);
  }
  return post;
}

export function getPostsByCategorySync(categoryId: string): Post[] {
  return getAllPosts().filter((p) => p.categoryId === categoryId);
}

export function getPostsByCategory(categoryId: string): Post[] {
  return getPostsByCategorySync(categoryId);
}

export async function getPostsByCategoryAsync(categoryId: string): Promise<Post[]> {
  const posts = await getAllPostsAsync();
  return posts.filter((p) => p.categoryId === categoryId);
}

export function getCategoriesSync(): { slug: string; name: string; count: number }[] {
  const posts = getAllPosts();
  const configs = getAllCategoryConfigs();
  const map = new Map<string, number>();

  for (const post of posts) {
    map.set(post.categoryId, (map.get(post.categoryId) || 0) + 1);
  }

  return configs
    .map((c) => ({ slug: c.id, name: c.name, count: map.get(c.id) || 0 }))
    .sort((a, b) => b.count - a.count);
}

export function getCategories(): { slug: string; name: string; count: number }[] {
  return getCategoriesSync();
}

export async function getCategoriesAsync(): Promise<{ slug: string; name: string; count: number }[]> {
  const posts = await getAllPostsAsync();
  const configs = getAllCategoryConfigs();
  const map = new Map<string, number>();

  for (const post of posts) {
    map.set(post.categoryId, (map.get(post.categoryId) || 0) + 1);
  }

  return configs
    .map((c) => ({ slug: c.id, name: c.name, count: map.get(c.id) || 0 }))
    .sort((a, b) => b.count - a.count);
}

export function getFeaturedPostsSync(): Post[] {
  return getAllPosts().filter((p) => p.featured);
}

export function getFeaturedPosts(): Post[] {
  return getFeaturedPostsSync();
}

export async function getFeaturedPostsAsync(): Promise<Post[]> {
  const posts = await getAllPostsAsync();
  return posts.filter((p) => p.featured);
}

export function getRelatedPostsSync(post: Post, limit = 5): Post[] {
  const targetTitle = (post.title || "").trim().toLowerCase();
  const seenTitles = new Set<string>([targetTitle]);
  
  const all = getAllPosts().filter((p) => p.slug !== post.slug && (p.uid ? p.uid !== post.uid : true));
  const used = new Set<string>();

  const isUniqueCandidate = (p: Post) => {
    if (used.has(p.slug)) return false;
    const titleKey = (p.title || "").trim().toLowerCase();
    if (seenTitles.has(titleKey)) return false;
    return true;
  };

  const markUsed = (p: Post) => {
    used.add(p.slug);
    if (p.title) seenTitles.add((p.title || "").trim().toLowerCase());
  };

  const textForMatch = (p: Post) => `${p.title} ${p.description} ${p.content?.slice(0, 300) || ""}`;
  const postText = textForMatch(post);

  const keywordMatches = all.filter((p) => {
    if (!isUniqueCandidate(p)) return false;
    return postsAreKeywordRelated(postText, textForMatch(p));
  });
  for (const p of keywordMatches) markUsed(p);
  if (keywordMatches.length >= limit) return keywordMatches.slice(0, limit);

  const tagMatches = all.filter((p) => {
    if (!isUniqueCandidate(p)) return false;
    return p.tags.some((t) => post.tags.includes(t));
  });
  for (const p of tagMatches) markUsed(p);
  const combined1 = [...keywordMatches, ...tagMatches];
  if (combined1.length >= limit) return combined1.slice(0, limit);

  const categoryMatches = all.filter(
    (p) => isUniqueCandidate(p) && p.categoryId === post.categoryId
  );
  for (const p of categoryMatches) markUsed(p);
  const combined2 = [...combined1, ...categoryMatches];
  if (combined2.length >= limit) return combined2.slice(0, limit);

  const authorMatches = all.filter(
    (p) => isUniqueCandidate(p) && p.authorId === post.authorId
  );
  for (const p of authorMatches) markUsed(p);
  const combined3 = [...combined2, ...authorMatches];
  if (combined3.length >= limit) return combined3.slice(0, limit);

  const latest = all.filter((p) => isUniqueCandidate(p));
  for (const p of latest) markUsed(p);
  return [...combined3, ...latest].slice(0, limit);
}

export function getRelatedPosts(post: Post, limit = 5): Post[] {
  return getRelatedPostsSync(post, limit);
}

export async function getRelatedPostsAsync(post: Post, limit = 5): Promise<Post[]> {
  const targetTitle = (post.title || "").trim().toLowerCase();
  const seenTitles = new Set<string>([targetTitle]);

  const posts = await getAllPostsAsync();
  const all = posts.filter((p) => p.slug !== post.slug && (p.uid ? p.uid !== post.uid : true));
  const used = new Set<string>();

  const isUniqueCandidate = (p: Post) => {
    if (used.has(p.slug)) return false;
    const titleKey = (p.title || "").trim().toLowerCase();
    if (seenTitles.has(titleKey)) return false;
    return true;
  };

  const markUsed = (p: Post) => {
    used.add(p.slug);
    if (p.title) seenTitles.add((p.title || "").trim().toLowerCase());
  };

  const textForMatch = (p: Post) => `${p.title} ${p.description} ${p.content?.slice(0, 300) || ""}`;
  const postText = textForMatch(post);

  const keywordMatches = all.filter((p) => {
    if (!isUniqueCandidate(p)) return false;
    return postsAreKeywordRelated(postText, textForMatch(p));
  });
  for (const p of keywordMatches) markUsed(p);
  if (keywordMatches.length >= limit) return keywordMatches.slice(0, limit);

  const tagMatches = all.filter((p) => {
    if (!isUniqueCandidate(p)) return false;
    return p.tags.some((t) => post.tags.includes(t));
  });
  for (const p of tagMatches) markUsed(p);
  const combined1 = [...keywordMatches, ...tagMatches];
  if (combined1.length >= limit) return combined1.slice(0, limit);

  const categoryMatches = all.filter(
    (p) => isUniqueCandidate(p) && p.categoryId === post.categoryId
  );
  for (const p of categoryMatches) markUsed(p);
  const combined2 = [...combined1, ...categoryMatches];
  if (combined2.length >= limit) return combined2.slice(0, limit);

  const authorMatches = all.filter(
    (p) => isUniqueCandidate(p) && p.authorId === post.authorId
  );
  for (const p of authorMatches) markUsed(p);
  const combined3 = [...combined2, ...authorMatches];
  if (combined3.length >= limit) return combined3.slice(0, limit);

  const latest = all.filter((p) => isUniqueCandidate(p));
  for (const p of latest) markUsed(p);
  return [...combined3, ...latest].slice(0, limit);
}

export async function getPostsByAuthor(authorId: string): Promise<Post[]> {
  if (!authorId) return [];
  const posts = await getAllPostsAsync();
  const q = authorId.toLowerCase().trim();

  // Perform strict relational author_id / username matching
  return posts.filter((p) => {
    const pAuthorId = p.authorId.toLowerCase().trim();
    return pAuthorId === q;
  });
}

/**
 * Automatically discovers all series (linked chains of posts) and returns an array
 * where each element is an array of Posts in that series.
 */
export async function getSeries(): Promise<Post[][]> {
  const posts = await getAllPostsAsync();
  const slugToPost = new Map<string, Post>();

  for (const p of posts) {
    if (p.slug) slugToPost.set(p.slug.toLowerCase(), p);
    if (p.uid) slugToPost.set(p.uid.toLowerCase(), p);
    if (p.fileSlug) slugToPost.set(p.fileSlug.toLowerCase(), p);
    if (p.title) slugToPost.set(p.title.toLowerCase().trim(), p);
  }

  const seriesList: Post[][] = [];
  const visited = new Set<string>();

  // 1. Explicit Linked Chains (previousPost -> nextPost)
  for (const post of posts) {
    if (visited.has(post.slug)) continue;

    if (post.previousPost || post.nextPost) {
      let start: Post = post;
      const backVisited = new Set<string>([start.slug]);
      while (start.previousPost) {
        const ref = normalizeRef(start.previousPost);
        const prev = slugToPost.get(ref);
        if (prev && !backVisited.has(prev.slug)) {
          backVisited.add(prev.slug);
          start = prev;
        } else {
          break;
        }
      }

      if (!visited.has(start.slug)) {
        const chain: Post[] = [];
        let current: Post | undefined = start;

        while (current && !visited.has(current.slug)) {
          chain.push(current);
          visited.add(current.slug);
          current = current.nextPost ? slugToPost.get(normalizeRef(current.nextPost)) : undefined;
        }

        if (chain.length > 1) {
          seriesList.push(chain);
        }
      }
    }
  }

  // 2. Automatic Title Pattern Grouping (e.g., "বিশ্ববিদ্যালয় সমাচার – ১", "বিশ্ববিদ্যালয় সমাচার – ২")
  const titleGroups = new Map<string, Post[]>();
  const cleanTitlePattern = (title: string) => {
    return title
      .replace(/\s*[-\|:]?\s*(পর্ব|part|chapter|পর্বঃ)\s*[-\|:]?\s*(\d+|[০-৯]+)/gi, "")
      .replace(/\s*[-\|:]?\s*(\d+|[০-৯]+)\s*$/gi, "")
      .replace(/\s*\(\s*(\d+|[০-৯]+)\s*\)\s*$/gi, "")
      .trim()
      .toLowerCase();
  };

  for (const post of posts) {
    if (visited.has(post.slug)) continue;
    const baseTitle = cleanTitlePattern(post.title);
    if (baseTitle && baseTitle.length > 3) {
      if (!titleGroups.has(baseTitle)) {
        titleGroups.set(baseTitle, []);
      }
      titleGroups.get(baseTitle)!.push(post);
    }
  }

  for (const group of titleGroups.values()) {
    if (group.length > 1) {
      // Sort group by publishedAt ascending (Part 1 -> Part 2 -> Part 3)
      group.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
      group.forEach(p => visited.add(p.slug));
      seriesList.push(group);
    }
  }

  return seriesList;
}

export async function getPostsByTag(tag: string): Promise<Post[]> {
  const posts = await getAllPostsAsync();
  const q = tag.toLowerCase().trim().normalize("NFC");
  return posts.filter((p) =>
    p.tags.some((t) => t.toLowerCase().trim().normalize("NFC") === q)
  );
}

export async function getAllTags(): Promise<{ tag: string; count: number }[]> {
  const posts = await getAllPostsAsync();
  const map = new Map<string, number>();

  for (const post of posts) {
    for (const tag of post.tags) {
      const normalized = tag.normalize("NFC");
      map.set(normalized, (map.get(normalized) || 0) + 1);
    }
  }

  return Array.from(map.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getTopTags(limit = 5): Promise<{ tag: string; count: number }[]> {
  const tags = await getAllTags();
  return tags.slice(0, limit);
}

export async function searchPosts(query: string): Promise<Post[]> {
  const posts = await getAllPostsAsync();
  const q = query.toLowerCase();
  return posts.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q) ||
      p.authorName.toLowerCase().includes(q) ||
      p.categoryName.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
  );
}

const SEARCH_PAGE_SIZE = 500;
const SEARCH_STORY_COLUMNS =
  "uid, slug, title, description, author_id, category, tags, cover, featured, status, published_at, updated_at, created_at, previous_post, reading_time";

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[ূঊ]/g, (character) => (character === "ূ" ? "ু" : "উ"))
    .toLocaleLowerCase();
}

function getBengaliSpellingVariants(value: string): string[] {
  let variants = [""];
  for (const character of value) {
    const alternatives =
      character === "ু" || character === "ূ"
        ? ["ু", "ূ"]
        : character === "উ" || character === "ঊ"
          ? ["উ", "ঊ"]
          : [character];
    variants = variants.flatMap((variant) =>
      alternatives.map((alternative) => variant + alternative)
    );
    if (variants.length >= 16) variants = variants.slice(0, 16);
  }
  return variants;
}

const searchPostsCached = cachedRead(
  "story-search",
  async (query: string): Promise<PostMeta[]> => {
  const raw = (query || "").trim();
  const normalizedQuery = normalizeSearchText(raw);
  if (Array.from(normalizedQuery).length < 1) return [];

  // Search both Unicode forms: Bengali text can be stored in either
  // composed or decomposed form, depending on the input source.
  const terms = Array.from(new Set(
    [raw.toLocaleLowerCase(), normalizedQuery]
      .flatMap((value) => value.match(/[\p{L}\p{M}\p{N}]+/gu) || [])
  )).slice(0, 32);
  if (terms.length === 0) return [];
  const broadSearchTerms = terms.slice(0, 12);

  try {
    const supabase = getSupabaseAdmin();
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, username, name, profile_pic, bio, is_verified");
    if (usersError) throw usersError;

    const userMap: UserInfoMap = new Map();
    for (const u of users || []) {
      const info = {
        id: u.id,
        name: u.name || u.username || "অজ্ঞাত লেখক",
        profilePic: u.profile_pic || "",
        bio: u.bio || "",
        isVerified: u.is_verified === true,
      };
      if (u.id) userMap.set(String(u.id).toLowerCase(), info);
      if (u.username) userMap.set(String(u.username).toLowerCase(), info);
    }

    // Search all matching pages rather than silently ignoring results past
    // PostgREST's default page limit.
    const matchedStories = new Map<string, any>();
    const matchedTitleKeys = new Set<string>();
    const titleSearchTerms = Array.from(new Set(
      terms.flatMap(getBengaliSpellingVariants)
    )).slice(0, 64);

    // Run a dedicated title lookup first so a title hit never depends on
    // content-query parsing or gets buried beneath content-only matches.
    // Bengali short/long-u spelling variants are also queried because titles
    // commonly contain both spellings (e.g. পুর্ণিমা / পূর্ণিমা).
    for (const term of titleSearchTerms) {
      for (let offset = 0; ; offset += SEARCH_PAGE_SIZE) {
        const { data, error } = await supabase
          .from("stories")
          .select(SEARCH_STORY_COLUMNS)
          .eq("status", "published")
          .ilike("title", `%${term}%`)
          .order("uid", { ascending: true })
          .range(offset, offset + SEARCH_PAGE_SIZE - 1);
        if (error) throw error;
        for (const story of data || []) {
          const key = String(story.uid || story.slug);
          matchedStories.set(key, story);
          matchedTitleKeys.add(key);
        }
        if (!data || data.length < SEARCH_PAGE_SIZE) break;
      }
    }

    // Some Postgres collations do not treat canonically equivalent Bengali
    // strings as equal for ILIKE, so use the paged normalized scan as fallback.
    if (matchedTitleKeys.size === 0) {
      const normalizedTerms = terms.map(normalizeSearchText);
      for (let offset = 0; ; offset += SEARCH_PAGE_SIZE) {
        const { data, error } = await supabase
          .from("stories")
          .select(SEARCH_STORY_COLUMNS)
          .eq("status", "published")
          .order("uid", { ascending: true })
          .range(offset, offset + SEARCH_PAGE_SIZE - 1);
        if (error) throw error;
        for (const story of data || []) {
          const title = normalizeSearchText(story.title || "");
          const publishedAt = Date.parse(story.published_at || story.created_at || "");
          if (
            publishedAt <= Date.now() &&
            normalizedTerms.some((term) => title.includes(term))
          ) {
            const key = String(story.uid || story.slug);
            matchedStories.set(key, story);
            matchedTitleKeys.add(key);
          }
        }
        if (!data || data.length < SEARCH_PAGE_SIZE) break;
      }
    }

    const textFilters = broadSearchTerms.flatMap((term) => {
      const pattern = `"%${term}%"`;
      return [
        `title.ilike.${pattern}`,
        `description.ilike.${pattern}`,
        `content.ilike.${pattern}`,
      ];
    });

    for (let offset = 0; ; offset += SEARCH_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("stories")
        .select(SEARCH_STORY_COLUMNS)
        .eq("status", "published")
        .or(textFilters.join(","))
        .order("uid", { ascending: true })
        .range(offset, offset + SEARCH_PAGE_SIZE - 1);
      if (error) throw error;
      for (const story of data || []) {
        matchedStories.set(String(story.uid || story.slug), story);
      }
      if (!data || data.length < SEARCH_PAGE_SIZE) break;
    }

    for (let offset = 0; ; offset += SEARCH_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("stories")
        .select(SEARCH_STORY_COLUMNS)
        .eq("status", "published")
        .overlaps("tags", broadSearchTerms)
        .order("uid", { ascending: true })
        .range(offset, offset + SEARCH_PAGE_SIZE - 1);
      if (error) throw error;
      for (const story of data || []) {
        matchedStories.set(String(story.uid || story.slug), story);
      }
      if (!data || data.length < SEARCH_PAGE_SIZE) break;
    }

    const posts = Array.from(matchedStories.values()).map((story) => mapStoryToPost(story, userMap));
    const score = (post: PostMeta) => {
      const title = normalizeSearchText(post.title);
      const description = normalizeSearchText(post.description);
      const tags = post.tags.map(normalizeSearchText);
      const normalizedTerms = terms.map(normalizeSearchText);
      return {
        titleMatch: normalizedTerms.some((term) => title.includes(term)),
        exactTitleMatch: title === normalizedQuery,
        phraseTitleMatch: title.includes(normalizedQuery),
        titleTermMatches: normalizedTerms.filter((term) => title.includes(term)).length,
        secondary: normalizedTerms.reduce((total, term) =>
          total +
          (title.includes(term) ? 10 : 0) +
          (description.includes(term) ? 3 : 0) +
          (tags.some((tag) => tag.includes(term)) ? 5 : 0),
        0),
      };
    };

    return posts.sort((a, b) => {
      const aScore = score(a);
      const bScore = score(b);
      return (
        Number(bScore.titleMatch) - Number(aScore.titleMatch) ||
        Number(bScore.exactTitleMatch) - Number(aScore.exactTitleMatch) ||
        Number(bScore.phraseTitleMatch) - Number(aScore.phraseTitleMatch) ||
        bScore.titleTermMatches - aScore.titleTermMatches ||
        bScore.secondary - aScore.secondary ||
        Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
      );
    }).slice(0, 50);
  } catch (e) {
    console.error("[posts] DB search exception:", e);
    throw e;
  }
  },
  {
    revalidate: 15,
    tags: [CACHE_TAGS.posts],
    keyParts: ([query]) => [normalizeSearchText(query)],
    ttlMs: 5_000,
    staleMs: 0,
  },
);

export async function searchPostsFromDbAsync(query: string): Promise<PostMeta[]> {
  return searchPostsCached(query);
}
