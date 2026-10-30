import { getSiteConfig } from "@/lib/config";
import type { SiteConfig } from "@/lib/config";
import type { PostMeta } from "./posts";

export const OG_IMAGE_VERSION = 5;

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function toSiteOgUrl(siteConfig: SiteConfig = getSiteConfig()): string {
  const base = siteConfig.url.endsWith("/") ? siteConfig.url.slice(0, -1) : siteConfig.url;
  const contentVersion = fingerprint(
    `${process.env.VERCEL_GIT_COMMIT_SHA || ""}\n${siteConfig.url}\n${siteConfig.title}\n${siteConfig.tagline}`,
  );
  return `${base}/api/og/home?v=${OG_IMAGE_VERSION}-${contentVersion}`;
}

/**
 * Build the per-post social-share preview URL.
 *
 * Each story gets its own composed OpenGraph card served by
 * `/api/og/post/[identifier]` — the post's own cover (10% blur) with
 * the title, author, category, and brand mark overlaid, sized
 * 1200×630. Returns the absolute URL (with site origin) so it can be
 * dropped straight into `openGraph.images[].url`.
 */
export function toPostOgUrl(post: PostMeta, siteConfig?: ReturnType<typeof getSiteConfig>): string {
  const site = siteConfig || getSiteConfig();
  const base = site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;
  const identifier = post.uid || post.slug;
  const updatedAt = encodeURIComponent(post.updatedAt || post.publishedAt);
  return `${base}/api/og/post/${encodeURIComponent(identifier)}?v=${OG_IMAGE_VERSION}-${updatedAt}`;
}
