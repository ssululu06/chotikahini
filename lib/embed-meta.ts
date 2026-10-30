/**
 * lib/embed-meta.ts
 *
 * Shared helpers for turning a pasted link into rich embed metadata.
 *
 * Covers the platforms people actually paste into chat:
 *   - YouTube (watch / youtu.be / shorts / embed / live)
 *   - Facebook (watch, reels, posts with video)
 *   - Instagram (reel, p, tv)
 *   - TikTok
 *   - Vimeo
 *   - Twitter / X
 *   - Dailymotion
 *   - Generic: fall back to OpenGraph scraping.
 *
 * Everything here is pure (no I/O) so it can be unit tested and reused from
 * both the API route and, if needed, server components.
 */

export type EmbedProvider =
  | "youtube"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "vimeo"
  | "twitter"
  | "dailymotion"
  | "generic";

export interface EmbedMeta {
  provider: EmbedProvider;
  /** Canonical watch page URL. */
  url: string;
  /** Present when the provider has a real embeddable iframe. */
  embedUrl?: string;
  title?: string | null;
  description?: string | null;
  thumbnail?: string | null;
  siteName?: string | null;
  duration?: string | null;
  author?: string | null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Extract a YouTube video id from any of YouTube's URL shapes. */
export function parseYouTubeId(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  // youtu.be/<id>
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const v = u.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{6,}$/.test(v)) return v;
    const m = u.pathname.match(
      /^\/(?:embed|v|shorts|live|e)\/([A-Za-z0-9_-]{6,})/,
    );
    if (m) return m[1];
  }
  if (host === "youtube-nocookie.com") {
    const m = u.pathname.match(/^\/embed\/([A-Za-z0-9_-]{6,})/);
    if (m) return m[1];
  }
  return null;
}

function parseFacebookId(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (host !== "facebook.com" && host !== "fb.watch" && host !== "fb.com") return null;
  const patterns = [
    /\/reels\/(\d+)/,
    /\/watch\/?\?v=(\d+)/,
    /\/videos\/(\d+)/,
    /\/share\/v\/([A-Za-z0-9]+)/,
  ];
  for (const re of patterns) {
    const m = u.href.match(re) || u.pathname.match(re);
    if (m) return m[1];
  }
  return null;
}

/**
 * Detect the provider and pull out whatever can be derived from the URL
 * alone (no network). Returns null when nothing matches.
 */
export function deriveEmbedFromUrl(raw: string): EmbedMeta | null {
  let url: string;
  try {
    url = new URL(raw).toString();
  } catch {
    return null;
  }

  // YouTube
  const ytId = parseYouTubeId(raw);
  if (ytId) {
    return {
      provider: "youtube",
      url,
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1`,
      title: null,
      description: null,
      // maxresdefault exists for most, hqdefault is the safe fallback
      thumbnail: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      siteName: "YouTube",
    };
  }

  // Facebook
  const fbId = parseFacebookId(raw);
  if (fbId) {
    return {
      provider: "facebook",
      url,
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
        url,
      )}&show_text=0&autoplay=0`,
      title: null,
      description: null,
      thumbnail: null,
      siteName: "Facebook",
    };
  }

  // Instagram
  let u: URL | null = null;
  try {
    u = new URL(raw);
  } catch {
    /* ignore */
  }
  if (u) {
    const host = u.hostname.replace(/^www\./, "");
    const ig = u.pathname.match(/^\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
    if (host === "instagram.com" && ig) {
      return {
        provider: "instagram",
        url,
        embedUrl: `https://www.instagram.com/p/${ig[2]}/embed`,
        title: null,
        description: null,
        thumbnail: null,
        siteName: "Instagram",
      };
    }
  }

  // TikTok
  try {
    const t = new URL(raw);
    const host = t.hostname.replace(/^www\./, "");
    if (host === "tiktok.com" || host === "vm.tiktok.com") {
      const id = t.pathname.match(/\/video\/(\d+)/)?.[1];
      return {
        provider: "tiktok",
        url,
        embedUrl: id ? `https://www.tiktok.com/embed/v2/${id}` : undefined,
        title: null,
        description: null,
        thumbnail: null,
        siteName: "TikTok",
      };
    }
  } catch {
    /* ignore */
  }

  // Vimeo
  try {
    const v = new URL(raw);
    const host = v.hostname.replace(/^www\./, "");
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = v.pathname.match(/\/(\d{6,})/)?.[1];
      return {
        provider: "vimeo",
        url,
        embedUrl: id ? `https://player.vimeo.com/video/${id}` : undefined,
        title: null,
        description: null,
 thumbnail: null,
        siteName: "Vimeo",
      };
    }
  } catch {
    /* ignore */
  }

  // Twitter / X
  try {
    const x = new URL(raw);
    const host = x.hostname.replace(/^www\./, "").replace(/^mobile\./, "");
    if (host === "twitter.com" || host === "x.com") {
      return {
        provider: "twitter",
        url,
        title: null,
        description: null,
        thumbnail: null,
        siteName: "Twitter",
      };
    }
  } catch {
    /* ignore */
  }

  // Dailymotion
  try {
    const d = new URL(raw);
    const host = d.hostname.replace(/^www\./, "");
    if (host === "dailymotion.com" || host === "dai.ly") {
      const id = d.pathname.match(/\/video\/([a-z0-9]+)/i)?.[1];
      return {
        provider: "dailymotion",
        url,
        embedUrl: id ? `https://www.dailymotion.com/embed/video/${id}` : undefined,
        title: null,
        description: null,
        thumbnail: id ? `https://www.dailymotion.com/embed/video/${id}/thumbnail` : null,
        siteName: "Dailymotion",
      };
    }
  } catch {
    /* ignore */
  }

  return null;
}

