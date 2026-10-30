import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/users/profile?ref=username-or-id
// Returns public profile info for the hover card (no sensitive data).
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ref = url.searchParams.get("ref") || url.searchParams.get("userId") || url.searchParams.get("username") || "";
    if (!ref) return NextResponse.json({ error: "ref required" }, { status: 400 });

    const supabase = getSupabaseAdmin();

    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, name, profile_pic, bio, role, is_verified")
      .or(`id.eq.${ref},username.ilike.${ref}`)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Published story count
    let storyCount = 0;
    try {
      const { count } = await supabase
        .from("stories")
        .select("uid", { count: "exact", head: true })
        .eq("author_id", user.id)
        .eq("status", "published");
      storyCount = count || 0;
    } catch (e) {}

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name || user.username,
        profilePic: user.profile_pic || "/images/avatars/1.jpg",
        bio: user.bio || "",
        role: user.role || "user",
        isVerified: user.is_verified === true,
        storyCount,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
