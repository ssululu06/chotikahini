import { NextResponse } from "next/server";
import { getAvatarPool } from "@/lib/avatars";

export const dynamic = "force-dynamic";

// GET /api/avatars — returns the list of selectable default avatars
export async function GET() {
  return NextResponse.json({
    avatars: getAvatarPool(),
    defaultAvatar: "/images/avatars/1.jpg",
  });
}
