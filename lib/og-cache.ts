
// ─────────────────────────────────────────────────────────────
// lib/og-cache.ts — in-process cache for rendered OG images.
//
// The OG routes run a sharp → blur → composite → canvas → composite
// pipeline for every single request. Sharp encoding is the most
// CPU-expensive operation in this app, and social crawlers re-fetch
// the same OG URL many times per post (WhatsApp/Twitter/Facebook
// preview bots, link unfurlers, chat apps).
//
// The rendered bytes are a pure function of (story content + cover +
// site config), so they can be safely reused until something changes.
//
// This is an L1 (per-instance) cache: it removes the repeated sharp
// work on a warm instance. The HTTP `s-maxage` headers on the routes
// are what remove the *function invocation* on a cold instance —
// together they collapse "N renders" down to "1 render per edge TTL".
//
// Server-only. Do not import from a Client Component.
// ─────────────────────────────────────────────────────────────

/** A cached rendered OG image. */
interface OgEntry {
  buffer: Buffer;
  /** Epoch ms after which the entry should be regenerated. */
  expiresAt: number;
}

const cache = new Map<string, OgEntry>();

/** Hard cap so a crawler sweeping identifiers cannot grow memory unboundedly. */
const MAX_ENTRIES = 300;

/** Default lifetime of a rendered OG image (24h). */
export const OG_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Remove expired entries and enforce the entry cap. */
function evict(now: number): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  // Map preserves insertion order, so the oldest keys come first.
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

/**
 * Return a cached OG image for `key`, if one exists and is still fresh.
 */
export function getCachedOg(key: string): Buffer | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.buffer;
}

/**
 * Store a rendered OG image under `key`.
 */
export function setCachedOg(key: string, buffer: Buffer, ttlMs = OG_CACHE_TTL_MS): void {
  const now = Date.now();
  cache.set(key, { buffer, expiresAt: now + ttlMs });
  evict(now);
}

/**
 * Drop a single cached OG image. Call this when a story's title or
 * cover changes so the next request re-renders it.
 */
export function invalidateOg(key: string): void {
  cache.delete(key);
}

/**
 * Drop every cached OG image. Called from `clearPostsCache()` after a
 * story write so edited titles/covers produce a fresh share card.
 */
export function clearOgCache(): void {
  cache.clear();
}
