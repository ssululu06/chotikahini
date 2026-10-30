import { NextResponse } from "next/server";
import { deriveEmbedFromUrl, EmbedMeta } from "@/lib/embed-meta";
import { isBotRequest } from "@/lib/bot-guard";

export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 5000;

/** Hostnames we refuse to fetch metadata from (SSRF guard). */
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

function metaValue(html: string, names: string[]): string | null {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re1 = new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`,
      "i",
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`,
      "i",
    );
    const m = html.match(re1) || html.match(re2);
    if (m && m[1] && m[1].trim()) return m[1].trim();
  }
  return null;
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; EmbedMetaBot/1.0; +https://example.com/bot)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    // Cap so a huge page can't blow up memory.
    const slice = buf.slice(0, 400_000);
    return new TextDecoder("utf-8", { fatal: false }).decode(slice);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try the provider's public oEmbed endpoint first — it's cheap, stable, and
 * returns exactly the title/author/thumbnail we want without parsing HTML.
 */
async function tryOEmbed(
  provider: string,
  url: string,
): Promise<Partial<EmbedMeta> | null> {
  const endpoints: Record<string, string> = {
    youtube: "https://www.youtube.com/oembed?format=json&url=",
    vimeo: "https://vimeo.com/api/oembed.json?url=",
    dailymotion: "https://www.dailymotion.com/services/oembed?format=json&url=",
    tiktok: "https://www.tiktok.com/oembed?url=",
    instagram: "https://graph.facebook.com/v10.0/instagram_oembed?url=",
    twitter: "https://publish.twitter.com/oembed?url=",
  };
  const base = endpoints[provider];
  if (!base) return null;
  const full = base + encodeURIComponent(url);
  const body = await fetchText(full);
  if (!body) return null;
  try {
    const j = JSON.parse(body);
    return {
      title: j.title ?? null,
      author: j.author_name ?? null,
      thumbnail: j.thumbnail_url ?? null,
      // oEmbed HTML often carries an <iframe> we can reuse.
      embedUrl:
        typeof j.html === "string"
          ? (j.html.match(/src=["']([^"']+)["']/)?.[1] ?? undefined)
          : undefined,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  // Fetches a remote page for video metadata — reject obvious scrapers
  // before that work starts. Legitimate crawlers are allowed through.
  if (isBotRequest(req)) {
    return NextResponse.json({ error: "not allowed" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("url") || "").trim();

  if (!raw) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "unsupported protocol" }, { status: 400 });
  }
  if (isBlockedHost(target.hostname)) {
    return NextResponse.json({ error: "blocked host" }, { status: 400 });
  }

  // 1. Derive everything we can from the URL alone.
  const derived = deriveEmbedFromUrl(raw);

  if (derived) {
    // 2. Enrich via oEmbed (best-effort; falls back to the derived values).
    const oe = await tryOEmbed(derived.provider, derived.url);
    const merged: EmbedMeta = {
      ...derived,
      title: oe?.title ?? derived.title ?? null,
      author: oe?.author ?? null,
      thumbnail: oe?.thumbnail ?? derived.thumbnail ?? null,
      embedUrl: oe?.embedUrl ?? derived.embedUrl,
    };
    return NextResponse.json(merged);
  }

  // 3. Generic: scrape OpenGraph from the page itself.
  const html = await fetchText(target.toString());
  if (!html) {
    return NextResponse.json({
      provider: "generic",
      url: target.toString(),
      title: null,
      description: null,
      thumbnail: null,
    });
  }

  let thumbnail = metaValue(html, ["og:image", "og:image:secure_url", "twitter:image"]);
  if (thumbnail) {
    try {
      thumbnail = new URL(thumbnail, target.toString()).toString();
    } catch {
      /* leave as-is */
    }
  }

  return NextResponse.json({
    provider: "generic",
    url: target.toString(),
    title: metaValue(html, ["og:title", "twitter:title"]) ?? null,
    description:
      metaValue(html, ["og:description", "twitter:description", "description"]) ?? null,
    thumbnail,
    siteName: metaValue(html, ["og:site_name"]) ?? target.hostname,
  });
}