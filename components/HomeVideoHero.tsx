import Link from "next/link";
import Image from "next/image";
import { Video, Play, ArrowRight, Sparkles } from "lucide-react";
import { listPublishedVideos } from "@/lib/videos";
import { toCardData } from "@/components/VideoListShell";
import { enToBnNumber } from "@/lib/utils";

/**
 * HomeVideoHero — above-the-fold video module.
 *
 * Layout theory (UX + SEO):
 *   1. Motion beats text for the first impression — the left cell is a
 *      large "play this now" tile that pulls the visitor's eye before
 *      they have to read anything.
 *   2. The right cell shows three lightweight cards in a vertical stack.
 *      Every tile is 16:9, so at the 2-column split each card keeps a
 *      sane width instead of collapsing into slivers — the earlier
 *      "1.6fr/1fr + 3-across" grid squeezed three thumbnails into a
 *      fraction of the viewport on 1024–1280px screens.
 *   3. Tabular-numbers view counts and uploader chips create the
 *      "real library" social proof — empty shelves feel like a dead
 *      site. <5 videos: the right column just duplicates the hero.
 *
 * Empty state: when there are no videos yet, the component renders nothing
 * so the page doesn't show an awkward "ভিডিও নেই" block at the top.
 */

export async function HomeVideoHero() {
  const { videos } = await listPublishedVideos({ page: 1, pageSize: 4 });
  if (videos.length === 0) return null;

  const [hero, ...rest] = videos;
  const restTop3 = rest.slice(0, 3);

  return (
    <section className="mb-10 sm:mb-12" aria-label="ভিডিও">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-blue-500" />
            <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600 dark:text-blue-400">
              <Sparkles className="h-3.5 w-3.5" />
              নতুন ভিডিও
            </h2>
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            সদ্য প্রকাশিত ভিডিওগুলো — প্লে করতে ক্লিক করুন।
          </p>
        </div>
        <Link
          href="/videos"
          className="inline-flex items-center gap-1.5 rounded-full bg-blue-600/10 px-3.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-600/20 dark:text-blue-300"
        >
          ভিডিও লাইব্রেরি দেখুন
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Hero gets the whole first row on phones/tablets; from lg up it sits
          beside a single column of same-width 16:9 cards. The 2:1-ish split
          keeps the hero roughly 2x the small cards — noticeable but not
          overwhelmingly large. */}
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <HeroTile row={hero} priority />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-1">
          {restTop3.map((row) => (
            <SmallRow key={row.id} row={row} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HeroTile({ row, priority }: { row: any; priority?: boolean }) {
  const v = toCardData(row);
  return (
    <Link
      href={`/videos/${v.id}`}
      prefetch={priority}
      className="group relative isolate flex aspect-[16/9] flex-col justify-end overflow-hidden rounded-3xl border border-border bg-neutral-950 shadow-lg transition hover:shadow-2xl md:aspect-video"
    >
      {v.thumbnailUrl ? (
        <Image
          src={v.thumbnailUrl}
          alt=""
          fill
          priority
          sizes="(max-width: 768px) 100vw, 60vw"
          unoptimized
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-white/30">
          <Video className="h-14 w-14" />
        </div>
      )}

      {/* Multi-stop gradient — keeps the metadata legible on bright
          thumbnails while a thinner scrim keeps the play-button zone
          readable. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

      {/* Big play button centred in the upper half — visitor sees action
          before reading the title. */}
      <div className="absolute inset-0 flex items-center justify-center pb-12">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-blue-700 shadow-lg ring-1 ring-black/10 transition group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white sm:h-20 sm:w-20">
          <Play className="ml-1 h-7 w-7 fill-current sm:h-9 sm:w-9" />
        </span>
      </div>

      {/* Live / views badge top-right. */}
      <div className="absolute right-3 top-3 flex items-center gap-2">
        {Number(v.viewCount) > 0 ? (
          <span className="rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur-sm">
            {enToBnNumber(Number(v.viewCount))} ভিউ
          </span>
        ) : null}
      </div>

      {/* Bottom metadata block. */}
      <div className="relative p-5 sm:p-7">
        <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-blue-600/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
          <Play className="h-3 w-3 fill-current" />
          এখনই দেখুন
        </span>
        <h3 className="line-clamp-2 max-w-prose text-lg font-bold leading-snug text-white sm:text-2xl">
          {v.title}
        </h3>
        {v.uploaderName ? (
          <p className="mt-1.5 text-sm text-white/80">— {v.uploaderName}</p>
        ) : null}
      </div>
    </Link>
  );
}

function SmallRow({ row }: { row: any }) {
  const v = toCardData(row);
  return (
    <Link
      href={`/videos/${v.id}`}
      className="group relative block aspect-video overflow-hidden rounded-2xl border border-border bg-neutral-950"
    >
      {v.thumbnailUrl ? (
        <Image
          src={v.thumbnailUrl}
          alt=""
          fill
          sizes="(max-width: 1024px) 50vw, 20vw"
          unoptimized
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-white/25">
          <Video className="h-6 w-6" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-blue-700 shadow-md">
          <Play className="ml-0.5 h-5 w-5 fill-current" />
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 space-y-1 p-3">
        <h4 className="line-clamp-2 text-xs font-semibold text-white sm:text-sm">
          {v.title}
        </h4>
        {v.uploaderName ? (
          <p className="truncate text-[10px] text-white/70">{v.uploaderName}</p>
        ) : null}
      </div>
    </Link>
  );
}
