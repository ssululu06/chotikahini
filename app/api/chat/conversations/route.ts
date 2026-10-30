import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    
    // Fetch conversations where user is user1 or user2
    const { data: conversations, error } = await supabase
      .from("conversations")
      .select(`
        id,
        last_message,
        last_message_at,
        user1_id,
        user2_id,
        user1:users!user1_id(id, name, username, profile_pic),
        user2:users!user2_id(id, name, username, profile_pic)
      `)
      .or(`user1_id.eq.${session.id},user2_id.eq.${session.id}`)
      .order("last_message_at", { ascending: false });

    if (error) throw error;

    const formatted = (conversations || []).map((conv: any) => {
      const isUser1 = conv.user1_id === session.id;
      const otherUserId = isUser1 ? conv.user2_id : conv.user1_id;
      const otherUserRaw = isUser1 ? conv.user2 : conv.user1;
      const otherUserObj: any = Array.isArray(otherUserRaw) ? otherUserRaw[0] : otherUserRaw;
      
      return {
        id: conv.id,
        otherUser: {
          id: otherUserObj?.id || otherUserId,
          name: otherUserObj?.name || otherUserObj?.username || otherUserId,
          username: otherUserObj?.username || otherUserId,
          profilePic: otherUserObj?.profile_pic || null,
        },
        lastMessage: conv.last_message,
        lastMessageAt: conv.last_message_at
      };
    });

    return NextResponse.json({ conversations: formatted });
  } catch (error) {
    console.error("Failed to fetch conversations", error);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}
