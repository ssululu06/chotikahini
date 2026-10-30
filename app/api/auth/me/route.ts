import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: session.id,
      username: session.username,
      name: session.name,
      email: session.email,
      profilePic: session.profilePic,
      savedPosts: session.savedPosts || [],
      createdAt: session.createdAt,
      role: session.role,
      isVerified: session.isVerified
    }
  });
}