/** True when the provider has a real iframe embed we can render. */
export function hasEmbed(meta: EmbedMeta | null): boolean {
  return !!meta && !!meta.embedUrl;
}

/**
 * Extract every http(s) URL found inside an `<iframe>` HTML snippet.
 * Tolerates partial / malformed markup (people paste all sorts of variants).
 */
export function extractIframeSrcs(raw: string): string[] {
  if (!raw) return [];
  const out: string[] = [];

  const push = (candidate: string | null | undefined) => {
    if (!candidate) return;
    const cleaned = candidate.replace(/^['"\s]+|['"\s]+$/g, "");
    if (!cleaned) return;
    try {
      const u = new URL(cleaned);
      if (u.protocol === "http:" || u.protocol === "https:") {
        out.push(u.toString());
      }
    } catch {
      /* not a URL — skip */
    }
  };

  // Pull `src` out of every <iframe ...> tag (both quoted forms + bare).
  const iframeTagRe = /<iframe\b[^>]*>/gi;
  let tag: RegExpExecArray | null;
  while ((tag = iframeTagRe.exec(raw))) {
    const srcMatch = tag[0].match(
      /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
    );
    push(srcMatch ? srcMatch[1] || srcMatch[2] || srcMatch[3] : null);
  }

  // Then any bare URLs in the snippet (some pastes drop the iframe wrapper).
  const urlRe = /(https?:\/\/[^\s<>"']+)/gi;
  let url: RegExpExecArray | null;
  while ((url = urlRe.exec(raw))) {
    push(url[1]);
  }

  return Array.from(new Set(out));
}

/** Pull the `title` attribute out of an `<iframe>` snippet, if present. */
export function extractIframeTitle(raw: string): string | null {
  if (!raw) return null;
  const m = raw.match(/\btitle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!m) return null;
  const value = (m[1] || m[2] || m[3] || "").trim();
  return value ? value : null;
}

/**
 * Hostnames that look like an embed player even when the provider isn't one
 * of the platforms we explicitly know about. Keeps the "any website works"
 * promise: paste an iframe, it renders.
 */
const EMBED_HOST_HINTS = [
  "player.",
  "embed",
  "/embed/",
  "media-delivery",
  "streaming",
  "videoplayer",
  "jwplayer",
  "brightcove",
  "kaltura",
  "vidyard",
  "wistia",
  "html5",
];

function hostLooksEmbeddable(hostname: string): boolean {
  const h = hostname.replace(/^www\./, "").toLowerCase();
  return EMBED_HOST_HINTS.some((hint) => h.includes(hint));
}

/**
 * Decide whether a pasted blob should render as an embed, and if so return
 * the iframe src to use plus any title carried in the markup.
 *
 * Handles three paste shapes:
 *   1. A raw iframe snippet: `<iframe src="..." title="...">`
 *   2. A bare embed URL: `https://player.example.com/video/xyz`
 *   3. A known-provider watch URL: `https://youtu.be/...`
 */
export function parseEmbedInput(raw: string): {
  embedUrl: string;
  title: string | null;
  sourceUrl: string;
  provider: EmbedProvider;
} | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hasIframeTag = /<iframe\b/i.test(trimmed);
  const srcs = extractIframeSrcs(trimmed);
  const attrTitle = hasIframeTag ? extractIframeTitle(trimmed) : null;

  // Shape 1 & 2: an iframe snippet or a bare URL.
  for (const candidate of srcs) {
    // Prefer known providers — they give us nicer embeds + thumbnails.
    const known = deriveEmbedFromUrl(candidate);
    if (known) {
      return {
        embedUrl: known.embedUrl || candidate,
        title: attrTitle || known.title || null,
        sourceUrl: known.url || candidate,
        provider: known.provider,
      };
    }
  }

  if (hasIframeTag && srcs.length > 0) {
    const src = srcs[0];
    return {
      embedUrl: src,
      title: attrTitle,
      sourceUrl: src,
      provider: "generic",
    };
  }

  // Shape 3: a single bare URL that looks like an embed player host.
  const bare = trimmed.match(/^(https?:\/\/\S+)$/);
  if (bare && srcs.length === 1) {
    let hostname = "";
    try {
      hostname = new URL(srcs[0]).hostname;
    } catch {
      return null;
    }
    if (hostLooksEmbeddable(hostname)) {
      return {
        embedUrl: srcs[0],
        title: null,
        sourceUrl: srcs[0],
        provider: "generic",
      };
    }
  }

  return null;
}