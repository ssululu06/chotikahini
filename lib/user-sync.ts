import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { getSupabaseAdmin } from "./supabase";
import { clearPostsCache } from "./posts";

/**
 * Cascades user updates (username, name, profile pic) across all relational tables.
 *
 * NORMALIZED APPROACH:
 * - Only updates the `users` table (single source of truth)
 * - All other tables (comments, notifications, chat_messages) resolve
 *   user info via FK join at query time — no manual cascade needed
 * - post_metadata.author_id uses users.id (stable UUID) — username change has no effect
 *
 * REMOVED (no longer needed after normalization):
 * - comments.username/name/profile_pic cascade (now via FK join)
 * - notifications.actor_name/actor_profile_pic cascade (now via FK join)
 * - MDX file frontmatter rewrite (MDX author field is legacy; post_metadata.author_id is canonical)
 * - content/authors/ JSON sync (handled by Supabase users table)
 */
export async function syncUserCascade({
  userId,
  oldUsername,
  newUsername,
  newName,
  newProfilePic,
  newBio,
}: {
  userId: string;
  oldUsername?: string;
  newUsername?: string;
  newName?: string;
  newProfilePic?: string;
  newBio?: string;
}) {
  const supabase = getSupabaseAdmin();

  const updates: Record<string, any> = {};
  if (newUsername !== undefined) updates.username = newUsername;
  if (newName !== undefined) updates.name = newName;
  if (newProfilePic !== undefined) updates.profile_pic = newProfilePic;
  if (newBio !== undefined) updates.bio = newBio;

  if (Object.keys(updates).length === 0) return;

  // Single update to users table — all related data resolves via FK
  const { error } = await supabase.from("users").update(updates).eq("id", userId);
  if (error) throw error;

  clearPostsCache();
}
