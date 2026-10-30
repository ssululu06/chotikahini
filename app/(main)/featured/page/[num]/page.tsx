import { enToBnNumber } from '@/lib/utils';
import { getFeaturedPostsAsync } from "@/lib/posts";
import { FEATURED_PER_PAGE } from "@/lib/constants";
import { PostGridWithAds } from "@/components/PostGridWithAds";
import { Pagination } from "@/components/Pagination";
import { Sidebar } from "@/components/Sidebar";
import type { Metadata } from "next";
import { getSiteConfig } from "@/lib/config";
import { buildMetadata } from "@/lib/metadata";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface Props {
  params: { num: string };
}

export function generateStaticParams() {
  return [];
}

export function generateMetadata({ params }: Props): Metadata {
  const site = getSiteConfig();
  const base = site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;
  return buildMetadata({
    title: `নির্বাচিত লেখা — পাতা ${params.num} — ${site.title}`,
    description: `হাতে বাছাই করা নির্বাচিত ${getSiteConfig().seo?.description || getSiteConfig().description} — পাতা ${params.num}`,
    url: `${base}/featured/page/${params.num}`,
  });
}

export default async function FeaturedPagePage({ params }: Props) {
  const pageNum = parseInt(params.num, 10);
  const all = await getFeaturedPostsAsync();
  const totalPages = Math.ceil(all.length / FEATURED_PER_PAGE);
  const start = (pageNum - 1) * FEATURED_PER_PAGE;
  const posts = all.slice(start, start + FEATURED_PER_PAGE);
  const hasNext = start + FEATURED_PER_PAGE < all.length;

  return (
    <div className="article-layout py-8 sm:py-10">
      <div>
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg heading-accent inline-block pb-2">
            নির্বাচিত লেখা
          </h1>
          <p className="mt-3 text-sm text-fg-muted">
            পাতা {enToBnNumber(pageNum)} / {enToBnNumber(totalPages)}
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-border bg-surface-alt">
            <p className="text-sm text-fg-muted">এই পাতায় কোনো লেখা নেই</p>
          </div>
        ) : (
          <PostGridWithAds posts={posts} adInterval={4} />
        )}

        <Pagination currentPage={pageNum} totalPages={totalPages} baseUrl="/featured/page" homeUrl="/featured" />
      </div>

      <Sidebar />
    </div>
  );
}
