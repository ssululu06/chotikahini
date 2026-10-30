import type { Metadata } from "next";
import { getSiteConfig, getAuthors } from "@/lib/config";
import { buildMetadata } from "@/lib/metadata";
import Image from "next/image";

export function generateMetadata(): Metadata {
  const site = getSiteConfig();
  return buildMetadata({
    title: `সম্পর্কে — ${site.title}`,
    description: `${site.description} — এই ওয়েবসাইট সম্পর্কে জানুন`,
    url: `${site.url.endsWith("/") ? site.url.slice(0, -1) : site.url}/about`,
  });
}

export default function AboutPage() {
  const site = getSiteConfig();
  const authors = getAuthors();

  return (
    <div className="container-article py-10 sm:py-14">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-1 w-1 rounded-full bg-fg" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
          পরিচিতি
        </h2>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg mb-8">
        {site.title}
      </h1>

      <div className="prose-custom space-y-5">
        <p className="lead text-base text-fg leading-relaxed">
          {site.description}
        </p>

        <p>
          {site.tagline}। এই ওয়েবসাইটটি সম্পূর্ণ ব্যক্তিগত উদ্যোগে
          পরিচালিত — বাংলা ভাষায় লেখালেখির একটি প্ল্যাটফর্ম।
        </p>

        <hr className="my-8" />

        <h2>লেখকবৃন্দ</h2>

        <div className="space-y-6">
          {authors.map((author) => (
            <div
              key={author.id}
              className="flex items-start gap-4 not-prose rounded-2xl border border-border bg-surface-alt p-5"
            >
              {author.image ? (
                <Image
                  src={author.image}
                  alt={author.name}
                  width={56}
                  height={56}
                  className="rounded-full object-cover shrink-0"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-fg text-surface text-sm font-semibold">
                  {author.name.charAt(0)}
                </span>
              )}
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-fg">
                  {author.name}
                </p>
                <p className="text-xs text-fg-muted leading-relaxed">
                  {author.bio}
                </p>
                {author.website && (
                  <a
                    href={author.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-fg-muted hover:text-fg underline underline-offset-2"
                  >
                    ওয়েবসাইট
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <hr className="my-8" />

        <h2>যোগাযোগ</h2>
        <p>
          ইমেল:{" "}
          <a href={`mailto:${site.email}`} className="link">
            {site.email}
          </a>
        </p>
      </div>
    </div>
  );
}
