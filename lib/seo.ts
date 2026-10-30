import type { Metadata } from "next";
import { type Post, type PostMeta } from "@/lib/posts";
import { type SiteConfig } from "@/lib/config";
import { toPostOgUrl } from "@/lib/og-urls";
import {
  findMatchingClusters,
  generateSeoTitle,
  generateSeoDescription,
  generateTags,
  generateKeywordsTag,
  generateSocialTitle,
  generateJsonLdKeywords,
  type KeywordMatch,
} from "@/lib/keyword-engine";

/* ── Utilities ─────────────────────────────────────────────────── */

/** Extract the first meaningful paragraph from MDX content for use as meta description */
export function extractDescription(content: string, maxLength = 160): string {
  // Remove frontmatter, headings, code blocks, image embeds, links, formatting
  const cleaned = content
    .replace(/---[\s\S]*?---/, "") // frontmatter
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/#{1,6}\s+/g, "") // headings
    .replace(/!\[.*?\]\(.*?\)/g, "") // images
    .replace(/\[([^\]]*)\]\(.*?\)/g, "$1") // links → text
    .replace(/[*_~`]/g, "") // formatting
    .replace(/\n{2,}/g, "\n") // multiple newlines
    .trim();

  // Get first non-empty paragraph
  const paragraphs = cleaned.split(/\n+/).filter((p) => p.trim().length > 20);
  const firstPara = paragraphs[0]?.trim() || "";

  if (firstPara.length <= maxLength) return firstPara;
  return firstPara.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}

/** Generate keywords from post title + tags + category + keyword clusters + global config */
export function extractKeywords(post: PostMeta, site: SiteConfig, content?: string): string {
  const parts: string[] = [];

  // 1. Primary Keyword: Post Title (Full Title & Cleaned Title)
  if (post.title) {
    parts.push(post.title.trim());
    const cleanTitle = post.title
      .replace(/\s*[-\|:]?\s*(পর্ব|part|chapter|পর্বঃ)\s*[-\|:]?\s*(\d+|[০-৯]+)/gi, "")
      .trim();
    if (cleanTitle && cleanTitle !== post.title.trim()) {
      parts.push(cleanTitle);
    }
  }

  // 2. Tags as keywords
  if (post.tags.length > 0) {
    parts.push(...post.tags);
  }

  // 3. Category name
  if (post.categoryName) {
    parts.push(post.categoryName);
  }

  // 4. Global keywords from config.json
  if (site.seo?.keywords) {
    parts.push(...site.seo.keywords.split(",").map((k) => k.trim()).filter(Boolean));
  }

  // 5. Keyword cluster matches from search.md
  const searchText = `${post.title} ${post.description} ${content || ""}`;
  const matches = findMatchingClusters(searchText, 2);
  if (matches.length > 0) {
    const keywordTag = generateKeywordsTag(matches);
    if (keywordTag) {
      parts.push(...keywordTag.split(", "));
    }
  }

  // Deduplicate and join
  return [...new Set(parts)].slice(0, 15).join(", ");
}

/** Clean text for meta tags (strip markdown, newlines, control characters, extra whitespace) */
export function cleanMetaText(text: string, maxLength = 200): string {
  if (!text) return "";
  const cleaned = text
    .replace(/---[\s\S]*?---/, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/#{1,6}\s+/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]*)\]\(.*?\)/g, "$1")
    .replace(/[*_~`\r]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}

/** Build a full absolute social share image URL starting with https:// */
export function getSocialImage(post: PostMeta, site: SiteConfig): string {
  const rawImg = post.cover || site.defaultCover || site.logo || "";
  if (!rawImg) return "";
  if (rawImg.startsWith("http://") || rawImg.startsWith("https://")) {
    return rawImg;
  }
  const baseUrl = site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;
  const cleanImgPath = rawImg.startsWith("/") ? rawImg : `/${rawImg}`;
  return `${baseUrl}${cleanImgPath}`;
}

/* ── Post metadata generator ───────────────────────────────────── */

