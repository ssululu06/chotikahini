import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { getPostBySlugAsync } from "@/lib/posts";
import { getSiteConfig } from "@/lib/config";
import { createOgTextOverlay, OG_FONT, OG_HEIGHT, OG_WIDTH } from "@/lib/og-text-overlay";
import { getCachedOg, setCachedOg } from "@/lib/og-cache";

// ── Per-post social-share preview ────────────────────────────────
//
// Resolves the story by slug (or uid), loads its cover image, applies
// a very soft blur (sigma ≈ 1.0 — the user-perceived "10% blur"),
// and composites a complete link-preview layout (title, author,
// category, brand mark) on top so the share card is self-explanatory.
//
// Output is a single 1200×630 progressive JPEG with no server/CDN caching.

const COVER_BLUR_SIGMA = 1.0; // ~10% perceived blur — softens pixels without obscuring the photo
const ACCENT = "#f5a524";
const MAX_SOURCE_BYTES = 5 * 1024 * 1024; // 5 MB

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Rendered OG bytes are cached per story (see lib/og-cache.ts) so the
 * sharp/canvas pipeline does not re-run on every social-crawler hit.
 * The HTTP `s-maxage` headers below additionally let the Vercel edge
 * serve the image without invoking the function at all.
 */
const OG_POST_TTL_SECONDS = 86400; // 24h


interface RouteContext {
  params: { identifier: string };
}

/**
 * Load cover bytes. Local paths under /public/ are read from disk; remote
 * http(s) URLs are fetched with a UA header and 8s timeout. Returns null
 * on any failure (caller falls back to a flat dark canvas).
 */
