import Link from "next/link";
import { notFound } from "next/navigation";
import { Video, User, Play } from "lucide-react";
import { listPublishedVideos, type VideoListRow } from "@/lib/videos";
import { VIDEOS_PER_PAGE } from "@/lib/constants";
import { VideoCard, type VideoCardData } from "@/components/VideoCard";
import { Pagination } from "@/components/Pagination";
import { AdSlot } from "@/components/AdSlot";
import { AD_300x250_HTML } from "@/lib/ad-config";
import { isVideoSectionEnabled } from "@/lib/config";
import { enToBnNumber, timeAgoBn } from "@/lib/utils";

/**
 * Shared shell for `/videos` and `/videos/page/[num]`.
 *
 * xvideos-style layout: dense 4-up grid, `gap-2`, no card chrome. The hero
 * on page 1 is the first row's lead using the same density rules — bigger
 * thumbnail but identical text block — so the page reads as one shelf.
 *
 * Ad rule — exactly 3 ad cells on the page:
 *   Hero → 3 videos → ad 1 → 3 videos → ad 2 → remainder (with ad 3
 *   placed at the midpoint of the remainder if it's long).
 *
 * The 3 ads each sit in their own grid slot so a 300×250 occupies exactly
 * the space one video card would — rows stay flush.
 */

const TOTAL_ADS_PER_PAGE = 3;

interface ShellProps {
  title: string;
  subtitle: string;
  currentPage: number;
}

export function toCardData(row: VideoListRow): VideoCardData {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    publishedAt: row.published_at,
    uploaderName: row.uploader_name,
    viewCount: row.view_count,
  };
}

export async function VideoListShell({
  title,
  subtitle,
  currentPage,
}: ShellProps) {
  // Site-wide kill switch — 404 (not an empty shelf) so the video
  // section drops out of the index instead of lingering as a stub page.
  if (!isVideoSectionEnabled()) notFound();

  const { videos, total, totalPages } = await listPublishedVideos({ page: currentPage });
  const list = videos.slice(0, VIDEOS_PER_PAGE);
  const hero = currentPage === 1 ? list[0] : undefined;
  const rest = hero ? list.slice(1) : list;

  const segments: VideoListRow[][] = [];
  let working = rest;
  for (let i = 0; i < TOTAL_ADS_PER_PAGE - 1 && working.length > 0; i++) {
    const share = Math.max(
      3,
      Math.ceil(working.length / (TOTAL_ADS_PER_PAGE - i)),
    );
    const take = Math.min(working.length, share);
    segments.push(working.slice(0, take));
    working = working.slice(take);
  }
  if (working.length > 0) segments.push(working);
  while (segments.length > 0 && segments[segments.length - 1].length === 0) {
    segments.pop();
  }

  return (
    <main className="container-page min-h-[70vh] py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            <Video className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            {title}
          </h1>
          <p className="mt-1 max-w-prose text-sm leading-6 text-fg-muted">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-fg-subtle">
          {currentPage > 1 ? (
            <Link href="/videos" className="underline-offset-2 hover:underline">
              প্রথম পাতা
            </Link>
          ) : null}
          <span>মোট {enToBnNumber(total)}টি ভিডিও</span>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {hero ? <HeroCard video={hero} /> : null}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {segments.flatMap((segment, idx) => [
              ...segment.map((video) => (
                <VideoCard
                  key={video.id}
                  video={toCardData(video)}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                />
              )),
              idx < segments.length - 1 ? (
                /* Mobile-only ad cell. On md+ the whole slot is removed
                   (and the grid re-flows) so the desktop shelf stays a
                   clean 4-up video grid with no 300x250 holes in it. */
                <div
                  key={`ad-${currentPage}-${idx}`}
                  className="flex items-start justify-center pt-1 md:hidden"
                >
                  <AdSlot
                    id={`videos-ad-${currentPage}-${idx}`}
                    html={AD_300x250_HTML}
                    minHeight={250}
                  />
                </div>
              ) : null,
            ])}
          </div>

          {totalPages > 1 ? (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              baseUrl="/videos/page"
              homeUrl="/videos"
            />
          ) : null}
        </>
      )}
    </main>
  );
}

/**
 * Page-1 hero: 2-column dense layout — thumbnail on the left (16:9 at the
 * full available width), text on the right with the same shape the grid
 * cards use below it.
 */
function HeroCard({ video }: { video: VideoListRow }) {
  const views = Number(video.view_count) || 0;
  const ago = timeAgoBn(video.published_at);

  return (
    <Link
      href={`/videos/${video.id}`}
      className="group mb-4 grid overflow-hidden sm:grid-cols-[1.7fr_1fr] sm:gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div className="relative aspect-video overflow-hidden bg-black">
        {video.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail_url}
            alt=""
            className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
          />
        ) : null}

        {/* Centred play overlay — ALWAYS visible, same affordance as every
            grid card below (and the admin rows). Without it the hero read as
            a plain picture, since the thumbnail alone carries no hint that
            it's a video. */}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-blue-700 shadow-lg ring-1 ring-black/10 sm:h-14 sm:w-14">
            <Play className="h-5 w-5 translate-x-px fill-current sm:h-6 sm:w-6" />
          </span>
        </span>

        {views > 0 ? (
          <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-px text-[11px] font-semibold tabular-nums text-white">
            {enToBnNumber(views)} ভিউ
          </span>
        ) : null}
      </div>

      <div className="px-1.5 py-2 font-latin">
        {video.uploader_name ? (
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-fg-muted lg:text-sm">
            <User className="h-3.5 w-3.5" />
            <span className="truncate">{video.uploader_name}</span>
          </span>
        ) : null}
        <h2 className="mt-1.5 line-clamp-3 text-[19px] font-bold leading-[1.25] text-fg sm:text-[22px] lg:text-[26px]">
          {video.title}
        </h2>
        {video.description ? (
          <p className="mt-1.5 line-clamp-3 text-[13px] leading-[1.55] text-fg-muted lg:text-sm">
            {video.description}
          </p>
        ) : null}
        {ago ? <p className="mt-1.5 text-[12px] text-fg-subtle">{ago}</p> : null}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-12 text-center">
      <Video className="mx-auto h-10 w-10 text-fg-subtle" />
      <p className="mt-3 font-semibold text-fg">এখনো কোনো ভিডিও প্রকাশিত হয়নি</p>
      <p className="mt-1 text-sm text-fg-muted">
        নতুন ভিডিও প্রকাশ হলে এখানে দেখা যাবে।
      </p>
    </div>
  );
}
