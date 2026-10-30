import type { Metadata } from "next";
import Link from "next/link";
import { Tag } from "lucide-react";
import { getAllTags } from "@/lib/posts";
import { getSiteConfig } from "@/lib/config";
import { buildMetadata } from "@/lib/metadata";
import { tagSlug } from "@/lib/tag-utils";

export function generateMetadata(): Metadata {
  const site = getSiteConfig();
  return buildMetadata({
    title: `ট্যাগ — ${site.title}`,
    description: `${getSiteConfig().seo.description} — ট্যাগ ক্লাউড`,
    url: `${site.url.endsWith("/") ? site.url.slice(0, -1) : site.url}/tags`,
  });
}

export default async function TagsPage() {
  const tags = await getAllTags();

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-1 w-1 rounded-full bg-fg" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
          ট্যাগ
        </h2>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg mb-2">
        সকল ট্যাগ
      </h1>
      <p className="text-sm text-fg-muted mb-8">
        ট্যাগ অনুসারে লেখা ব্রাউজ করুন
      </p>

      {tags.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-border bg-surface-alt">
          <p className="text-sm text-fg-muted">কোনো ট্যাগ পাওয়া যায়নি</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {tags.map((t) => (
            <Link
              key={t.tag}
              href={`/tags/${tagSlug(t.tag)}`}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-5 py-3 text-sm font-medium text-fg-muted hover:text-fg hover:bg-surface-hover hover:border-fg/30 transition-all duration-200"
            >
              <Tag className="h-4 w-4" />
              <span>{t.tag}</span>
              <span className="text-xs text-fg-subtle">({t.count})</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
