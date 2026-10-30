import { NextResponse } from "next/server";
import {
  deriveSourceUrlFromEmbed,
  normalizeVideoUrl,
} from "@/lib/video-embed";
import { scrapeEmbedFrame } from "@/lib/embed-scrapers";
import { resolveEmbed } from "@/lib/embed-resolver";
import { isBotRequest } from "@/lib/bot-guard";

export const dynamic = "force-dynamic";

/**
 * Server-side metadata lookup for a pasted embed.
 *
 * The browser cannot read a cross-origin iframe's document, so when an admin
 * pastes an embed that has no `title` / `poster` attribute we fetch the page
 * ourselves and pull og:title, og:image and og:description out of it.
 *
 * GET /api/video-metadata?url=<url>
 *   — url may be the embed src OR the original watch page.
 */

const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 500_000;

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h.startsWith("169.254.") ||
    h.startsWith("10.") ||
    h.startsWith("192.168.")
  );
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function metaValue(html: string, names: string[]): string | null {
  for (const name of names) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re1 = new RegExp(
      `<meta[^>]+(?:property|name)=["']${esc}["'][^>]*content=["']([^"']*)["']`,
      "i",
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${esc}["']`,
      "i",
    );
    const m = html.match(re1) || html.match(re2);
    if (m && m[1] && m[1].trim()) return decodeEntities(m[1].trim());
  }
  return null;
}

