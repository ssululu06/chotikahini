import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const query = url.searchParams.get("q") || "";
    
    if (query.trim().length < 2) {
      return NextResponse.json({ users: [] });
    }

    const supabase = getSupabaseAdmin();
    
    // Search users by id, username, or name
    const { data: users, error } = await supabase
      .from("users")
      .select("id, name, username, profile_pic")
      .or(`id.eq.${query},username.eq.${query},name.ilike.%${query}%,username.ilike.%${query}%`)
      .neq("id", session.id) // exclude current user
      .limit(10);

    if (error) throw error;

    return NextResponse.json({ users: users || [] });
  } catch (error) {
    console.error("Failed to search users", error);
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}
