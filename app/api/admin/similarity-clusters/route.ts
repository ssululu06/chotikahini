import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabase";
import { preprocessForSimilarity, scorePreprocessed } from "@/lib/similarity";

export const dynamic = "force-dynamic";

// Module cache: recompute every 10 minutes (O(n²) scan).
let cache: { at: number; data: any } | null = null;
const CACHE_TTL = 10 * 60 * 1000;

const CLUSTER_THRESHOLD = 0.45; // 45%+ similarity = possible duplicate cluster

// Union-Find for grouping connected similar stories
class UnionFind {
  parent: number[] = [];
  constructor(n: number) { for (let i = 0; i < n; i++) this.parent[i] = i; }
  find(x: number): number {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }
  union(a: number, b: number) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

// GET /api/admin/similarity-clusters
// Groups mutually-similar stories into clusters and recommends which to keep.
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !hasPermission(session.role, "story.review")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (cache && Date.now() - cache.at < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    const supabase = getSupabaseAdmin();
    const { data: stories } = await supabase
      .from("stories")
      .select("uid, slug, title, content, author_id, status, published_at, created_at")
      .limit(5000);

    if (!stories || stories.length < 2) {
      const empty = { clusters: [] };
      return NextResponse.json(empty);
    }

    const prepared = (stories as any[]).map((s) => ({
      uid: s.uid, slug: s.slug, title: s.title, status: s.status,
      publishedAt: s.published_at || s.created_at || "",
      content: s.content || "",
      text: preprocessForSimilarity(s.content || ""),
    }));

    const uf = new UnionFind(prepared.length);

    // Build adjacency: connect stories whose similarity >= threshold
    for (let i = 0; i < prepared.length; i++) {
      const a = prepared[i];
      if (a.text.bigramSet.size < 10) continue;
      for (let j = i + 1; j < prepared.length; j++) {
        const b = prepared[j];
        if (b.text.bigramSet.size < 10) continue;
        if (scorePreprocessed(a.text, b.text) >= CLUSTER_THRESHOLD) {
          uf.union(i, j);
        }
      }
    }

    // Group by root
    const groups = new Map<number, number[]>();
    for (let i = 0; i < prepared.length; i++) {
      const root = uf.find(i);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root)!.push(i);
    }

    // Build clusters (only groups with >= 2 members)
    const clusters: any[] = [];

    for (const members of groups.values()) {
      if (members.length < 2) continue;

      // For each pair in the cluster, compute their score
      const items = members.map((idx) => {
        const s = prepared[idx];
        return {
          uid: s.uid, slug: s.slug, title: s.title, status: s.status,
          publishedAt: s.publishedAt, wordCount: s.content.trim() ? s.content.trim().split(/\s+/).length : 0,
        };
      });

      // Recommendation: keep the one with the most content (most complete),
      // prefer published over pending, then earliest published.
      const sorted = [...items].sort((x, y) => {
        const statusOrder = (st: string) => (st === "published" ? 0 : 1);
        if (statusOrder(x.status) !== statusOrder(y.status)) return statusOrder(x.status) - statusOrder(y.status);
        if (y.wordCount !== x.wordCount) return y.wordCount - x.wordCount;
        return new Date(x.publishedAt).getTime() - new Date(y.publishedAt).getTime();
      });

      const keepUid = sorted[0].uid || sorted[0].slug;

      // Pairwise similarity between cluster members (top link for display)
      const relations: { from: string; to: string; percent: number }[] = [];
      for (let x = 0; x < members.length; x++) {
        for (let y = x + 1; y < members.length; y++) {
          const score = Math.round(scorePreprocessed(prepared[members[x]].text, prepared[members[y]].text) * 100);
          if (score >= Math.round(CLUSTER_THRESHOLD * 100)) {
            relations.push({
              from: prepared[members[x]].uid || prepared[members[x]].slug,
              to: prepared[members[y]].uid || prepared[members[y]].slug,
              percent: score,
            });
          }
        }
      }

      clusters.push({
        id: `c_${members[0]}`,
        items: items.map((it) => ({ ...it, keep: (it.uid || it.slug) === keepUid })),
        relations,
        maxPercent: relations.reduce((m, r) => Math.max(m, r.percent), 0),
        recommendation: `"${sorted[0].title}" রাখুন — এটি সবচেয়ে সম্পূর্ণ${sorted[0].status === "published" ? " ও প্রকাশিত" : ""}। বাকিগুলো সম্ভাব্য ডুপ্লিকেট।`,
      });
    }

    // Sort clusters by highest similarity first
    clusters.sort((a, b) => b.maxPercent - a.maxPercent);

    const data = { clusters, total: prepared.length };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
