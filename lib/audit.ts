import { getSupabaseAdmin } from "@/lib/supabase";
import type { UserSessionPayload } from "@/lib/auth";

// ─────────────────────────────────────────────────────────────
// Lightweight audit logging for sensitive admin actions.
//
// Never logs secrets, passwords, or tokens.
// Storage-efficient: one small JSONB row per sensitive action.
//
// TWO MODES:
//  - logAudit()           → fail-open (best-effort). For regular
//                           content actions (publish, reject, etc.).
//  - logAuditCritical()   → fail-closed. Returns false when the
//                           audit row could not be written so the
//                           caller can ABORT the operation. Used for
//                           role changes, admin promotion, permanent
//                           deletion, and security settings changes.
// ─────────────────────────────────────────────────────────────

export interface AuditEntry {
  action: string;
  targetType?: string;
  targetId?: string;
  prevState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
}

async function writeAudit(
  session: UserSessionPayload | null,
  entry: AuditEntry
): Promise<boolean> {
  if (!session?.id) return false;
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("admin_audit_logs").insert({
      actor_id: session.id,
      actor_username: session.username || session.name || null,
      action: entry.action,
      target_type: entry.targetType || null,
      target_id: entry.targetId || null,
      prev_state: entry.prevState || null,
      new_state: entry.newState || null,
      created_at: new Date().toISOString(),
    });
    return !error;
  } catch (e) {
    console.error("Audit log error:", e);
    return false;
  }
}

/** Fail-open audit — for regular content actions. Never blocks the operation. */
export async function logAudit(
  session: UserSessionPayload | null,
  entry: AuditEntry
): Promise<void> {
  await writeAudit(session, entry);
}

/** Fail-closed audit — for critical security actions. Returns false on failure. */
export async function logAuditCritical(
  session: UserSessionPayload | null,
  entry: AuditEntry
): Promise<boolean> {
  return writeAudit(session, entry);
}
