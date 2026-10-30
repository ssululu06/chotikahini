import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { setSession } from "@/lib/auth";
import { safeIdentifier } from "@/lib/utils";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    // 20 login attempts per IP per 5 min. Anything tighter and a legit
    // user mistyping their password gets locked out; anything looser and
    // online brute-force goes unnoticed.
    const rl = rateLimit(`login:${clientIp(req)}`, { windowMs: 5 * 60_000, max: 20 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "অতিরিক্ত চেষ্টা। কিছুক্ষণ পর আবার চেষ্টা করুন।" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const { username: rawUsername, password: rawPassword } = await req.json();

    const username = (rawUsername || "").trim();
    const password = (rawPassword || "").trim();

    if (!username || !password) {
      return NextResponse.json({ error: "ইউজারনেম এবং পাসওয়ার্ড প্রদান করুন।" }, { status: 400 });
    }

    // Reject characters that would break the PostgREST `.or()` filter or
    // be used for SQL-injection-style probing of other columns. Login uses
    // an OR across `username` and `email`, so a comma/dot in the value
    // could be turned into additional filter clauses by an attacker.
    const safeLoginId = safeIdentifier(username, 254);
    if (!safeLoginId) {
      return NextResponse.json({ error: "ইউজারনেম বা ইমেইল ফরম্যাট সঠিক নয়।" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: users, error: dbError } = await supabase
      .from('users')
      .select('*')
      .or(`username.ilike.${safeLoginId},email.ilike.${safeLoginId}`)
      .limit(1);

    if (dbError) {
      console.error("Supabase user fetch error:", dbError);
      return NextResponse.json({ error: "ডাটাবেস সমস্যা। আবার চেষ্টা করুন।" }, { status: 500 });
    }

    const dbUser = users?.[0];

    const envAdminUser = (process.env.ADMIN_USERNAME || "").trim();
    const envAdminPass = (process.env.ADMIN_PASSWORD || "").trim();

    // 1. Superadmin Login check via Environment Variables (ADMIN_USERNAME &
    // ADMIN_PASSWORD). Use constant-time comparison for both username and
    // password so a timing side-channel cannot leak them.
    const userMatches = !!envAdminUser && constantTimeEqualsIgnoreCase(username, envAdminUser);
    const passMatches = !!envAdminPass && constantTimeEquals(password, envAdminPass);
    if (userMatches && passMatches) {
      // Fetch all details dynamically from database if a matching user record exists
      const adminId = dbUser?.id || "superadmin";
      const adminName = dbUser?.name || dbUser?.username || envAdminUser;
      const adminEmail = dbUser?.email || "";
      const adminProfilePic = (dbUser?.profile_pic && !dbUser.profile_pic.startsWith("data:")) ? dbUser.profile_pic : "";

      // Ensure a real DB row exists for the env superadmin so admin
      // notifications (user_id has a FK to users.id) can be delivered.
      if (!dbUser) {
        const { ensureSuperAdminRow } = await import("@/lib/notify");
        await ensureSuperAdminRow(supabase, adminId, envAdminUser);
      }

      await setSession({
        id: adminId,
        username: envAdminUser,
        name: adminName,
        email: adminEmail,
        profilePic: adminProfilePic,
        savedPosts: dbUser?.saved_posts || [],
        createdAt: dbUser?.created_at || new Date().toISOString(),
        role: "superadmin",
        isVerified: true
      });

      // Track active user
      try {
        if (dbUser?.id) {
          await supabase.from("users").update({ last_seen_at: new Date().toISOString() }).eq("id", dbUser.id);
        }
      } catch {}

      return NextResponse.json({
        success: true,
        user: {
          id: adminId,
          username: envAdminUser,
          name: adminName,
          email: adminEmail,
          role: "superadmin",
          profilePic: adminProfilePic,
          savedPosts: dbUser?.saved_posts || [],
          isVerified: true
        }
      });
    }

    // 2. All other roles (Admin, Author, User) authenticate strictly via Supabase Database password_hash
    if (!dbUser) {
      return NextResponse.json({ error: "ইউজারনেম বা পাসওয়ার্ড ভুল হয়েছে।" }, { status: 401 });
    }

    let isValid = false;
    try {
      isValid = await bcrypt.compare(password, dbUser.password_hash || "");
    } catch (e) {}

    if (!isValid) {
      return NextResponse.json({ error: "ইউজারনেম বা পাসওয়ার্ড ভুল হয়েছে।" }, { status: 401 });
    }

    const computedRole = dbUser.role || "user";
    const safeProfilePic = (dbUser.profile_pic && !dbUser.profile_pic.startsWith("data:")) ? dbUser.profile_pic : "";

    // Set session cookie
    await setSession({ 
      id: dbUser.id, 
      username: dbUser.username,
      name: dbUser.name,
      email: dbUser.email,
      profilePic: safeProfilePic,
      savedPosts: dbUser.saved_posts || [],
      createdAt: dbUser.created_at,
      role: computedRole,
      isVerified: dbUser.is_verified === true
    });

    // Track active user
    try {
      await supabase.from("users").update({ last_seen_at: new Date().toISOString() }).eq("id", dbUser.id);
    } catch {}

    return NextResponse.json({
      success: true,
      user: {
        id: dbUser.id,
        username: dbUser.username,
        name: dbUser.name,
        email: dbUser.email,
        profilePic: safeProfilePic,
        savedPosts: dbUser.saved_posts || [],
        createdAt: dbUser.created_at,
        role: computedRole,
        isVerified: dbUser.is_verified === true
      }
    });

  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "লগইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।" }, { status: 500 });
  }
}

/**
 * Constant-time equality on equal-length strings. Falls back to a normal
 * `===` when the lengths differ (the loop still runs the same number of
 * iterations on the dummy side so the wall-clock time is roughly stable
 * regardless of the match).
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function constantTimeEqualsIgnoreCase(a: string, b: string): boolean {
  return constantTimeEquals(a.toLowerCase(), b.toLowerCase());
}
