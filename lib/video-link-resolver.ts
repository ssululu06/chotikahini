/**
 * lib/video-link-resolver.ts
 *
 * Turns a *human watch URL* — the thing an author pastes into a story —
 * into an iframe `src` we can actually render. This is the mirror image of
 * `deriveSourceUrlFromEmbed` in lib/video-embed.ts (which goes embed → watch).
 *
 * Two kinds of link are understood:
 *
 *   1. Our OWN published videos — `/videos/<id>` or the absolute
 *      `https://<site>/videos/<id>`. These resolve against the local
 *      `video_posts` table so the story shows the exact video the admin
 *      published (with its own thumbnail/title/uploader) rather than a
 *      bare third-party frame.
 *
 *   2. Third-party watch URLs — YouTube, Vimeo, Dailymotion, TikTok and the
 *      common tube sites — normalised into their canonical embed endpoint.
 *
 * Everything is pure string/URL work except `resolveOwnVideoLink`, which is
 * isolated so callers that can't touch the DB can skip it.
 */

import { getSupabaseAdmin } from "@/lib/supabase";

export interface ResolvedVideo {
  /** The iframe `src` to render. */
  embedUrl: string;
  /** Title for the frame + a visible caption. */
  title: string | null;
  /** Poster image, when we know one. */
  thumbnail: string | null;
  /** The original link the author wrote, for the "মূল পেজে যান" affordance. */
  sourceUrl: string;
  /** True when the link pointed at one of our own /videos pages. */
  isOwn: boolean;
}

const OWN_VIDEO_ID = /\/videos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const OWN_VIDEO_ID_SHORT = /\/videos\/([0-9a-f]{8,})/i;

/**
 * Extract our own video id from a link, if it points at /videos/<id>.
 * Accepts absolute and relative forms.
 */
export function extractOwnVideoId(rawUrl: string): string | null {
  const m =
    rawUrl.match(OWN_VIDEO_ID) || rawUrl.match(OWN_VIDEO_ID_SHORT);
  return m ? m[1] : null;
}

/**
 * Convert a third-party watch URL into its embed endpoint.
 * Returns null when the host isn't a provider we can embed.
 */
export function thirdPartyEmbedUrl(rawUrl: string): {
  embedUrl: string;
  title?: string | null;
} | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  // ---- YouTube: watch / shorts / live / youtu.be ----
  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "youtu.be"
  ) {
    const id =
      (host === "youtu.be"
        ? u.pathname.slice(1)
        : u.pathname.match(/\/(?:shorts|live|embed|v|e)\/([A-Za-z0-9_-]{6,})/)?.[1]) ||
      u.searchParams.get("v");
    if (!id) return null;
    // Use the privacy-enhanced nocookie host so the story doesn't leak
    // viewers into ad-personalisation the moment they hit play.
    const start = u.searchParams.get("t") || u.searchParams.get("start");
    const params = new URLSearchParams();
    if (start) params.set("start", String(parseInt(start, 10) || 0));
    const qs = params.toString();
    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}${qs ? `?${qs}` : ""}`,
      title: null,
    };
  }

  // ---- Vimeo ----
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id =
      u.pathname.match(/\/(?:video\/)?(\d{6,})/)?.[1] ||
      u.searchParams.get("video_id");
    if (!id) return null;
    return { embedUrl: `https://player.vimeo.com/video/${id}`, title: null };
  }

  // ---- Dailymotion ----
  if (host === "dailymotion.com" || host === "dai.ly") {
    const id = u.pathname.match(/(?:video\/)?([a-z0-9]{5,})/i)?.[1];
    if (!id) return null;
    return {
      embedUrl: `https://www.dailymotion.com/embed/video/${id}`,
      title: null,
    };
  }

  // ---- TikTok ----
  if (host === "tiktok.com") {
    const id = u.pathname.match(/\/video\/(\d{6,})/)?.[1];
    if (!id) return null;
    return { embedUrl: `https://www.tiktok.com/embed/v2/${id}`, title: null };
  }

  // ---- Facebook / Instagram ----
  if (host === "facebook.com" || host === "fb.com" || host === "fb.watch") {
    const id = u.pathname.match(/\/(?:reels|videos|watch)\/?(\d{6,})/)?.[1];
    if (id) {
      return {
        embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
          `https://www.facebook.com/reels/${id}`
        )}`,
        title: null,
      };
    }
  }
  if (host === "instagram.com") {
    const code = u.pathname.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1];
    if (code) {
      return {
        embedUrl: `https://www.instagram.com/p/${code}/embed`,
        title: null,
      };
    }
  }

  // ---- Tube sites that already accept a watch URL as the frame source.
  // Their `/video.<slug>/…` pages serve a player directly, and the embed
  // shape is `/embedframe/<slug>`. ----
  const tubeHosts = [
    "xvideos.com",
    "xvideos.link",
    "xhamster.com",
    "xhamster.desi",
    "xnxx.com",
    "redtube.com",
    "youporn.com",
    "spankbang.com",
    "eporner.com",
    "hitomi.me",
    "fapello.com",
  ];
  for (const h of tubeHosts) {
    if (host === h || host.endsWith(`.${h}`)) {
      const slug = u.pathname.match(
        /^\/(?:video\.|embedframe\/|embed\/|video\/)([A-Za-z0-9_-]{6,})/i,
      )?.[1];
      if (slug) {
        return { embedUrl: `${u.origin}/embedframe/${slug}`, title: null };
      }
      const bare = u.pathname.match(/^\/([A-Za-z0-9_-]{6,})(?:\/|$)/)?.[1];
      if (bare) {
        return { embedUrl: `${u.origin}/embedframe/${bare}`, title: null };
      }
    }
  }

  return null;
}

