import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { notifyAdmins } from "@/lib/notify";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, entries, values } = body;

    const name = values?.name || values?.entry_name || "";
    const email = values?.email || values?.entry_email || "";
    const subject = values?.subject || values?.entry_subject || "যোগাযোগের বার্তা";
    const message = values?.message || values?.entry_message || "";

    if (!name.trim() || !message.trim()) {
      return NextResponse.json(
        { success: false, errors: ["নাম এবং বার্তা আবশ্যক।"] },
        { status: 400 }
      );
    }

    // 1. ALWAYS Save contact submission directly to Supabase DB (FK-safe admin notification)
    try {
      const supabase = getSupabaseAdmin();
      await notifyAdmins(
        {
          type: "contact_message",
          actorName: name.trim(),
          snippet: `[${subject.trim()}] ${message.trim().length > 0 ? message.trim().slice(0, 100) + (message.trim().length > 100 ? "…" : "") : ""}`.trim(),
        },
        supabase
      );
    } catch (dbErr) {
      console.error("Failed to save contact message to Supabase DB:", dbErr);
    }

    // 2. Optionally forward to Google Forms if configured
    if (action && typeof action === "string" && action.startsWith("http") && entries) {
      try {
        const payload = new URLSearchParams();
        for (const [key, entryId] of Object.entries(entries as Record<string, string>)) {
          const val = (values as Record<string, string>)[key];
          if (val !== undefined && val !== null) {
            payload.append(entryId, String(val));
          }
        }
        await fetch(action, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: payload.toString(),
          redirect: "manual",
        }).catch(() => {});
      } catch (gfErr) {}
    }

    return NextResponse.json({
      success: true,
      message: "আপনার বার্তা সফলভাবে পাঠানো হয়েছে!",
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, errors: [`বার্তা পাঠাতে সমস্যা হয়েছে: ${errorMsg}`] },
      { status: 500 }
    );
  }
}
