/**
 * lib/embed-resolver.ts
 *
 * Turns any watch-page URL into the provider's own official embed URL.
 *
 * Why this exists:
 *   Platforms don't expect you to remember their embed path. Pasting the
 *   watch URL is what humans actually do, and the mapping between the two
 *   is deterministic per provider:
 *
 *       watch page : https://site.com/<video-id>
 *       embed frame: https://site.com/embedframe/<video-id>
 *
 *   Getting this shape right matters more than it sounds — a malformed
 *   path usually 404s, and several providers serve `X-Frame-Options:
 *   SAMEORIGIN` on their 404 page. The browser then shows "refused to
 *   connect" in the iframe, which looks identical to "this site blocks
 *   embedding" but is really just a bad URL.
 *
 * Adding a provider: append one rule. Each rule needs the host list, a
 * pattern that captures the video ID from the watch-page path, and the two
 * templates.
 */

export interface ProviderRule {
  /** Hostnames (with or without www.) this rule claims. */
  hostMatch: string[];
  /** Matched against the watch-page pathname; capture group 1 is the video ID. */
  idPattern: RegExp;
  /** The iframe src we should render. */
  embedTemplate: (id: string, url: URL) => string;
  /** The original human-facing page for this video. */
  sourceTemplate: (id: string, url: URL) => string;
}

export interface ResolutionResult {
  embedUrl: string;
  sourceUrl: string;
  provider: string;
}

