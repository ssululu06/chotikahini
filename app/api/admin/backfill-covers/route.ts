import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCoverPool, isCoverAvailable, getUnusedCover } from "@/lib/cover";

export const dynamic = "force-dynamic";

// POST /api/admin/backfill-covers
// Re-assigns covers to every story whose stored cover points to a missing
// file. Uses the "unused first" strategy so every picture is used once
// before any repeats. Admin/superadmin only.
export async function POST() {
  try {
    const session = await getSession();
    if (!session || !hasPermission(session.role, "content.edit")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const pool = getCoverPool();
    if (pool.files.length === 0) {
      return NextResponse.json({ success: false, error: "cover_pic ফোল্ডার খালি।" }, { status: 400 });
    }

    const { data: stories } = await supabase
      .from("stories")
      .select("uid, slug, title, cover")
      .limit(5000);

    if (!stories || stories.length === 0) {
      return NextResponse.json({ success: true, updated: 0, total: 0 });
    }

    let toUpdate = 0;
    for (const story of stories as any[]) {
      if (!isCoverAvailable(story.cover)) {
        const newCover = await getUnusedCover(supabase);
        if (!newCover) break;

        await supabase
          .from("stories")
          .update({ cover: newCover, updated_at: new Date().toISOString() })
          .or(`uid.eq.${story.uid},slug.eq.${story.slug}`);

        toUpdate++;
      }
    }

    return NextResponse.json({
      success: true,
      updated: toUpdate,
      total: stories.length,
      message: `${toUpdate}টি গল্পের কভার নতুন করে assigned হয়েছে (প্রতিটি pic একবার)।`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
