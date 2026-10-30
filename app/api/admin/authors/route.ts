import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requirePermission } from "@/lib/admin-auth";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { getRoleLabel } from "@/lib/permissions";

export const dynamic = 'force-dynamic';

/** Clean username: lowercase alphanumeric + hyphen/underscore. */
function cleanUsername(raw: string): string {
  const base = (raw || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_]/g, "");
  return base.slice(0, 30);
}

export async function POST(req: Request) {
  const { authorized, session } = await requirePermission("authors.manage");
  if (!authorized || !session) {
    return NextResponse.json({ error: "অননুমোদিত অ্যাক্সেস।" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const name = (body.name || "").trim();
    const username = cleanUsername(body.username || "");
    const email = (body.email || "").trim();
    const bio = (body.bio || "").trim();
    const profilePic = (body.profilePic || "").trim();
    const website = (body.website || "").trim();
    const facebook = (body.facebook || "").trim();
    const password = (body.password || "").trim();

    if (!name || !username) {
      return NextResponse.json({ error: "লেখকের নাম ও ইউজারনেম আবশ্যক।" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Unique username check
    const { data: existing } = await supabase
      .from("users")
      .select("id, username")
      .or(`username.ilike.${username},id.eq.${username}`)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: `"${username}" ইউজারনেমটি ইতিমধ্যে ব্যবহৃত।` }, { status: 409 });
    }

    // Unique email check (if provided)
    if (email) {
      const { data: emailExists } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (emailExists) {
        return NextResponse.json({ error: "এই ইমেইলটি ইতিমধ্যে ব্যবহৃত।" }, { status: 409 });
      }
    }

    const id = `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    const insert: any = {
      id,
      username,
      name,
      email: email || null,
      role: "author",
      bio: bio || null,
      profile_pic: profilePic || null,
      website: website || null,
      facebook: facebook || null,
      is_verified: false,
      created_at: new Date().toISOString(),
    };

    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।" }, { status: 400 });
      }
      insert.password_hash = await bcrypt.hash(password, 10);
    }

    const { error } = await supabase.from("users").insert(insert);
    if (error) {
      return NextResponse.json({ error: `লেখক তৈরি করা যায়নি: ${error.message}` }, { status: 500 });
    }

    logAudit(session, {
      action: "authors.manage",
      targetType: "user",
      targetId: id,
      newState: { role: "author", username, name },
    });

    return NextResponse.json({
      success: true,
      message: `লেখক "${name}" (@${username}) সফলভাবে যোগ হয়েছে।${password ? " লেখক এখন লগইন করতে পারবেন।" : " পাসওয়ার্ড সেট নেই — পরে রিসেট লিংক পাঠান।"}`,
      author: { id, username, name },
    });
  } catch (error: any) {
    console.error("Create author error:", error);
    return NextResponse.json({ error: "লেখক তৈরি করতে সমস্যা হয়েছে।" }, { status: 500 });
  }
}

export async function GET() {
  const { authorized } = await requirePermission("authors.view");
  if (!authorized) {
    return NextResponse.json({ error: "অননুমোদিত অ্যাক্সেস।" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // 1. Fetch registered users from Supabase
    const { data: authorUsers } = await supabase
      .from("users")
      .select("*")
      .in("role", ["author", "admin", "superadmin"]);

    // 2. Fetch all stories from Supabase to aggregate stats directly from DB
    const { data: stories } = await supabase
      .from("stories")
      .select("author_id, status, history");

    const authorStatsMap: Record<string, { total: number; published: number; pending: number; revision: number; rejected: number }> = {};

    if (Array.isArray(stories)) {
      for (const s of stories) {
        const author = s.author_id || "admin";
        const status = s.status || "published";
        // Crawled stories are reviewed only in the Auto-Post queue — they
        // must not inflate an author's pending-review count.
        const isCrawled = Array.isArray(s.history) && s.history.some((h: any) => h.event === "crawled" || h.event === "auto_posted");

        if (!authorStatsMap[author]) {
          authorStatsMap[author] = { total: 0, published: 0, pending: 0, revision: 0, rejected: 0 };
        }

        authorStatsMap[author].total += 1;

        if (status === "published") authorStatsMap[author].published += 1;
        else if (status === "pending" && !isCrawled) authorStatsMap[author].pending += 1;
        else if (status === "revision_requested") authorStatsMap[author].revision += 1;
        else if (status === "rejected") authorStatsMap[author].rejected += 1;
      }
    }

    const authorsList = (authorUsers || []).map(u => {
      const stats = authorStatsMap[u.id] || authorStatsMap[u.username] || { total: 0, published: 0, pending: 0, revision: 0, rejected: 0 };
      return {
        id: u.id,
        username: u.username,
        name: u.name,
        email: u.email || "—",
        role: u.role || "author",
        profilePic: u.profile_pic || null,
        joinedDate: u.created_at || new Date().toISOString(),
        stats,
      };
    });

    return NextResponse.json({ authors: authorsList });
  } catch (error: any) {
    console.error("Fetch authors error:", error);
    return NextResponse.json({ error: "লেখকদের তালিকা পেতে সমস্যা হয়েছে।" }, { status: 500 });
  }
}
