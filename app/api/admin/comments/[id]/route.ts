import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canDeletePermanently, hasPermission } from "@/lib/permissions";
import { logAudit, logAuditCritical } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notify";

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "comments.hide")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { status } = await req.json();
    if (status !== "approved" && status !== "hidden") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const id = params.id;
    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from("comments")
      .select("status")
      .eq("id", id)
      .single();

    const { error: updateError } = await supabase
      .from("comments")
      .update({ status })
      .eq("id", id);

    if (updateError) throw updateError;

    logAudit(session, { action: status === "hidden" ? "comments.hide" : "comments.restore", targetType: "comment", targetId: id, prevState: existing ? { status: existing.status } : null, newState: { status } });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("PATCH admin comment error:", error);
    return NextResponse.json({ error: "Failed to update comment status" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "comments.hide")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = params.id;
    const supabase = getSupabaseAdmin();

    if (canDeletePermanently(session.role)) {
      // Superadmin: permanent delete (fail-closed on audit error)
      const auditOk = await logAuditCritical(session, { action: "comments.delete_permanent", targetType: "comment", targetId: id });
      if (!auditOk) {
        return NextResponse.json({ error: "অডিট লগ ব্যর্থ হয়েছে। অপারেশন বাতিল করা হলো।" }, { status: 500 });
      }
      const { error: deleteError } = await supabase
        .from("comments")
        .delete()
        .eq("id", id);
      if (deleteError) throw deleteError;
      return NextResponse.json({ success: true, permanent: true });
    }

    // Limited admins: hide the comment + request permanent deletion
    await supabase.from("comments").update({ status: "hidden" }).eq("id", id);
    await supabase.from("deletion_requests").insert({
      target_type: "comment",
      target_id: id,
      requested_by: session.id,
      reason: "কমেন্ট স্থায়ী ডিলিটের অনুরোধ",
      status: "pending",
    });

    notifyAdmins(
      {
        type: "deletion_request",
        actorId: session.id,
        snippet: `অ্যাডমিন @${session.username} একটি কমেন্ট স্থায়ী ডিলিটের অনুরোধ করেছেন।`,
      },
      supabase
    );

    return NextResponse.json({ success: true, hidden: true, pendingApproval: true });
  } catch (error: any) {
    console.error("DELETE admin comment error:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
