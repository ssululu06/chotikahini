import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Announcements are stored ONLY in the DB (no JSON file fallback).

const emptyAnnouncement = {
  id: null,
  text: "",
  active: false,
  color: "blue",
  link: "",
  updated_at: new Date().toISOString(),
};

/**
 * Public banner data — a single announcement row, no user data. Every
 * visitor polls this, so it is served from the CDN to keep polling off
 * the function. The `PUT` handler below invalidates it with
 * `revalidatePath("/api/admin/announcement")` when an admin edits it.
 */
const ANNOUNCEMENT_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
  "CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("announcements")
      .select("id, text, active, color, link, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data && data.text) {
      return NextResponse.json(data, {
        headers: ANNOUNCEMENT_CACHE_HEADERS,
      });
    }
  } catch (e) {}

  return NextResponse.json(emptyAnnouncement, {
    headers: ANNOUNCEMENT_CACHE_HEADERS,
  });
}

export async function PUT(req: Request) {
  try {
    const { authorized } = await requirePermission("announcements.edit");
    if (!authorized) {
      return NextResponse.json({ error: "অননুমোদিত অ্যাক্সেস।" }, { status: 401 });
    }

    const { text, active, color, link } = await req.json();
    const nowIso = new Date().toISOString();
    const payload = {
      text: text ? String(text).trim() : "",
      active: Boolean(active),
      color: color || "blue",
      link: link ? String(link).trim() : "",
      updated_at: nowIso,
    };

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("announcements")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await supabase.from("announcements").update(payload).eq("id", existing.id);
    } else {
      await supabase
        .from("announcements")
        .insert({ id: "ann_" + Date.now().toString(36), ...payload });
    }

    try {
      revalidatePath("/", "layout");
      revalidatePath("/admin/announcement");
      revalidatePath("/api/admin/announcement");
    } catch {}

    return NextResponse.json({ success: true, announcement: payload }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Announcement update error:", error);
    return NextResponse.json({ error: "ঘোষণা সংরক্ষণ করতে সমস্যা হয়েছে।" }, { status: 500 });
  }
}
