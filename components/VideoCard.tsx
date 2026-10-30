import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";
import { enToBnNumber, timeAgoBn } from "@/lib/utils";

export interface VideoCardData {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  uploaderName?: string | null;
  viewCount?: number | null;
  /** Optional duration string, e.g. "12:34". Falls back to nothing. */
  duration?: string | null;
}

const ASPECT_CLASS = "aspect-video";

/**
 * Triangle glyph, inlined so the card needs no icon-library import.
 */
function PlayGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

/**
 * Grid card for /videos, the paginated list, and the related rail.
 *
 * Layout follows the dense thumbnail-index pattern (xvideos-style) rather
 * than the editorial story-card pattern used elsewhere on the site:
 *
 *   [ 16:9 thumbnail ]
 *   title, clamped to 2 lines
 *   uploader · time ago · views
 *
 * NO card border, NO card background, NO inner padding beyond what's
 * needed for legibility — the thumbnail tile is the whole visual. Pages
 * of 30+ videos stay scannable because every card is just two stacked
 * rectangles: thumb + text.
 *
 * The play affordance is a centred white circle over the thumbnail that is
 * ALWAYS visible — it is never gated behind hover, because on touch
 * devices there is no hover and a hidden affordance reads as a plain
 * picture. It matches the affordance on the admin video rows so the shape
 * is identical everywhere.
 */
export function VideoCard({
  video,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  showDescription = false,
  priority = false,
}: {
  video: VideoCardData;
  sizes?: string;
  showDescription?: boolean;
  /** Sets the `<Image priority>` hint for above-the-fold thumbnails
   *  so they don't wait in the LCP queue. */
  priority?: boolean;
}) {
  const views = Number(video.viewCount) || 0;
  const ago = timeAgoBn(video.publishedAt);

  return (
    <Link
      href={`/videos/${video.id}`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {/* ---- Thumbnail: the only fixed box; no border, no surface ---- */}
      <div className={`relative ${ASPECT_CLASS} overflow-hidden bg-black`}>
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            fill
            sizes={sizes}
            priority={priority}
            unoptimized
            alt=""
            className="object-cover transition-opacity duration-200 group-hover:opacity-90"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-neutral-900">
            <PlayGlyph className="h-9 w-9 text-white/30" />
          </div>
        )}

        {/* Centred play overlay — ALWAYS visible (no hover gate), matching the
            admin list's affordance so one shape is learned everywhere. */}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-blue-700 shadow">
            <Play className="h-4 w-4 translate-x-px fill-current" />
          </span>
        </span>

        {/* Duration sits bottom-left (classic thumbnail-index style). */}
        {video.duration ? (
          <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1 text-[10px] font-semibold leading-4 tabular-nums text-white">
            {video.duration}
          </span>
        ) : null}

        {/* Views badge — bottom-right. Small, tabular so numbers align. */}
        {views > 0 ? (
          <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-px text-[10px] font-semibold leading-4 tabular-nums text-white">
            {enToBnNumber(views)}
          </span>
        ) : null}
      </div>

      {/* ---- Text block: tight, no surface, just left-aligned copy ---- */}
      <div className="px-1.5 pt-2 font-latin">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-[1.3] text-fg lg:text-[17px]">
          {video.title}
        </h3>

        {showDescription && video.description ? (
          <p className="mt-1 line-clamp-2 text-[12px] leading-[1.45] text-fg-muted lg:text-[13px]">
            {video.description}
          </p>
        ) : null}

        {/* Single metadata row: uploader + time + views. xvideos puts time
            on this row, never the editor-style "3 days ago" pill. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px] leading-[1.4] text-fg-muted lg:text-[13px]">
          {video.uploaderName ? (
            <span className="truncate font-semibold hover:underline">
              {video.uploaderName}
            </span>
          ) : null}
          {ago ? (
            <span className="truncate text-fg-subtle">{ago}</span>
          ) : null}
          {views > 0 ? (
            <span className="truncate text-fg-subtle tabular-nums">
              {enToBnNumber(views)} ভিউ
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

/**
 * Compact horizontal variant for the detail page's sidebar — xvideos
 * "up next" style. Thumbnail left, two-line title right, single meta row.
 */
export function VideoRailItem({
  video,
  rank,
}: {
  video: VideoCardData;
  rank?: number;
}) {
  const views = Number(video.viewCount) || 0;
  const ago = timeAgoBn(video.publishedAt);

  return (
    <Link
      href={`/videos/${video.id}`}
      className="group flex gap-2.5 p-1 transition hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-sm bg-black sm:w-32">
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            fill
            sizes="128px"
            unoptimized
            alt=""
            className="object-cover transition-opacity group-hover:opacity-90"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-neutral-900">
            <PlayGlyph className="h-5 w-5 text-white/25" />
          </div>
        )}
        {/* Centred play overlay — same affordance, scaled to thumbnail. */}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-blue-700 shadow">
            <Play className="h-3 w-3 translate-x-px fill-current" />
          </span>
        </span>
        {video.duration ? (
          <span className="absolute bottom-0.5 left-0.5 rounded bg-black/75 px-1 text-[9px] font-semibold leading-3 tabular-nums text-white">
            {video.duration}
          </span>
        ) : null}
        {views > 0 ? (
          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 text-[9px] font-semibold leading-3 tabular-nums text-white">
            {enToBnNumber(views)}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 py-0.5 font-latin">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-[1.3] text-fg lg:text-[16px]">
          {video.title}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-fg-muted lg:text-[13px]">
          {video.uploaderName ? (
            <span className="truncate font-semibold hover:underline">
              {video.uploaderName}
            </span>
          ) : null}
          {ago ? <span className="truncate text-fg-subtle">{ago}</span> : null}
        </div>
      </div>
    </Link>
  );
}
