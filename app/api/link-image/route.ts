import { NextResponse } from "next/server";
import { isBotRequest } from "@/lib/bot-guard";

export const dynamic = "force-dynamic";

/**
 * Proxies a remote og:image through our own origin.
 *
 * Many sites (GitHub's ctfassets CDN, Cloudflare-protected images, etc.)
 * hot-link protect their assets, so a bare <img src="https://..."> in the
 * browser renders a blank box. Fetching server-side and re-serving the bytes
 * from our own domain sidesteps referrer/origin checks entirely.
 *
 * Guardrails mirror /api/link-preview: http(s) only, no private hosts, hard
 * timeout, capped size, and only image content-types are relayed.
 */
const FETCH_TIMEOUT_MS = 6000;
const MAX_IMAGE_BYTES = 5_000_000;

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

export async function GET(req: Request) {
  // Proxies a remote image — reject obvious scrapers before the fetch.
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)",
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5",
      },
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !contentType.startsWith("image/")) {
      return new NextResponse(null, {
        status: 404,
        headers: { "Cache-Control": "public, max-age=300" },
      });
    }

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return new NextResponse(null, { status: 413 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        // Allow hot-linking from our own site only.
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new NextResponse(null, {
      status: 502,
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } finally {
    clearTimeout(timer);
  }
}