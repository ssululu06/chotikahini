/**
 * Uploader fallback helpers.
 *
 * Several scrapers return a description shaped like:
 *
 *   "Some Title — NatashaRecords"
 *   "Some Title | By: NatashaRecords"
 *   "Some Title channel: NatashaRecords"
 *
 * …with the channel/uploader name living in the *last* segment. When the
 * dedicated `uploaderName` probe comes back empty we still want the form
 * to be pre-populated, so we slice off the trailing piece of the description
 * here. Intentionally conservative — we only return a value when the trailing
 * segment looks like a single short token, not a sentence fragment.
 */

const MAX_LEN = 60;

/**
 * Accept only well-formed uploads. Words that are obviously English glue
 * (articles, prepositions, pronouns) are dropped so we never substitute
 * "the" or "a" as the channel name.
 */
function isPlausibleUploader(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > MAX_LEN) return false;
  // Reject if it contains typical sentence punctuation.
  if (/[,.;:?!]/.test(v)) return false;
  // Reject stopwords / articles so we don't surface junk like "the".
  const stop = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "by",
    "from",
    "with",
    "to",
    "for",
    "of",
    "on",
    "in",
    "at",
    "this",
    "that",
    "video",
    "watch",
    "full",
    "free",
    "hd",
  ]);
  return !stop.has(v.toLowerCase());
}

/**
 * Extract a likely uploader handle from the end of a description. Returns
 * null when nothing plausible is found.
 *
 * Priority:
 *   1. "{title} — {Uploader}" → "Uploader"
 *   2. "{title} | {Uploader}"  → "Uploader"
 *   3. Last whitespace-separated word → "word"
 */
export function extractUploaderFromDescription(
  description: string | null | undefined,
): string | null {
  if (!description) return null;
  const text = description.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const trailing = (segment: string): string | null => {
    const v = segment.trim();
    return isPlausibleUploader(v) ? v : null;
  };

  const sepMatch = text.match(/[\u2014\u2013\u2012|-]\s*([^|]+)$/);
  if (sepMatch) {
    const candidate = trailing(sepMatch[1]);
    if (candidate) return candidate;
  }

  const tokens = text.split(" ");
  for (let i = tokens.length - 1; i >= Math.max(0, tokens.length - 4); i--) {
    const candidate = trailing(tokens[i]);
    if (candidate) return candidate;
  }
  return null;
}