/**
 * Full resolution for a link pasted into a story.
 *
 * Own /videos/<id> links go through the DB so we reuse the published row's
 * embed_url/thumbnail (single source of truth — if the admin swaps the
 * provider, every story follows automatically).
 */
export async function resolveVideoLink(rawUrl: string): Promise<ResolvedVideo | null> {
  const ownId = extractOwnVideoId(rawUrl);
  if (ownId) {
    const { data } = await getSupabaseAdmin()
      .from("video_posts")
      .select("id, title, thumbnail_url, embed_url, source_url, status, published_at")
      .eq("id", ownId)
      .neq("status", "deleted")
      .maybeSingle();
    if (data?.embed_url) {
      // Drafts / scheduled videos stay hidden from the public site, so a
      // story must not be able to surface an unpublished video.
      const live =
        data.status === "published" &&
        (!data.published_at || data.published_at <= new Date().toISOString());
      if (live) {
        return {
          embedUrl: data.embed_url,
          title: data.title,
          thumbnail: data.thumbnail_url,
          sourceUrl: data.source_url || rawUrl,
          isOwn: true,
        };
      }
    }
  }

  const third = thirdPartyEmbedUrl(rawUrl);
  if (third) {
    return {
      embedUrl: third.embedUrl,
      title: third.title ?? null,
      thumbnail: null,
      sourceUrl: rawUrl,
      isOwn: false,
    };
  }

  return null;
}

const ANY_URL_RE = /https?:\/\/[^\s<>"']+/g;

/**
 * Per-body cap. A community feed page shows 20 posts; resolving 10 links per
 * post would mean up to 200 embed lookups for one screen of scroll. Five is
 * far more than any real post uses and keeps the query count bounded.
 */
const MAX_LINKS_PER_BODY = 5;

/**
 * Resolve every video link inside a plain-text body.
 *
 * Returns a map keyed by the *exact* URL substring that appears in the text,
 * which is what the renderers look up. Texts with no video links (the
 * overwhelming majority) return an empty object without touching the DB.
 *
 * `enabled` lets a caller honour the site-wide video kill switch without
 * branching at every call site; resolution is pure overhead when the section
 * is off, since the player would point at a page that 404s.
 */
export async function resolveVideosInText(
  text: string,
  enabled = true,
): Promise<Record<string, ResolvedVideo>> {
  if (!enabled || !text) return {};

  const matches = text.match(ANY_URL_RE);
  if (!matches) return {};

  const urls = Array.from(new Set(matches)).slice(0, MAX_LINKS_PER_BODY);
  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        return { url, video: await resolveVideoLink(url) };
      } catch {
        // One bad link must never take the whole post (or feed page) down.
        return { url, video: null };
      }
    }),
  );

  const videos: Record<string, ResolvedVideo> = {};
  for (const { url, video } of results) {
    if (video) videos[url] = video;
  }
  return videos;
}

/**
 * True when the body contains *only* our own `/videos/<id>` links — the
 * community-post policy, which is stricter than the story-body policy
 * (stories happily take any embeddable third-party URL; the community
 * feed accepts posts whose only link is to a video WE published, so the
 * reader stays on-site and the post can't turn into a spam redirect).
 */
export async function bodyHasOnlyOwnVideoLinks(text: string): Promise<boolean> {
  const matches = text.match(ANY_URL_RE);
  if (!matches) return true; // no links at all — nothing to police
  for (const url of Array.from(new Set(matches))) {
    if (!extractOwnVideoId(url)) return false;
  }
  return true;
}