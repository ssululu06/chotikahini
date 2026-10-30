import { NextResponse } from "next/server";
import { isBotRequest } from "@/lib/bot-guard";

export const dynamic = "force-dynamic";

/**
 * Stream-proxy for geo-blocked video CDNs.
 *
 * Many video CDNs (YouTube's videoplayback, googlevideo.com, etc.) restrict
 * playback to specific regions based on the requesting IP. When the user's
 * network is in such a country, the browser request fails.
 *
 * This route fetches the segments server-side over our (cloud-hosted)
 * egress, which isn't region-locked, and relays the bytes back to the
 * browser. The user can watch any video regardless of origin country.
 *
 * Guardrails:
 *  - http/https only.
 *  - No localhost / private IP / .local hosts.
 *  - Only video mime types relayed.
 *  - Hard timeout; capped response size; no body buffering (streamed).
 */
const FETCH_TIMEOUT_MS = 30_000;
const MAX_BYTES = 200_000_000; // 200 MB cap per request (single segment)

/** Allowlist of video CDN hostnames we are willing to proxy. */
const ALLOWED_HOST_SUFFIXES = [
  ".googlevideo.com",
  ".yt3.ggpht.com",
  ".youtube.com",
  ".facebook.com",
  ".fbcdn.net",
  ".cdninstagram.com",
  ".tiktokv.com",
  ".tiktok.com",
  ".byteicdn.com",
  ".muscdn.com",
  ".vimeocdn.com",
  ".vimeo.com",
  ".dailymotion.com",
  ".dmcdn.net",
  ".cloudfront.net",
  ".cdn.videoplayer.com",
  ".mp4",
  ".m3u8",
  ".ts",
];

function isAllowedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h.startsWith("169.254.") ||
    h.startsWith("10.") ||
    h.startsWith("192.168.")
  ) {
    return false;
  }
  return ALLOWED_HOST_SUFFIXES.some((suffix) => h.endsWith(suffix) || h === suffix);
}

export async function GET(req: Request) {
  // Streams a remote video segment through the function — reject obvious
  // scrapers before opening the upstream connection.
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
  if (!isAllowedHost(target.hostname)) {
    return NextResponse.json(
      { error: `host not allowlisted: ${target.hostname}` },
      { status: 400 },
    );
  }

  // Preserve Range requests so video seeking still works when the upstream
  // supports it.
  const upstreamHeaders: Record<string, string> = {};
  const clientRange = req.headers.get("range");
  if (clientRange) upstreamHeaders["Range"] = clientRange;
  if (req.headers.get("if-range")) upstreamHeaders["If-Range"] = req.headers.get("if-range")!;

  // Some CDNs fingerprint the player via Referer + sec-fetch headers. Pass
  // the original origin so the request looks like a normal playback.
  upstreamHeaders["Referer"] = `https://${target.hostname}/`;
  upstreamHeaders["Origin"] = `https://${target.hostname}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: upstreamHeaders,
    });

    if (!upstream.ok && upstream.status !== 206) {
      return new NextResponse(null, { status: upstream.status });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    // Block non-video content just to be safe — never echo HTML back to a
    // <video> tag.
    if (
      !contentType.startsWith("video/") &&
      !contentType.startsWith("audio/") &&
      !contentType.startsWith("application/") &&
      !contentType.startsWith("binary/")
    ) {
      return NextResponse.json(
        { error: `upstream content-type not allowed: ${contentType}` },
        { status: 415 },
      );
    }

    // Pass-through relevant headers. Always expose CORS so browser <video>
    // can request ranges without preflight surprises.
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");
    const cl = upstream.headers.get("content-length");
    if (cl) headers.set("Content-Length", cl);
    if (upstream.headers.get("content-range")) {
      headers.set("Content-Range", upstream.headers.get("content-range")!);
    }
    headers.set("Cache-Control", "public, max-age=600, stale-while-revalidate=86400");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Headers", "Range, If-Range");

    if (!upstream.body) {
      return new NextResponse(null, { status: 502 });
    }

    // Light byte cap so a runaway upstream can't stream gigabytes; this is a
    // best-effort limit using TransformStream.
    let total = 0;
    const capped = upstream.body;
    const transform = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        if (total >= MAX_BYTES) {
          controller.terminate();
          return;
        }
        if (total + chunk.byteLength > MAX_BYTES) {
          const clipped = chunk.subarray(0, MAX_BYTES - total);
          controller.enqueue(clipped);
          total = MAX_BYTES;
        } else {
          total += chunk.byteLength;
          controller.enqueue(chunk);
        }
      },
    });

    return new Response(capped.pipeThrough(transform), {
      status: upstream.status,
      headers,
    });
  } catch (err) {
    const msg = (err as Error)?.message || "fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}