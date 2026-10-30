import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSiteConfig, getNavigation } from "@/lib/config";
import { DEFAULT_SITE_CONFIG, DEFAULT_NAVIGATION, DEFAULT_FEATURES } from "@/lib/site-defaults";
import { CACHE_TAGS, invalidateTags } from "@/lib/cache";
import { loadSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

// GET /api/admin/site-settings — returns current DB settings (or seeds from defaults)
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("site_settings").select("key, value");

    // Auto-seed from defaults if the table is empty
    if (!data || data.length === 0) {
      const current = getSiteConfig() as any;
      const nav = getNavigation();
      await supabase.from("site_settings").insert([
        { key: "config", value: current && current.title ? current : DEFAULT_SITE_CONFIG },
        { key: "navigation", value: nav && nav.main ? nav : DEFAULT_NAVIGATION },
      ]);
      return NextResponse.json({
        config: current && current.title ? current : DEFAULT_SITE_CONFIG,
        navigation: nav && nav.main ? nav : DEFAULT_NAVIGATION,
        features: DEFAULT_FEATURES,
      });
    }

    const map = new Map<string, any>();
    for (const r of data) map.set(r.key, r.value);
    return NextResponse.json({
      config: map.get("config") || DEFAULT_SITE_CONFIG,
      navigation: map.get("navigation") || DEFAULT_NAVIGATION,
      features: map.get("features") || DEFAULT_FEATURES,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH /api/admin/site-settings — save site config/navigation to DB (admin/superadmin)
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "settings.view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { config, navigation, features, configPatch, featuresPatch } = body || {};
    const supabase = getSupabaseAdmin();
    const upserts: any[] = [];
    if (config) upserts.push({ key: "config", value: config });
    if (navigation) upserts.push({ key: "navigation", value: navigation });
    // The toggle UI sends only `featuresPatch`, so the merge happens here
    // — adding a new flag in code won't erase it on the next admin click.
    if (features && typeof features === "object") {
      upserts.push({ key: "features", value: deepMerge(DEFAULT_FEATURES, features) });
    } else if (featuresPatch && typeof featuresPatch === "object") {
      const { data: current } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "features")
        .maybeSingle();
      const base = current?.value && typeof current.value === "object"
        ? current.value
        : DEFAULT_FEATURES;
      upserts.push({ key: "features", value: deepMerge(base, featuresPatch) });
    }
    // `configPatch` lets the client update a nested field without sending
    // the entire site config — keeps the form simple and avoids race conditions.
    if (configPatch && typeof configPatch === "object") {
      const { data: current } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "config")
        .maybeSingle();
      const base = current?.value && typeof current.value === "object"
        ? current.value
        : DEFAULT_SITE_CONFIG;
      const merged = deepMerge(base, configPatch);
      upserts.push({ key: "config", value: merged });
    }
    if (upserts.length) {
      const { error } = await supabase.from("site_settings").upsert(upserts, { onConflict: "key" });
      if (error) throw error;
    }
    invalidateTags([CACHE_TAGS.siteSettings, CACHE_TAGS.categories]);
    await loadSiteSettings();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Shallow object merge — overwrites only the keys present in `patch`,
// recurses one level into nested objects so a partial `seo: {...}` patch
// doesn't blow away the rest of the seo object.
function deepMerge<T extends Record<string, any>>(base: T, patch: Record<string, any>): T {
  const out: any = { ...base };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === "object" && !Array.isArray(v) && base && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
      out[k] = deepMerge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
