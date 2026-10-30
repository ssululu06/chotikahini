import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionRaw } from "@/lib/auth";
import { recordActiveVisitor } from "@/lib/active-visitors";

export async function POST(req: Request) {
  try {
    const { visitorId } = await req.json();
    // Heartbeats fire every 90s per visitor. The id is only used for
    // presence tracking (not authorization), so the JWT payload is read
    // directly instead of querying the user row on every beat.
    const session = await getSessionRaw();

    const idToTrack = session?.id || visitorId || "anon";
    const activeOnline = recordActiveVisitor(idToTrack);

    // If user is logged in, update last_seen_at in Supabase DB
    if (session?.id) {
      try {
        const supabase = getSupabaseAdmin();
        await supabase
          .from("users")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", session.id);
      } catch (e) {
        // Ignore if column is missing
      }
    }

    return NextResponse.json({
      success: true,
      activeOnline,
    });
  } catch (e) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
