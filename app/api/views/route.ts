import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

const viewsCache = new Map<string, { views: number; timestamp: number }>();
const VIEWS_CACHE_TTL = 5_000;
const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ error: "Slug required" }, { status: 400 });
    }

    const cached = viewsCache.get(slug);
    if (cached && Date.now() - cached.timestamp < VIEWS_CACHE_TTL) {
      return NextResponse.json(
        { views: cached.views },
        { headers: noStoreHeaders }
      );
    }

    const supabase = getSupabaseAdmin();

    let finalCount = 0;

    // Try post_view_counts (new normalized table) first
    const { data: pm } = await supabase
      .from("post_metadata")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (pm?.id) {
      const { data: vc } = await supabase
        .from("post_view_counts")
        .select("view_count")
        .eq("post_id", pm.id)
        .maybeSingle();
      if (vc !== null && typeof vc?.view_count === "number") {
        finalCount = vc.view_count;
        viewsCache.set(slug, { views: finalCount, timestamp: Date.now() });
        return NextResponse.json(
          { views: finalCount },
          { headers: noStoreHeaders }
        );
      }
    }

    // Fallback to legacy post_views table
    const { data: viewData, error: viewError } = await supabase
      .from("post_views")
      .select("view_count")
      .eq("post_slug", slug)
      .maybeSingle();
    if (viewError) throw viewError;

    finalCount = viewData?.view_count || 0;
    viewsCache.set(slug, { views: finalCount, timestamp: Date.now() });

    return NextResponse.json(
      { views: finalCount },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error("Failed to fetch views", error);
    return NextResponse.json({ error: "Failed to fetch views" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { slug, visitorId, referrer } = await req.json();
    if (!slug) {
      return NextResponse.json({ error: "Slug required" }, { status: 400 });
    }

    const session = await getSession();
    const supabase = getSupabaseAdmin();

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      req.headers.get("cf-connecting-ip") ||
      "anon_ip";

    const effectiveVisitorId = String(visitorId || clientIp).slice(0, 64);

    // 1. Record raw page visit for unique-visitor & daily analytics.
    try {
      const country =
        req.headers.get("x-vercel-ip-country") ||
        req.headers.get("cf-ipcountry") ||
        null;
      await supabase.from("page_visits").insert({
        slug: String(slug).slice(0, 300),
        visitor_id: effectiveVisitorId,
        user_id: session?.id || null,
        referrer: referrer ? String(referrer).slice(0, 1000) : null,
        user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
        country,
      });
    } catch {}

    // 2. Update "active user" timestamp for logged-in members
    try {
      if (session?.id) {
        await supabase
          .from("users")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", session.id);
      }
    } catch {}

    // Resolve post_id
    const { data: pm } = await supabase
      .from("post_metadata")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    let shouldIncrement = true;

    // Deduplication check for anonymous / Incognito visitors via IP & visitor ID (1-hour window)
    if (!session) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      try {
        const { data: recentVisits } = await supabase
          .from("page_visits")
          .select("id")
          .eq("slug", String(slug).slice(0, 300))
          .or(`visitor_id.eq.${effectiveVisitorId},visitor_id.eq.${clientIp}`)
          .gte("created_at", oneHourAgo)
          .limit(2);

        // If this visit is not the only visit in the last hour, don't increment view count
        if (recentVisits && recentVisits.length > 1) {
          shouldIncrement = false;
        }
      } catch {}
    } else {
      // For logged-in users, check reading history to prevent duplicate views
      const historyQuery = supabase
        .from("reading_history")
        .select("last_read_at, id")
        .eq("post_slug", slug)
        .eq("user_id", session.id)
        .maybeSingle();

      const { data: history } = await historyQuery;

      if (history) {
        const lastRead = new Date(history.last_read_at).getTime();
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - lastRead < oneHour) {
          shouldIncrement = false;
        }
        // Update last_read_at and backfill post_id
        await supabase
          .from("reading_history")
          .update({ last_read_at: new Date().toISOString(), post_id: pm?.id || null })
          .eq("id", history.id);
      } else {
        await supabase.from("reading_history").insert({
          post_slug: slug,
          post_id: pm?.id || null,
          user_id: session.id
        });
      }
    }

    if (shouldIncrement) {
      if (pm?.id) {
        // Use new normalized table with atomic RPC-style upsert
        const { data: currentVc } = await supabase
          .from("post_view_counts")
          .select("view_count")
          .eq("post_id", pm.id)
          .maybeSingle();

        const newCount = (currentVc?.view_count || 0) + 1;
        const { error: upsertError } = await supabase
          .from("post_view_counts")
          .upsert(
            { post_id: pm.id, view_count: newCount, updated_at: new Date().toISOString() },
            { onConflict: "post_id" }
          );
        if (upsertError) throw upsertError;

        viewsCache.set(slug, { views: newCount, timestamp: Date.now() });
        return NextResponse.json({ success: true, views: newCount });
      } else {
        // Fallback: legacy post_views table
        const { data: currentView } = await supabase
          .from("post_views")
          .select("view_count")
          .eq("post_slug", slug)
          .maybeSingle();

        const newCount = (currentView?.view_count || 0) + 1;
        const { error: upsertError } = await supabase
          .from("post_views")
          .upsert(
            { post_slug: slug, view_count: newCount, updated_at: new Date().toISOString() },
            { onConflict: "post_slug" }
          );
        if (upsertError) throw upsertError;

        viewsCache.set(slug, { views: newCount, timestamp: Date.now() });
        return NextResponse.json({ success: true, views: newCount });
      }
    }

    return NextResponse.json({ success: true, incremented: false });
  } catch (error) {
    console.error("Failed to update views", error);
    return NextResponse.json({ error: "Failed to update views" }, { status: 500 });
  }
}
