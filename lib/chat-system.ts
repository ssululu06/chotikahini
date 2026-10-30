/**
 * lib/chat-system.ts
 *
 * Posts a server-authored announcement into the global group chat.
 *
 * The chat UI already understands `is_system` rows (`chat_messages`), which
 * is what makes this a thin wrapper rather than a new subsystem: the message
 * simply appears in the same feed, styled as a system pill.
 *
 * Design notes:
 *  - `user_id` is `null` for system rows, so they never resolve to a profile
 *    and the UI can render them without an avatar or a profile link.
 *  - Every failure is swallowed and logged. Announcements are a nice-to-have;
 *    a missing `chat_messages` table (or a permission blip on a self-hosted
 *    Supabase) must NEVER fail the publish that triggered it. The caller
 *    keeps its success response either way.
 *  - Fire-and-forget: the function is awaited by callers for observability
 *    but its return value is only used for logging.
 */

import { getSupabaseAdmin } from "@/lib/supabase";
import { getSiteConfig } from "@/lib/config";

/** Marker identity for system rows — never a real user id. */
const SYSTEM_USER_ID = null;

/**
 * Insert one system announcement into the global chat.
 *
 * @param text  Bengali announcement body. May contain a `/videos/<id>` link,
 *              which `ChatRoom` renders as a rich video preview card.
 * @returns true when the row was written, false otherwise (never throws).
 */
export async function postSystemChat(text: string): Promise<boolean> {
  const trimmed = (text || "").trim();
  if (!trimmed) return false;

  try {
    const { error } = await getSupabaseAdmin()
      .from("chat_messages")
      .insert({
        user_id: SYSTEM_USER_ID,
        username: "system",
        name: "সিস্টেম",
        profile_pic: null,
        message: trimmed,
        role: "system",
        is_system: true,
      });

    if (error) {
      // A missing table/column is a configuration state, not a crash —
      // log it once-ish and let the publish succeed regardless.
      console.warn("[chat-system] could not post announcement:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[chat-system] unexpected error:", (e as Error)?.message);
    return false;
  }
}

/**
 * Announcement for a newly published video.
 *
 * The link is absolute so `ChatRoom`'s URL matcher recognises it as a video
 * link and swaps in the rich player card rather than rendering bare text.
 */
export async function announceVideoPublished(
  videoId: string,
  title: string,
): Promise<boolean> {
  const id = (videoId || "").trim();
  if (!id) return false;

  // Prefer the configured origin; fall back to a root-relative link so the
  // message is still useful in local/dev where no site URL is configured.
  let origin = "";
  try {
    const site = getSiteConfig();
    origin = (site.url || "").replace(/\/+$/, "");
  } catch {
    origin = "";
  }
  const href = origin ? `${origin}/videos/${id}` : `/videos/${id}`;

  const safeTitle = (title || "").trim();
  const headline = safeTitle ? `নতুন ভিডিও: ${safeTitle}` : "নতুন ভিডিও প্রকাশিত হয়েছে";

  return postSystemChat(`${headline}\n${href}`);
}