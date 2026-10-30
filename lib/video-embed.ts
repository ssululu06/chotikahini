/**
 * lib/video-embed.ts
 *
 * Parses whatever an admin pastes into the "video embed" field and turns it
 * into the pieces the video form + the public video page need:
 *
 *   - the iframe `src` (the thing we actually render)
 *   - the iframe `title` attribute (used as a fallback title)
 *   - the original watch/page URL behind that embed (so the "মূল ভিডিও
 *     পেজের লিংক" field can prefill without the admin digging for it)
 *   - a thumbnail (`poster` / `data-thumbnail` when present)
 *
 * Accepts three paste shapes:
 *   1. A complete snippet:  <iframe src="..." title="..." poster="..."></iframe>
 *   2. A self-closing tag:   <iframe src="..." />
 *   3. A bare embed URL:     https://provider.com/embed/abc123
 */

export interface IframeInfo {
  /** The iframe src we should render. Null when the input isn't an embed. */
  src: string | null;
  /** `title` attribute, if the snippet carried one. */
  title: string | null;
  /** `poster` / `data-thumbnail` / `data-poster`, if present. */
  thumbnail: string | null;
  /**
   * The original human-facing page for this video, recovered from the embed
   * src when the provider encodes it (YouTube / Vimeo / etc.).
   */
  sourceUrl: string | null;
  /** Every attribute found on the tag, lowercased keys. */
  attributes: Record<string, string>;
}

const ATTRIBUTE_PATTERN =
  /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function parseAttributes(rawTagContent: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of rawTagContent.matchAll(ATTRIBUTE_PATTERN)) {
    const key = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    attributes[key] = decodeEntities(value);
  }
  return attributes;
}

/** Matches an `<iframe ...>` opening tag, with or without a closing tag. */
function matchIframeTag(value: string): RegExpMatchArray | null {
  const trimmed = value.trim();
  const withClose = trimmed.match(/^<iframe\b([^>]*)>([\s\S]*?)<\/iframe>$/i);
  if (withClose) return withClose;
  const selfClosing = trimmed.match(/^<iframe\b([^>]*?)\/?>$/i);
  if (selfClosing) return selfClosing;
  // Be forgiving: find an iframe tag anywhere in a bigger blob (someone may
  // paste a wrapper div around it).
  const loose = trimmed.match(/<iframe\b([^>]*)>/i);
  return loose;
}

/** First http(s) URL anywhere in the string. */
function firstUrl(value: string): string | null {
  const m = value.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0] : null;
}

/**
 * Recover the human watch page from a provider's embed src.
 * Falls back to the src itself when the provider isn't recognised.
 */
