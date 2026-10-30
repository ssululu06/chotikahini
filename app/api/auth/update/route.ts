import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession, setSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { syncUserCascade } from "@/lib/user-sync";
import { isAvatarAvailable } from "@/lib/avatars";

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "অননুমোদিত অ্যাক্সেস।" }, { status: 401 });
    }

    const { name, email, profilePic, bio, currentPassword, newPassword } = await req.json();

    // Only predefined pool avatars may be used as profile pictures — users
    // cannot upload/custom-set their own image URL.
    let cleanProfilePic: string | undefined;
    if (profilePic !== undefined && profilePic !== null) {
      if (isAvatarAvailable(profilePic)) {
        cleanProfilePic = String(profilePic).trim();
      } else if (profilePic === "") {
        cleanProfilePic = "/images/avatars/1.jpg";
      } else {
        // Reject non-pool avatar URLs
        return NextResponse.json({ error: "শুধুমাত্র নির্বাচিত ডিফল্ট avatar ব্যবহার করা যাবে।" }, { status: 400 });
      }
    }

    const supabase = getSupabaseAdmin();
    
    // Get current user from DB
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("id", session.id)
      .single();

    if (fetchError || !user) {
      return NextResponse.json({ error: "ইউজার পাওয়া যায়নি।" }, { status: 404 });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email.trim();
    if (cleanProfilePic !== undefined) updates.profile_pic = cleanProfilePic;
    if (bio !== undefined) updates.bio = bio.trim();

    let passwordChanged = false;

    if (currentPassword && newPassword) {
      if (user.password_hash) {
        const isValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValid) throw new Error("বর্তমান পাসওয়ার্ড সঠিক নয়।");
      }

      if (newPassword.length < 6) throw new Error("নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।");
      
      updates.password_hash = await bcrypt.hash(newPassword, 10);
      passwordChanged = true;
    }

    // Update User in Supabase
    const { error: updateError } = await supabase
      .from("users")
      .update(updates)
      .eq("id", session.id);

    if (updateError) {
      console.error("Profile update error:", updateError);
      throw new Error("প্রোফাইল আপডেট করতে সমস্যা হয়েছে।");
    }

    // Sync user details across DB, MDX article frontmatters, and author configs
    await syncUserCascade({
      userId: session.id,
      oldUsername: user.username,
      newUsername: user.username,
      newName: updates.name,
      newProfilePic: updates.profile_pic
    });

    // Update the JWT session cookie
    await setSession({
      id: user.id,
      username: user.username,
      name: updates.name !== undefined ? updates.name : user.name,
      email: updates.email !== undefined ? updates.email : user.email,
      profilePic: updates.profile_pic !== undefined ? updates.profile_pic : user.profile_pic,
      bio: updates.bio !== undefined ? updates.bio : user.bio,
      role: user.role || "user",
      createdAt: user.created_at,
      savedPosts: user.saved_posts || [],
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: updates.name !== undefined ? updates.name : user.name,
        email: updates.email !== undefined ? updates.email : user.email,
        profilePic: updates.profile_pic !== undefined ? updates.profile_pic : user.profile_pic,
      },
      passwordChanged
    });

  } catch (error: any) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: error.message || "প্রোফাইল আপডেট করতে সমস্যা হয়েছে।" }, { status: 400 });
  }
}
