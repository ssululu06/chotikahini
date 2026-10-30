import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getAllPostsAsync } from "@/lib/posts";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  aggregateEngagement,
  buildCandidatesFromPosts,
  rankSuggestionCandidates,
} from "@/lib/share-suggestions";
import { cachedRead } from "@/lib/cache";
import { getPostViewsBySlug } from "@/lib/views";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_SUGGESTIONS_PER_DAY = 4;
const COOLDOWN_DAYS = 2;

function isMissingTable(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function dateOnly(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

interface DailyRow {
  id: string;
  actor_id: string;
  served_on: string;
  served_count: number;
  served_slugs: string[];
}

/** Row shapes returned by the cached read-only fan-out. */
type SnapshotMetadata = { id: string; slug: string };
type SnapshotViewRow = { post_slug: string | null; view_count: number | null };
type SnapshotEngagementRow = { post_slug?: string | null; post_id?: string | null };
type SnapshotLogRow = { post_slug: string | null; served_on: string | null };

/**
 * GET /api/admin/share-suggestions
 *
 * Returns the top MAX_SUGGESTIONS_PER_DAY "opportunity" stories an
 * admin should consider sharing. Ranking uses five weighted signals
 * (underperformance / engagement / freshness / quality / diversity)
 * with a cooldown against recently-shown stories.
 *
 * Per-actor daily cap: once an admin has already been served
 * MAX_SUGGESTIONS_PER_DAY stories today, the route re-plays the same
 * set so refresh / other tabs see the same picks.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !hasPermission(session.role, "analytics.view")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const today = dateOnly();

// 1a. Served-history is read OUTSIDE the cache on purpose.
    //
    //     `share_suggestion_log` is the cooldown source of truth: it is
    //     written the moment a suggestion is served. If it were read
    //     through `cachedRead`, the ranking would keep re-serving the
    //     same stories for up to 2 minutes after the log write, which
    //     defeats the whole cooldown. One extra small query is cheaper
    //     than showing the admin the same 3 stories every refresh.
    const logResult = await supabase
      .from("share_suggestion_log")
      .select("post_slug, served_on")
      .order("served_on", { ascending: false })
      .limit(2000);
    const logError = !!logResult.error;
    const logRaw = (logResult.data || []) as SnapshotLogRow[];

    // 2. Pull posts + view counts + engagement counters in parallel.
    //
    //    The read-only fan-out is cached for 2 minutes: the dashboard
    //    polls this route, and the ranking inputs (views / likes /
    //    comments) only need to be fresh-ish, not real-time. Writes
    //    that change a story's views or likes still land within the
    //    window. Served-history is deliberately NOT cached — see above.
    const readSnapshot = cachedRead<
      [],
      {
        metadata: SnapshotMetadata[];
        legacy: SnapshotViewRow[];
        likes: SnapshotEngagementRow[];
        comments: SnapshotEngagementRow[];
        legacyError: boolean;
      }
    >(
      "share-suggestions-snapshot",
      async () => {
        const [
          metadataResult,
          legacyResult,
          likesResult,
          commentsResult,
          logResult,
        ] = await Promise.all([
          supabase.from("post_metadata").select("id, slug"),
          supabase.from("post_views").select("post_slug, view_count"),
          supabase.from("post_likes").select("post_slug, post_id"),
          supabase.from("comments").select("post_slug, post_id"),
          supabase
            .from("share_suggestion_log")
            .select("post_slug, served_on")
            .order("served_on", { ascending: false })
            .limit(2000),
        ]);

        if (metadataResult.error && !isMissingTable(metadataResult.error)) {
          throw metadataResult.error;
        }
        if (legacyResult.error && !isMissingTable(legacyResult.error)) {
          throw legacyResult.error;
        }
        if (likesResult.error && !isMissingTable(likesResult.error)) {
          throw likesResult.error;
        }
        if (commentsResult.error && !isMissingTable(commentsResult.error)) {
          throw commentsResult.error;
        }

        return {
          metadata: (metadataResult.data || []) as SnapshotMetadata[],
          legacy: (legacyResult.data || []) as SnapshotViewRow[],
          likes: (likesResult.data || []) as SnapshotEngagementRow[],
          comments: (commentsResult.data || []) as SnapshotEngagementRow[],
          log: (logResult.data || []) as SnapshotLogRow[],
          logError: !!logResult.error,
          legacyError: !!legacyResult.error,
        };
      },
      { revalidate: 120 },
    );

    const [posts, snapshot] = await Promise.all([
      getAllPostsAsync({ includeFuture: false, includePending: false }),
      readSnapshot(),
    ]);
    const {
      metadata,
      legacy: legacyCountsRaw,
      likes: likesRaw,
      comments: commentsRaw,
      legacyError,
    } = snapshot;

    const hasLogTable = !logError;
    if (!hasLogTable) {
      console.warn(
        "[share-suggestions] share_suggestion_log missing — run scripts/share-suggestions.sql",
      );
    }

    const idBySlug = new Map<string, string>(
      metadata.map((row) => [row.slug, row.id]),
    );

    // 2. View counts come from the centralized helper that uses the
    //    same precedence as the public reader (post_view_counts for
    //    posts that have a metadata id, post_views otherwise). A single
    //    shared helper guarantees the admin panel and the reader see
    //    the *same* number for the *same* post — no drift, no double-
    //    count when both tables have a row.
    const postRefs = posts
      .filter((p) => p.slug)
      .map((p) => ({ id: idBySlug.get(p.slug) ?? null, slug: p.slug }));
    const viewsBySlug = await getPostViewsBySlug(postRefs);
    const viewBySlug = new Map<string, number>();
    let normalizedRows = 0;
    let legacyRows = 0;
    let missingRows = 0;
    for (const [slug, info] of viewsBySlug.entries()) {
      viewBySlug.set(slug, info.views);
      if (info.source === "post_view_counts") normalizedRows++;
      else if (info.source === "post_views") legacyRows++;
      else missingRows++;
    }

    // 3. Build engagement lookup (likes + comments).
    const engagement = aggregateEngagement(
      likesRaw.map((r) => ({
        post_slug: r.post_slug ?? undefined,
        post_id: r.post_id ?? undefined,
      })),
      commentsRaw.map((r) => ({
        post_slug: r.post_slug ?? undefined,
        post_id: r.post_id ?? undefined,
      })),
      metadata,
    );

    // 4. Build cooldown lookup from the log table.
    const servedDatesBySlug = new Map<string, string[]>();
    if (hasLogTable) {
      for (const row of logRaw) {
        if (!row.post_slug || !row.served_on) continue;
        const list = servedDatesBySlug.get(row.post_slug) || [];
        list.push(row.served_on);
        servedDatesBySlug.set(row.post_slug, list);
      }
    }

    // 5. Shape candidates + rank.
    const candidates = buildCandidatesFromPosts(
      posts,
      viewBySlug,
      engagement.bySlug,
      servedDatesBySlug,
    );

    const ranked = rankSuggestionCandidates(candidates, {
      limit: MAX_SUGGESTIONS_PER_DAY,
      cooldownDays: COOLDOWN_DAYS,
    });

    // DEBUG: expose where the funnel empties so the empty-state is diagnosable.
    const funnel = {
      postsFetched: posts.length,
      postsWithSlug: posts.filter((p) => p.slug).length,
      candidates: candidates.length,
      ranked: ranked.length,
      metadataRows: metadata.length,
viewRows: normalizedRows + legacyRows,
      viewSource: {
        postViewCounts: normalizedRows,
        postViews: legacyRows,
        missing: missingRows,
      },
      logTableAvailable: hasLogTable,
    };

    // 6. Per-actor daily cap — same set for the rest of the day.
    const { data: dailyRows } = hasLogTable
      ? await supabase
          .from("share_suggestion_daily")
          .select("*")
          .eq("actor_id", session.id)
          .eq("served_on", today)
      : { data: [] as DailyRow[] };

    const todaysRow = (dailyRows?.[0] as DailyRow | undefined) || null;
    const alreadyServedSlugs = new Set(todaysRow?.served_slugs || []);
    const servedSoFar = todaysRow?.served_count || 0;
    let output: typeof ranked = ranked;
    let capActive = false;
    if (todaysRow) {
      // The admin has already been served MAX_SUGGESTIONS_PER_DAY
      // stories today. We *still* show them the day's top picks so the
      // panel isn't an empty box, but flag `capActive = true` so the UI
      // knows the daily cap has been reached and disables "Mark as
      // shared".
      capActive = servedSoFar >= MAX_SUGGESTIONS_PER_DAY;
      output = ranked.slice(0, MAX_SUGGESTIONS_PER_DAY);
    }

    // 7. Persist today's served set + log entries (cooldown source).
    //    Only when the cap has not been hit yet — otherwise we'd
    //    re-log the same picks, blow past MAX_SUGGESTIONS_PER_DAY, and
    //    kick off the cooldown clock for stories that weren't actually
    //    *new* for the day.
    const freshNow = capActive
      ? []
      : output
          .map((s) => s.slug)
          .filter((slug) => !alreadyServedSlugs.has(slug));

    if (freshNow.length > 0 && hasLogTable) {
      try {
        await supabase.from("share_suggestion_log").insert(
          output.map((s) => ({
            post_slug: s.slug,
            post_uid: s.uid || null,
            story_title: s.title,
            actor_id: session.id,
            score: Math.round(s.score * 1000) / 1000,
            served_on: today,
          })),
        );

        if (todaysRow) {
          await supabase
            .from("share_suggestion_daily")
            .update({
              served_count: servedSoFar + freshNow.length,
              served_slugs: [...alreadyServedSlugs, ...freshNow],
            })
            .eq("id", todaysRow.id);
        } else {
          await supabase.from("share_suggestion_daily").insert({
            actor_id: session.id,
            served_on: today,
            served_count: output.length,
            served_slugs: output.map((s) => s.slug),
          });
        }
      } catch (logErr) {
        console.warn("[share-suggestions] log insert failed:", logErr);
      }
    }

    const totalAfter = todaysRow
      ? Math.min(MAX_SUGGESTIONS_PER_DAY, servedSoFar + output.length)
      : output.length;

    return NextResponse.json(
      {
        suggestions: output,
        meta: {
          limit: MAX_SUGGESTIONS_PER_DAY,
          cooldownDays: COOLDOWN_DAYS,
          today,
          servedToday: totalAfter,
          remainingToday: Math.max(
            0,
            MAX_SUGGESTIONS_PER_DAY - totalAfter,
          ),
          capActive,
          logTableAvailable: hasLogTable,
          funnel,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("GET admin share suggestions error:", error);
    return NextResponse.json(
      { error: "Failed to load story share suggestions" },
      { status: 500 },
    );
  }
}