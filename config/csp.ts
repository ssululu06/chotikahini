/**
 * Content Security Policy (CSP) Configuration
 *
 * Uses broad scheme sources (`https:`) instead of per-domain allowlists
 * because ad networks constantly rotate CDN/regional domains.
 *
 * The `https:` scheme source is NOT a wildcard — it only allows secure
 * HTTPS connections, blocking HTTP and other schemes. This is a common
 * and practical choice for sites with third-party integrations.
 *
 * Security-critical restrictions remain strict:
 *   - form-action: 'self'       (forms can only submit to same origin)
 *   - object-src: 'none'        (no plugins)
 *   - base-uri: 'self'          (no <base> injection)
 *
 * To add a domain-specific exception (rarely needed), push to the array.
 * Example:
 *   scriptSrc.push("https://specific.trusted.domain");
 */

/* ── Script sources ─────────────────────────────────────────────── */
export const scriptSrc: string[] = [
  "'self'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  "https:",
];

/* ── Style sources ──────────────────────────────────────────────── */
export const styleSrc: string[] = [
  "'self'",
  "'unsafe-inline'",
  "https:",
];

/* ── Image sources ──────────────────────────────────────────────── */
export const imgSrc: string[] = [
  "'self'",
  "https:",
  "data:",
  "blob:",
];

/* ── Font sources ───────────────────────────────────────────────── */
export const fontSrc: string[] = [
  "'self'",
  "https:",
  "data:",
];

/* ── Connect sources (XHR, fetch, WebSocket) ─────────────────────── */
export const connectSrc: string[] = [
  "'self'",
  "https:",
  "wss:",
];

/* ── Frame sources ──────────────────────────────────────────────── */
export const frameSrc: string[] = [
  "'self'",
  "https:",
];

/* ── Media sources ──────────────────────────────────────────────── */
export const mediaSrc: string[] = [
  "'self'",
  "https:",
  "blob:",
];

/* ── Worker sources ─────────────────────────────────────────────── */
export const workerSrc: string[] = [
  "'self'",
  "https:",
  "blob:",
];

/* ── Form action ────────────────────────────────────────────────── */
export const formAction: string[] = [
  "'self'",
];

/* ── Object sources (plugins) ──────────────────────────────────── */
export const objectSrc: string[] = [
  "'none'",
];

/* ── Base URI ──────────────────────────────────────────────────── */
export const baseUri: string[] = [
  "'self'",
];

/* ── CSP builder ────────────────────────────────────────────────── */

function unique(arr: string[]): string[] {
  return [...new Set(arr)];
}

export function buildCsp(): string {
  const directives: string[] = [];

  const add = (name: string, sources: string[]) => {
    const vals = unique(sources);
    if (vals.length > 0) {
      directives.push(`${name} ${vals.join(" ")}`);
    }
  };

  add("default-src", ["'self'", "https:"]);
  add("script-src", scriptSrc);
  add("style-src", styleSrc);
  add("img-src", imgSrc);
  add("font-src", fontSrc);
  add("connect-src", connectSrc);
  add("frame-src", frameSrc);
  add("media-src", mediaSrc);
  add("worker-src", workerSrc);
  add("form-action", formAction);
  add("object-src", objectSrc);
  add("base-uri", baseUri);

  return directives.join("; ");
}
