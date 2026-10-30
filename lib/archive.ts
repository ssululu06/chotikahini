import { getAllPosts, getAllPostsAsync } from "./posts";
import { getSiteConfig } from "./config";
import { buildMetadata } from "./metadata";
import type { Metadata } from "next";

export interface YearArchive {
  year: number;
  months: MonthArchive[];
}

export interface MonthArchive {
  year: number;
  month: number; // 1–12
  monthName: string;
  postCount: number;
}

/**
 * Group all posts by year → month, sorted newest first.
 */
export function getArchiveTree(): YearArchive[] {
  return buildArchiveTree(getAllPosts());
}

export async function getArchiveTreeAsync(): Promise<YearArchive[]> {
  return buildArchiveTree(await getAllPostsAsync());
}

function buildArchiveTree(posts: ReturnType<typeof getAllPosts>): YearArchive[] {
  const map = new Map<number, Map<number, number>>();

  for (const post of posts) {
    const y = parseInt(post.publishedAt.slice(0, 4), 10);
    const m = parseInt(post.publishedAt.slice(5, 7), 10); // 1-indexed
    if (!map.has(y)) map.set(y, new Map());
    const monthMap = map.get(y)!;
    monthMap.set(m, (monthMap.get(m) || 0) + 1);
  }

  const years: YearArchive[] = [];
  for (const [year, monthMap] of map) {
    const months: MonthArchive[] = [];
    for (const [month, count] of monthMap) {
      months.push({
        year,
        month,
        monthName: new Date(year, month - 1).toLocaleDateString("bn-BD", { month: "long" }),
        postCount: count,
      });
    }
    months.sort((a, b) => b.month - a.month);
    years.push({ year, months });
  }
  years.sort((a, b) => b.year - a.year);

  return years;
}

/**
 * Get all posts published in a specific year and month.
 */
export function getPostsByYearMonth(year: number, month: number) {
  const posts = getAllPosts();
  return posts.filter((p) => {
    const y = parseInt(p.publishedAt.slice(0, 4), 10);
    const m = parseInt(p.publishedAt.slice(5, 7), 10);
    return y === year && m === month;
  });
}

export async function getPostsByYearMonthAsync(year: number, month: number) {
  const posts = await getAllPostsAsync();
  return posts.filter((p) => {
    const y = parseInt(p.publishedAt.slice(0, 4), 10);
    const m = parseInt(p.publishedAt.slice(5, 7), 10);
    return y === year && m === month;
  });
}

/**
 * Generate SEO-friendly metadata for an archive page.
 */
export function generateArchiveMetadata(year: number, month: number): Metadata {
  const site = getSiteConfig();
  const base = site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;
  const date = new Date(year, month - 1);
  const monthName = date.toLocaleDateString("bn-BD", { month: "long", year: "numeric" });
  return buildMetadata({
    title: `${monthName} — ${site.title}`,
    description: `${monthName} মাসের সকল লেখা — ${site.description}`,
    url: `${base}/archive/${year}/${String(month).padStart(2, "0")}`,
  });
}
