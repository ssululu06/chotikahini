import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    if (!slug) {
      return NextResponse.json({ error: "Slug required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Join with users for live username/name (no denormalized copies)
    const { data: likes, error } = await supabase
      .from("post_likes")
      .select(`
        id, post_slug, post_id, user_id, created_at,
        users:user_id ( username, name )
      `)
      .eq("post_slug", slug);

    if (error) throw error;

    const mappedLikes = (likes || []).map((l: any) => ({
      id: l.id,
      slug: l.post_slug,
      postId: l.post_id,
      userId: l.user_id,
      username: l.users?.username,
      name: l.users?.name,
      createdAt: l.created_at
    }));

    return NextResponse.json({ likes: mappedLikes, count: mappedLikes.length });
  } catch (error) {
    console.error("Failed to fetch likes", error);
    return NextResponse.json({ likes: [], count: 0 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, action } = await req.json();
    if (!slug || !["like", "unlike"].includes(action)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Resolve post_id for FK normalization
    const { data: postMeta } = await supabase
      .from("post_metadata")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (action === "like") {
      const { error: insertError } = await supabase
        .from("post_likes")
        .upsert(
          {
            post_slug: slug,
            post_id: postMeta?.id || null,
            user_id: session.id
            // No username/name duplication — use users FK
          },
          { onConflict: 'post_slug,user_id' }
        );
      if (insertError) throw insertError;

      // Notify the post author
      if (postMeta?.id) {
        const { data: pm } = await supabase
          .from("post_metadata")
          .select("author_id")
          .eq("id", postMeta.id)
          .maybeSingle();
        if (pm?.author_id && pm.author_id !== session.id) {
          const notifInsert = supabase.from("notifications").insert({
            id: "notif_" + Math.random().toString(36).substring(2, 9),
            user_id: pm.author_id,
            type: "like",
            actor_id: session.id,
            post_slug: slug,
            post_id: postMeta.id,
            is_read: false,
          });
          notifInsert.then(({ error: e }) => { if (e) console.error("Like notification error:", e); });
        }
      }
    } else if (action === "unlike") {
      const { error: deleteError } = await supabase
        .from("post_likes")
        .delete()
        .match({ post_slug: slug, user_id: session.id });
      if (deleteError) throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Like action failed", error);
    return NextResponse.json({ error: "Failed to process like action" }, { status: 500 });
  }
}
