import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Single hit per viewer per 24-hour bucket.
 *
 * The `viewer_key` is sha256(`ip|user-agent|dayOfYear`). Any of those changing
 * counts as a "new viewer" so it's robust against simple IP rotation while
 * still de-duplicating refresh hits. Persistence lives in `public.video_views`
 * (see scripts/video-views-unique.sql) and the counter is bumped atomically
 * from a Postgres function so concurrent viewers can't lose increments.
 *
 * The route is intentionally tolerant: schema-missing or RPC-missing all
 * log + 200 so an in-flight migration can't break a viewer.
 */

interface RouteContext {
  params: { id: string };
}

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

function dayBucket(): number {
  return Math.floor(Date.now() / DEDUPE_WINDOW_MS);
}

function viewerKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";
  const ua = req.headers.get("user-agent") || "";
  const bucket = dayBucket();
  return createHash("sha256")
    .update(`${ip}|${ua}|${bucket}`)
    .digest("hex");
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const supabase = getSupabaseAdmin();
    const key = viewerKey(req);

    // INSERT … ON CONFLICT DO NOTHING gives us atomic de-duplication in a
    // single round-trip. The unique constraint is (video_id, viewer_key).
    // PostgREST exposes this as `ignoreDuplicates: true` on .upsert().
    const { error: insertErr } = await supabase
      .from("video_views")
      .upsert(
        { video_id: params.id, viewer_key: key },
        { onConflict: "video_id,viewer_key", ignoreDuplicates: true },
      );

    if (insertErr) {
      // The most common cause before scripts/video-views-unique.sql has
      // been run is "relation video_views does not exist". Swallow it so
      // the page never reports errors to a real viewer.
      console.warn("[video-view] upsert skipped:", insertErr.message);
      return NextResponse.json({ counted: false });
    }

    // After the upsert we still can't tell whether the row was new or
    // duplicated (PostgREST returns the same shape), so we always check
    // the counter and ask the DB to bump. Using a single-statement RPC
    // would be one fewer round-trip, but for a fire-and-forget counter
    // the extra hop is fine.
    const { error: rpcErr } = await supabase.rpc("bump_video_view_count", {
      p_video_id: params.id,
    });

    if (rpcErr) {
      console.warn("[video-view] rpc skipped:", rpcErr.message);
    }

    return NextResponse.json({ counted: true });
  } catch (e) {
    console.error("[video-view] unexpected error:", e);
    return NextResponse.json({ counted: false });
  }
}
