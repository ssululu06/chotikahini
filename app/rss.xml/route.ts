import { getAllPostsAsync } from "@/lib/posts";
import { getSiteConfig } from "@/lib/config";
import { formatRssDate, todayDhaka } from "@/lib/utils";
import { findMatchingClusters, generateSeoDescription } from "@/lib/keyword-engine";

// The feed is public and changes only when a story is published, so it
// is regenerated at most once an hour and served from the edge after that.
export const revalidate = 3600;

export async function GET() {
  const site = getSiteConfig();
  const baseUrl = site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;
  // The async loader is used on purpose: the synchronous `getAllPosts()`
  // only returns an already-populated in-memory list, which is empty on a
  // cold serverless instance and produced an empty feed.
  const posts = await getAllPostsAsync();

  const items = posts
    .map((post) => {
      // Enrich RSS description with keyword data
      const rawDesc = post.description || post.content?.slice(0, 200).replace(/[#*`\[\]]/g, "") || "";
      const matches = findMatchingClusters(`${post.title} ${rawDesc}`, 1);
      const seoDesc = generateSeoDescription(rawDesc, matches, 200);

      // Collect keyword tags for RSS categories
      const rssCategories = [post.categoryName, ...post.tags].filter(Boolean);

      return `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <description><![CDATA[${seoDesc}]]></description>
      <link>${baseUrl}/${post.slug}</link>
      <guid isPermaLink="true">${baseUrl}/${post.slug}</guid>
      <pubDate>${formatRssDate(post.publishedAt)}</pubDate>
      ${rssCategories.map((cat) => `<category>${cat}</category>`).join("\n      ")}
      ${post.cover ? `<media:content url="${baseUrl}${post.cover}" medium="image" />` : ""}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${site.title}</title>
    <description>${site.seo?.description || site.description}</description>
    <link>${baseUrl}</link>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    <language>${site.locale}</language>
    <lastBuildDate>${formatRssDate(todayDhaka() + "T00:00:00+06:00")}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      "CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