async function loadCoverBytes(raw: string, origin: string): Promise<Buffer | null> {
  if (!raw) return null;

  // Remote URL → fetch.
  if (/^https?:\/\//i.test(raw)) {
    try {
      const res = await fetch(raw, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; chotikahini-og-post/1.0)",
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      const buf = Buffer.from(ab);
      if (buf.byteLength > MAX_SOURCE_BYTES) return null;
      return buf;
    } catch {
      return null;
    }
  }

  // Otherwise treat as a local path. Try as an absolute path on disk
  // first (relative to /public), then as an http fetch against our own
  // origin (covers any absolute path that the file system doesn't have).
  const rel = raw.startsWith("/") ? raw : `/${raw}`;
  const localPath = path.join(process.cwd(), "public", rel);
  try {
    return await fs.readFile(localPath);
  } catch {
    try {
      const res = await fetch(new URL(rel, origin).toString(), {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      const buf = Buffer.from(ab);
      if (buf.byteLength > MAX_SOURCE_BYTES) return null;
      return buf;
    } catch {
      return null;
    }
  }
}

function wrapTitle(
  text: string,
  measure: (line: string) => number,
  maxWidth: number,
  maxLines: number,
): string[] | null {
  const words = (text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const chunks = words.flatMap((word) => {
    if (measure(word) <= maxWidth) return [{ text: word, continuation: false }];
    const parts: string[] = [];
    let part = "";
    for (const character of Array.from(word)) {
      const candidate = part + character;
      if (part && measure(candidate) > maxWidth) {
        parts.push(part);
        part = character;
      } else {
        part = candidate;
      }
    }
    if (part) parts.push(part);
    return parts.map((text, index) => ({ text, continuation: index > 0 }));
  });
  const joinChunks = (start: number, end: number) =>
    chunks.slice(start, end).reduce(
      (line, chunk) => line + (line && !chunk.continuation ? " " : "") + chunk.text,
      "",
    );

  for (let lineCount = 1; lineCount <= Math.min(maxLines, chunks.length); lineCount += 1) {
    const memo = new Map<string, { cost: number; lines: string[] } | null>();
    const findLines = (
      start: number,
      linesLeft: number,
    ): { cost: number; lines: string[] } | null => {
      const key = `${start}:${linesLeft}`;
      if (memo.has(key)) return memo.get(key)!;
      if (linesLeft === 1) {
        const line = joinChunks(start, chunks.length);
        const width = measure(line);
        const result = width <= maxWidth
          ? { cost: (maxWidth - width) ** 2, lines: [line] }
          : null;
        memo.set(key, result);
        return result;
      }

      let best: { cost: number; lines: string[] } | null = null;
      for (let end = start + 1; end <= chunks.length - linesLeft + 1; end += 1) {
        const line = joinChunks(start, end);
        const width = measure(line);
        if (width > maxWidth) break;
        const rest = findLines(end, linesLeft - 1);
        if (!rest) continue;
        const candidate = {
          cost: (maxWidth - width) ** 2 + rest.cost,
          lines: [line, ...rest.lines],
        };
        if (!best || candidate.cost < best.cost) best = candidate;
      }
      memo.set(key, best);
      return best;
    };

    const result = findLines(0, lineCount);
    if (result) return result.lines;
  }
  return null;
}

function darkCanvas(): Buffer {
  // Plain dark background as the ultimate fallback.
  return Buffer.from(
    `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="rgb(18,18,22)"/>
    </svg>`,
  );
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const identifier = (params.identifier || "").trim();
  if (!identifier) {
    return new NextResponse("Missing identifier", { status: 400 });
  }

  let post: Awaited<ReturnType<typeof getPostBySlugAsync>> = null;
  try {
    post = await getPostBySlugAsync(identifier);
  } catch (e) {
    post = null;
  }
  if (!post) {
    return new NextResponse("Story not found", { status: 404 });
  }

  const isPublished =
    post.status === "published" && new Date(post.publishedAt).getTime() <= Date.now();
  if (!isPublished) {
    return new NextResponse("Story not found", { status: 404 });
  }

  // Cache key is scoped to the resolved story slug so a title/cover change
  // is picked up as a new key rather than serving a stale card.
  const ogCacheKey = `og:post:${post.slug}`;
  const cached = getCachedOg(ogCacheKey);
  if (cached) {
    return new NextResponse(new Blob([new Uint8Array(cached)], { type: "image/jpeg" }), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(cached.length),
        "Cache-Control": `public, max-age=${OG_POST_TTL_SECONDS}, s-maxage=${OG_POST_TTL_SECONDS}, stale-while-revalidate=604800`,
        "CDN-Cache-Control": `public, s-maxage=${OG_POST_TTL_SECONDS}, stale-while-revalidate=604800`,
      },
    });
  }

  const site = getSiteConfig() as any;
  const siteUrl = (site?.url || "chotikahini.vercel.app").replace(/\/$/, "");
  const siteName = (site?.title || "চটি কাহিনী").toString();
  const rawCover =
    post.cover || site?.defaultCover || site?.logo || "";

  // ── Build the background (cover + very soft blur) ──
  const coverBytes = await loadCoverBytes(rawCover, req.nextUrl.origin);
  let base: ReturnType<typeof sharp>;
  if (coverBytes) {
    try {
      base = sharp(coverBytes)
        .resize(OG_WIDTH, OG_HEIGHT, { fit: "cover", position: "centre" })
        .blur(COVER_BLUR_SIGMA);
    } catch {
      base = sharp(darkCanvas());
    }
  } else {
    base = sharp(darkCanvas());
  }

  // Vignette + bottom shade so the title + author remain legible regardless
  // of which cover photo was picked.
  const shadeSvg = Buffer.from(
    `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="vtop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(6,8,12,0.55)"/>
          <stop offset="50%" stop-color="rgba(6,8,12,0.12)"/>
          <stop offset="100%" stop-color="rgba(6,8,12,0)"/>
        </linearGradient>
        <linearGradient id="vbot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(6,8,12,0)"/>
          <stop offset="60%" stop-color="rgba(6,8,12,0.45)"/>
          <stop offset="100%" stop-color="rgba(6,8,12,0.78)"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#vtop)"/>
      <rect y="320" width="100%" height="310" fill="url(#vbot)"/>
    </svg>`,
  );

  const bg: Buffer = await base
    .composite([{ input: shadeSvg, top: 0, left: 0 }])
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();

  // ── Compose the text overlay ──
  const readingTime = post.readingTime || "";
  const { canvas, context } = createOgTextOverlay();
  context.textAlign = "left";
  context.shadowColor = "rgba(0,0,0,0.45)";
  context.shadowBlur = 3;
  context.shadowOffsetY = 2;
  context.fillStyle = ACCENT;
  context.beginPath();
  context.arc(76, 98, 5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(255,255,255,0.96)";
  context.font = `500 25px "${OG_FONT}"`;
  context.fillText(`${siteName}  ·  CHOTI KAHINI`, 92, 106);

  context.shadowColor = "transparent";
  context.fillStyle = ACCENT;
  context.fillRect(72, 174, 54, 3);

  context.shadowColor = "rgba(0,0,0,0.45)";
  context.shadowBlur = 3;
  context.shadowOffsetY = 2;
  context.fillStyle = "#fff";
  const titleTop = 194;
  const titleHeight = 226;
  let titleLines: string[] | null = null;
  let titleFontSize = 76;
  for (; titleFontSize >= 48; titleFontSize -= 2) {
    context.font = `500 ${titleFontSize}px "${OG_FONT}"`;
    titleLines = wrapTitle(post.title || "Untitled", (line) => context.measureText(line).width, 1056, 3);
    if (titleLines && titleLines.length * titleFontSize * 1.24 <= titleHeight) break;
    titleLines = null;
  }
  if (!titleLines) {
    const words = (post.title || "Untitled").trim().split(/\s+/);
    while (words.length > 1 && !titleLines) {
      words.pop();
      const shortened = `${words.join(" ")}…`;
      context.font = `500 48px "${OG_FONT}"`;
      titleLines = wrapTitle(shortened, (line) => context.measureText(line).width, 1056, 3);
    }
    titleFontSize = 48;
  }
  titleLines = titleLines || ["Untitled"];
  context.font = `500 ${titleFontSize}px "${OG_FONT}"`;
  const titleLineHeight = titleFontSize * 1.24;
  const titleBlockHeight = titleFontSize + (titleLines.length - 1) * titleLineHeight;
  const firstBaseline = titleTop + (titleHeight - titleBlockHeight) / 2 + titleFontSize;
  titleLines.forEach((line, index) =>
    context.fillText(line, 72, firstBaseline + index * titleLineHeight),
  );
  context.fillStyle = "rgba(255,255,255,0.92)";
  context.font = `400 26px "${OG_FONT}"`;
  context.fillText(post.authorName || "অজ্ঞাত লেখক", 72, 472, 1056);
  context.fillStyle = "rgba(255,255,255,0.95)";
  context.font = `400 18px "${OG_FONT}"`;
  context.fillText(
    `${post.categoryName || post.categoryId || "গল্প"}${readingTime ? `  ·  ${readingTime}` : ""}`,
    72,
    508,
    1056,
  );

  context.shadowColor = "transparent";
  context.strokeStyle = "rgba(255,255,255,0.22)";
  context.beginPath();
  context.moveTo(72, 568);
  context.lineTo(1128, 568);
  context.stroke();
  context.fillStyle = ACCENT;
  context.beginPath();
  context.arc(78, 600, 4, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(255,255,255,0.86)";
  context.font = '600 18px sans-serif';
  context.fillText(siteUrl, 94, 606);
  context.font = `600 18px "${OG_FONT}"`;
  context.textAlign = "right";
  context.fillText("SHORT STORIES  ·  গল্প", 1128, 606);
  const textOverlay = canvas.toBuffer("image/png");

  const composed: Buffer = await sharp(bg)
    .composite([{ input: textOverlay, top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  setCachedOg(ogCacheKey, composed);

  return new NextResponse(new Blob([new Uint8Array(composed)], { type: "image/jpeg" }), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(composed.length),
      "Cache-Control": `public, max-age=${OG_POST_TTL_SECONDS}, s-maxage=${OG_POST_TTL_SECONDS}, stale-while-revalidate=604800`,
      "CDN-Cache-Control": `public, s-maxage=${OG_POST_TTL_SECONDS}, stale-while-revalidate=604800`,
    },
  });
}
