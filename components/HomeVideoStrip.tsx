import Link from "next/link";
import { listPublishedVideos } from "@/lib/videos";
import { toCardData } from "@/components/VideoListShell";
import { enToBnNumber } from "@/lib/utils";
import { isVideoSectionEnabled } from "@/lib/config";
import { VideoCard } from "@/components/VideoCard";
import { VideoScrollRail } from "@/components/VideoScrollRail";

/**
 * HomeVideoStrip — the homepage's video module.
 *
 * Layout (what the visitor sees top to bottom):
 *   [ 2 cards, each full half-width ]   ← headline row, static
 *   [ scrollable rail of the next 4 ]    ← carousel, swipe/arrows
 *
 * The top pair stays a plain 2-up grid because those are the "headline"
 * entries and shouldn't need a swipe to see. Everything below is the rail:
 * one row, swipeable on touch, arrow-navigable on desktop. Cards keep the
 * shared `VideoCard` shape so the homepage never diverges from /videos.
 *
 * When there are fewer than 4 extra videos the rail simply has fewer
 * cards; it degrades to a static row because the arrows auto-hide when
 * there's nothing to scroll.
 */

export async function HomeVideoStrip() {
  // Site-wide kill switch: when the video section is off the homepage
  // skips the query entirely, so no homepage request touches video_posts.
  if (!isVideoSectionEnabled()) return null;

  // The homepage is a *teaser*, not the library: we show at most 15 cards
  // (2 headline + 13 rail) and let "সব দেখুন" → /videos carry the full set.
  // Fetching just past the cap keeps the count honest without a second query.
  const { videos, total } = await listPublishedVideos({ page: 1, pageSize: 18 });
  if (videos.length === 0) return null;

  const cards = videos.map(toCardData);
  const shown = total > videos.length ? videos.length : total;

  // Headline pair = first 2. The rest feed the carousel rail, capped so the
  // homepage never dumps an unbounded shelf on the visitor.
  const top = cards.slice(0, 2);
  const rail = cards.slice(2, 15);

  // A rail needs at least 3 cards to read as a carousel — 1 or 2 cards
  // can't scroll, so the arrows would never show and it'd just look like a
  // broken row. Below that threshold, or with fewer than 3 videos overall,
  // fall back to one static grid so the shelf always looks intentional.
  if (cards.length < 3 || rail.length < 3) {
    return <SectionShell shown={shown} videos={cards} />;
  }

  return (
    <section className="mb-8" aria-label="ভিডিও">
      <StripHeader shown={shown} total={total} />

      {/* ---- Headline row: two cards, each half the container width ---- */}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {top.map((video, i) => (
          <VideoCard
            key={video.id}
            video={video}
            priority={i === 0}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 50vw"
          />
        ))}
      </div>

      {/* ---- Carousel rail: the rest, swipe/arrow navigable + auto-advancing
             one card at a time. Max 13 cards here (2 headline + 13 rail
             = 15 shown); the full library lives at /videos behind
             "সব দেখুন". ---- */}
      <div className="mt-3 sm:mt-4">
        <VideoScrollRail
          videos={rail}
          sizes="(max-width: 640px) 70vw, (max-width: 1024px) 40vw, (max-width: 1280px) 26vw, 25vw"
          autoPlay
          autoPlayIntervalMs={6000}
        />
      </div>
    </section>
  );
}

/** Header + link, shared by the main strip and the short-list variant. */
function StripHeader({ shown, total }: { shown: number; total?: number }) {
  // When the shelf is capped (homepage shows 10 of N), say so — otherwise
  // "সদ্য প্রকাশিত ১০টি" reads as "there are only 10 videos".
  const capped = typeof total === "number" && total > shown;

  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="h-3.5 w-0.5 shrink-0 translate-y-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />
        <h2 className="text-sm font-bold tracking-tight text-fg">ভিডিও</h2>
        <span className="text-xs text-fg-subtle">
          সদ্য প্রকাশিত {enToBnNumber(shown)}টি
          {capped ? ` / মোট ${enToBnNumber(total)}টি` : ""}
        </span>
      </div>
      <Link
        href="/videos"
        className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
      >
        সব দেখুন
      </Link>
    </div>
  );
}

/**
 * Static fallback grid, used whenever there aren't enough videos for the
 * carousel to make sense (fewer than 3, or a rail of 1–2). The column count
 * tracks the card count so 4 videos fill a 4-up row on desktop rather than
 * leaving a hole — same "shelf" feel without the rail's empty arrows.
 */
function SectionShell({
  shown,
  videos,
}: {
  shown: number;
  videos: ReturnType<typeof toCardData>[];
}) {
  const cols =
    videos.length >= 4 ? "lg:grid-cols-4" : videos.length >= 3 ? "lg:grid-cols-3" : "";
  return (
    <section className="mb-8" aria-label="ভিডিও">
      <StripHeader shown={shown} />
      <div className={`grid gap-3 sm:grid-cols-2 sm:gap-4 ${cols}`}>
        {videos.map((video, i) => (
          <VideoCard
            key={video.id}
            video={video}
            priority={i === 0}
            sizes={
              videos.length >= 4
                ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                : "(max-width: 640px) 100vw, 50vw"
            }
          />
        ))}
      </div>
    </section>
  );
}
