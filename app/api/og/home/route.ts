import { NextResponse } from "next/server";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { getSiteConfig } from "@/lib/config";
import { createOgTextOverlay, OG_FONT, OG_HEIGHT, OG_WIDTH } from "@/lib/og-text-overlay";
import { getCachedOg, setCachedOg } from "@/lib/og-cache";

// ── Social-share preview for the homepage ─────────────────────
// Always uses this single cover as the background. The response is not cached.
const COVER_PATH = path.join(
  process.cwd(),
  "public",
  "images",
  "Cover_pic",
  "52964258_014_da43.jpg",
);
const BLUR_SIGMA = 1.5;
const ACCENT = "#f5a524";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * The homepage OG card is rendered from a single fixed cover plus the
 * site config, so the output is identical for every request. It is
 * cached in-process (see lib/og-cache.ts) and at the CDN edge so the
 * sharp/canvas pipeline does not re-run on every crawler hit.
 */
const OG_HOME_CACHE_KEY = "og:home";

export async function GET() {
  const cached = getCachedOg(OG_HOME_CACHE_KEY);
  if (cached) {
    return new NextResponse(new Blob([new Uint8Array(cached)], { type: "image/jpeg" }), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(cached.length),
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
        "CDN-Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  }

  const site = getSiteConfig() as any;
  const title = (site?.title || "Chotikahini").toString();
  const tagline = (site?.tagline || "ছোট গল্পের বড় দুনিয়া").toString();
  const url = (site?.url || "chotikahini.vercel.app").toString();

  const cover = await fs.readFile(COVER_PATH);
  const base = sharp(cover).resize(OG_WIDTH, OG_HEIGHT, { fit: "cover", position: "centre" });

  // Keep the cover visible with a subtle left-to-right shade for text contrast.
  const bg: Buffer = await base
    .blur(BLUR_SIGMA)
    .composite([
      {
        input: Buffer.from(
          `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="rgba(8,10,14,0.52)"/>
                <stop offset="52%" stop-color="rgba(8,10,14,0.28)"/>
                <stop offset="82%" stop-color="rgba(8,10,14,0.04)"/>
                <stop offset="100%" stop-color="rgba(8,10,14,0)"/>
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#shade)"/>
          </svg>`
        ),
        top: 0,
        left: 0,
      },
    ])
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();

  const { canvas, context } = createOgTextOverlay();
  context.shadowColor = "rgba(0,0,0,0.38)";
  context.shadowBlur = 3;
  context.shadowOffsetY = 2;

  context.fillStyle = ACCENT;
  context.beginPath();
  context.arc(76, 98, 5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(255,255,255,0.96)";
  context.font = `500 25px "${OG_FONT}"`;
  context.fillText("চটি কাহিনী  ·  CHOTI KAHINI", 92, 106);

  context.shadowColor = "transparent";
  context.fillStyle = ACCENT;
  context.fillRect(72, 194, 54, 3);

  context.shadowColor = "rgba(0,0,0,0.38)";
  context.shadowBlur = 3;
  context.shadowOffsetY = 2;
  context.fillStyle = "#fff";
  context.font = `500 88px "${OG_FONT}"`;
  context.fillText(title, 72, 320, 1056);
  context.fillStyle = "rgba(255,255,255,0.92)";
  context.font = `400 32px "${OG_FONT}"`;
  context.fillText(tagline, 72, 378, 1056);

  context.shadowColor = "transparent";
  context.strokeStyle = "rgba(255,255,255,0.22)";
  context.beginPath();
  context.moveTo(72, 496);
  context.lineTo(1128, 496);
  context.stroke();
  context.fillStyle = ACCENT;
  context.beginPath();
  context.arc(78, 542, 4, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(255,255,255,0.86)";
  context.font = '600 18px sans-serif';
  context.fillText(url, 94, 548);
  context.fillStyle = "rgba(255,255,255,0.78)";
  context.font = `500 18px "${OG_FONT}"`;
  context.textAlign = "right";
  context.fillText("SHORT STORIES  ·  গল্প", 1128, 548);
  const textOverlay = canvas.toBuffer("image/png");

  const composed: Buffer = await sharp(bg)
    .composite([{ input: textOverlay, top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  setCachedOg(OG_HOME_CACHE_KEY, composed);

  return new NextResponse(new Blob([new Uint8Array(composed)], { type: "image/jpeg" }), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(composed.length),
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      "CDN-Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
