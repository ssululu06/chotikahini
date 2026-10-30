import { enToBnNumber } from '@/lib/utils';
import type { Metadata } from "next";
import { getPostsByTag, getAllTags } from "@/lib/posts";
import { PostGridWithAds } from "@/components/PostGridWithAds";
import { getSiteConfig } from "@/lib/config";
import { buildListingMetadata } from "@/lib/metadata";
import { tagSlug, tagFromSlug } from "@/lib/tag-utils";

interface Props {
  params: { tag: string };
}

export function generateStaticParams() {
  return [];
}

export function generateMetadata({ params }: Props): Metadata {
  const tag = tagFromSlug(params.tag);
  const site = getSiteConfig();
  const base = site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;
  const title = `#${tag}`;
  const description = `"${tag}" ট্যাগযুক্ত সকল ${getSiteConfig().description || getSiteConfig().seo?.description}`;
  return buildListingMetadata(title, description, `${base}/tags/${params.tag}`);
}

export default async function TagPage({ params }: Props) {
  const tag = tagFromSlug(params.tag);
  const posts = await getPostsByTag(tag);
  const empty = posts.length === 0;

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-1 w-1 rounded-full bg-fg" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
          ট্যাগ
        </h2>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg mb-1">
        #{tag}
      </h1>
      {empty ? (
        <p className="text-sm text-fg-muted mb-8">এই ট্যাগে কোনো লেখা নেই</p>
      ) : (
        <p className="text-sm text-fg-muted mb-8">
          মোট {enToBnNumber(posts.length)}টি লেখা
        </p>
      )}

      {empty ? (
        <div className="text-center py-16 rounded-2xl border border-border bg-surface-alt">
          <p className="text-sm text-fg-muted">
            &ldquo;{tag}&rdquo; ট্যাগে কোনো লেখা পাওয়া যায়নি
          </p>
        </div>
      ) : (
        <PostGridWithAds posts={posts} adInterval={4} />
      )}
    </div>
  );
}
