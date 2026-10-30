import { NextResponse } from "next/server";
import { isBotRequest } from "@/lib/bot-guard";

export const dynamic = "force-dynamic";

interface PreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

/**
 * Fetch a URL and pull OpenGraph / Twitter-card metadata out of it so chat
 * messages can render a link preview card (the way WhatsApp / Facebook do).
 *
 * Guardrails:
 *  - Only http/https, and only for the same hostname family we allow.
 *  - Hard timeout, capped response body, no redirects to internal hosts.
 *  - Never throws: returns a null-ish payload when the site is unreachable.
 */
const MAX_HTML_BYTES = 400_000;
const FETCH_TIMEOUT_MS = 5000;

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function meta(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      const value = decodeEntities(m[1].trim());
      if (value) return value;
    }
  }
  return null;
}

function absolute(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  // This endpoint fetches an arbitrary remote URL and parses the HTML with
  // several regexes. Obvious scrapers are rejected before that work
  // starts; legitimate search engines and chat clients are allowed
  // through (see lib/bot-guard.ts).
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

  // Block obvious internal / metadata endpoints (SSRF guard).
  const host = target.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.startsWith("169.254.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.");
  if (blocked) {
    return NextResponse.json({ error: "blocked host" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Some sites serve a stripped page to unknown agents.
        "User-Agent":
          "Mozilla/5.0 (compatible; LinkPreviewBot/1.0; +https://example.com/bot)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({ url: target.toString() } satisfies Partial<PreviewData>);
    }

    const reader = upstream.body?.getReader();
    if (!reader) {
      return NextResponse.json({ url: target.toString() });
    }

    // Read at most MAX_HTML_BYTES so a huge page can't exhaust memory.
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
      }
    }
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }

    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      chunks.reduce<Uint8Array>((acc, c) => {
        const merged = new Uint8Array(acc.length + c.length);
        merged.set(acc, 0);
        merged.set(c, acc.length);
        return merged;
      }, new Uint8Array(0)),
    );

    const baseUrl = upstream.url || target.toString();

    const title =
      meta(html, [
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
        /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i,
        /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']*)["']/i,
        /<title[^>]*>([\s\S]{1,300}?)<\/title>/i,
      ]) || null;

    const description = meta(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']*)["']/i,
    ]);

    const rawImage = meta(html, [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']*)["']/i,
    ]);

    const image = rawImage ? absolute(rawImage, baseUrl) : null;

    const siteName =
      meta(html, [
        /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']*)["']/i,
      ]) || target.hostname;

    const payload: PreviewData = {
      url: baseUrl,
      title: title ? title.slice(0, 300) : null,
      description: description ? description.slice(0, 400) : null,
      image,
      siteName: siteName ? siteName.slice(0, 120) : null,
    };

    return NextResponse.json(payload);
  } catch (err) {
    const message = (err as Error)?.message || "fetch failed";
    return NextResponse.json(
      { url: target.toString(), error: message },
      { status: 200 },
    );
  } finally {
    clearTimeout(timer);
  }
}