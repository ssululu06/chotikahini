import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isFullAdmin, isSuperAdmin, requirePermission } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { syncUserCascade } from "@/lib/user-sync";
import { hasPermission, isSuperAdminRole, getAssignableRoles } from "@/lib/permissions";
import { logAudit, logAuditCritical } from "@/lib/audit";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const isFull = await isFullAdmin();
    if (!isFull) {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: users, error } = await supabase
      .from("users")
      .select("id, username, name, email, role, profile_pic, created_at, is_verified, is_trusted")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Map profile_pic to profilePic for existing frontend compatibility
    const safeUsers = (users || []).map((u: any) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      role: u.role || "user",
      profilePic: u.profile_pic,
      createdAt: u.created_at,
      isVerified: u.is_verified === true,
      isTrusted: u.is_trusted === true
    }));

    return NextResponse.json({ users: safeUsers });
  } catch (error) {
    console.error("Fetch users error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { authorized, session } = await requirePermission("users.manage");
    if (!authorized || !session) {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
    }
    const actorRole = session.role || "user";

    const { userId, role, username, newPassword, isVerified, isTrusted } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    
    // Fetch current user
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updates: any = {};
    let roleChanged = false;
    let prevRole = user.role;

    if (role && role !== user.role) {
      // ── Protected superadmin ──
      if (user.role === "superadmin") {
        return NextResponse.json({ error: "সুপার অ্যাডমিনের রোল পরিবর্তন করা যাবে না।" }, { status: 403 });
      }

      // Self-protection: never allow promoting yourself
      if (userId === session.id && role !== user.role) {
        return NextResponse.json({ error: "নিজের রোল পরিবর্তন করা যাবে না।" }, { status: 403 });
      }

      // Admin cannot modify another admin's or superadmin's role.
      if (session.role !== "superadmin" && (user.role === "admin" || user.role === "superadmin")) {
        return NextResponse.json({ error: "আপনি অন্য অ্যাডমিন বা সুপার অ্যাডমিনের রোল পরিবর্তন করতে পারবেন না।" }, { status: 403 });
      }

      if (!["user", "author", "admin", "content_manager", "moderator"].includes(role)) {
        return NextResponse.json({ error: "Invalid role specified" }, { status: 400 });
      }

      // Only superadmin can assign the "admin" role
      if (role === "admin" && !hasPermission(actorRole, "roles.assign_admin")) {
        return NextResponse.json({ error: "শুধুমাত্র সুপার অ্যাডমিন 'admin' রোল দিতে পারবেন।" }, { status: 403 });
      }

      // Actors can only assign roles within their allowed set
      const assignable = getAssignableRoles(actorRole);
      if (!assignable.includes(role as any)) {
        return NextResponse.json({ error: "আপনার এই রোল দেওয়ার অনুমতি নেই।" }, { status: 403 });
      }

      updates.role = role;
      roleChanged = true;
    }

    if (newPassword && newPassword.trim()) {
      if (newPassword.trim().length < 6) {
        return NextResponse.json({ error: "পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।" }, { status: 400 });
      }
      if (!hasPermission(actorRole, "users.reset_password")) {
        return NextResponse.json({ error: "আপনার পাসওয়ার্ড রিসেটের অনুমতি নেই।" }, { status: 403 });
      }
      updates.password_hash = await bcrypt.hash(newPassword.trim(), 10);
    }

    if (typeof isVerified === "boolean" && isVerified !== (user.is_verified === true)) {
      if (!hasPermission(actorRole, "users.verify")) {
        return NextResponse.json({ error: "আপনার ভেরিফিকেশন পরিবর্তনের অনুমতি নেই।" }, { status: 403 });
      }
      updates.is_verified = isVerified;
    }

    if (Object.keys(updates).length > 0) {
      // Critical action (role change): fail-closed — write audit BEFORE the update.
      if (roleChanged) {
        const auditOk = await logAuditCritical(session, { action: "roles.assign", targetType: "user", targetId: userId, prevState: { role: prevRole }, newState: { role: updates.role } });
        if (!auditOk) {
          return NextResponse.json({ error: "অডিট লগ ব্যর্থ হয়েছে। রোল পরিবর্তন বাতিল করা হলো।" }, { status: 500 });
        }
      }

      const { error: updateError } = await supabase
        .from("users")
        .update(updates)
        .eq("id", userId);

      if (updateError) throw updateError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Update user role error:", error);
    return NextResponse.json({ error: error.message || "Failed to update user role" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { authorized, session } = await requirePermission("users.delete_permanent");
    if (!authorized || !session) {
      return NextResponse.json({ error: "অননুমোদিত অ্যাক্সেস। শুধুমাত্র সুপার অ্যাডমিন স্থায়ীভাবে ইউজার ডিলিট করতে পারবেন।" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "ইউজার আইডি প্রয়োজন।" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: targetUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: "ইউজার পাওয়া যায়নি।" }, { status: 404 });
    }

    if (isSuperAdminRole(targetUser.role)) {
      return NextResponse.json({ error: "সুপারএডমিন ডিলিট করা যাবে না।" }, { status: 403 });
    }

    // Self-protection: cannot delete your own account
    if (userId === session.id) {
      return NextResponse.json({ error: "নিজের অ্যাকাউন্ট ডিলিট করা যাবে না।" }, { status: 403 });
    }

    const auditOk = await logAuditCritical(session, { action: "users.delete_permanent", targetType: "user", targetId: userId, prevState: { role: targetUser.role } });
    if (!auditOk) {
      return NextResponse.json({ error: "অডিট লগ ব্যর্থ হয়েছে। ইউজার ডিলিট বাতিল করা হলো।" }, { status: 500 });
    }

    const { error: deleteError } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, message: "ইউজার অ্যাকাউন্ট সফলভাবে মুছে ফেলা হয়েছে।" });
  } catch (error: any) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: error.message || "ইউজার মুছতে সমস্যা হয়েছে।" }, { status: 500 });
  }
}
