// ─────────────────────────────────────────────────────────────
// Tiny in-memory rate limiter. Per-process Map keyed by an
// identifier (e.g. `${ip}:${route}`) holding a sliding window of
// timestamps. Sufficient for single-instance dev / on-prem; on
// Vercel each serverless instance has its own memory so the
// effective limit is `instances × window`. Adequate as a basic
// shield against casual brute-force on /api/auth/* and the
// contact form. For a hardened system, swap in a shared store
// (Upstash Redis, Vercel KV, etc.).
// ─────────────────────────────────────────────────────────────

type Window = { hits: number[] };

const buckets = new Map<string, Window>();
const MAX_BUCKETS = 10_000; // cap memory if hammered
const BUCKET_TTL_MS = 10 * 60 * 1000;

function gc(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [k, w] of buckets) {
    if (w.hits.every((t) => now - t > BUCKET_TTL_MS)) buckets.delete(k);
    if (buckets.size < MAX_BUCKETS) break;
  }
}

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum hits per window per key. */
  max: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Returns whether a hit is allowed. `key` should be unique per
 * logical caller (e.g. `"login:1.2.3.4"`).
 */
export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  let w = buckets.get(key);
  if (!w) {
    w = { hits: [] };
    buckets.set(key, w);
  }
  w.hits = w.hits.filter((t) => t > cutoff);
  if (w.hits.length >= opts.max) {
    const oldest = w.hits[0]!;
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(0, opts.windowMs - (now - oldest)),
    };
  }
  w.hits.push(now);
  if (buckets.size >= MAX_BUCKETS) gc(now);
  return { ok: true, remaining: opts.max - w.hits.length, retryAfterMs: 0 };
}

/** Best-effort client IP extraction from a Next.js request. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
