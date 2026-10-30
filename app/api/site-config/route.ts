import { NextResponse } from "next/server";
import { getSiteConfig } from "@/lib/config";
import { loadSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

/**
 * Public site configuration (branding, navigation, social links, form
 * templates). Contains no user data and no secrets, so it is served from
 * the CDN. `loadSiteSettings()` already keeps the underlying read cached.
 */
const SITE_CONFIG_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
  "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

export async function GET() {
  try {
    await loadSiteSettings();
    const config = getSiteConfig();
    return NextResponse.json(config, {
      headers: SITE_CONFIG_CACHE_HEADERS,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load site config" }, { status: 500 });
  }
}
