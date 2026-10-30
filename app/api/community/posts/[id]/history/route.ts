import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { isAdminOrAbove } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "লগইন করুন" }, { status: 401 });

    // Edit history is visible to admins only
    if (!isAdminOrAbove(session.role)) {
      return NextResponse.json({ error: "অনুমতি নেই" }, { status: 403 });
    }

    const postId = Number(params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Current version (so the diff has a reference point)
    const { data: current } = await supabase
      .from("posts")
      .select("content, updated_at")
      .eq("id", postId)
      .maybeSingle();

    const { data: history, error } = await supabase
      .from("posts_history")
      .select(`
        id, post_id, content, edited_by, created_at,
        users:edited_by ( id, username, name )
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      current: current ? { content: current.content, updatedAt: current.updated_at } : null,
      history: (history || []).map((h: any) => {
        const u = Array.isArray(h.users) ? h.users[0] : h.users;
        return {
          id: h.id,
          postId: h.post_id,
          content: h.content,
          editedBy: h.edited_by,
          editedByName: u?.name || u?.username || "",
          editedByUsername: u?.username || "",
          createdAt: h.created_at,
        };
      }),
    });
  } catch (error: any) {
    console.error("GET /api/community/posts/[id]/history error:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}