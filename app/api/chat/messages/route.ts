import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = 'force-dynamic';
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

/**
 * Read the group chat feed through the service role key.
 * The anon browser client cannot read `chat_messages` reliably (RLS has no
 * guaranteed public SELECT policy), so the client calls this instead of
 * hitting Supabase directly. Profile fields are joined in from `users`.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requestedLimit = Number(url.searchParams.get("limit"));
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
    const beforeCreatedAt = url.searchParams.get("before");
    const beforeId = url.searchParams.get("beforeId");

    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (beforeCreatedAt && beforeId) {
      query = query.or(
        `created_at.lt.${beforeCreatedAt},and(created_at.eq.${beforeCreatedAt},id.lt.${beforeId})`,
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("[chat] read error:", error.message);
      return NextResponse.json({ messages: [], error: error.message }, { status: 200 });
    }

    const fetchedRows = (data || []) as any[];
    const hasMore = fetchedRows.length > limit;
    const rows = fetchedRows.slice(0, limit);
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
    let profileById = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("id, username, name, profile_pic, role")
        .in("id", userIds);
      profileById = new Map((users || []).map((u: any) => [u.id, u]));
    }

    const messages = rows.map((r) => {
      const u = profileById.get(r.user_id);
      return {
        ...r,
        username: r.username ?? u?.username ?? "unknown",
        name: r.name ?? u?.name ?? u?.username ?? "unknown",
        profile_pic: r.profile_pic ?? u?.profile_pic ?? null,
        role: r.role ?? u?.role ?? "user",
      };
    });

    return NextResponse.json({ messages, hasMore });
  } catch (error) {
    console.error("[chat] GET error:", (error as Error).message);
    return NextResponse.json({ messages: [] }, { status: 200 });
  }
}

// In-memory rate limiting store (Simple sliding window for a single Vercel instance)
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_MESSAGES_PER_WINDOW = 10;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitStore.get(userId) || [];
  
  // Filter out timestamps older than the window
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  
  if (recent.length >= MAX_MESSAGES_PER_WINDOW) {
    return false;
  }
  
  recent.push(now);
  rateLimitStore.set(userId, recent);
  return true;
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "চ্যাট করতে লগইন করুন।" }, { status: 401 });
    }

    const { message } = await req.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "মেসেজ ফাঁকা রাখা যাবে না।" }, { status: 400 });
    }

    const trimmedMsg = message.trim();
    if (trimmedMsg.length > 1000) {
      return NextResponse.json({ error: "মেসেজ অনেক বড় (সর্বোচ্চ ১০০০ অক্ষর)।" }, { status: 400 });
    }

    if (!checkRateLimit(session.id)) {
      return NextResponse.json({ error: "অনুগ্রহ করে একটু পরে আবার চেষ্টা করুন (স্প্যাম প্রোটেকশন)।" }, { status: 429 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    
    // Check if muted/banned. The `chat_mutes` table is optional and the user may
    // have no row at all, so we must tolerate BOTH a missing table and zero
    // rows. supabase-js never rejects here — it resolves with `{ error }` — so
    // the error field has to be inspected explicitly.
    let muteData: { banned?: boolean | null; muted_until?: string | null } | null = null;
    const muteLookup = await supabaseAdmin
      .from('chat_mutes')
      .select('banned, muted_until')
      .eq('user_id', session.id)
      .limit(1)
      .maybeSingle();
    if (muteLookup.error) {
      // Missing table / column on this deployment — chat still works, the
      // ban list is simply unavailable.
      console.warn('[chat] mute lookup skipped:', muteLookup.error.message);
      muteData = null;
    } else {
      muteData = (muteLookup.data as any) ?? null;
    }

    if (muteData) {
      if (muteData.banned) {
        return NextResponse.json({ error: "আপনি চ্যাট থেকে ব্যান হয়েছেন।" }, { status: 403 });
      }
      if (muteData.muted_until && new Date(muteData.muted_until) > new Date()) {
        return NextResponse.json({ error: "আপনাকে সাময়িকভাবে চ্যাট থেকে মিউট করা হয়েছে।" }, { status: 403 });
      }
    }

    const newMsg = {
      user_id: session.id,
      username: session.username,
      name: session.name || session.username,
      profile_pic: session.profilePic || null,
      message: trimmedMsg,
      role: session.role || "user",
      is_system: false,
    };

    const { data, error } = await supabaseAdmin
      .from("chat_messages")
      .insert([newMsg])
      .select()
      .single();

    if (error) {
      const detail = [
        error.code ? `code=${error.code}` : null,
        error.message ? `message=${error.message}` : null,
        error.hint ? `hint=${error.hint}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      console.error(`[chat] Supabase insert error: ${detail}`);
      return NextResponse.json({
        error: "মেসেজ পাঠানো যায়নি। আবার চেষ্টা করুন।",
        reason: error.message || "unknown",
        code: error.code || null,
      }, { status: 500 });
    }

    // Profile fields come back from chat_messages along with user_id + message.
// Add is_system explicitly (DB default is false but downstream callers want
// the field always present for the UI).
    return NextResponse.json({
      success: true,
      message: { ...data, is_system: data.is_system ?? false },
    });
  } catch (error) {
    console.error("POST message error:", error);
    return NextResponse.json({ error: "মেসেজ পাঠানো যায়নি। আবার চেষ্টা করুন।" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing message ID" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const isAdmin = session.role === "admin" || session.role === "superadmin";

    // First fetch the message to verify ownership
    const { data: msg } = await supabaseAdmin
      .from("chat_messages")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!msg) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (!isAdmin && msg.user_id !== session.id) {
      return NextResponse.json({ error: "You can only delete your own messages" }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("chat_messages")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE message error:", error);
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }
}
