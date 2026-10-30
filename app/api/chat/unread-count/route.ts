import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ unread: 0 });

    const supabase = getSupabaseAdmin();
    
    const { count, error } = await supabase
      .from("private_messages")
      .select("*", { count: 'exact', head: true })
      .eq("receiver_id", session.id)
      .eq("is_read", false);

    if (error) throw error;

    return NextResponse.json({ unread: count || 0 });
  } catch (error) {
    console.error("Failed to fetch unread count", error);
    return NextResponse.json({ unread: 0 });
  }
}
