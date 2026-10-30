import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getActiveVisitorsCount } from "@/lib/active-visitors";

export async function GET() {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "analytics.view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const canSeeUserStats = hasPermission(session.role, "users.view");

  try {
    const supabase = getSupabaseAdmin();

    // 1. Total Registered Users
    const { data: users } = await supabase
      .from("users")
      .select("id, role, created_at, last_seen_at");

    const totalUsers = users?.length || 0;
    const rolesCount = {
      superadmin: 0,
      admin: 0,
      author: 0,
      user: 0,
    };

    let dbActiveCount = 0;
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    if (users) {
      for (const u of users) {
        const role = (u.role || "user") as keyof typeof rolesCount;
        if (rolesCount[role] !== undefined) {
          rolesCount[role]++;
        } else {
          rolesCount.user++;
        }

        if (u.last_seen_at && u.last_seen_at >= fiveMinsAgo) {
          dbActiveCount++;
        }
      }
    }

    // Combine in-memory heartbeat + DB last_seen_at
    const activeOnlineUsers = Math.max(getActiveVisitorsCount(), dbActiveCount, 1);

    // 2. Reading History & Unique Visitors
    const { data: history } = await supabase
      .from("reading_history")
      .select("user_id, last_read_at");

    const uniqueUserIds = new Set<string>();
    let todayVisitorsCount = 0;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (history) {
      for (const h of history) {
        if (h.user_id) uniqueUserIds.add(h.user_id);
        if (h.last_read_at && new Date(h.last_read_at) >= todayStart) {
          todayVisitorsCount++;
        }
      }
    }

    // 3. Total Page Views (legacy post_views, used as fallback)
    const { data: views } = await supabase
      .from("post_views")
      .select("view_count, updated_at");

    let todayViewsCount = 0;

    if (views) {
      for (const v of views) {
        if (v.updated_at && new Date(v.updated_at) >= todayStart) {
          todayViewsCount += v.view_count || 0;
        }
      }
    }

    // 4. Real analytics from page_visits table (if migration has been run)
    let realVisits = 0;
    let realDailyCount = 0;
    let realUniqueVisitors = 0;
    try {
      const { count: totalV } = await supabase
        .from("page_visits")
        .select("*", { count: "exact", head: true });
      realVisits = totalV || 0;

      const { count: todayV } = await supabase
        .from("page_visits")
        .select("*", { count: "exact", head: true })
        .gte("viewed_at", todayStart.toISOString());
      realDailyCount = todayV || 0;

      // Unique visitors. The PostgREST API caps a single response at 1000
      // rows, so this reads the most recent window (ordered by viewed_at)
      // rather than the whole table. The previous version had no ORDER BY
      // and no limit, which made it read an arbitrary 1000-row page — the
      // number it produced was already an undercount.
      const { data: visitorRows } = await supabase
        .from("page_visits")
        .select("visitor_id")
        .order("viewed_at", { ascending: false })
        .limit(1000);
      if (visitorRows) {
        realUniqueVisitors = new Set(visitorRows.map((r) => r.visitor_id)).size;
      }
    } catch {
      // page_visits table doesn't exist yet — fall back to estimates below
    }

    // Prefer real tracked data; fall back to historical estimates otherwise
    const totalPageViews = realVisits > 0 ? realVisits : (views || []).reduce((sum, v) => sum + (v.view_count || 0), 0);
    const uniqueVisitorsCount = realUniqueVisitors > 0 ? realUniqueVisitors : Math.max(uniqueUserIds.size, Math.round(totalPageViews * 0.65));
    const dailyCount = realDailyCount > 0 ? realDailyCount : Math.max(todayVisitorsCount, todayViewsCount, Math.round(activeOnlineUsers * 3.5));

    // Total stories (by status) — for the dashboard overview card
    let totalStories = 0;
    let publishedStories = 0;
    let pendingStories = 0;
    let scheduledStories = 0;
    const nowIso = new Date().toISOString();
    try {
      // `history` is only needed to tell crawled / auto-posted stories apart
      // from author-submitted pending ones. Published and scheduled stories
      // do not need it, so it is fetched only for the pending rows.
      const { count: storyCount } = await supabase
        .from("stories")
        .select("*", { count: "exact", head: true });
      totalStories = storyCount || 0;

      const { data: statusRows } = await supabase
        .from("stories")
        .select("uid, status, published_at, scheduled_at")
        .limit(1000);
      const { data: pendingRows } = await supabase
        .from("stories")
        .select("uid, history")
        .eq("status", "pending")
        .limit(1000);

      // Per-story flag, so one crawled story does not suppress the rest.
      const crawledUids = new Set<string>();
      for (const r of pendingRows || []) {
        const h = (r as any).history;
        if (Array.isArray(h) && h.some((e: any) => e.event === "crawled" || e.event === "auto_posted")) {
          if (r.uid) crawledUids.add(r.uid);
        }
      }

      if (statusRows) {
        for (const r of statusRows) {
          const st = r.status || "published";
          const isFuture = (r.published_at && new Date(r.published_at) > new Date(nowIso)) || (r.scheduled_at && new Date(r.scheduled_at) > new Date(nowIso));
          // Crawled/auto-posted stories are reviewed ONLY in the Auto-Post
          // section — keep them out of the author-review pending counter.
          const isCrawled = st === "pending" && !!r.uid && crawledUids.has(r.uid);
          if (isFuture) {
            scheduledStories++;
          } else if (st === "published") {
            publishedStories++;
          } else if (st === "pending" && !isCrawled) {
            pendingStories++;
          }
        }
      }
    } catch {}

    return NextResponse.json({
      totalUsers: canSeeUserStats ? totalUsers : undefined,
      rolesCount: canSeeUserStats ? rolesCount : undefined,
      activeOnlineUsers,
      dailyCount,
      uniqueVisitorsCount,
      totalPageViews,
      totalStories,
      publishedStories,
      pendingStories,
      scheduledStories,
    });
  } catch (error) {
    console.error("Failed to fetch admin stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
