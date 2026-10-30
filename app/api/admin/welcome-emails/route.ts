import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-auth";
import { getSiteConfig } from "@/lib/config";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const WELCOME_SENT_TYPE = "welcome_email_sent";

function makeWelcomeMessage(name: string, siteName: string): string {
  return (
    `প্রিয় ${name || "বন্ধু"},\n\n` +
    `${siteName}-এ আপনাকে স্বাগতম! আপনার অ্যাকাউন্ট তৈরি হয়েছে। ` +
    "এখানে আপনার পছন্দের গল্প পড়ুন, লেখকদের সঙ্গে যুক্ত থাকুন, আর চাইলে নিজের গল্পও শেয়ার করুন।\n\n" +
    `শুভেচ্ছান্তে,\n${siteName} টিম`
  );
}

export async function GET() {
  const { authorized } = await requirePermission("notifications.manage");
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
    const [
      { data: recentUsers, error: usersError },
      { data: registrations, error: registrationsError },
    ] = await Promise.all([
      supabase
        .from("users")
        .select("id, name, username, email, role, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
      supabase
        .from("notifications")
        .select("actor_id, created_at")
        .eq("type", "new_user_registration")
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
    ]);

    if (usersError) throw usersError;
    if (registrationsError) throw registrationsError;

    const registrationDates = new Map<string, string>();
    for (const registration of registrations || []) {
      if (registration.actor_id && !registrationDates.has(registration.actor_id)) {
        registrationDates.set(registration.actor_id, registration.created_at);
      }
    }
    const userIds = Array.from(
      new Set([
        ...(recentUsers || [])
          .filter((user) => !["admin", "superadmin", "content_manager", "moderator"].includes(user.role || ""))
          .map((user) => user.id),
        ...registrationDates.keys(),
      ]),
    );
    const usersById = new Map((recentUsers || []).map((user) => [user.id, user]));
    const missingRegistrationUsers = userIds.filter((userId) => !usersById.has(userId));
    if (missingRegistrationUsers.length > 0) {
      const { data: registrationUsers, error: registrationUsersError } = await supabase
        .from("users")
        .select("id, name, username, email, role, created_at")
        .in("id", missingRegistrationUsers);
      if (registrationUsersError) throw registrationUsersError;
      for (const user of registrationUsers || []) usersById.set(user.id, user);
    }

    const sentIds = new Set<string>();
    if (userIds.length > 0) {
      const { data: sentRows, error: sentError } = await supabase
        .from("notifications")
        .select("actor_id")
        .eq("type", WELCOME_SENT_TYPE)
        .in("actor_id", userIds);
      if (sentError) throw sentError;
      for (const row of sentRows || []) {
        if (row.actor_id) sentIds.add(row.actor_id);
      }
    }

    const site = getSiteConfig();
    const siteName = site.seo?.siteName || site.title || "আমাদের প্ল্যাটফর্ম";
    const recipients = userIds
      .map((userId) => usersById.get(userId))
      .filter((user): user is NonNullable<typeof user> => Boolean(user))
      .map((user) => ({
        id: user.id,
        name: user.name || user.username || "নতুন পাঠক",
        username: user.username || "",
        email: user.email || "",
        createdAt: user.created_at || registrationDates.get(user.id) || "",
        welcomeMessage: makeWelcomeMessage(user.name || user.username || "বন্ধু", siteName),
        sentAt: sentIds.has(user.id),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json(
      { recipients, since },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("GET admin welcome email recipients error:", error);
    return NextResponse.json(
      { error: "নতুন ব্যবহারকারীদের তালিকা লোড করা যায়নি।" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { authorized, session } = await requirePermission("notifications.manage");
  if (!authorized || !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId || typeof body.sent !== "boolean") {
      return NextResponse.json({ error: "ব্যবহারকারী এবং পাঠানোর status প্রয়োজন।" }, { status: 400 });
    }
    const sent = body.sent;

    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, created_at")
      .eq("id", userId)
      .maybeSingle();
    if (userError) throw userError;
    if (!user) {
      return NextResponse.json(
        { error: "ব্যবহারকারীকে পাওয়া যায়নি।" },
        { status: 404 },
      );
    }
    let recentlyRegistered = Boolean(
      user.created_at &&
      Number.isFinite(Date.parse(user.created_at)) &&
      Date.parse(user.created_at) >= Date.parse(since),
    );
    if (!recentlyRegistered) {
      const { data: registration, error: registrationError } = await supabase
        .from("notifications")
        .select("id")
        .eq("type", "new_user_registration")
        .eq("actor_id", userId)
        .gte("created_at", since)
        .limit(1);
      if (registrationError) throw registrationError;
      recentlyRegistered = Boolean(registration?.length);
    }
    if (!recentlyRegistered) {
      return NextResponse.json(
        { error: "এই তালিকাটি শুধু গত ৭ দিনে নিবন্ধিত ব্যবহারকারীদের জন্য।" },
        { status: 404 },
      );
    }
    if (sent && !user.email) {
      return NextResponse.json(
        { error: "এই ব্যবহারকারীর ইমেইল ঠিকানা নেই।" },
        { status: 400 },
      );
    }

    if (sent) {
      const { data: existing, error: existingError } = await supabase
        .from("notifications")
        .select("id")
        .eq("type", WELCOME_SENT_TYPE)
        .eq("actor_id", userId)
        .limit(1);
      if (existingError) throw existingError;

      if (!existing?.length) {
        const { error: insertError } = await supabase.from("notifications").insert({
          id: crypto.randomUUID(),
          user_id: session.id,
          actor_id: userId,
          actor_name: session.name || session.username,
          type: WELCOME_SENT_TYPE,
          snippet: "স্বাগতম ইমেইল পাঠানো হয়েছে",
          is_read: true,
          created_at: new Date().toISOString(),
        });
        if (insertError) throw insertError;
      }
    } else {
      const { error: deleteError } = await supabase
        .from("notifications")
        .delete()
        .eq("type", WELCOME_SENT_TYPE)
        .eq("actor_id", userId);
      if (deleteError) throw deleteError;
    }

    return NextResponse.json({ success: true, sent });
  } catch (error) {
    console.error("POST admin welcome email status error:", error);
    return NextResponse.json(
      { error: "ইমেইল পাঠানোর অবস্থা সংরক্ষণ করা যায়নি।" },
      { status: 500 },
    );
  }
}
