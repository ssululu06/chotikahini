import type { Metadata } from "next";
import { getSiteConfig } from "@/lib/config";
import type { SiteConfig } from "@/lib/config";
import { toSiteOgUrl } from "@/lib/og-urls";
import {
  findMatchingClusters,
  generateSeoTitle,
  generateSeoDescription,
  generateKeywordsTag,
  getAllKeywordPhrases,
} from "@/lib/keyword-engine";

/* ── Build a fully-populated Metadata object from site config + overrides ── */

interface PageMetaInput {
  title: string;
  description?: string;
  keywords?: string;
  /** Full URL of this page, used for canonical & OG url. */
  url?: string;
  /** Image path (absolute or relative to site root). */
  image?: string;
  /** Page type hint for OG. */
  type?: "website" | "article";
  /** Robots directive. */
  robots?: string;
  /** Optional text content for keyword matching (e.g. page content) */
  content?: string;
}

function siteUrl(site: SiteConfig): string {
  return site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;
}

/**
 * Return complete Metadata for any page — OG, Twitter, canonical, robots, etc.
 *
 * Every page calls this so the metadata is consistent across the entire site.
 * Now enriched with keyword data from search.md via the keyword engine.
 */
export function buildMetadata(input: PageMetaInput): Metadata {
  const site = getSiteConfig();
  const base = siteUrl(site);
  const pageUrl = input.url || base;
  const description = input.description || site.seo?.description || site.description;
  const imageUrl = input.image
    ? input.image.startsWith("http://") || input.image.startsWith("https://")
      ? input.image
      : `${base}${input.image.startsWith("/") ? input.image : `/${input.image}`}`
    : toSiteOgUrl(site);
  const robotsVal = input.robots || site.seo?.robots || "index, follow";

  // Find keyword clusters from content/title for SEO enrichment
  const searchText = `${input.title} ${description} ${input.content || ""}`;
  const matches = findMatchingClusters(searchText, 2);

  // Enrich title and description with keyword data
  const seoTitle = generateSeoTitle(input.title, matches);
  const seoDescription = generateSeoDescription(description, matches);
  const seoKeywords = input.keywords || generateKeywordsTag(matches, site.seo?.keywords);

  const robotsDirective: Record<string, boolean> = {};
  if (robotsVal.includes("noindex")) robotsDirective.index = false;
  else robotsDirective.index = true;
  if (robotsVal.includes("nofollow")) robotsDirective.follow = false;
  else robotsDirective.follow = true;

  return {
    title: seoTitle,
    description: seoDescription,
    keywords: seoKeywords,
    metadataBase: new URL(base),
    authors: site.seo?.author ? [{ name: site.seo.author }] : [],
    robots: robotsDirective,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      type: input.type || "website",
      url: pageUrl,
      siteName: site.seo?.siteName || site.title,
      locale: "bn_BD",
      images: imageUrl
        ? [{ url: imageUrl, secureUrl: imageUrl.replace(/^http:/, "https:"), width: 1200, height: 630, alt: seoTitle }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: seoTitle,
      description: seoDescription,
      images: imageUrl ? [imageUrl] : [],
      site: site.seo?.twitterCreator || undefined,
    },
    other: {
      "theme-color": site.seo?.themeColor || "#2c2c2c",
      rating: "general",
    },
  };
}

/**
 * Convenience: build page metadata with the site's default title appended
 * for listing / taxonomy pages (e.g. "বিভাগ — বাংলা চটি কাহিনী").
 * Now enriched with keyword data for better SEO.
 */
export function buildListingMetadata(
  title: string,
  description: string,
  url?: string,
  /** Optional category id for keyword matching */
  categoryId?: string,
): Metadata {
  const site = getSiteConfig();
  const fullTitle = `${title} — ${site.title}`;

  // Find relevant keywords for this listing page
  const searchText = `${title} ${description}`;
  const matches = findMatchingClusters(searchText, 2);

  const seoTitle = generateSeoTitle(fullTitle, matches);
  const seoDescription = generateSeoDescription(description, matches);

  return buildMetadata({
    title: seoTitle,
    description: seoDescription,
    url,
  });
}

/**
 * Build metadata for taxonomy/listing pages with pagination.
 */
export function buildPagedMetadata(
  title: string,
  description: string,
  url: string,
  pageNum: number,
): Metadata {
  const site = getSiteConfig();
  const pagedTitle = `পাতা ${pageNum} — ${title} — ${site.title}`;
  const pagedDesc = `${description} — পাতা ${pageNum}`;
  return buildMetadata({
    title: pagedTitle,
    description: pagedDesc,
    url,
  });
}
