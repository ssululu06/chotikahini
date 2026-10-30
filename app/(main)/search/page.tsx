import type { Metadata } from "next";
import { SearchInput } from "@/components/SearchInput";
import { getSiteConfig } from "@/lib/config";
import { buildMetadata } from "@/lib/metadata";

export function generateMetadata(): Metadata {
  const site = getSiteConfig();
  return buildMetadata({
    title: `খুঁজুন — ${site.title}`,
    description: `${getSiteConfig().seo.description} — শিরোনাম, বিষয়বস্তু বা ট্যাগ অনুসারে খুঁজুন`,
    url: `${site.url.endsWith("/") ? site.url.slice(0, -1) : site.url}/search`,
  });
}

export default function SearchPage() {
  return (
    <div className="container-page py-12 sm:py-16">
      <section className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-fg">খুঁজুন</h1>
        <p className="mt-2 text-fg-muted">
          শিরোনাম, বিষয়বস্তু বা ট্যাগ অনুসারে লেখা খুঁজুন
        </p>
      </section>
      <div className="mb-8">
        <SearchInput />
      </div>
    </div>
  );
}