const PROVIDER_RULES: ProviderRule[] = [
  // --- Mainstream ----------------------------------------------------------
  {
    hostMatch: ["youtube.com", "youtube-nocookie.com", "youtu.be"],
    idPattern: /(?:watch\?v=|\/(?:embed|v|shorts|live|e)\/)([A-Za-z0-9_-]{6,})/,
    embedTemplate: (id) =>
      `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`,
    sourceTemplate: (id) => `https://www.youtube.com/watch?v=${id}`,
  },
  {
    hostMatch: ["vimeo.com", "player.vimeo.com"],
    idPattern: /\/(?:video\/)?(\d{6,})/,
    embedTemplate: (id) => `https://player.vimeo.com/video/${id}`,
    sourceTemplate: (id) => `https://vimeo.com/${id}`,
  },
  {
    hostMatch: ["dailymotion.com", "dai.ly"],
    idPattern: /\/video\/([a-z0-9]+)/i,
    embedTemplate: (id) => `https://www.dailymotion.com/embed/video/${id}`,
    sourceTemplate: (id) => `https://www.dailymotion.com/video/${id}`,
  },

  // --- Xvideos -------------------------------------------------------------
  // Watch : /video.omfdkmld693/desi_couple_chair_…
  // Embed : /embedframe/omfdkmld693          ← ID ONLY, no title slug
  //
  // Probed both shapes directly:
  //   /embedframe/<id>         → 200, no X-Frame-Options  → embeds cleanly
  //   /embedframe/<id>/<slug>  → 404, X-Frame-Options: SAMEORIGIN
  //
  // The 404 page is what produces "refused to connect" for the visitor, so
  // the single-segment form is mandatory here.
  {
    hostMatch: ["xvideos.com", "xvideos.link"],
    idPattern: /\/video\.([a-z0-9]+)(?:\/[^?#]*)?/i,
    embedTemplate: (id) => `https://www.xvideos.com/embedframe/${id}`,
    sourceTemplate: (id) => `https://www.xvideos.com/video.${id}`,
  },
  {
    // /embedframe/<id> is served without X-Frame-Options too.
    hostMatch: ["xnxx.com"],
    idPattern: /\/video\.?([a-z0-9_-]+)(?:\/[^?#]*)?/i,
    embedTemplate: (id) => `https://www.xnxx.com/embedframe/${id}`,
    sourceTemplate: (id) => `https://www.xnxx.com/video.${id}`,
  },

  // --- Other tube platforms ------------------------------------------------
  {
    hostMatch: ["xhamster.com", "xhamster.desi", "xhamster2.com", "xhamster3.com"],
    idPattern: /\/videos\/([A-Za-z0-9_-]+)/i,
    embedTemplate: (id) => `https://xhamster.com/embed/${id}`,
    sourceTemplate: (id) => `https://xhamster.com/videos/${id}`,
  },
  {
    hostMatch: ["pornhub.com"],
    idPattern: /\/view_video\.php\?viewkey=([a-z0-9]+)/i,
    embedTemplate: (id) => `https://www.pornhub.com/embed/${id}`,
    sourceTemplate: (id) => `https://www.pornhub.com/view_video.php?viewkey=${id}`,
  },
  {
    hostMatch: ["spankbang.com"],
    // Watch : /<account>/video/<slug>
    // Embed : /<account>/embed/
    idPattern: /\/([a-z0-9_-]+)\/video\/([a-z0-9_-]+)/i,
    embedTemplate: (_id, url) => {
      const m = url.pathname.match(/^\/([a-z0-9_-]+)\/video\//i);
      return m ? `https://spankbang.com/${m[1]}/embed/` : "";
    },
    sourceTemplate: (_id, url) => `https://spankbang.com${url.pathname}`,
  },
  {
    hostMatch: ["faphouse.com", "faphouse2.com"],
    idPattern: /\/videos\/([a-z0-9_-]+)/i,
    embedTemplate: (id, url) => {
      const host = url.hostname.replace(/^www\./, "");
      return `https://${host}/embed/${id}`;
    },
    sourceTemplate: (id, url) => {
      const host = url.hostname.replace(/^www\./, "");
      return `https://${host}/videos/${id}`;
    },
  },
  {
    hostMatch: ["redtube.com"],
    idPattern: /\/(\d+)(?:[/?#]|$)/,
    embedTemplate: (id) => `https://www.redtube.com/embed/?id=${id}`,
    sourceTemplate: (_id, url) => `https://www.redtube.com${url.pathname}`,
  },
  {
    hostMatch: ["youporn.com"],
    idPattern: /\/watch\/(\d+)\/([a-z0-9_-]+)/i,
    embedTemplate: (id) => `https://www.youporn.com/embed/${id}`,
    sourceTemplate: (id) => `https://www.youporn.com/watch/${id}`,
  },
  {
    hostMatch: ["tube8.com"],
    idPattern: /\/([a-z0-9_-]+)\/([a-z0-9_-]+)/i,
    embedTemplate: (_id, url) => {
      const parts = url.pathname.split("/").filter(Boolean);
      return parts.length >= 2
        ? `https://www.tube8.com/embed/${parts[0]}/${parts[1]}`
        : "";
    },
    sourceTemplate: (_id, url) => `https://www.tube8.com${url.pathname}`,
  },
  {
    hostMatch: ["beeg.com"],
    idPattern: /\/(\d{4,})/,
    embedTemplate: (id) => `https://beeg.com/embed/${id}`,
    sourceTemplate: (id) => `https://beeg.com/${id}`,
  },
];

function hostMatches(rule: ProviderRule, host: string): boolean {
  return rule.hostMatch.some((h) => {
    const base = h.replace(/^www\./, "");
    return host === base || host.endsWith(`.${base}`);
  });
}

/**
 * Resolve a watch-page URL to its provider-official embed URL.
 * Returns null when the host isn't in our rules.
 */
export function resolveEmbed(inputUrl: string): ResolutionResult | null {
  let url: URL;
  try {
    url = new URL(inputUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  for (const rule of PROVIDER_RULES) {
    if (!hostMatches(rule, host)) continue;

    const m = url.pathname.match(rule.idPattern);
    if (!m || !m[1]) continue;

    const id = m[1];
    const embedUrl = rule.embedTemplate(id, url);
    if (!embedUrl) continue;

    return {
      embedUrl,
      sourceUrl: rule.sourceTemplate(id, url),
      provider: rule.hostMatch[0],
    };
  }

  return null;
}

/** Every host we recognise — used to gate the allow-list in API routes. */
export function knownProviderHosts(): string[] {
  return PROVIDER_RULES.flatMap((r) => r.hostMatch.map((h) => h.replace(/^www\./, "")));
}

export function isKnownProvider(hostLike: string): boolean {
  let host = hostLike.toLowerCase();
  try {
    host = new URL(hostLike).hostname.toLowerCase();
  } catch {
    /* already a bare host */
  }
  host = host.replace(/^www\./, "");
  return PROVIDER_RULES.some((r) => hostMatches(r, host));
}