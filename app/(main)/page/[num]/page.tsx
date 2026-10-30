import { enToBnNumber } from '@/lib/utils';
import type { Metadata } from "next";
import { getAllPostsAsync } from "@/lib/posts";
import { POSTS_PER_PAGE } from "@/lib/constants";
import { PostGridWithAds } from "@/components/PostGridWithAds";
import { Pagination } from "@/components/Pagination";
import { Sidebar } from "@/components/Sidebar";
import { buildPagedMetadata } from "@/lib/metadata";
import { getSiteConfig } from "@/lib/config";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface Props {
  params: { num: string };
}

export const revalidate = 60;

export function generateMetadata({ params }: Props): Metadata {
  const site = getSiteConfig();
  const base = site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;
  return buildPagedMetadata(
    site.title,
    site.seo?.description || site.description,
    `${base}/page/${params.num}`,
    parseInt(params.num, 10),
  );
}

export async function generateStaticParams() {
  const total = (await getAllPostsAsync()).length;
  const pages = Math.ceil(total / POSTS_PER_PAGE);
  return Array.from({ length: pages - 1 }, (_, i) => ({ num: String(i + 2) }));
}

export default async function PagePage({ params }: Props) {
  const pageNum = parseInt(params.num, 10);
  const allPosts = await getAllPostsAsync();
  const totalPages = Math.ceil(allPosts.length / POSTS_PER_PAGE);
  const start = (pageNum - 1) * POSTS_PER_PAGE;
  const posts = allPosts.slice(start, start + POSTS_PER_PAGE);
  const hasNext = start + POSTS_PER_PAGE < allPosts.length;

  return (
    <div className="article-layout py-8 sm:py-10">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="h-1 w-1 rounded-full bg-fg" />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
            পাতা {enToBnNumber(pageNum)} / {enToBnNumber(totalPages)}
          </h2>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-border bg-surface-alt">
            <p className="text-sm text-fg-muted">এই পাতায় কোনো লেখা নেই</p>
          </div>
        ) : (
          <PostGridWithAds posts={posts} adInterval={4} />
        )}

        <Pagination currentPage={pageNum} totalPages={totalPages} baseUrl="/page" homeUrl="/" />
      </div>

      <Sidebar />
    </div>
  );
}
