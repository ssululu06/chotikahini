import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Clock, Layers } from "lucide-react";
import { buildMetadata } from "@/lib/metadata";
import { getSeries } from "@/lib/posts";
import { getSeriesId, getSeriesTitle } from "@/lib/series-utils";
import { formatDate, enToBnNumber } from "@/lib/utils";
import { SeriesShareActions } from "./SeriesShareActions";

interface SeriesPageProps {
  params: { seriesId: string };
}

async function findSeries(seriesId: string) {
  const seriesList = await getSeries();
  return seriesList.find((series) => getSeriesId(series) === seriesId) || null;
}

export async function generateMetadata({ params }: SeriesPageProps): Promise<Metadata> {
  const series = await findSeries(params.seriesId);
  if (!series) return buildMetadata({ title: "সিরিজ পাওয়া যায়নি" });

  const title = getSeriesTitle(series);
  const cover = series.find((post) => post.cover)?.cover;
  return buildMetadata({
    title: `${title} — সম্পূর্ণ সিরিজ`,
    description: `${title} সিরিজের ${enToBnNumber(series.length)}টি পর্ব একসাথে পড়ুন।`,
    url: `/series/${params.seriesId}`,
    image: cover,
  });
}

export default async function SeriesDetailPage({ params }: SeriesPageProps) {
  const series = await findSeries(params.seriesId);
  if (!series) notFound();

  const title = getSeriesTitle(series);
  const cover = series.find((post) => post.cover)?.cover;

  return (
    <main className="container-page min-h-[60vh] py-8 sm:py-12">
      <Link
        href="/series"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-fg-muted transition hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        সব সিরিজ
      </Link>

      <header className="relative mb-8 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface-alt via-surface to-surface-alt p-5 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          {cover && (
            <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-md sm:h-36 sm:w-28">
              <Image
                src={cover}
                alt={title}
                fill
                priority
                sizes="112px"
                className="object-cover"
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface-alt px-3 py-1 text-xs font-semibold text-fg">
              <Layers className="h-3.5 w-3.5" />
              সম্পূর্ণ সিরিজ
            </p>
            <h1 className="text-2xl font-black tracking-tight text-fg sm:text-4xl">{title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                {enToBnNumber(series.length)}টি পর্ব
              </span>
              <span aria-hidden="true">·</span>
              <span>লেখক: {series[0].authorName}</span>
            </div>
            <div className="mt-5">
              <SeriesShareActions title={title} />
            </div>
          </div>
        </div>
      </header>

      <section aria-labelledby="series-episodes-heading" className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">শুরু করুন</p>
            <h2 id="series-episodes-heading" className="mt-1 text-xl font-bold text-fg sm:text-2xl">
              পর্বের তালিকা
            </h2>
          </div>
          <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-fg-muted">
            {enToBnNumber(series.length)} পর্ব
          </span>
        </div>

        <ol className="space-y-2.5">
          {series.map((post, index) => (
            <li key={post.slug}>
              <Link
                href={`/${post.uid || post.slug}`}
                className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md sm:p-5"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-alt text-sm font-bold text-fg-muted transition-colors group-hover:bg-fg group-hover:text-surface">
                  {enToBnNumber(index + 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-fg transition-colors group-hover:text-fg">
                    {post.title}
                  </span>
                  <span className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-muted">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDate(post.publishedAt)}
                  </span>
                </span>
                <span className="shrink-0 rounded-lg bg-surface-alt px-3 py-2 text-sm font-semibold text-fg transition-colors group-hover:bg-surface-hover">
                  পড়ুন
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
