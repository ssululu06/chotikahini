import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/admin/story-coauthors?storyUid=xxx
// Lists the current co-authors for a story so the admin edit modal can
// hydrate its chips without a second round-trip.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.role, "story.edit_any") && !hasPermission(session.role, "authors.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const storyUid = searchParams.get("storyUid");
  if (!storyUid) {
    return NextResponse.json({ error: "storyUid is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("story_coauthors")
    .select("user_id, position")
    .eq("story_uid", storyUid);

  if (error) {
    return NextResponse.json({ coauthors: [] });
  }

  const userIds = (data || []).map((r: any) => r.user_id).filter(Boolean);
  let userMap = new Map<string, any>();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, username, name, profile_pic, is_verified")
      .in("id", userIds);
    for (const u of users || []) userMap.set(u.id, u);
  }

  const coauthors = (data || []).map((r: any) => {
    const u = userMap.get(r.user_id) || {};
    return {
      userId: r.user_id,
      position: r.position ?? 0,
      username: u.username || null,
      name: u.name || null,
      profilePic: u.profile_pic || null,
      isVerified: u.is_verified === true,
    };
  });

  return NextResponse.json({ coauthors });
}

// POST /api/admin/story-coauthors
// Body: { storyUid, userId }  — add a co-author (idempotent: dedupes on (story_uid, user_id))
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.role, "story.edit_any") && !hasPermission(session.role, "authors.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { storyUid, userId } = body || {};
  if (!storyUid || !userId) {
    return NextResponse.json({ error: "storyUid এবং userId আবশ্যক।" }, { status: 400 });
  }
  if (userId === session.id) {
    return NextResponse.json({ error: "প্রধান লেখক নিজেকে সহ-লেখক হিসেবে যোগ করতে পারবেন না।" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Confirm the user exists; reject dangling ids so the chip list stays honest.
  const { data: user } = await supabase
    .from("users")
    .select("id, username, name, profile_pic, is_verified, role")
    .or(`id.eq.${userId},username.eq.${userId}`)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: `ইউজার "${userId}" পাওয়া যায়নি।` }, { status: 404 });
  }
  if (!["author", "admin", "superadmin"].includes(user.role || "user")) {
    return NextResponse.json({ error: "শুধুমাত্র লেখক/অ্যাডমিন ইউজারকে সহ-লেখক হিসেবে যোগ করা যাবে।" }, { status: 400 });
  }

  // Find current max position so new entries append at the end.
  const { data: existing } = await supabase
    .from("story_coauthors")
    .select("position")
    .eq("story_uid", storyUid)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const { error } = await supabase
    .from("story_coauthors")
    .upsert(
      { story_uid: storyUid, user_id: user.id, position: nextPosition },
      { onConflict: "story_uid,user_id" }
    );

  if (error) {
    console.error("Add co-author error:", error);
    return NextResponse.json({ error: "সহ-লেখক যোগ করতে সমস্যা হয়েছে।" }, { status: 500 });
  }

  await logAudit(session, {
    action: "story.coauthor_add",
    targetType: "story",
    targetId: storyUid,
    newState: { userId: user.id, username: user.username },
  });

  return NextResponse.json({
    success: true,
    coauthor: {
      userId: user.id,
      username: user.username,
      name: user.name,
      profilePic: user.profile_pic,
      isVerified: user.is_verified === true,
      position: nextPosition,
    },
  });
}

// DELETE /api/admin/story-coauthors?storyUid=xxx&userId=yyy
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.role, "story.edit_any") && !hasPermission(session.role, "authors.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const storyUid = searchParams.get("storyUid");
  const userId = searchParams.get("userId");
  if (!storyUid || !userId) {
    return NextResponse.json({ error: "storyUid এবং userId আবশ্যক।" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("story_coauthors")
    .delete()
    .eq("story_uid", storyUid)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: "সহ-লেখক মুছতে সমস্যা হয়েছে।" }, { status: 500 });
  }

  await logAudit(session, {
    action: "story.coauthor_remove",
    targetType: "story",
    targetId: storyUid,
    prevState: { userId },
  });

  return NextResponse.json({ success: true });
}
