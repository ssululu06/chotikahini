import { getSession, type UserSessionPayload } from "./auth";
import {
  canAccessAdmin,
  hasPermission,
  isAtLeast,
  type Permission,
} from "./permissions";

// ─────────────────────────────────────────────────────────────
// Authorization helpers — every helper reads the LIVE session
// role from the DB (lib/auth.ts refreshes it on each call), so
// role changes take effect immediately without re-login.
//
// IMPORTANT: these helpers are the server-side security boundary.
// UI hiding is NOT authorization.
// ─────────────────────────────────────────────────────────────

/** Returns the authenticated session, or null. */
export async function getAuthorizedSession(): Promise<UserSessionPayload | null> {
  return getSession();
}

/** Any admin-tier role can access the admin panel. */
export async function isAdminAuthenticated() {
  const session = await getSession();
  if (!session) return false;
  return canAccessAdmin(session.role);
}

/** Full admin (superadmin or admin) — for sensitive operational areas. */
export async function isFullAdmin() {
  const session = await getSession();
  if (!session) return false;
  return isAtLeast(session.role, "admin");
}

/** Any non-user role is considered an author (can write stories). */
export async function isAuthorAuthenticated() {
  const session = await getSession();
  if (!session) return false;
  return session.role !== "user";
}

/** Only superadmin. */
export async function isSuperAdmin() {
  const session = await getSession();
  if (!session) return false;
  return session.role === "superadmin";
}

/**
 * Permission gate for API routes.
 * Returns `{ authorized: true, session }` or `{ authorized: false, session }`.
 * Usage: `const { authorized, session } = await requirePermission("users.manage");`
 */
export async function requirePermission(
  permission: Permission
): Promise<{ authorized: boolean; session: UserSessionPayload | null }> {
  const session = await getSession();
  if (!session) return { authorized: false, session: null };
  return { authorized: hasPermission(session.role, permission), session };
}

/**
 * Permission gate for sensitive GET endpoints.
 * Returns NextResponse-compatible shape — caller decides status.
 */
export async function authorizePermission(permission: Permission) {
  const session = await getSession();
  if (!session) return { session: null, authorized: false };
  return { session, authorized: hasPermission(session.role, permission) };
}
