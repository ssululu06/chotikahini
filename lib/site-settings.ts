// ─────────────────────────────────────────────────────────────
// lib/site-settings.ts — server-only loader for DB-backed site data.
//
// Reads `site_settings` + `categories` through the shared multi-tier cache
// (lib/cache.ts), then applies them to the in-process cache in lib/config.ts.
// Keep this module out of Client Components: it pulls in `next/cache`.
// ─────────────────────────────────────────────────────────────

import { cachedRead, CACHE_TAGS } from "./cache";
import { getSupabaseAdmin } from "./supabase";
import { applySiteSettings } from "./config";

const readSiteSettings = cachedRead(
  "site-settings",
  async () => {
    const supabase = getSupabaseAdmin();

    const { data: settings, error } = await supabase
      .from("site_settings")
      .select("key, value");
    if (error) throw error;

    const { data: categories, error: categoriesError } = await supabase
      .from("categories")
      .select("*")
      .order("created_at", { ascending: true });
    if (categoriesError) throw categoriesError;

    return {
      settings: (settings || []) as { key: string; value: any }[],
      categories: (categories || []) as any[],
    };
  },
  { revalidate: 15, tags: [CACHE_TAGS.siteSettings, CACHE_TAGS.categories], ttlMs: 5_000, staleMs: 0 }
);

/**
 * Refresh the in-process site config from the (cached) DB rows.
 * Cheap on every call after the first — the underlying query is cached in L1
 * and L2, so this never hits the DB on a warm cache.
 */
export async function loadSiteSettings(): Promise<void> {
  applySiteSettings(await readSiteSettings());
}
