import Link from "next/link";
import { Video, ArrowRight } from "lucide-react";
import { listPublishedVideos } from "@/lib/videos";
import { toCardData } from "@/components/VideoListShell";
import { VideoCard } from "@/components/VideoCard";

/**
 * A compact 4-up "video on the homepage" section. Goal: a visitor who
 * scrolls past the featured carousel and stories grid sees *immediately*
 * that videos are an option on this site — same eyebrow design as the
 * post header so the eye picks it up without re-learning.
 *
 * Pulls the 5 newest published videos. Each card links to /videos/[id];
 * the section's own CTA links to /videos so visitors can browse more.
 */
export async function HomeVideoRail() {
  const { videos } = await listPublishedVideos({ page: 1, pageSize: 5 });
  if (videos.length === 0) return null;

  return (
    <section className="mt-10 sm:mt-12">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-fg" />
            <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
              <Video className="h-3.5 w-3.5" />
              ভিডিও
            </h2>
          </div>
          <p className="mt-1 max-w-prose text-sm leading-6 text-fg-muted">
            প্রকাশিত সেরা ভিডিও। প্লে করতে ক্লিক করুন।
          </p>
        </div>
        <Link
          href="/videos"
          className="btn-outline gap-1.5 text-xs sm:text-sm"
        >
          সব ভিডিও দেখুন
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {videos.slice(0, 4).map((row, i) => (
          <VideoCard
            key={row.id}
            video={toCardData(row)}
            sizes={
              i === 0
                ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                : "(max-width: 640px) 100vw, 50vw"
            }
          />
        ))}
      </div>
    </section>
  );
}
