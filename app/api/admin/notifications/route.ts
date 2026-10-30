import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { getSiteConfig } from "@/lib/config";

// ── Role-scoped notification visibility ──────────────────────
// Every admin-tier role only sees the notifications its role is
// responsible for. Nothing outside the role's domain is exposed.

const ROLE_NOTIF_TYPES: Record<string, string[]> = {
  superadmin: [
    "deletion_request",
    "forgot_password_request",
    "password_reset_link_generated",
    "password_reset_by_admin",
    "verification_request",
    "verification_approved",
    "duplicate_story_flag",
    "new_user_registration",
    "author_approved",
    "author_application",
    "contact_message",
    "comment_report",
    "report",
    "welcome",
  ],
  admin: [
    "deletion_request",
    "forgot_password_request",
    "password_reset_link_generated",
    "password_reset_by_admin",
    "verification_request",
    "verification_approved",
    "duplicate_story_flag",
    "new_user_registration",
    "author_approved",
    "author_application",
    "contact_message",
    "comment_report",
    "report",
    "welcome",
  ],
  content_manager: [
    "author_approved",
    "verification_approved",
    "comment_report",
    "report",
    "welcome",
  ],
  moderator: [
    "comment_report",
    "report",
  ],
};

async function resolveAdminIds(supabase: any): Promise<string[]> {
  const ids = ["admin-1", "superadmin"];
  try {
    const { data: admins } = await supabase.from("users").select("id").in("role", ["admin", "superadmin"]);
    if (admins?.length) ids.push(...admins.map((a: any) => a.id));
  } catch (e) {}
  return ids;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const role = session.role || "user";
    const allowedTypes = ROLE_NOTIF_TYPES[role];
    if (!allowedTypes) {
      return NextResponse.json({ notifications: [] });
    }

    const supabase = getSupabaseAdmin();
    const adminIds = await resolveAdminIds(supabase);

    // Only notifications the role is entitled to see (by type) AND that are
    // bound to admin recipients or this specific user.
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*")
      .or(`user_id.in.(${[...adminIds, session.id].join(",")})`)
      .in("type", allowedTypes)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const registrationUserIds = Array.from(
      new Set(
        (notifications || [])
          .filter((notification) => notification.type === "new_user_registration" && notification.actor_id)
          .map((notification) => notification.actor_id as string),
      ),
    );
    const registrationUsersById = new Map<
      string,
      { name: string; email: string; username: string }
    >();

    if (registrationUserIds.length > 0) {
      const { data: registeredUsers, error: usersError } = await supabase
        .from("users")
        .select("id, name, email, username")
        .in("id", registrationUserIds);
      if (usersError) throw usersError;
      for (const user of registeredUsers || []) {
        registrationUsersById.set(user.id, {
          name: user.name || "",
          email: user.email || "",
          username: user.username || "",
        });
      }
    }

    const site = getSiteConfig();
    const siteName = site.seo?.siteName || site.title || "আমাদের প্ল্যাটফর্ম";
    const mapped = (notifications || []).map((n) => {
      let payload: any = {};
      try {
        if (n.snippet && n.snippet.startsWith("{")) {
          payload = JSON.parse(n.snippet);
        }
      } catch (e) {}

      const registrationUser = n.type === "new_user_registration"
        ? registrationUsersById.get(n.actor_id)
        : undefined;
      const welcomeName = registrationUser?.name || n.actor_name || "বন্ধু";

      return {
        id: n.id,
        type: n.type || "general",
        userId: n.user_id,
        actorId: n.actor_id,
        title: n.actor_name || "সিস্টেম নোটিফিকেশন",
        message: payload.message || payload.message_text || n.snippet || "",
        data: {
          ...payload,
          ...(registrationUser
            ? {
                userId: n.actor_id,
                name: registrationUser.name || n.actor_name || "বন্ধু",
                email: registrationUser.email,
                username: registrationUser.username,
                welcomeMessage:
                  `প্রিয় ${welcomeName},\n\n` +
                  `${siteName}-এ আপনাকে স্বাগতম! আপনার অ্যাকাউন্ট তৈরি হয়েছে। ` +
                  "এখানে আপনার পছন্দের গল্প পড়ুন, লেখকদের সঙ্গে যুক্ত থাকুন, আর চাইলে নিজের গল্পও শেয়ার করুন।\n\n" +
                  `শুভেচ্ছান্তে,\n${siteName} টিম`,
              }
            : {}),
        },
        isRead: Boolean(n.is_read),
        createdAt: n.created_at,
      };
    });

    return NextResponse.json({ notifications: mapped });
  } catch (error) {
    console.error("Failed to fetch admin notifications:", error);
    return NextResponse.json({ notifications: [] }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const role = session.role || "user";
    const allowedTypes = ROLE_NOTIF_TYPES[role];
    if (!allowedTypes) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const supabase = getSupabaseAdmin();
    const adminIds = await resolveAdminIds(supabase);
    const scope = `user_id.in.(${[...adminIds, session.id].join(",")})`;

    if (body.all) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .or(scope)
        .in("type", allowedTypes)
        .eq("is_read", false);
    } else if (body.id) {
      await supabase.from("notifications").update({ is_read: Boolean(body.isRead) }).eq("id", body.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const role = session.role || "user";
    const allowedTypes = ROLE_NOTIF_TYPES[role];
    if (!allowedTypes) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const adminIds = await resolveAdminIds(supabase);
    const scope = `user_id.in.(${[...adminIds, session.id].join(",")})`;

    if (id === "all") {
      await supabase
        .from("notifications")
        .delete()
        .or(scope)
        .in("type", allowedTypes);
    } else if (id) {
      await supabase.from("notifications").delete().eq("id", id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 });
  }
}
