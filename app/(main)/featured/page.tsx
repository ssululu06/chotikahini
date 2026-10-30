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

export function generateMetadata(): Metadata {
  const site = getSiteConfig();
  return buildMetadata({
    title: `নির্বাচিত লেখা — ${site.title}`,
    description: `হাতে বাছাই করা ${getSiteConfig().seo.description}`,
    url: `${site.url.endsWith("/") ? site.url.slice(0, -1) : site.url}/featured`,
  });
}

export default async function FeaturedPage() {
  const all = await getFeaturedPostsAsync();
  const totalPages = Math.ceil(all.length / FEATURED_PER_PAGE);
  const posts = all.slice(0, FEATURED_PER_PAGE);
  const hasMore = all.length > FEATURED_PER_PAGE;

  return (
    <div className="article-layout py-8 sm:py-10">
      <div>
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg heading-accent inline-block pb-2">
            নির্বাচিত লেখা
          </h1>
          <p className="mt-3 text-sm text-fg-muted">
            হাতে বাছাই করা সেরা চটি গল্প — মোট {enToBnNumber(all.length)}টি লেখা
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-border bg-surface-alt">
            <p className="text-sm text-fg-muted">কোনো নির্বাচিত লেখা নেই</p>
          </div>
        ) : (
          <PostGridWithAds posts={posts} adInterval={4} />
        )}

        <Pagination currentPage={1} totalPages={totalPages} baseUrl="/featured/page" homeUrl="/featured" />

        <div className="mt-12 text-center">
          <Link href="/" className="btn-outline text-sm">
            <ArrowLeft className="h-4 w-4" />
            হোমপেজে ফিরে যান
          </Link>
        </div>
      </div>

      <Sidebar />
    </div>
  );
}