async function fetchHtml(url: string): Promise<string | null> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return null;
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") return null;
  if (isBlockedHost(target.hostname)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new TextDecoder("utf-8", { fatal: false }).decode(
      buf.slice(0, MAX_HTML_BYTES),
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Titles that are page chrome / placeholders, not the real video title. */
function isPlaceholderTitle(value: string | null | undefined): boolean {
  if (!value) return true;
  const t = value.replace(/\s+/g, " ").trim();
  if (t.length < 3) return true;
  return (
    /^(embed video|video player|just a moment|loading|redirecting|access denied|forbidden|not found|error|404|403|500|javascript is (disabled|required)|please enable javascript|attention required|checking your browser)/i.test(
      t,
    ) ||
    // "<Provider>.com embed video" / "<Provider> embed" style defaults.
    /^[\w.-]+\.(?:com|net|org|io|co)\s+embed\b/i.test(t) ||
    /\bembed\s+video\b/i.test(t) ||
    /^\s*(?:xvideos|xhamster|xnxx|redtube|youporn|pornhub|spankbang|eporner)\b[\w\s.-]*$/i.test(
      t,
    )
  );
}

/**
 * Last-resort title extraction.
 *
 * A lot of modern pages (and most tube sites) don't ship a useful <title> or
 * og:title on their embed/watch pages — the human title lives in some custom
 * element instead, e.g.
 *
 *   <span id="title-auto-tr">Desi Couple Chair Pe Ghodi ...</span>
 *   <h1 class="video-title">...</h1>
 *   <div class="_5pcr9">...</div>            (Twitter-style obfuscated ids)
 *
 * So we sweep a prioritised list of DOM shapes before giving up.
 */
function extractTitleFromHtml(html: string): string | null {
  const clean = (value: string | undefined | null): string | null => {
    if (!value) return null;
    const text = decodeEntities(
      value
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    if (isPlaceholderTitle(text)) return null;
    return text.slice(0, 200);
  };

  // 1. Explicit id/class hints — the <span id="title-auto-tr"> case.
  const idHints = [
    "title-auto-tr",
    "title-auto",
    "video-title",
    "videoTitle",
    "watch-title",
    "entry-title",
    "product_title",
    "og_title",
    "video_name",
  ];
  for (const id of idHints) {
    const re = new RegExp(
      `<(?:span|h1|h2|h3|div|p|meta)[^>]*(?:id|class|itemprop|data-testid)=["'][^"']*\\b${id}\\b[^"']*["'][^>]*>([\\s\\S]{1,400}?)<\\/(?:span|h1|h2|h3|div|p)>`,
      "i",
    );
    const m = html.match(re);
    if (m) {
      const title = clean(m[1]);
      if (title) return title;
    }
    // Self-closing / meta form: content="..."
    const metaRe = new RegExp(
      `<meta[^>]*(?:id|itemprop|name|property)=["'][^"']*\\b${id}\\b[^"']*["'][^>]*content=["']([^"']{3,200})["']`,
      "i",
    );
    const mm = html.match(metaRe);
    if (mm) {
      const title = clean(mm[1]);
      if (title) return title;
    }
  }

  // 2. Any element whose id or class *contains* "title".
  const genericId = html.match(
    /<(?:span|h1|h2|h3|div|p|meta)[^>]*(?:id|class|itemprop)=["'][^"']*title[^"']*["'][^>]*>([\s\S]{1,400}?)<\/(?:span|h1|h2|h3|div|p)>/i,
  );
  if (genericId) {
    const title = clean(genericId[1]);
    if (title) return title;
  }

  // 3. The first <h1> that isn't a nav/error heading.
  const h1 = html.match(/<h1[^>]*>([\s\S]{1,400}?)<\/h1>/i);
  if (h1) {
    const title = clean(h1[1]);
    if (title) return title;
  }

  // 4. <h2> as a second structural heading.
  const h2 = html.match(/<h2[^>]*>([\s\S]{1,400}?)<\/h2>/i);
  if (h2) {
    const title = clean(h2[1]);
    if (title) return title;
  }

  // 5. JSON-LD / embedded JSON that carries a name/title field.
  const jsonLd = html.match(
    /["'](?:name|headline|title)["']\s*:\s*["']([^"']{5,200})["']/i,
  );
  if (jsonLd) {
    const title = clean(jsonLd[1]);
    if (title) return title;
  }

  return null;
}

/**
 * Turn a URL slug into a human title.
 *   /video.omfdkmld693/desi-couple-chair-pe-ghodi-cowgirl-ride
 *     -> "Desi Couple Chair Pe Ghodi Cowgirl Ride"
 *
 * Rejects slugs that are only an opaque id ("omfdkmld693") — those carry no
 * words, so returning them would be worse than leaving the field empty.
 */
function titleFromSlug(url: string): string | null {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;

    // Prefer the last segment that actually contains word separators.
    for (const raw of [...segments].reverse()) {
      const slug = raw.replace(/^[a-z]+_/, "").replace(/^[a-z]+\./i, "");
      // Needs at least two words to look like a title, not an id.
      if (!/[-_+]/.test(raw) || slug.length < 8) continue;
      const words = slug.replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim();
      const parts = words.split(" ").filter((w) => w.length > 1);
      if (parts.length < 2) continue;
      return parts
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
        .slice(0, 200);
    }

    return null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  // Resolves video metadata by fetching and parsing remote pages — reject
  // obvious scrapers before that work starts.
  if (isBotRequest(req)) {
    return NextResponse.json({ error: "not allowed" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("url") || "").trim();

  if (!raw) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }

  // Accept either a bare URL or a pasted iframe snippet.
  const normalized = normalizeVideoUrl(raw) ?? (raw.startsWith("http") ? raw : null);
  if (!normalized) {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  // The embed frame is scanned FIRST: for providers whose watch page 404s or
  // is geo-blocked, the embed HTML still carries the real title/thumbnail via
  // its inline player API (`html5player.setVideoTitle(...)` and friends).
  const embedHtml = await fetchHtml(normalized);
  let fromEmbed = embedHtml ? scrapeEmbedFrame(normalized, embedHtml) : null;

  // A watch page recovered from the embed beats our slug-only guess.
  const sourceUrl =
    fromEmbed?.sourceUrl ?? deriveSourceUrlFromEmbed(normalized);

  const candidates = [sourceUrl, normalized].filter(
    (v, i, arr): v is string => !!v && arr.indexOf(v) === i,
  );

  // If the embed scrape already gave us a real title and a picture, we're done.
  if (
    fromEmbed?.title &&
    fromEmbed?.thumbnail &&
    !isPlaceholderTitle(fromEmbed.title)
  ) {
    return NextResponse.json({
      title: fromEmbed.title.slice(0, 200),
      thumbnail: fromEmbed.thumbnail,
      description: fromEmbed.description,
      sourceUrl,
      resolvedFrom: `${normalized} (embed player API)`,
    });
  }

  for (const candidate of candidates) {
    const html = await fetchHtml(candidate);
    if (!html) continue;

    // Resolution order:
    //   1. og:title / twitter:title  (most reliable, machine-readable)
    //   2. <title>                   (skip placeholder strings)
    //   3. custom DOM shapes         (<span id="title-auto-tr">, <h1>, …)
    //   4. JSON-LD "name"/"headline"
    //   5. URL slug, humanised
    // 1. og:title / twitter:title  (most reliable, machine-readable)
    const ogTitle = metaValue(html, ["og:title", "twitter:title"]);
    const rawTitleTag = html.match(/<title[^>]*>([\s\S]{1,300}?)<\/title>/i)?.[1]?.trim() ?? null;

    let title = !isPlaceholderTitle(ogTitle) ? ogTitle : null;
    if (!title && !isPlaceholderTitle(rawTitleTag)) title = rawTitleTag;
    if (!title) title = extractTitleFromHtml(html);
    if (!title) title = titleFromSlug(candidate);

    let thumbnail = metaValue(html, [
      "og:image",
      "og:image:secure_url",
      "twitter:image",
      "twitter:image:src",
    ]);
    if (thumbnail) {
      try {
        thumbnail = new URL(thumbnail, candidate).toString();
      } catch {
        /* keep raw */
      }
    }

    // Some embeds only expose the poster inside a JS config blob.
    if (!thumbnail) {
      const posterInJs = html.match(
        /["'](?:poster|thumbnail|thumb|image)["']\s*:\s*"(https?:[^"']{10,400})"/i,
      )?.[1];
      if (posterInJs) thumbnail = posterInJs.replace(/\\\//g, "/");
    }

const description = metaValue(html, [
      "og:description",
      "twitter:description",
      "description",
    ]);

    // Uploader / channel name. Sites expose this under wildly different
    // labels, so we probe the common ones plus the JSON-LD author block.
    // Only used when the admin hasn't typed their own value.
    let uploaderName =
      metaValue(html, [
        "author",
        "article:author",
        "video:director",
        "twitter:creator",
        "og:site_name",
      ]) ?? null;

    if (!uploaderName) {
      const jsonLdAuthor = html.match(
        /"author"\s*:\s*(?:\{\s*)?(?:"name"\s*:\s*")([^"]{2,120})"/i,
      )?.[1];
      if (jsonLdAuthor) uploaderName = jsonLdAuthor.trim();
    }

    if (!uploaderName) {
      // Scraper-style JS config: html5player.setUploaderName('someone')
      const jsUploader = html.match(
        /\.set(?:UploaderName|AuthorName|ChannelName)\(\s*['"]([^'"]{2,120})['"]\s*\)/i,
      )?.[1];
      if (jsUploader) uploaderName = jsUploader.trim();
if (jsUploader) uploaderName = jsUploader.trim();
    }

    if (title || thumbnail) {
      // Try resolving to a known provider's official embed URL.
      const resolved = resolveEmbed(sourceUrl || candidate || "");
      return NextResponse.json({
        // Prefer anything the HTML gave us; fall back to the embed player API.
        title: (title || fromEmbed?.title || "").slice(0, 200) || null,
        thumbnail: thumbnail || fromEmbed?.thumbnail || null,
        description:
          description || fromEmbed?.description || null,
        sourceUrl: sourceUrl || fromEmbed?.sourceUrl || candidate,
        uploaderName: uploaderName ?? fromEmbed?.uploader ?? null,
        embedUrl: resolved?.embedUrl ?? normalized,
        provider: resolved?.provider ?? null,
        resolvedFrom: candidate,
      });
      }
    }

  // Nothing from HTML — fall back to the URL slug (and anything the embed
  // player API gave us) so the admin still gets a usable title.
  const slugTitle = titleFromSlug(sourceUrl || normalized);
  // For known providers we don't even need HTML. The resolver turns the
  // watch-page URL into the provider's official embed URL with no scraping.
  const resolved = resolveEmbed(sourceUrl || normalized || "");
  return NextResponse.json({
    title: slugTitle || fromEmbed?.title || null,
    thumbnail: fromEmbed?.thumbnail || null,
    description: fromEmbed?.description ?? null,
    sourceUrl: sourceUrl || fromEmbed?.sourceUrl || normalized,
    embedUrl: resolved?.embedUrl ?? normalized,
    provider: resolved?.provider ?? null,
    uploaderName: fromEmbed?.uploader ?? null,
  });
}