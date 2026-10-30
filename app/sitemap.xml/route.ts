import { NextResponse } from "next/server";
import { getAllPostsAsync, getSeries } from "@/lib/posts";
import { getSiteConfig, getAllCategoryConfigs } from "@/lib/config";
import { tagSlug } from "@/lib/tag-utils";
import { getSeriesId } from "@/lib/series-utils";

// `revalidate` alone is enough here. A previous `force-dynamic` export
// overrode it, so the sitemap re-scanned every story on each crawler hit
// instead of being served from the edge cache for an hour.
export const revalidate = 3600; // 1 hour edge cache

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

export async function GET() {
  const site = getSiteConfig();
  const baseUrl = site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;

  let posts: any[] = [];
  let seriesList: Awaited<ReturnType<typeof getSeries>> = [];
  try {
    posts = await getAllPostsAsync();
    seriesList = await getSeries();
  } catch (err) {
    console.error("[sitemap] Failed to fetch posts:", err);
  }

  const categories = getAllCategoryConfigs();

  // Aggregate tags directly from posts without a second DB roundtrip
  const tagMap = new Map<string, number>();
  for (const post of posts) {
    if (Array.isArray(post.tags)) {
      for (const t of post.tags) {
        const norm = t?.trim();
        if (norm) tagMap.set(norm, (tagMap.get(norm) || 0) + 1);
      }
    }
  }

  const urls: { loc: string; lastmod?: string; changefreq?: string; priority: number }[] = [
    { loc: `${baseUrl}`, changefreq: "daily", priority: 1.0 },
    { loc: `${baseUrl}/series`, changefreq: "daily", priority: 0.8 },
    { loc: `${baseUrl}/about`, changefreq: "monthly", priority: 0.4 },
    { loc: `${baseUrl}/contact`, changefreq: "monthly", priority: 0.3 },
    { loc: `${baseUrl}/privacy`, changefreq: "yearly", priority: 0.2 },
    { loc: `${baseUrl}/tags`, changefreq: "weekly", priority: 0.5 },
  ];

  for (const series of seriesList) {
    urls.push({
      loc: `${baseUrl}/series/${getSeriesId(series)}`,
      lastmod: series[0]?.updatedAt ? new Date(series[0].updatedAt).toISOString() : undefined,
      changefreq: "weekly",
      priority: 0.7,
    });
  }

  // Categories
  for (const c of categories) {
    urls.push({
      loc: `${baseUrl}/categories/${c.id}`,
      changefreq: "daily",
      priority: 0.7,
    });
  }

  // Posts
  for (const post of posts) {
    const id = post.uid || post.slug;
    const priority = post.featured ? 0.9 : 0.8;
    urls.push({
      loc: `${baseUrl}/${id}`,
      lastmod: post.updatedAt ? new Date(post.updatedAt).toISOString() : new Date().toISOString(),
      changefreq: priority >= 0.9 ? "weekly" : "monthly",
      priority,
    });
  }

  // Tags with >= 2 posts
  for (const [tag, count] of tagMap.entries()) {
    if (count >= 2) {
      urls.push({
        loc: `${baseUrl}/tags/${tagSlug(tag)}`,
        changefreq: "weekly",
        priority: 0.5,
      });
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}${u.changefreq ? `\n    <changefreq>${u.changefreq}</changefreq>` : ""}
    <priority>${u.priority.toFixed(1)}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