export function deriveSourceUrlFromEmbed(
  embedSrc: string,
  explicit?: string | null,
): string | null {
  if (explicit) return normalizeVideoUrl(explicit);

  let u: URL;
  try {
    u = new URL(embedSrc);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  // YouTube: /embed/<id>, /v/<id>, /shorts/<id>
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "youtu.be") {
    const id =
      u.pathname.match(/\/(?:embed|v|shorts|live|e)\/([A-Za-z0-9_-]{6,})/)?.[1] ||
      u.searchParams.get("v");
    if (id) return `https://www.youtube.com/watch?v=${id}`;
  }

  // Vimeo: /video/<id>
  if (host === "player.vimeo.com" || host === "vimeo.com") {
    const id = u.pathname.match(/\/(?:video\/)?(\d{6,})/)?.[1];
    if (id) return `https://vimeo.com/${id}`;
  }

  // Facebook: the plugin href carries the real post URL.
  if (host === "facebook.com" || host === "fb.com") {
    const href = u.searchParams.get("href");
    if (href) return href;
    const pathId = u.pathname.match(/\/(?:reels|videos|watch)\/?(\d+)/)?.[1];
    if (pathId) return `https://www.facebook.com/reels/${pathId}`;
  }

  // Instagram: /p/<code>/embed
  if (host === "instagram.com") {
    const code = u.pathname.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1];
    if (code) return `https://www.instagram.com/p/${code}/`;
  }

  // TikTok: /embed/v2/<id>
  if (host === "tiktok.com") {
    const id = u.pathname.match(/\/embed\/(?:v2\/)?(\d+)/)?.[1];
    if (id) return `https://www.tiktok.com/@/video/${id}`;
  }

  // Dailymotion: /embed/video/<id>
  if (host === "dailymotion.com") {
    const id = u.pathname.match(/\/embed\/video\/([a-z0-9]+)/i)?.[1];
    if (id) return `https://www.dailymotion.com/video/${id}`;
  }

  // Porn / adult tube sites: their embeds carry the slug directly in the path
  // and the watch page is reachable by dropping `/embedframe|embed/`.
  // These are ordinary public embed endpoints; we only parse the URL shape.
  const embedFrameHosts = [
    "xvideos.com",
    "xvideos.link",
    "xhamster.com",
    "xhamster.desi",
    "xnxx.com",
    "redtube.com",
    "youporn.com",
    "spankbang.com",
    "eporner.com",
    "e621.xxx",
    "motherless.com",
    "hitomi.me",
    "fapello.com",
  ];
  for (const h of embedFrameHosts) {
    if (host === h || host.endsWith(`.${h}`)) {
      // Accept both `/embedframe/<slug>` and `/embed/<slug>` and `/<slug>/<title-slug>`.
      const m2 = u.pathname.match(
        /^\/(?:embedframe|embed|embed_video|video)\/([A-Za-z0-9_-]{6,})(?:\/([^?#]*))?/i,
      );
      if (m2) {
        const slug = m2[1];
        const titleSlug = m2[2] ? m2[2].replace(/\/+$/, "") : "";
        // XVIDEOS watch pages live under `/video.<slug>/<title-slug>`.
        if (h.includes("xvideos")) {
          return `${u.origin}/video.${slug}${titleSlug ? `/${titleSlug}` : ""}`;
        }
        return `${u.origin}/video.${slug}${titleSlug ? `/${titleSlug}` : ""}`;
      }

      // Already on a watch page shape: `/video.<slug>[/title-slug]` or `/<slug>[/...]`.
      const direct = u.pathname.match(
        /^\/(?:video\.)?([A-Za-z0-9_-]{6,})(?:\/([^?#]*))?/i,
      );
      if (direct) {
        const slug = direct[1];
        const titleSlug = direct[2] ? direct[2].replace(/\/+$/, "") : "";
        if (h.includes("xvideos")) {
          return `${u.origin}/video.${slug}${titleSlug ? `/${titleSlug}` : ""}`;
        }
        return `${u.origin}/video.${slug}${titleSlug ? `/${titleSlug}` : ""}`;
      }

      return u.origin;
    }
  }

  // Unknown provider: some embeds carry the origin page in a query param.
  for (const key of ["url", "u", "src", "page", "permalink", "link"]) {
    const v = u.searchParams.get(key);
    if (v) {
      try {
        const parsed = new URL(v);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return parsed.toString();
        }
      } catch {
        /* keep looking */
      }
    }
  }

  return null;
}

/** Validate + normalize a video/embed URL. */
export function normalizeVideoUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 8192) return null;

  try {
    const trimmed = value.trim();
    const tag = matchIframeTag(trimmed);
    const urlValue = tag
      ? parseAttributes(tag[1]).src
      : (firstUrl(trimmed) ?? trimmed);
    if (!urlValue) return null;

    const url = new URL(urlValue);
    if (
      url.toString().length > 2048 ||
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Full parse of a pasted blob. Safe to call on every keystroke — it's pure
 * string work with no network access.
 */
export function parseVideoEmbed(value: unknown): IframeInfo {
  const empty: IframeInfo = {
    src: null,
    title: null,
    thumbnail: null,
    sourceUrl: null,
    attributes: {},
  };
  if (typeof value !== "string" || value.length > 8192) return empty;

  const trimmed = value.trim();
  if (!trimmed) return empty;

  const tag = matchIframeTag(trimmed);
  const attributes = tag ? parseAttributes(tag[1]) : {};

  const src = normalizeVideoUrl(trimmed);
  if (!src) return empty;

  const titleRaw = attributes["data-title"] || attributes.title || "";
  const title = titleRaw.replace(/\s+/g, " ").trim().slice(0, 160) || null;

  const thumbnailRaw =
    attributes["data-thumbnail"] ||
    attributes["data-poster"] ||
    attributes.poster ||
    "";
  const thumbnail = normalizeVideoUrl(thumbnailRaw) || null;

  const sourceUrl = deriveSourceUrlFromEmbed(
    src,
    attributes["data-source"] || attributes["data-url"] || null,
  );

  return { src, title, thumbnail, sourceUrl, attributes };
}

/**
 * Backwards-compatible shape used by the video admin form.
 * Returns only the two fields it consumed before.
 */
export function extractIframeMetadata(value: unknown) {
  const info = parseVideoEmbed(value);
  return { title: info.title, thumbnailUrl: info.thumbnail };
}

/**
 * The extra piece the admin form needs: the original page URL, recovered from
 * the embed src.
 */
export function extractSourceUrl(value: unknown): string | null {
  return parseVideoEmbed(value).sourceUrl;
}