// ─────────────────────────────────────────────────────────────
// lib/cache.ts — multi-tier read cache for DB-backed data.
//
// Goal (system design): stop every page load from hitting Supabase.
//
//   L1  in-process micro-cache   plain Map, ~0 latency, per server instance
//   L2  Next.js Data Cache       `unstable_cache`, shared across requests,
//                                serverless instances and cold starts
//   L3  HTTP / CDN cache         `Cache-Control: s-maxage` headers on the
//                                JSON endpoints that expose this data
//
// Properties
//   • Bounded freshness: L1 values are not served past their freshness window;
//     Next's tagged Data Cache avoids repeat database reads across requests.
//   • Single-flight: N concurrent misses trigger exactly ONE query.
//   • Tag-based invalidation: writes call `invalidateTags([...])` to purge
//     shared Data Cache entries immediately on every instance.
//   • Failures are never cached (a thrown query leaves the cache untouched).
//
// Server-only: it imports `next/cache`. Do not import it from a Client
// Component (only from route handlers, server components and server libs).
// ─────────────────────────────────────────────────────────────

import { unstable_cache, revalidateTag } from "next/cache";

/** Cache tags shared between readers (`cachedRead`) and writers (`invalidateTags`). */
export const CACHE_TAGS = {
  posts: "posts",
  users: "users",
  siteSettings: "site-settings",
  categories: "categories",
  comments: "comments",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

type L1Entry = { value: unknown; freshUntil: number; staleUntil: number };

const l1 = new Map<string, L1Entry>();
const inflight = new Map<string, Promise<unknown>>();
const namespaceVersions = new Map<string, number>();
const namespaceTags = new Map<string, Set<string>>();

const DEFAULT_REVALIDATE_S = 15;
const DEFAULT_FRESH_MS = 5 * 1000;
const DEFAULT_STALE_MS = 0;

export interface CachedReadOptions<TArgs extends unknown[]> {
  /** How long Next.js keeps the value in its persistent Data Cache (seconds). */
  revalidate?: number;
  /** Tags that `invalidateTags()` can use to purge this entry. */
  tags?: string[];
  /** Serializable key suffix derived from the call arguments. */
  keyParts?: (args: TArgs) => (string | number | boolean)[];
  /** L1 freshness window (ms). After this the value is stale but still usable. */
  ttlMs?: number;
  /** Extra window (ms) in which stale values are served while refreshing. */
  staleMs?: number;
}

/**
 * Wrap a DB read with the L1/L2 cache, single-flight de-duplication and
 * stale-while-revalidate. Returns an async function with the same signature.
 */
export function cachedRead<TArgs extends unknown[], TResult>(
  namespace: string,
  fn: (...args: TArgs) => Promise<TResult>,
  options: CachedReadOptions<TArgs> = {}
): (...args: TArgs) => Promise<TResult> {
  const revalidate = options.revalidate ?? DEFAULT_REVALIDATE_S;
  const tags = options.tags ?? [];
  const ttlMs = options.ttlMs ?? DEFAULT_FRESH_MS;
  const staleMs = options.staleMs ?? DEFAULT_STALE_MS;
  const registeredTags = namespaceTags.get(namespace) ?? new Set<string>();
  for (const tag of tags) registeredTags.add(tag);
  namespaceTags.set(namespace, registeredTags);
  if (!namespaceVersions.has(namespace)) namespaceVersions.set(namespace, 0);

  const partsFor = (args: TArgs): string[] => {
    const parts = options.keyParts ? options.keyParts(args) : (args as unknown[]);
    return parts.map((p) => String(p));
  };
  const cacheKey = (args: TArgs) => [namespace, ...partsFor(args)].join("|");
  const dataCache = (args: TArgs) =>
    unstable_cache(() => fn(...args), [namespace, ...partsFor(args)], { revalidate, tags });

  const refresh = (key: string, args: TArgs): Promise<TResult> => {
    const version = namespaceVersions.get(namespace) ?? 0;
    const promise = dataCache(args)()
      .then((value) => {
        if (namespaceVersions.get(namespace) === version && inflight.get(key) === promise) {
          const now = Date.now();
          l1.set(key, { value, freshUntil: now + ttlMs, staleUntil: now + ttlMs + staleMs });
          inflight.delete(key);
        }
        return value;
      })
      .catch((err) => {
        if (inflight.get(key) === promise) inflight.delete(key);
        throw err;
      });
    inflight.set(key, promise);
    return promise;
  };

  return async (...args: TArgs): Promise<TResult> => {
    const key = cacheKey(args);
    const now = Date.now();
    const entry = l1.get(key);

    if (entry) {
      if (now < entry.freshUntil) return entry.value as TResult;
      if (now < entry.staleUntil) {
        // Serve the stale value immediately; repopulate in the background.
        if (!inflight.has(key)) refresh(key, args).catch(() => {});
        return entry.value as TResult;
      }
    }

    const pending = inflight.get(key);
    if (pending) return pending as Promise<TResult>;
    return refresh(key, args);
  };
}

/** Drop L1 entries. Pass a namespace to clear only that group. */
export function clearMemoryCache(namespace?: string): void {
  const namespaces = namespace ? [namespace] : Array.from(namespaceTags.keys());
  for (const name of namespaces) {
    namespaceVersions.set(name, (namespaceVersions.get(name) ?? 0) + 1);
    const prefix = `${name}|`;
    for (const key of Array.from(l1.keys())) {
      if (key === name || key.startsWith(prefix)) l1.delete(key);
    }
    for (const key of Array.from(inflight.keys())) {
      if (key === name || key.startsWith(prefix)) inflight.delete(key);
    }
  }
}

/**
 * Purge tagged L2 Data Cache entries. Must run inside a route handler or
 * server action so Next.js can apply the invalidation.
 */
export function invalidateTags(tags: CacheTag | CacheTag[] | string | string[]): void {
  const list = Array.isArray(tags) ? tags : [tags];
  const invalidatedNamespaces = new Set<string>();
  for (const [namespace, namespaceTagSet] of namespaceTags) {
    if (list.some((tag) => namespaceTagSet.has(tag))) invalidatedNamespaces.add(namespace);
  }
  for (const namespace of invalidatedNamespaces) clearMemoryCache(namespace);
  for (const tag of list) revalidateTag(tag);
}

/** Standard CDN cache headers for endpoints where brief response staleness is acceptable. */
export function cdnHeaders({
  maxAge = 60,
  sMaxAge = 300,
  staleWhileRevalidate = 600,
}: { maxAge?: number; sMaxAge?: number; staleWhileRevalidate?: number } = {}): Record<string, string> {
  return {
    "Cache-Control": `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
  };
}
