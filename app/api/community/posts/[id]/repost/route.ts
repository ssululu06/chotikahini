import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "লগইন করুন" }, { status: 401 });

    const postId = Number(params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: post } = await supabase
      .from("posts")
      .select("id, user_id, reposts_count")
      .eq("id", postId)
      .maybeSingle();

    if (!post) return NextResponse.json({ error: "পোস্টটি পাওয়া যায়নি" }, { status: 404 });

    const { data: existing } = await supabase
      .from("posts_reposts")
      .select("post_id")
      .eq("post_id", postId)
      .eq("user_id", session.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("posts_reposts").delete().eq("post_id", postId).eq("user_id", session.id);
      await supabase.from("posts").update({ reposts_count: Math.max(0, (post.reposts_count || 0) - 1) }).eq("id", postId);
      return NextResponse.json({ success: true, reposted: false, repostsCount: Math.max(0, (post.reposts_count || 0) - 1) });
    }

    await supabase.from("posts_reposts").insert({ post_id: postId, user_id: session.id });
    await supabase.from("posts").update({ reposts_count: (post.reposts_count || 0) + 1 }).eq("id", postId);

    return NextResponse.json({ success: true, reposted: true, repostsCount: (post.reposts_count || 0) + 1 });
  } catch (error: any) {
    console.error("POST /api/community/posts/[id]/repost error:", error);
    return NextResponse.json({ error: "অপারেশন ব্যর্থ" }, { status: 500 });
  }
}