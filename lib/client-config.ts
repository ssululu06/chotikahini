// ─────────────────────────────────────────────────────────────
// Client-safe site configuration.
//
// The site now reads all data from the DATABASE (site_settings table),
// not from JSON files. On the client, we use the bundled defaults as the
// initial value and optionally hydrate from /api/site-config.
// ─────────────────────────────────────────────────────────────

import { DEFAULT_SITE_CONFIG } from "./site-defaults";

export interface ClientSiteConfig {
  title: string;
  shortName: string;
  tagline: string;
  description: string;
  url: string;
  locale: string;
  logo: string;
  copyright: string;
  coverFallbackDir?: string;
  seo?: {
    siteName?: string;
    description?: string;
  };
  [key: string]: unknown;
}

export function getClientSiteConfig(): ClientSiteConfig {
  return DEFAULT_SITE_CONFIG as ClientSiteConfig;
}

/** Site base URL without trailing slash. */
export function getClientSiteUrl(): string {
  const url = (DEFAULT_SITE_CONFIG as any).url || "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/** Site name/title. */
export function getClientSiteName(): string {
  return (DEFAULT_SITE_CONFIG as any).title || "";
}

/** Site short name (e.g. for brand marks). */
export function getClientShortName(): string {
  return (DEFAULT_SITE_CONFIG as any).shortName || (DEFAULT_SITE_CONFIG as any).title || "";
}
