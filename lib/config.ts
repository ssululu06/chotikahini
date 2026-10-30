/** Shallow-deep merge: nested plain objects are merged recursively so a
 *  partial DB config never loses defaults (themeColors, seo, ...). */
function deepMerge<T>(base: T, override: any): T {
  if (Array.isArray(base) || Array.isArray(override)) {
    return (override !== undefined && override !== null ? override : base) as T;
  }
  if (typeof base === "object" && base !== null && typeof override === "object" && override !== null) {
    const out: any = { ...base };
    for (const key of Object.keys(override)) {
      const bv = (base as any)[key];
      const ov = override[key];
      out[key] =
        typeof bv === "object" && bv !== null && typeof ov === "object" && ov !== null && !Array.isArray(bv)
          ? deepMerge(bv, ov)
          : ov !== undefined
            ? ov
            : bv;
    }
    return out as T;
  }
  return (override !== undefined && override !== null ? override : base) as T;
}

export interface SiteConfig {
  title: string;
  shortName: string;
  tagline: string;
  description: string;
  url: string;
  locale: string;
  logo: string;
  favicon: string;
  defaultCover: string;
  coverFallbackDir: string;
  copyright: string;
  email: string;
  socialLinks: { platform: string; url: string; label: string }[];
  submissionForm?: {
    action: string;
    entries: {
      name: string;
      email: string;
      subject: string;
      message: string;
    };
  };
  commentForm?: {
    action: string;
    entries: {
      postId: string;
      postTitle: string;
      postUrl: string;
      name: string;
      email: string;
      comment: string;
      date: string;
    };
  };
  themeColors: {
    light: ThemeColorSet;
    dark: ThemeColorSet;
  };
  seo: {
    titleTemplate: string;
    defaultTitle: string;
    description: string;
    author: string;
    keywords: string;
    twitterCard: string;
    twitterCreator: string;
    canonicalUrl: string;
    robots: string;
    themeColor: string;
    siteName: string;
    googleSearchConsole: string;
    bingVerification: string;
    googleAnalyticsId: string;
    googleTagManagerId: string;
    organization: {
      name: string;
      url: string;
      logo: string;
    };
  };
}

export interface ThemeColorSet {
  surface: string;
  surfaceAlt: string;
  surfaceHover: string;
  border: string;
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  accent: string;
  accentHover: string;
}

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Site-wide feature switches, stored in `site_settings` under the
 * `features` key (NOT inside `config`, so a toggle never risks clobbering
 * the large config blob).
 *
 * Every flag is read through `getFeatures()`, which is synchronous and
 * safe to call from Server Components. Keep this interface flat —
 * `applySiteSettings` deep-merges the DB value over these defaults, so a
 * row that predates a new flag still resolves to its default.
 */
export interface Features {
  /** Master switch for the whole video section: homepage strip, /videos
   *  routes, video detail pages, and nav entries. When false the section
   *  is unreachable and excluded from discovery (sitemap/RSS/robots). */
  videoSection: boolean;
}

export interface Navigation {
  main: NavItem[];
  footer: NavItem[];
}

export interface Author {
  id: string;
  name: string;
  image: string;
  bio: string;
  facebook: string;
  website: string;
  email?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
}

import { DEFAULT_SITE_CONFIG, DEFAULT_NAVIGATION, DEFAULT_AUTHORS, DEFAULT_CATEGORIES, DEFAULT_FEATURES } from "./site-defaults";

// ── DB-backed site data with in-memory cache ─────────────────
// All site data lives in the DB (site_settings + categories tables).
// These sync getters return the cached value (or an embedded fallback).
// `loadSiteSettings()` (see lib/site-settings.ts, server-only) refreshes the
// cache through the shared multi-tier cache so the DB is queried rarely.

let configCache: SiteConfig | null = null;
let navCache: Navigation | null = null;
let categoriesCache: Category[] | null = null;
let authorsCache: Author[] | null = null;
let featuresCache: Features | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Apply site data that was read (and cached) elsewhere into the in-process
 * cache used by the synchronous getters above. This module deliberately avoids
 * any DB / `next/cache` import so it stays importable from Client Components.
 */
export function applySiteSettings({
  settings,
  categories,
}: {
  settings: { key: string; value: any }[];
  categories: any[];
}): void {
  const map = new Map<string, any>();
  for (const r of settings || []) map.set(r.key, r.value);

  if (map.has("config")) {
    // Merge DB config over defaults so a partial DB row (missing
    // themeColors / seo / organization) never breaks the site.
    configCache = deepMerge(DEFAULT_SITE_CONFIG, map.get("config"));
  }
  if (map.has("navigation")) navCache = map.get("navigation");

  // Feature flags are deep-merged over the defaults so a DB row written
  // before a flag existed still resolves that flag to its default value.
  if (map.has("features")) {
    featuresCache = deepMerge(DEFAULT_FEATURES, map.get("features"));
  }

  if (Array.isArray(categories) && categories.length > 0) {
    categoriesCache = categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      icon: c.icon || "feather",
      description: c.description || "",
    }));
  }

  cacheLoadedAt = Date.now();
}

export function getSiteConfig(): SiteConfig {
  if (configCache && Date.now() - cacheLoadedAt < CACHE_TTL * 2) return configCache as SiteConfig;
  return DEFAULT_SITE_CONFIG as SiteConfig;
}

export function getNavigation(): Navigation {
  if (navCache) return navCache;
  return DEFAULT_NAVIGATION;
}

/**
 * Feature switches, defaulting to "everything on". Callers that render or
 * link to a gated surface should use this rather than reading config
 * directly, so the default-on behaviour is stated in exactly one place.
 */
export function getFeatures(): Features {
  return (featuresCache as Features) || DEFAULT_FEATURES;
}

/** Convenience for the one switch that gates several routes. */
export function isVideoSectionEnabled(): boolean {
  return getFeatures().videoSection !== false;
}

export function getAuthors(): Author[] {
  if (authorsCache && authorsCache.length > 0) return authorsCache;
  return DEFAULT_AUTHORS;
}

export function getAuthor(id: string): Author | null {
  if (!id) return null;
  const q = id.toLowerCase().trim();
  const authors = getAuthors();
  const found = authors.find((a) => a.id.toLowerCase() === q);
  if (found) return found;

  // Fallback for registered users/authors so profile page /authors/[id] never 404s
  const siteConfig = getSiteConfig();
  const cleanName = (id.startsWith("usr_") || id.length > 20) ? "অজ্ঞাত লেখক" : id;
  return {
    id: id,
    name: cleanName,
    image: "",
    bio: `${cleanName} - ${siteConfig.title} কমিউনিটি সদস্য`,
    facebook: "",
    website: "",
    email: ""
  };
}

export function getCategoryConfig(id: string): Category | null {
  if (!id) return null;
  const q = String(id).trim().toLowerCase();
  if (!q) return null;

  const categories = getAllCategoryConfigs();
  const found = categories.find((c) => c.id.toLowerCase() === q || c.name.toLowerCase() === q);
  if (found) return found;

  if (q === "golpo" || q === "posts") {
    return { id: "golpo", name: "গল্প", icon: "feather", description: "সাধারণ গল্প" };
  }
  return null;
}

export function getAllCategoryConfigs(): Category[] {
  if (categoriesCache && categoriesCache.length > 0) return categoriesCache;
  return DEFAULT_CATEGORIES;
}

export function setAuthorsCache(authors: Author[]) {
  authorsCache = authors;
}
