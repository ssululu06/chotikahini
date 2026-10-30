import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const storyUid = url.searchParams.get("storyUid");

    const supabase = getSupabaseAdmin();
    const isAdmin = ["admin", "superadmin"].includes(session.role || "");

    let storyQuery = supabase
      .from("stories")
      .select("uid, slug, title, status, published_at, author_id");
    if (storyUid) {
      // IDOR protection: non-admin may only view analytics for their OWN story
      if (!isAdmin) {
        storyQuery = storyQuery
          .or(`uid.eq.${storyUid},slug.eq.${storyUid}`)
          .eq("author_id", session.id);
      } else {
        storyQuery = storyQuery.or(`uid.eq.${storyUid},slug.eq.${storyUid}`);
      }
    } else if (!isAdmin) {
      storyQuery = storyQuery.eq("author_id", session.id);
    }

    const { data: stories, error } = await storyQuery.order("published_at", { ascending: false });
    if (error || !stories?.length) {
      return NextResponse.json({ analytics: [] });
    }

    const refs = [...new Set(stories.flatMap((s: any) => [s.slug, s.uid].filter(Boolean)))];

    const safe = async (p: any): Promise<any[]> => {
      try {
        const r = await p;
        return Array.isArray(r?.data) ? r.data : [];
      } catch {
        return [];
      }
    };

    const [viewsRes, likesRes, commentsRes, progressRes] = await Promise.all([
      safe(supabase.from("post_views").select("post_slug, view_count").in("post_slug", refs)),
      safe(supabase.from("post_likes").select("post_slug").in("post_slug", refs)),
      safe(supabase.from("comments").select("post_slug").eq("status", "approved").in("post_slug", refs)),
      safe(supabase.from("story_progress").select("post_slug, percent").in("post_slug", refs)),
    ]);

    const viewsMap = new Map((viewsRes as any[]).map((v: any) => [v.post_slug, v.view_count || 0]));
    const likesMap = new Map<string, number>();
    (likesRes as any[]).forEach((l: any) => likesMap.set(l.post_slug, (likesMap.get(l.post_slug) || 0) + 1));
    const commentsMap = new Map<string, number>();
    (commentsRes as any[]).forEach((c: any) => commentsMap.set(c.post_slug, (commentsMap.get(c.post_slug) || 0) + 1));

    // Avg completion per story
    const progressBuckets = new Map<string, number[]>();
    (progressRes as any[]).forEach((p: any) => {
      if (!progressBuckets.has(p.post_slug)) progressBuckets.set(p.post_slug, []);
      progressBuckets.get(p.post_slug)!.push(p.percent || 0);
    });

    const analytics = stories.map((s: any) => {
      const storyRefs = [s.slug, s.uid].filter(Boolean);
      const views = storyRefs.reduce((sum: number, ref: string) => sum + (viewsMap.get(ref) || 0), 0);
      const likes = storyRefs.reduce((sum: number, ref: string) => sum + (likesMap.get(ref) || 0), 0);
      const comments = storyRefs.reduce((sum: number, ref: string) => sum + (commentsMap.get(ref) || 0), 0);
      const allPcts = storyRefs.flatMap((ref: string) => progressBuckets.get(ref) || []);
      const avgCompletion = allPcts.length > 0 ? Math.round(allPcts.reduce((a: number, b: number) => a + b, 0) / allPcts.length) : 0;

      return {
        uid: s.uid, slug: s.slug, title: s.title, status: s.status, publishedAt: s.published_at,
        views, likes, comments, avgCompletion, uniqueReaders: allPcts.length,
      };
    });

    return NextResponse.json({ analytics });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}