export function generatePostMetadata(post: Post, site: SiteConfig): Metadata {
  const rawDescription = post.description || extractDescription(post.content);
  const identifier = post.uid || post.slug;
  const baseUrl = site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;
  const canonicalUrl = `${baseUrl}/${identifier}`;
  // Each story gets its own composed share card: post cover + 10% blur
  // + title/author/category text overlay, served by /api/og/post/[id].
  const imageUrl = toPostOgUrl(post, site);

  // Find keyword clusters for SEO enrichment
  const searchText = `${post.title} ${rawDescription} ${post.content?.slice(0, 500) || ""}`;
  const matches = findMatchingClusters(searchText, 2);

  // Enrich title and description with keyword data
  const rawTitle = generateSeoTitle(post.title, matches);
  const seoTitle = cleanMetaText(rawTitle, 100);
  const seoDescription = cleanMetaText(generateSeoDescription(rawDescription, matches), 200);
  const socialTitle = cleanMetaText(generateSocialTitle(seoTitle), 100);

  // Keyword-enriched tags
  const enrichedTags = generateTags(post.tags, matches);

  return {
    title: seoTitle,
    description: seoDescription,
    metadataBase: new URL(baseUrl),
    openGraph: {
      title: socialTitle,
      description: seoDescription,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.authorName],
      images: imageUrl
        ? [
            {
              url: imageUrl,
              secureUrl: imageUrl.replace(/^http:/, "https:"),
              width: 1200,
              height: 630,
              alt: socialTitle,
              type: imageUrl.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
            },
          ]
        : [],
      url: canonicalUrl,
      siteName: site.seo?.siteName || site.title,
      locale: "bn_BD",
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: seoDescription,
      images: imageUrl ? [imageUrl] : [],
      creator: site.seo?.twitterCreator || undefined,
    },
    alternates: {
      canonical: canonicalUrl,
    },
    keywords: extractKeywords(post, site, post.content),
    other: {
      rating: "general",
      ...(imageUrl
        ? {
            "og:image:secure_url": imageUrl.replace(/^http:/, "https:"),
            "og:image:width": "1200",
            "og:image:height": "630",
          }
        : {}),
      "article:published_time": post.publishedAt,
      "article:modified_time": post.updatedAt,
      "article:author": post.authorName,
      "article:section": post.categoryName,
      ...(enrichedTags.length > 0
        ? { "article:tag": enrichedTags.join(",") }
        : {}),
    },
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

/* ── JSON-LD generators ────────────────────────────────────────── */

interface JsonLdGraph {
  "@context": "https://schema.org";
  "@graph": Record<string, unknown>[];
}

export function generatePostJsonLd(
  post: Post,
  site: SiteConfig,
  breadcrumbItems?: { name: string; url: string }[]
): JsonLdGraph {
  const siteUrl = site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;
  const postUrl = `${siteUrl}/${post.uid || post.slug}`;
  const imageUrl = getSocialImage(post, site);
  const rawDescription = post.description || extractDescription(post.content);

  // Keyword enrichment
  const searchText = `${post.title} ${rawDescription} ${post.content?.slice(0, 500) || ""}`;
  const matches = findMatchingClusters(searchText, 2);
  const seoDescription = generateSeoDescription(rawDescription, matches);
  const seoTitle = generateSeoTitle(post.title, matches);
  const jsonLdKeywords = generateJsonLdKeywords(matches);

  const graph: Record<string, unknown>[] = [];

  // 1. Website
  graph.push({
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    name: site.seo?.siteName || site.title,
    description: site.seo?.description || site.description,
    publisher: {
      "@id": `${siteUrl}/#organization`,
    },
    inLanguage: site.locale || "bn-BD",
  });

  // 2. Organization
  graph.push({
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: site.seo?.organization?.name || site.title,
    url: siteUrl,
    ...(site.logo
      ? {
          logo: {
            "@type": "ImageObject",
            url: `${siteUrl}${site.logo}`,
          },
        }
      : {}),
    ...(site.seo?.googleSearchConsole
      ? { sameAs: [site.seo.googleSearchConsole] }
      : {}),
  });

  // 3. Breadcrumb
  const items = breadcrumbItems || [
    { name: "হোম", url: siteUrl },
    { name: post.categoryName, url: `${siteUrl}/categories/${post.categoryId}` },
    { name: post.title, url: postUrl },
  ];

  graph.push({
    "@type": "BreadcrumbList",
    "@id": `${postUrl}/#breadcrumb`,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  });

  // 4. Article (with keyword-enriched headline & description)
  const article: Record<string, unknown> = {
    "@type": "Article",
    "@id": `${postUrl}/#article`,
    headline: seoTitle,
    description: seoDescription,
    url: postUrl,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      "@type": "Person",
      "@id": `${siteUrl}/#author/${post.authorId}`,
      name: post.authorName,
      ...(post.authorImage
        ? { image: { "@type": "ImageObject", url: post.authorImage } }
        : {}),
    },
    publisher: {
      "@id": `${siteUrl}/#organization`,
    },
    image: imageUrl
      ? {
          "@type": "ImageObject",
          url: imageUrl.startsWith("http") ? imageUrl : `${siteUrl}${imageUrl}`,
          width: 1200,
          height: 630,
        }
      : undefined,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl,
    },
    keywords: [...new Set([post.title, post.categoryName, ...post.tags, jsonLdKeywords].filter(Boolean))].join(", "),
    articleSection: post.categoryName,
    inLanguage: site.locale || "bn-BD",
    isFamilyFriendly: true,
  };

  // Remove undefined values
  graph.push(Object.fromEntries(Object.entries(article).filter(([_, v]) => v !== undefined)));

  // 5. Author
  graph.push({
    "@type": "Person",
    "@id": `${siteUrl}/#author/${post.authorId}`,
    name: post.authorName,
    ...(post.authorBio ? { description: post.authorBio } : {}),
    ...(post.authorImage
      ? { image: { "@type": "ImageObject", url: post.authorImage } }
      : {}),
  });

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

/**
 * Generate FAQPage JSON-LD for pages that answer common questions.
 * This uses keyword clusters to auto-generate relevant Q&A pairs.
 */
export function generateFaqJsonLd(
  questions: { question: string; answer: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };
}

/**
 * Generate BreadcrumbList JSON-LD for any page.
 */
export function generateBreadcrumbJsonLd(
  items: { name: string; url: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** Generate minimal JSON-LD for the home page / static pages */
export function generateSiteJsonLd(site: SiteConfig): JsonLdGraph {
  const siteUrl = site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: site.seo?.siteName || site.title,
        description: site.seo?.description || site.description,
        publisher: {
          "@id": `${siteUrl}/#organization`,
        },
        inLanguage: site.locale || "bn-BD",
      },
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: site.seo?.organization?.name || site.title,
        url: siteUrl,
        ...(site.logo
          ? {
              logo: {
                "@type": "ImageObject",
                url: `${siteUrl}${site.logo}`,
              },
            }
          : {}),
      },
    ],
  };
}
