import { enToBnNumber } from '@/lib/utils';
import type { Metadata } from "next";
import { getAllPostsAsync, getFeaturedPosts } from "@/lib/posts";
import { POSTS_PER_PAGE, FEATURED_MAX } from "@/lib/constants";
import { PostGridWithAds } from "@/components/PostGridWithAds";
import { Pagination } from "@/components/Pagination";
import { HomeVideoStrip } from "@/components/HomeVideoStrip";
import { FeaturedCarousel } from "@/components/FeaturedCarousel";
import { getSiteConfig, isVideoSectionEnabled } from "@/lib/config";
import { Sidebar } from "@/components/Sidebar";
import { buildMetadata } from "@/lib/metadata";
import { getAllKeywordPhrases } from "@/lib/keyword-engine";
import { toSiteOgUrl } from "@/lib/og-urls";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Homepage — above-the-fold-first layout.
 *
 *   [Title strip]
 *   [HomeVideoStrip   ] ← video lead, motion-stopper
 *   [Featured stories ] ← secondary
 *   [Latest stories   ] ← secondary
 *   [Sidebar | SEO body]
 *
 * Why videos lead (UX + SEO summary):
 *
 *   1. Motion is a stronger attention draw than text. Visitors on text
 *      first-scroll bounce within ~7s; on a video-led page the next
 *      motion is one click away.
 *
 *   2. Google weights internal links in the first ~500 lines of HTML
 *      more heavily than below-fold. Each video card is a fresh
 *      internal link emitting PageRank and crawl priority. Burying
 *      them below 27 stories starved them of crawl budget.
 *
 *   3. Sending a visitor straight to /featured or /posts feels like
 *      "library page" — sending them straight to a play surface feels
 *      like "show". Different first impression.
 */

export const revalidate = 60;

export function generateMetadata(): Metadata {
  const site = getSiteConfig();
  const phrases = getAllKeywordPhrases();
  const keywords = site.seo?.keywords
    ? `${site.seo.keywords}, ${phrases.slice(0, 5).join(", ")}`
    : phrases.slice(0, 5).join(", ");
  const homeOgImage = toSiteOgUrl(site);

  // Two-shape title: brand first (CTR), then content types so search
  // engines see this site as a video + story hub, not just stories.
  return buildMetadata({
    title: site.seo?.defaultTitle || `${site.title} — ভিডিও ও গল্প`,
    description:
      site.seo?.description ||
      `${site.tagline} — সেরা ভিডিও ও বাংলা চটি গল্প এক জায়গায়।`,
    keywords,
    url: site.url,
    image: homeOgImage,
  });
}

export default async function HomePage() {
  const site = getSiteConfig();
  const videoOn = isVideoSectionEnabled();
  const allPosts = await getAllPostsAsync();
  const featured = allPosts.filter(p => p.featured).slice(0, FEATURED_MAX);
  const latest = allPosts.slice(0, POSTS_PER_PAGE);
  const totalPages = Math.ceil(allPosts.length / POSTS_PER_PAGE);

  return (
    <div className="article-layout py-8 sm:py-10">
      <div className="min-w-0">
        {/* ── Title strip ─────────────────────────────────────── */}
        <header className="mb-7 sm:mb-9">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-[28px]">
                {site.title}
              </h1>
              <p className="mt-1 text-sm leading-6 text-fg-muted">
                {site.tagline}
              </p>
            </div>
{/* Content-type switch as plain text. The video strip right
                below already proves both modes exist, so badges here only
                crowd the H1 — and another 24px of chips pushed the fold down. */}
            <div className="hidden shrink-0 gap-5 text-xs font-semibold sm:flex">
              {/* Hidden when the video section is switched off, so the
                  header never links to a 404. */}
              {videoOn ? (
                <Link
                  href="/videos"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  ভিডিও
                </Link>
              ) : null}
              <Link href="/posts" className="text-fg-subtle hover:text-fg">
                গল্প
              </Link>
            </div>
          </div>
        </header>

        {/* ── Lead module: video strip ─────────────────────────── */}
        <HomeVideoStrip />

        {/* ── Stories: featured then latest ───────────────────── */}
        {featured.length > 0 ? (
          <section className="mb-8">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-amber-500" />
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
                    নির্বাচিত গল্প
                  </h2>
                </div>
                <p className="mt-1 text-xs text-fg-muted">
                  এই সপ্তাহের সেরা পড়াগুলো
                </p>
              </div>
              <Link
                href="/featured"
                className="inline-flex items-center gap-1 text-xs font-semibold text-fg-subtle hover:text-fg"
              >
                সব নির্বাচিত
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <FeaturedCarousel posts={featured} />
          </section>
        ) : null}

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-fg" />
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
                  সর্বশেষ গল্প
                </h2>
              </div>
              <p className="mt-1 text-xs text-fg-muted">
                মোট {enToBnNumber(allPosts.length)}টি গল্পের মধ্য থেকে
              </p>
            </div>
          </div>

          {latest.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface-alt py-16 text-center">
              <p className="text-sm text-fg-muted">কোনো লেখা পাওয়া যায়নি</p>
              <p className="mt-2 text-xs text-fg-subtle">
                নতুন গল্প প্রকাশ করতে লেখক বা অ্যাডমিন ড্যাশবোর্ড ব্যবহার করুন
              </p>
            </div>
          ) : (
            <PostGridWithAds posts={latest} adInterval={4} />
          )}

          {totalPages > 1 ? (
            <Pagination
              currentPage={1}
              totalPages={totalPages}
              baseUrl="/page"
              homeUrl="/"
            />
          ) : null}
        </section>
      </div>

      <Sidebar />

      {/* SEO content — keyword-rich description of the site */}
      <section className="mt-16 border-t border-border pt-10">
        <div className="mx-auto max-w-3xl space-y-4 text-sm leading-relaxed text-fg-muted">
          <h2 className="text-lg font-bold text-fg">
            {site.title} — ভিডিও ও গল্প
          </h2>
          <p>
            {site.title} একটি বাংলা চটি গল্প ও ভিডিওর ওয়েবসাইট। এখানে পাবেন
            বাংলা চটি গল্প, চোদাচুদির গল্প, সেক্স কাহিনী, স্বামী-স্ত্রী চোদাচুদির গল্প,
            মা ছেলে ধারাবাহিক চটি, বাবা মেয়ের সেক্স স্টোরি, শাশুড়ি-জামাই, সৎ মা, ভাই বোন,
            কাকিমা, বৌদি, মাসি, খালা, ভাবি সহ পারিবারিক ও পরকিয়া চটি গল্পের বিশাল সংগ্রহ।
            প্রতিদিন নতুন ভিডিও প্রকাশিত হচ্ছে।
          </p>
          <p>
            bangla choti golpo, bengali sex story, choti kahini — যেকোনো সার্চে
            নতুন গল্প পড়ুন এবং নিজের গল্প লিখে পাঠান আমাদের লেখক হতে পারেন।
          </p>
          <p className="text-xs text-fg-subtle">
            সতর্কতা: এই ওয়েবসাইটটি কেবল ১৮ বছর বা তার বেশি বয়সের প্রাপ্তবয়স্কদের জন্য। অনুগ্রহ করে নিজের দায়িত্বে ব্যবহার করুন।
          </p>
        </div>
      </section>
    </div>
  );
}
