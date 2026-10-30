import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { token, username, newPassword } = await req.json();
    const cleanToken = (token || "").trim();
    const cleanUsername = (username || "").trim().toLowerCase();
    const cleanPassword = (newPassword || "").trim();

    if (!cleanToken || !cleanUsername || !cleanPassword) {
      return NextResponse.json({ error: "টোকেন, ইউজারনেম এবং নতুন পাসওয়ার্ড প্রদান করা আবশ্যক।" }, { status: 400 });
    }

    if (cleanPassword.length < 6) {
      return NextResponse.json({ error: "পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে।" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify token and user
    const { data: user, error: fetchErr } = await supabase
      .from("users")
      .select("id, username, reset_token, reset_token_expires")
      .eq("username", cleanUsername)
      .eq("reset_token", cleanToken)
      .maybeSingle();

    if (fetchErr || !user) {
      return NextResponse.json({ error: "অকার্যকর অথবা মেয়াদোত্তীর্ণ পাসওয়ার্ড রিসেট টোকেন।" }, { status: 400 });
    }

    // Check expiry
    if (user.reset_token_expires && new Date(user.reset_token_expires).getTime() < Date.now()) {
      return NextResponse.json({ error: "পাসওয়ার্ড রিসেট লিঙ্কের মেয়াদ শেষ হয়ে গেছে। নতুন অনুরোধ করুন।" }, { status: 400 });
    }

    // Hash new password and clear single-use token immediately
    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    const { error: updateErr } = await supabase
      .from("users")
      .update({
        password_hash: hashedPassword,
        reset_token: null,
        reset_token_expires: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);

    if (updateErr) {
      throw updateErr;
    }

    return NextResponse.json({
      success: true,
      message: "আপনার পাসওয়ার্ড সফলভাবে রিসেট ও হালনাগাদ করা হয়েছে! নতুন পাসওয়ার্ড দিয়ে প্রবেশ করুন।"
    });

  } catch (error: any) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "পাসওয়ার্ড পরিবর্তন করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।" }, { status: 500 });
  }
}
