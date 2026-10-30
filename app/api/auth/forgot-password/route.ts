import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { notifyAdmins } from "@/lib/notify";
import { getSiteConfig } from "@/lib/config";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { safeIdentifier } from "@/lib/utils";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Forgot-password is a high-value attack surface: enumeration +
    // email-bombing. Cap tightly: 5 / 10 min per IP.
    const rl = rateLimit(`forgot:${clientIp(req)}`, { windowMs: 10 * 60_000, max: 5 });
    if (!rl.ok) {
      return NextResponse.json(
        { success: true, message: "অনুরোধ গ্রহণ করা হয়েছে।" },
        { status: 200, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const { username, email } = await req.json();
    const cleanUsername = (username || "").trim().toLowerCase();
    const cleanEmail = (email || "").trim().toLowerCase();

    if (!cleanUsername || !cleanEmail) {
      return NextResponse.json({ error: "ইউজারনেম এবং ইমেইল ঠিকানা দুটিই প্রদান করা আবশ্যক।" }, { status: 400 });
    }

    // Reject anything that would break the PostgREST filter or look like
    // a malformed email. Returning a generic 200 keeps the
    // account-enumeration surface flat.
    if (!safeIdentifier(cleanUsername, 80) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json(
        { success: true, message: "অনুরোধ গ্রহণ করা হয়েছে।" },
        { status: 200 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Find user matching BOTH username and email
    const { data: user, error: fetchErr } = await supabase
      .from("users")
      .select("id, username, email, name, reset_token, reset_token_expires")
      .eq("username", cleanUsername)
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (fetchErr || !user) {
      return NextResponse.json(
        { success: true, message: "যদি এই ইউজারনেম ও ইমেইলের সাথে কোনো অ্যাকাউন্ট থাকে, রিসেট লিংক শীঘ্রই পাঠানো হবে।" },
        { status: 200 }
      );
    }

    // Generate secure single-use token valid for 1 hour
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    // Save token to Supabase users table (or JSON metadata)
    await supabase.from("users").update({
      reset_token: resetToken,
      reset_token_expires: expiresAt
    }).eq("id", user.id);

    // Create single-use reset URL (contains NO plain password)
    const origin = req.headers.get("origin") || req.headers.get("host") || getSiteConfig().url.replace(/\/$/, "");
    const cleanOrigin = origin.startsWith("http") ? origin : `https://${origin}`;
    const resetUrl = `${cleanOrigin}/auth/reset-password?token=${resetToken}&user=${encodeURIComponent(user.username)}`;

    const emailSubject = `পাসওয়ার্ড রিসেট করার লিঙ্ক — ${getSiteConfig().title}`;
    const emailBody = `প্রিয় ${user.name || user.username},

আপনার অ্যাকাউন্টের (@${user.username}) পাসওয়ার্ড রিসেটের অনুরোধ গ্রহণ করা হয়েছে। 

নিচের এককালীন (Single-use) লিঙ্কে ক্লিক করে আপনার নতুন পাসওয়ার্ড সেট করুন:
${resetUrl}

নোট: এই লিঙ্কটি ১ ঘণ্টার জন্য সক্রিয় থাকবে এবং কেবল একবারই ব্যবহার করা যাবে। লিঙ্কটিতে কোনো পাসওয়ার্ড দেওয়া নেই।

ধন্যবাদ,
${getSiteConfig().title} টিম`;

    // Notify admins about the request (No plain password involved)
    await notifyAdmins(
      {
        type: "forgot_password_request",
        actorId: user.id,
        actorName: user.name || user.username,
        snippet: `পাসওয়ার্ড রিসেট লিংক আবেদন: @${user.username} (${user.email})`,
      },
      supabase
    );

    return NextResponse.json({
      success: true,
      message: "পাসওয়ার্ড রিসেট লিঙ্কটি সফলভাবে জেনারেট হয়েছে! ইমেইল টেমপ্লেটটি ব্যবহার করে লিঙ্কটি পাঠাতে পারেন।",
      data: {
        username: user.username,
        email: user.email,
        resetUrl,
        emailSubject,
        emailBody
      }
    });

  } catch (error: any) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "পাসওয়ার্ড রিসেট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।" }, { status: 500 });
  }
}
