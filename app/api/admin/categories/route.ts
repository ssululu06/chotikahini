import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabase";
import { CACHE_TAGS, cachedRead, clearMemoryCache, invalidateTags } from "@/lib/cache";
import { clearPostsCache } from "@/lib/posts";
import { loadSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

const getCategoryRecords = cachedRead(
  "category-records",
  async () => {
    const { data, error } = await getSupabaseAdmin()
      .from("categories")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  },
  { revalidate: 15, tags: [CACHE_TAGS.categories], ttlMs: 5_000, staleMs: 0 },
);

async function refreshCategoryCache() {
  clearPostsCache();
  clearMemoryCache("site-settings");
  invalidateTags([CACHE_TAGS.categories, CACHE_TAGS.siteSettings]);
  await loadSiteSettings();
}

export async function GET() {
  try {
    return NextResponse.json({ categories: await getCategoryRecords() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to load categories" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "settings.view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id, name, icon, description } = await req.json();
    if (!id || !name) return NextResponse.json({ error: "ID ও নাম আবশ্যক।" }, { status: 400 });
    const cleanId = String(id).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-_]/g, "");

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("categories").insert({
      id: cleanId, name: String(name).trim(), icon: icon || "feather", description: description || "",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await refreshCategoryCache();
    return NextResponse.json({ success: true, category: { id: cleanId, name: String(name).trim(), icon: icon || "feather", description: description || "" } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "settings.view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id, name, icon, description } = await req.json();
    if (!id) return NextResponse.json({ error: "ID আবশ্যক।" }, { status: 400 });
    const updates: any = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (icon !== undefined) updates.icon = String(icon).trim();
    if (description !== undefined) updates.description = String(description).trim();

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("categories").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await refreshCategoryCache();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "settings.view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID আবশ্যক।" }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await refreshCategoryCache();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}