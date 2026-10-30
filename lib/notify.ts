import { getSupabaseAdmin } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────
// Central notification helpers.
//
// IMPORTANT: `notifications.user_id` has a FOREIGN KEY constraint
// to `users(id)`. Fake ids like "admin-1" or "superadmin" cause
// the ENTIRE insert to fail with a FK violation, silently dropping
// notifications. These helpers ALWAYS resolve REAL user ids from
// the database before inserting.
// ─────────────────────────────────────────────────────────────

export interface NotifyPayload {
  type: string;
  actorId?: string | null;
  actorName?: string | null;
  actorProfilePic?: string | null;
  snippet?: string | null;
  postSlug?: string | null;
  commentId?: string | null;
}

/** Resolve real admin + superadmin user ids from the database. */
export async function getRealAdminIds(supabase: any): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("users")
      .select("id")
      .in("role", ["admin", "superadmin"]);
    const ids = (data || []).map((u: any) => u.id);

    // Ensure the env superadmin (id "superadmin") is included when it exists.
    if (ids.length > 0 && !ids.includes("superadmin")) {
      const { data: superRow } = await supabase
        .from("users")
        .select("id")
        .eq("id", "superadmin")
        .maybeSingle();
      if (superRow) ids.push("superadmin");
    }
    return ids;
  } catch {
    return [];
  }
}

/**
 * Notify every real admin/superadmin user.
 * Never inserts fake user ids — so the FK constraint never fails.
 *
 * First ensures the env superadmin has a real DB row, so admin
 * notifications are delivered even before the admin has logged in
 * once (e.g. a new-user registration notification arriving when the
 * superadmin has never logged into the DB-backed account).
 */
export async function notifyAdmins(
  payload: NotifyPayload,
  supabase?: any
): Promise<void> {
  // The admin panel renders `snippet` as plain Bengali text — never as JSON.
  // Some legacy call sites passed JSON.stringify(...) payloads, so unwrap
  // those here so the table can never accumulate raw JSON rows.
  if (typeof payload.snippet === "string" && payload.snippet.trimStart().startsWith("{")) {
    let unwrapped: string | null = null;
    try {
      const parsed = JSON.parse(payload.snippet);
      if (typeof parsed?.message === "string") unwrapped = parsed.message;
      else if (typeof parsed?.snippet === "string") unwrapped = parsed.snippet;
    } catch {
      unwrapped = null;
    }
    console.warn("[notify] unwrapped JSON snippet for type:", payload.type);
    payload = { ...payload, snippet: unwrapped };
  }

  const client = supabase || getSupabaseAdmin();

  // Make sure the env superadmin exists as a real user row.
  try {
    const envAdminUser = (process.env.ADMIN_USERNAME || "").trim();
    await ensureSuperAdminRow(client, "superadmin", envAdminUser || "superadmin");
  } catch (e) {}

  const ids = await getRealAdminIds(client);
  if (ids.length === 0) return;

  const rows = ids.map((userId) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    type: payload.type,
    actor_id: payload.actorId || null,
    actor_name: payload.actorName || null,
    actor_profile_pic: payload.actorProfilePic || null,
    snippet: payload.snippet || null,
    post_slug: payload.postSlug || null,
    comment_id: payload.commentId || null,
    is_read: false,
    created_at: new Date().toISOString(),
  }));

  try {
    const { error, data } = await client.from("notifications").insert(rows).select();
    if (!error) {
      console.log("[notify] inserted", data?.length ?? rows.length, "rows for", payload.type);
      return;
    }

    // Fallback: insert one-by-one so one bad row can't drop everything.
    // NOTE: supabase-js resolves (never rejects) on failure, so we MUST
    // inspect the returned `error` field instead of relying on try/catch.
    console.error("[notify] bulk insert failed:", payload.type, error.message);
    for (const row of rows) {
      try {
        const { error: rowError } = await client.from("notifications").insert(row);
        if (rowError) {
          console.error("[notify] row insert failed:", rowError.message);
        }
      } catch {}
    }
  } catch (e) {
    console.error("[notify] admin insert threw:", (e as Error).message);
  }
}

/** Notify a single user (must be a real user id). */
export async function notifyUser(
  userId: string | null | undefined,
  payload: NotifyPayload,
  supabase?: any
): Promise<void> {
  if (!userId) return;
  const client = supabase || getSupabaseAdmin();
  try {
    const { error } = await client.from("notifications").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      type: payload.type,
      actor_id: payload.actorId || null,
      actor_name: payload.actorName || null,
      actor_profile_pic: payload.actorProfilePic || null,
      snippet: payload.snippet || null,
      post_slug: payload.postSlug || null,
      comment_id: payload.commentId || null,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[notify] user insert failed:", error.message);
    }
  } catch (e) {
    // If the target user no longer exists, fail silently.
    console.error("[notify] user insert threw:", (e as Error).message);
  }
}

/**
 * Ensure a real DB row exists for the env superadmin so notifications
 * delivered to the superadmin pass the FK constraint. Safe to call
 * during superadmin login or inside notifyAdmins.
 *
 * Handles username conflicts gracefully: if another row already owns the
 * env admin username, the superadmin row uses "superadmin" as its username.
 */
export async function ensureSuperAdminRow(
  supabase: any,
  id = "superadmin",
  username?: string
): Promise<void> {
  try {
    // Always start by checking whether THIS specific id row already exists.
    // The previous guard (`in("role", ["superadmin"])`) used to early-return
    // when ANY user had the superadmin role — which meant the env superadmin
    // row was never created if a DB-backed admin already existed. That broke
    // notifications because getRealAdminIds() returned the DB admin ids but
    // not the env admin id, so notifications addressed to the env admin were
    // silently dropped.
    const { data: selfRow } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", id)
      .maybeSingle();
    if (selfRow) {
      // Already exists — make sure the role is correct.
      if (selfRow.role !== "superadmin") {
        try {
          await supabase
            .from("users")
            .update({ role: "superadmin", updated_at: new Date().toISOString() })
            .eq("id", id);
        } catch {}
      }
      return;
    }

    // Otherwise ensure the row exists with the right role + username.
    const desiredName = username || "superadmin";

    // Try with the env username first; on unique-violation fall back.
    try {
      await supabase.from("users").upsert(
        {
          id,
          username: desiredName,
          name: desiredName === "superadmin" ? "সুপার অ্যাডমিন" : desiredName,
          role: "superadmin",
          is_verified: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    } catch (e) {
      // Username may be taken by another id — use a unique fallback.
      await supabase.from("users").upsert(
        {
          id,
          username: "superadmin",
          name: "সুপার অ্যাডমিন",
          role: "superadmin",
          is_verified: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    }
  } catch (e) {
    // If the table is missing or some other error, fail silently.
  }
}
