import { enToBnNumber } from '@/lib/utils';
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getPostsByCategoryAsync } from "@/lib/posts";
import { getAllCategoryConfigs, getSiteConfig } from "@/lib/config";
import { PostGridWithAds } from "@/components/PostGridWithAds";
import { Sidebar } from "@/components/Sidebar";
import { buildListingMetadata } from "@/lib/metadata";
import { ArrowRight } from "lucide-react";

interface Props {
  params: { category: string };
}

export const revalidate = 60;

export function generateStaticParams() {
  return getAllCategoryConfigs().map((cat) => ({ category: cat.id }));
}

export function generateMetadata({ params }: Props): Metadata {
  const cat = getAllCategoryConfigs().find((c) => c.id === params.category);
  const site = getSiteConfig();
  const base = site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;
  const name = cat?.name || params.category;
  const description = cat?.description || `${name} বিভাগের সকল লেখা`;
  return buildListingMetadata(name, description, `${base}/categories/${params.category}`, params.category);
}

export default async function CategoryPage({ params }: Props) {
  const posts = await getPostsByCategoryAsync(params.category);
  const allCats = getAllCategoryConfigs();
  const cat = allCats.find((c) => c.id === params.category);

  if (posts.length === 0 && !cat) notFound();

  return (
    <div className="article-layout py-8 sm:py-10">
      <div>
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-1 w-1 rounded-full bg-fg" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
              বিভাগ
            </h2>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">
            {cat?.name || params.category}
          </h1>
          {cat?.description && (
            <p className="text-sm text-fg-muted mt-1">{cat.description}</p>
          )}
          <p className="text-xs text-fg-subtle mt-2">
            মোট {enToBnNumber(posts.length)}টি লেখা
          </p>
        </section>

        {/* Category navigation — rounded cards */}
        <div className="flex flex-wrap gap-2 mb-8">
          {allCats.map((c) => {
            const isActive = c.id === params.category;
            return (
              <Link
                key={c.id}
                href={`/categories/${c.id}`}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm transition-all duration-200 ${
                  isActive
                    ? "border-fg bg-fg text-surface font-medium"
                    : "border-border bg-surface text-fg-muted hover:text-fg hover:border-fg/30 hover:bg-surface-hover"
                }`}
              >
                {c.name}
                <ArrowRight
                  className={`h-3.5 w-3.5 transition-transform ${
                    isActive ? "rotate-90" : ""
                  }`}
                />
              </Link>
            );
          })}
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-border bg-surface-alt">
            <p className="text-sm text-fg-muted">
              এই বিভাগে এখনো কোনো লেখা নেই
            </p>
          </div>
        ) : (
          <PostGridWithAds posts={posts} adInterval={4} />
        )}
      </div>

      <Sidebar />
    </div>
  );
}
