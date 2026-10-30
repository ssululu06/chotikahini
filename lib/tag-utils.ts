/**
 * URL-safe tag slug utilities.
 *
 * Bengali Unicode tags can be problematic in URL routing (especially
 * after deployment on platforms like Vercel/Netlify where CDNs may
 * decode the URL path before it reaches the Next.js router, causing
 * 404s).
 *
 * Solution: encode each tag as a URL-safe base64 slug that is purely
 * ASCII and guaranteed to survive any URL processing layer unchanged.
 *
 * Usage:
 *   <Link href={`/tags/${tagSlug(tag)}`}>  → link
 *   params.tag → tagFromSlug(params.tag)   → page/metadata
 */

/**
 * Convert a Bengali (Unicode) tag to an ASCII URL-safe slug.
 */
export function tagSlug(tag: string): string {
  return Buffer.from(tag.normalize("NFC"), "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Convert a base64 slug back to the original tag.
 *
 * Handles three formats:
 *  1. New base64url slugs (ASCII-safe) — try base64 decode first
 *  2. Old encodeURIComponent format (%E0%A6...) — via % check
 *  3. Raw Bengali Unicode (direct URL entry) — via Unicode range check
 */
export function tagFromSlug(slug: string): string {
  // Old-style URL-encoded (contains % signs)
  if (slug.includes("%")) {
    return decodeURIComponent(slug).normalize("NFC");
  }

  // Raw Bengali characters in the slug (old direct Unicode URLs)
  if (/[\u0980-\u09FF]/.test(slug)) {
    return decodeURIComponent(slug).normalize("NFC");
  }

  // New base64url slug
  try {
    const padded = slug
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const padding = 4 - (padded.length % 4);
    const full = padding < 4 ? padded + "=".repeat(padding) : padded;
    return Buffer.from(full, "base64").toString("utf-8").normalize("NFC");
  } catch {
    return slug;
  }
}
