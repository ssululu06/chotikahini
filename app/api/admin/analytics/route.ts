import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Admin-only analytics aggregation endpoint. */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !hasPermission(session.role, "analytics.view")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const canSeeUserStats = hasPermission(session.role, "users.view");

    const supabase = getSupabaseAdmin();

    // --- Total registered users ---
    let totalUsers = 0;
    try {
      const { count } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true });
      totalUsers = count || 0;
    } catch {}

    // --- Active users (last_seen_at within 24h / 7d) ---
    let activeToday = 0;
    let active7d = 0;
    try {
      const { count: today } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .gte("last_seen_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      activeToday = today || 0;

      const { count: week } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .gte("last_seen_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      active7d = week || 0;
    } catch {}

    // --- page_visits aggregates (only if table exists) ---
    let totalVisits = 0;
    let uniqueVisitors = 0;
    let dailyStats: { date: string; visits: number; uniqueVisitors: number }[] = [];
    let topStories: { slug: string; visits: number; uniqueVisitors: number }[] = [];

    try {
      // Total visits
      const { count: totalV } = await supabase
        .from("page_visits")
        .select("*", { count: "exact", head: true });
      totalVisits = totalV || 0;

      // Total unique visitors.
      // The PostgREST API caps a response at 1000 rows, so this reads the
      // most recent page of visits (ordered by time). Previously it had no
      // ORDER BY and no limit, so it counted distinct visitors over an
      // arbitrary 1000-row page of the table.
      const { data: uniq } = await supabase
        .from("page_visits")
        .select("visitor_id")
        .order("viewed_at", { ascending: false })
        .limit(1000);
      if (uniq) {
        uniqueVisitors = new Set(uniq.map((r) => r.visitor_id)).size;
      }

      // Daily stats (last 14 days)
      const { data: daily } = await supabase
        .from("page_visits")
        .select("visitor_id, viewed_at")
        .gte("viewed_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .order("viewed_at", { ascending: false })
        .limit(1000);

      if (daily) {
        const dayMap = new Map<string, { visits: number; visitors: Set<string> }>();
        for (const row of daily) {
          const d = row.viewed_at.slice(0, 10);
          if (!dayMap.has(d)) {
            dayMap.set(d, { visits: 0, visitors: new Set() });
          }
          const entry = dayMap.get(d)!;
          entry.visits++;
          entry.visitors.add(row.visitor_id);
        }
        dailyStats = Array.from(dayMap.entries())
          .map(([date, info]) => ({
            date,
            visits: info.visits,
            uniqueVisitors: info.visitors.size,
          }))
          .sort((a, b) => b.date.localeCompare(a.date));
      }

      // Top stories by unique visitors.
      // The 10000 limit was above the API's 1000-row response cap, so it
      // never applied — the query silently read 1000 rows. It is now
      // explicit and ordered, so the sample is the most recent visits.
      const { data: top } = await supabase
        .from("page_visits")
        .select("slug, visitor_id, viewed_at")
        .order("viewed_at", { ascending: false })
        .limit(1000);

      if (top) {
        const slugMap = new Map<string, { visits: number; visitors: Set<string> }>();
        for (const row of top) {
          if (!slugMap.has(row.slug)) {
            slugMap.set(row.slug, { visits: 0, visitors: new Set() });
          }
          const entry = slugMap.get(row.slug)!;
          entry.visits++;
          entry.visitors.add(row.visitor_id);
        }
        topStories = Array.from(slugMap.entries())
          .map(([slug, info]) => ({
            slug,
            visits: info.visits,
            uniqueVisitors: info.visitors.size,
          }))
          .sort((a, b) => b.uniqueVisitors - a.uniqueVisitors)
          .slice(0, 20);
      }
    } catch {
      // page_visits table doesn't exist yet (run scripts/analytics-supabase.sql)
    }

    return NextResponse.json({
      totalUsers: canSeeUserStats ? totalUsers : undefined,
      activeToday: canSeeUserStats ? activeToday : undefined,
      active7d: canSeeUserStats ? active7d : undefined,
      totalVisits,
      uniqueVisitors,
      dailyStats,
      topStories,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}