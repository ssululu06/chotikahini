import { enToBnNumber } from '@/lib/utils';
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getPostsByYearMonthAsync, generateArchiveMetadata, getArchiveTreeAsync } from "@/lib/archive";
import { PostGridWithAds } from "@/components/PostGridWithAds";
import { Sidebar } from "@/components/Sidebar";

interface Props {
  params: { year: string; month: string };
}

export const revalidate = 60;

export async function generateStaticParams() {
  const tree = await getArchiveTreeAsync();
  const params: { year: string; month: string }[] = [];
  for (const year of tree) {
    for (const month of year.months) {
      params.push({ year: String(year.year), month: String(month.month).padStart(2, "0") });
    }
  }
  return params;
}

export function generateMetadata({ params }: Props) {
  const year = parseInt(params.year, 10);
  const month = parseInt(params.month, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return {};
  return generateArchiveMetadata(year, month);
}

export default async function ArchivePage({ params }: Props) {
  const year = parseInt(params.year, 10);
  const month = parseInt(params.month, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) notFound();

  const posts = await getPostsByYearMonthAsync(year, month);
  if (posts.length === 0) notFound();

  const date = new Date(year, month - 1);
  const monthName = date.toLocaleDateString("bn-BD", { month: "long", year: "numeric" });

  // Build prev/next month navigation
  const tree = await getArchiveTreeAsync();
  const allMonths: { year: number; month: number }[] = [];
  for (const y of tree) {
    for (const m of y.months) {
      allMonths.push({ year: y.year, month: m.month });
    }
  }
  const currentIndex = allMonths.findIndex((m) => m.year === year && m.month === month);
  const prevMonth = currentIndex < allMonths.length - 1 ? allMonths[currentIndex + 1] : null;
  const nextMonth = currentIndex > 0 ? allMonths[currentIndex - 1] : null;

  return (
    <div className="article-layout py-8 sm:py-10">
      <div>
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-1 w-1 rounded-full bg-fg" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
              আর্কাইভ
            </h2>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">
            {monthName}
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            মোট {enToBnNumber(posts.length)}টি লেখা
          </p>
        </section>

        {posts.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-border bg-surface-alt">
            <p className="text-sm text-fg-muted">এই মাসে কোনো লেখা নেই</p>
          </div>
        ) : (
          <PostGridWithAds posts={posts} adInterval={4} />
        )}

        {/* Prev / Next month navigation */}
        <div className="mt-8 flex items-center justify-between gap-4">
          {prevMonth ? (
            <Link
              href={`/archive/${prevMonth.year}/${String(prevMonth.month).padStart(2, "0")}`}
              className="btn-outline text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              {new Date(prevMonth.year, prevMonth.month - 1).toLocaleDateString("bn-BD", { month: "long", year: "numeric" })}
            </Link>
          ) : (
            <div />
          )}
          {nextMonth ? (
            <Link
              href={`/archive/${nextMonth.year}/${String(nextMonth.month).padStart(2, "0")}`}
              className="btn-outline text-sm"
            >
              {new Date(nextMonth.year, nextMonth.month - 1).toLocaleDateString("bn-BD", { month: "long", year: "numeric" })}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <div />
          )}
        </div>
      </div>

      <Sidebar />
    </div>
  );
}
