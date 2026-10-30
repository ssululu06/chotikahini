/**
 * RSS / Atom feed discovery and parsing.
 *
 * Used by the crawler to import articles from feeds instead of relying
 * solely on homepage link extraction (which often misses or picks wrong
 * links on Bengali choti sites).
 */

export interface FeedEntry {
  title: string;
  link: string;
  content: string;       // full article body from the feed (HTML)
  publishedAt: string;   // ISO string
}

export interface FeedResult {
  entries: FeedEntry[];
  feedTitle?: string;
  feedUrl?: string;
}

/** Feed type: RSS 2.0 or Atom. */
type FeedType = "rss" | "atom";

// ── Common feed paths checked when auto-discovery fails ──
const COMMON_FEED_PATHS = [
  "/feed", "/rss", "/rss.xml", "/atom.xml", "/feed.xml",
  "/feeds/posts/default", "/feeds/posts/default?alt=rss",
  "/rss/", "/feed/", "/blog/feed", "/blog/rss.xml",
  "/index.xml", "/posts/feed", "/posts/rss",
];

/** Discover feed URLs from a website's homepage HTML + common paths. */
export function discoverFeeds(html: string, baseUrl: string): string[] {
  const feeds = new Set<string>();
  const base = new URL(baseUrl);

  // 1. Parse <link rel="alternate" type="application/rss+xml|application/atom+xml">
  const linkRe = /<link[^>]*(?:alternate|application\/(?:rss|atom)\+xml)[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const hrefMatch = m[0].match(/href=["']([^"']+)["']/i);
    if (hrefMatch) {
      try {
        feeds.add(new URL(hrefMatch[1], base.origin).href);
      } catch {}
    }
  }

  // 2. Check common feed paths
  for (const p of COMMON_FEED_PATHS) {
    try {
      feeds.add(new URL(p, base.origin).href);
    } catch {}
  }

  return Array.from(feeds);
}

/** Attempt to fetch and parse a feed. Returns entries or null. */
export async function fetchFeed(url: string): Promise<FeedResult | null> {
  try {
    // Try to access the URL (HEAD first to avoid downloading large bodies if
    // the path doesn't exist, but many feeds are light so just fetch).
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CittakkhoCrawler/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const xml = await res.text();
    if (!xml.trim()) return null;

    // Detect feed type
    const isRss = /<rss[^>]*version=["']2\.0["']/i.test(xml);
    const isAtom = /<feed[^>]*xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(xml);

    if (isRss) return parseRss(xml, url);
    if (isAtom) return parseAtom(xml, url);
    return null;
  } catch {
    return null;
  }
}

/** Get the text of an element by local name (namespace-safe for content:encoded). */
function localText(parent: Element, localName: string): string {
  if (!parent.querySelectorAll) return "";
  const all = parent.querySelectorAll("*");
  for (const el of Array.from(all)) {
    if (el.localName === localName) return el.textContent || "";
  }
  return "";
}

/** Parse an RSS 2.0 feed. */
function parseRss(xml: string, feedUrl: string): FeedResult | null {
  try {
    const { JSDOM } = require("jsdom");
    const dom = new JSDOM(xml, { contentType: "application/xml" });
    const doc = dom.window.document;

    const feedTitle = doc.querySelector("channel > title")?.textContent || "";
    const items = doc.querySelectorAll("item");
    const entries: FeedEntry[] = [];

    for (const item of items) {
      const title = item.querySelector("title")?.textContent?.trim() || "";
      const link = item.querySelector("link")?.textContent?.trim() ||
                   item.querySelector("guid")?.textContent?.trim() || "";
      if (!title || !link) continue;

      // <content:encoded> — full body (most Bengali choti sites use this).
      // Fall back to <description>.
      const contentEncoded = localText(item, "encoded");
      const description = item.querySelector("description")?.textContent || "";
      const content = contentEncoded || description;

      const pubDate = item.querySelector("pubDate")?.textContent || "";
      const publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();

      entries.push({ title, link, content, publishedAt });
    }

    return { entries, feedTitle };
  } catch {
    return null;
  }
}

/** Parse an Atom feed. */
function parseAtom(xml: string, feedUrl: string): FeedResult | null {
  try {
    const { JSDOM } = require("jsdom");
    const dom = new JSDOM(xml, { contentType: "application/xml" });
    const doc = dom.window.document;

    const feedTitle = doc.querySelector("feed > title")?.textContent || "";
    const entries_list = doc.querySelectorAll("entry");
    const entries: FeedEntry[] = [];

    for (const entry of entries_list) {
      const title = entry.querySelector("title")?.textContent?.trim() || "";
      // Atom <link href="…"> (rel="alternate" is the default when unique)
      let link = "";
      const links = entry.querySelectorAll("link");
      for (const l of links) {
        const rel = l.getAttribute("rel") || "alternate";
        const href = l.getAttribute("href") || "";
        if (rel === "alternate" || rel === "self") {
          if (href) { link = href; break; }
        }
      }
      if (!link) link = entry.querySelector("link")?.getAttribute("href") || "";
      if (!title || !link) continue;

      // Atom <content> (type="html" or "xhtml") or <summary>
      const contentEl = entry.querySelector("content, summary")?.textContent || "";
      const content = contentEl || "";

      const published = entry.querySelector("published")?.textContent ||
                        entry.querySelector("updated")?.textContent || "";
      const publishedAt = published ? new Date(published).toISOString() : new Date().toISOString();

      entries.push({ title, link, content, publishedAt });
    }

    return { entries, feedTitle };
  } catch {
    return null;
  }
}

/** Try to find and fetch a feed for a given site URL. Returns the first
 *  feed that has entries, or null. */
export async function discoverAndFetchFeed(url: string, html?: string): Promise<FeedResult | null> {
  const base = new URL(url);
  // Fetch homepage if HTML not provided
  let homeHtml = html;
  if (!homeHtml) {
    try {
      const res = await fetch(base.origin, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CittakkhoCrawler/1.0)" },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) homeHtml = await res.text();
    } catch {}
  }

  if (!homeHtml) return null;

  const feedUrls = discoverFeeds(homeHtml, base.origin);
  for (const feedUrl of feedUrls) {
    try {
      const result = await fetchFeed(feedUrl);
      if (result && result.entries.length > 0) {
        result.feedUrl = feedUrl;
        return result;
      }
    } catch {}
  }
  return null;
}