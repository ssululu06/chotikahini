import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { notifyAdmins } from "@/lib/notify";
import { getSiteConfig } from "@/lib/config";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Generates a clean, simple, human-readable username from a display name or email.
 * Examples:
 * - "রহিম চৌধুরী" -> "rahim" or "rahim-choudhury"
 * - "Tanvir Ahmed" -> "tanvir" or "tanvir-ahmed"
 * - "karim123@gmail.com" -> "karim"
 * No random 'hijibiji' gibberish like 'user-8795'. Clean and name-aligned!
 */
function generateCleanUsername(name: string, email: string): string {
  let base = name
    .toLowerCase()
    .trim()
    // Convert Bengali phonetic equivalents to clean English letters
    .replace(/র/g, "r").replace(/হ/g, "h").replace(/ি/g, "i").replace(/ম/g, "m")
    .replace(/ক/g, "k").replace(/া/g, "a").replace(/ব/g, "b").replace(/ল/g, "l")
    .replace(/স/g, "s").replace(/ন/g, "n").replace(/ত/g, "t").replace(/দ/g, "d")
    .replace(/প/g, "p").replace(/ফ/g, "f").replace(/য/g, "j").replace(/শ/g, "s")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!base || base.length < 2) {
    // Extract name portion before @ in email
    const emailPrefix = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    base = emailPrefix || "user";
  }

  return base.substring(0, 18);
}

const generatePassword = () => {
  // 12 chars from the full alphanumeric alphabet, sampled uniformly with a
  // CSPRNG (randomBytes). Reject samples >= 62 * 4 (= 248) to remove
  // modulo bias. ~71 bits of entropy is plenty for a one-time setup
  // password that the user should change on first login.
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const out: string[] = [];
  while (out.length < 12) {
    const buf = randomBytes(12);
    for (const b of buf) {
      if (out.length >= 12) break;
      if (b < 248) out.push(chars[b % chars.length]!);
    }
  }
  return out.join("");
};

export async function POST(req: Request) {
  try {
    // Cap registrations per IP. A flood of fake signups burns DB writes,
    // notification rows, and welcome emails. 10 / 10min is generous for a
    // real visitor; everything beyond is rejected at the edge.
    const rl = rateLimit(`register:${clientIp(req)}`, { windowMs: 10 * 60_000, max: 10 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "অতিরিক্ত নিবন্ধনের চেষ্টা। কিছুক্ষণ পর আবার চেষ্টা করুন।" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const name = (body.name || "").trim();
    const email = (body.email || "").trim();

    if (!name) {
      return NextResponse.json({ error: "নাম প্রদান করুন।" }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "ইমেইল ঠিকানা প্রদান করুন।" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "সঠিক ইমেইল ঠিকানা দিন।" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check for duplicate email
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: "এই ইমেইল দিয়ে আগেই একটি অ্যাকাউন্ট আছে। লগইন করুন।" }, { status: 409 });
    }

    const rawPassword = generatePassword();
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const userId = "usr_" + randomBytes(8).toString("hex");

    // Derive a clean, simple username matching the user's name
    const baseUsername = generateCleanUsername(name, email);
    let finalUsername = baseUsername;
    let suffix = 1;
    // Cap collision attempts so a broken DB or a targeted collision attack
    // cannot pin the server in an infinite loop (was possible before —
    // no exit condition other than the user table being empty).
    const MAX_USERNAME_ATTEMPTS = 50;
    let attempts = 0;

    while (attempts < MAX_USERNAME_ATTEMPTS) {
      attempts++;
      const { data } = await supabase
        .from("users")
        .select("id")
        .eq("username", finalUsername)
        .maybeSingle();

      if (data) {
        suffix++;
        finalUsername = `${baseUsername}${suffix}`;
      } else {
        break;
      }
    }

    if (attempts >= MAX_USERNAME_ATTEMPTS) {
      // Highly unlikely — fall back to a random suffix so the request can
      // still succeed deterministically instead of leaking a 500.
      finalUsername = `${baseUsername}_${randomBytes(3).toString("hex")}`;
    }

    // Auto-assign a random unused avatar from the avatars pool
    let assignedAvatar = "/images/avatars/1.jpg";
    try {
      const { getUnusedAvatar } = await import("@/lib/avatars");
      assignedAvatar = await getUnusedAvatar(supabase);
    } catch (e) {}

    const { error: insertError } = await supabase.from("users").insert({
      id: userId,
      username: finalUsername,
      name,
      email,
      password_hash: passwordHash,
      role: "user",
      profile_pic: assignedAvatar,
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("User insert error:", insertError);
      throw new Error("DB_ERROR");
    }

    const site = getSiteConfig();
    const siteName = site.seo?.siteName || site.title || "ওয়েবসাইট";
    const teamName = `${siteName} টিম`;

    // 1. Automated Welcome Notification for new user
    try {
      await supabase.from("notifications").insert({
        id: "ntf_wel_" + Date.now() + "_" + randomBytes(4).toString("hex"),
        user_id: userId,
        type: "welcome",
        actor_name: teamName,
        snippet: `স্বাগতম ${name}! ${siteName} প্ল্যাটফর্মে আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে। চমৎকার সব গল্প পড়ুন এবং নতুন গল্প জমা দিন।`,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    } catch (e) {}

    // 2. Admin Notification for new user registration (FK-safe).
    // `snippet` is rendered as plain text in the admin panel — no JSON.
    await notifyAdmins(
      {
        type: "new_user_registration",
        actorId: userId,
        actorName: name,
        snippet: `নতুন ব্যবহারকারী নিবন্ধিত হয়েছেন: ${name} (@${finalUsername}) - ${email}`,
      },
      supabase
    );

    return NextResponse.json({
      success: true,
      data: {
        username: finalUsername,
        password: rawPassword,
      },
    });

  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "নিবন্ধন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।" }, { status: 500 });
  }
}
