import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { clearPostsCache } from "@/lib/posts";
import { logAuditCritical } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notify";

export const dynamic = "force-dynamic";

// GET — list deletion requests (requires deletion_requests.view)
export async function GET() {
  const { authorized } = await requirePermission("deletion_requests.view");
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: requests } = await supabase
      .from("deletion_requests")
      .select("id, target_type, target_id, reason, status, created_at, requested_by")
      .order("created_at", { ascending: false });

    // Resolve requester names
    let requesterMap = new Map<string, string>();
    try {
      const ids = [...new Set((requests || []).map((r: any) => r.requested_by).filter(Boolean))];
      if (ids.length) {
        const { data: users } = await supabase.from("users").select("id, username").in("id", ids);
        (users || []).forEach((u: any) => requesterMap.set(u.id, u.username));
      }
    } catch (e) {}

    // For stories, include title for context
    let titleMap = new Map<string, string>();
    try {
      const storyRefs = [...new Set((requests || []).filter((r: any) => r.target_type === "story").map((r: any) => r.target_id))];
      if (storyRefs.length) {
        const { data: stories } = await supabase
          .from("stories")
          .select("uid, slug, title")
          .or(storyRefs.map((s) => `uid.eq.${s}`).join(","));
        (stories || []).forEach((s: any) => {
          titleMap.set(s.uid, s.title);
          titleMap.set(s.slug, s.title);
        });
      }
    } catch (e) {}

    const enriched = (requests || []).map((r: any) => ({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      status: r.status,
      createdAt: r.created_at,
      requestedBy: requesterMap.get(r.requested_by) || r.requested_by,
      title: titleMap.get(r.target_id) || r.target_id,
    }));

    return NextResponse.json({ requests: enriched });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST — request permanent deletion (limited admins) or execute (superadmin)
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "অননুমোদিত অ্যাক্সেস। লগইন করুন।" }, { status: 401 });

  const { targetType, targetId, reason } = await req.json();
  if (!targetType || !targetId) {
    return NextResponse.json({ error: "অকার্যকর অনুরোধ।" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // If author requesting deletion of their own story
  if (targetType === "story" && session.role !== "admin" && session.role !== "superadmin") {
    const { data: story } = await supabase
      .from("stories")
      .select("uid, slug, author_id, title")
      .or(`uid.eq.${targetId},slug.eq.${targetId}`)
      .maybeSingle();

    if (!story || story.author_id !== session.id) {
      return NextResponse.json({ error: "আপনি কেবল নিজের গল্পের ডিলিট রিকোয়েস্ট পাঠাতে পারবেন।" }, { status: 403 });
    }

    await supabase.from("deletion_requests").insert({
      target_type: "story",
      target_id: story.uid || story.slug,
      requested_by: session.id,
      reason: reason?.trim() || "লেখকের নিজের ডিলিট অনুরোধ",
      status: "pending",
    });

    notifyAdmins(
      {
        type: "deletion_request",
        actorId: session.id,
        snippet: `গল্প ডিলিট অনুরোধ: "${story.title}" — লেখক @${session.username}`,
      },
      supabase
    );

    return NextResponse.json({ success: true, pendingApproval: true, message: "ডিলিট অনুরোধটি অ্যাডমিনের কাছে পাঠানো হয়েছে।" });
  }

  if (session.role === "superadmin") {
    // Superadmin: execute permanent delete immediately
    if (targetType === "story") {
      const { data: story } = await supabase
        .from("stories")
        .select("uid, slug")
        .or(`uid.eq.${targetId},slug.eq.${targetId}`)
        .maybeSingle();
      if (story) {
        const { error: deleteError } = await supabase.from("stories").delete().or(`uid.eq.${targetId},slug.eq.${targetId}`);
        if (deleteError) throw deleteError;
        await supabase.from("post_metadata").delete().eq("slug", story.slug || story.uid);
        clearPostsCache();
      }
    } else if (targetType === "comment") {
      await supabase.from("comments").delete().eq("id", targetId);
    } else if (targetType === "user") {
      await supabase.from("users").delete().eq("id", targetId);
    }
    return NextResponse.json({ success: true, permanent: true });
  }

  // Limited admin: create a deletion request (content is already hidden by caller)
  await supabase.from("deletion_requests").insert({
    target_type: targetType,
    target_id: targetId,
    requested_by: session.id,
    reason: reason?.trim() || "",
    status: "pending",
  });

  // Notify every real admin/superadmin (FK-safe)
  notifyAdmins(
    {
      type: "deletion_request",
      actorId: session.id,
      snippet: `স্থায়ী ডিলিটের অনুরোধ: ${targetType} (${targetId}) — অ্যাডমিন @${session.username}`,
    },
    supabase
  );

  return NextResponse.json({ success: true, pendingApproval: true });
}

// PATCH — superadmin approves/rejects a deletion request
export async function PATCH(req: Request) {
  const { authorized, session } = await requirePermission("deletion_requests.approve");
  if (!authorized || !session) {
    return NextResponse.json({ error: "শুধুমাত্র সুপার অ্যাডমিন এই অনুমতি দিতে পারবেন।" }, { status: 403 });
  }

  const { id, status } = await req.json();
  if (!id || !["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: reqRow } = await supabase
    .from("deletion_requests")
    .select("id, target_type, target_id")
    .eq("id", id)
    .single();

  if (!reqRow) return NextResponse.json({ error: "আবেদনটি পাওয়া যায়নি।" }, { status: 404 });

  if (status === "approved") {
    // Fail-closed: audit the permanent delete BEFORE executing it.
    const auditOk = await logAuditCritical(session, { action: "deletion_requests.approve", targetType: reqRow.target_type, targetId: reqRow.target_id, newState: { status } });
    if (!auditOk) {
      return NextResponse.json({ error: "অডিট লগ ব্যর্থ হয়েছে। ডিলিট অনুমোদন বাতিল করা হলো।" }, { status: 500 });
    }

    // Execute permanent delete
    if (reqRow.target_type === "story") {
      const { error: deleteError } = await supabase.from("stories").delete().or(`uid.eq.${reqRow.target_id},slug.eq.${reqRow.target_id}`);
      if (deleteError) throw deleteError;
      await supabase.from("post_metadata").delete().eq("slug", reqRow.target_id);
      clearPostsCache();
    } else if (reqRow.target_type === "comment") {
      await supabase.from("comments").delete().eq("id", reqRow.target_id);
    } else if (reqRow.target_type === "user") {
      await supabase.from("users").delete().eq("id", reqRow.target_id);
    }
  }

  await supabase.from("deletion_requests").update({ status }).eq("id", id);

  return NextResponse.json({ success: true, status });
}
