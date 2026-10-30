import { NextResponse } from "next/server";
import { parseEmbedInput } from "@/lib/embed-meta";
import { isBotRequest } from "@/lib/bot-guard";

export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 400_000;

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
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re1 = new RegExp(
      `<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"']*)["']`,
      "i",
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${esc}["']`,
      "i",
    );
    const m = html.match(re1) || html.match(re2);
    if (m && m[1] && m[1].trim()) return m[1].trim();
  }
  return null;
}

/** Best-effort title from the iframe src page (og:title → <title>). */
async function scrapeTitle(url: string): Promise<string | null> {
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
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; EmbedMetaBot/1.0; +https://example.com/bot)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      buf.slice(0, MAX_HTML_BYTES),
    );
    const og = metaValue(html, ["og:title", "twitter:title"]);
    if (og) return og;
    const t = html.match(/<title[^>]*>([\s\S]{1,300}?)<\/title>/i);
    if (t && t[1]) return t[1].trim();
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Takes any pasted blob — a raw `<iframe>...</iframe>` snippet, a bare embed
 * URL, or a known provider watch link — and returns everything the chat card
 * needs: the iframe src to render, the original page URL, and an
 * auto-filled title (from the iframe `title` attribute, else from the
 * embedded page's OpenGraph metadata).
 *
 * GET /api/embed-info?text=<url-encoded blob>
 */
export async function GET(req: Request) {
  // Fetches a remote page and parses its HTML — reject obvious scrapers
  // before that work starts. Legitimate crawlers are allowed through.
  if (isBotRequest(req)) {
    return NextResponse.json({ error: "not allowed" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const blob =
    searchParams.get("text") || searchParams.get("url") || "";

  if (!blob.trim()) {
    return NextResponse.json({ error: "missing text" }, { status: 400 });
  }

  const parsed = parseEmbedInput(blob);
  if (!parsed) {
    return NextResponse.json({ error: "not an embed" }, { status: 400 });
  }

  // Title priority: iframe title attr → known provider title → scrape.
  let title = parsed.title;
  if (!title) {
    title = await scrapeTitle(parsed.embedUrl);
  }
  if (!title && parsed.sourceUrl !== parsed.embedUrl) {
    title = await scrapeTitle(parsed.sourceUrl);
  }

  return NextResponse.json({
    provider: parsed.provider,
    embedUrl: parsed.embedUrl,
    sourceUrl: parsed.sourceUrl,
    title: title || null,
  });
}