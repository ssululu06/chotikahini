import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/admin/export-stories?format=json|csv — download all stories as backup
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || !hasPermission(session.role, "content.edit")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "json";

    const supabase = getSupabaseAdmin();
    const { data: stories } = await supabase
      .from("stories")
      .select("uid, slug, title, category, description, content, cover, tags, author_id, status, published_at, updated_at, created_at, history, scheduled_at")
      .order("published_at", { ascending: false });

    if (!stories) {
      return NextResponse.json({ error: "কোনো গল্প নেই।" }, { status: 404 });
    }

    if (format === "csv") {
      const header = "uid,slug,title,category,description,cover,tags,author_id,status,published_at";
      const rows = stories.map((s: any) => {
        const esc = (v: any) => `"${String(v || "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
        return [s.uid, s.slug, esc(s.title), s.category, esc(s.description), esc(s.cover), esc(Array.isArray(s.tags) ? s.tags.join(",") : s.tags), s.author_id, s.status, s.published_at].join(",");
      });
      const csv = [header, ...rows].join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="stories-backup-${Date.now()}.csv"`,
        },
      });
    }

    // JSON export (default)
    return NextResponse.json({ exportedAt: new Date().toISOString(), count: stories.length, stories });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
