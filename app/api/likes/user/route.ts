import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: likes, error } = await supabase
      .from("post_likes")
      .select("post_slug")
      .eq("user_id", session.id);

    if (error) throw error;
    
    // Get unique slugs liked by this user
    const uniqueSlugs = [...new Set((likes || []).map((l: any) => l.post_slug))];
    
    const posts = uniqueSlugs.map(slug => ({ slug }));
    
    return NextResponse.json({ posts });
  } catch (error) {
    console.error("Failed to fetch user likes", error);
    return NextResponse.json({ posts: [] });
  }
}
