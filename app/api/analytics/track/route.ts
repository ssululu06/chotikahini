import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionRaw } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Lightweight public endpoint that logs one page visit (story page) so the
 * admin panel can show unique page visitors and daily counts.
 *
 * Always succeeds — analytics must never break the reading experience, so
 * every failure is swallowed.
 */
export async function POST(req: Request) {
  try {
    const { slug, visitorId, referrer } = await req.json();
    if (!slug || !visitorId) {
      return NextResponse.json({ ok: true });
    }

    // The visitor id is only used for attribution, never for an
    // authorization decision, so the JWT payload is used directly instead
    // of re-reading the user row from the database on every page view.
    const session = await getSessionRaw();
    const supabase = getSupabaseAdmin();

    const userAgent = req.headers.get("user-agent") || null;
    const country =
      req.headers.get("x-vercel-ip-country") ||
      req.headers.get("cf-ipcountry") ||
      null;
    const safeReferrer = referrer && String(referrer).length <= 1000 ? String(referrer) : null;

    // 1. Insert raw visit (works only after scripts/analytics-supabase.sql is run)
    await supabase.from("page_visits").insert({
      slug: String(slug).slice(0, 300),
      visitor_id: String(visitorId).slice(0, 64),
      user_id: session?.id || null,
      referrer: safeReferrer,
      user_agent: userAgent ? userAgent.slice(0, 500) : null,
      country,
    });

    // 2. Track "active user" for logged-in members
    if (session?.id) {
      await supabase
        .from("users")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", session.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: true });
  }
}
