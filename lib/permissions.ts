// ─────────────────────────────────────────────────────────────
// Cittakkho — Central Role-Based Access Control (RBAC) Registry
//
// ONE source of truth for roles, permissions, and the role →
// permission matrix. Every authorization decision (UI + server)
// must go through these helpers.
//
// SECURITY RULE:
//   UI helpers are for UX only. Server-side authorization is the
//   real security boundary. Never trust client-supplied roles,
//   permissions, user IDs, or status fields.
// ─────────────────────────────────────────────────────────────

export type Role = "superadmin" | "admin" | "content_manager" | "moderator" | "author" | "user";

// ── Role hierarchy (levels) — for GENERAL comparisons only ──
export const ROLE_LEVELS: Record<Role, number> = {
  superadmin: 100,
  admin: 80,
  content_manager: 60,
  moderator: 40,
  author: 30,
  user: 10,
};

// ── Complete permission registry ─────────────────────────────
export const ALL_PERMISSIONS = [
  // Content
  "content.view",
  "content.create",
  "content.edit",
  "content.publish",
  "content.unpublish",
  "content.reject",
  "content.request_revision",
  "content.hide",
  "content.restore",
  "content.delete_permanent",

  // Stories
  "story.view",
  "story.submit",
  "story.view_own",
  "story.edit_own",
  "story.resubmit",
  "story.edit_any",
  "story.review",
  "story.approve",
  "story.reject",
  "story.request_revision",

  // Users
  "users.view",
  "users.manage",
  "users.suspend",
  "users.restore",
  "users.verify",
  "users.reset_password",
  "users.delete_permanent",

  // Roles
  "roles.view",
  "roles.assign",
  "roles.assign_admin",
  "roles.remove_admin",

  // Comments
  "comments.view",
  "comments.create",
  "comments.reply",
  "comments.hide",
  "comments.restore",
  "comments.pin",
  "comments.delete_permanent",

  // Posts (short-form micro-posts)
  "posts.view",
  "posts.create",
  "posts.edit_own",
  "posts.delete_own",
  "posts.like",
  "posts.repost",
  "posts.comment",
  "posts.moderate",
  "posts.ban",

  // Reports
  "reports.view",
  "reports.manage",
  "reports.dismiss",

  // Authors
  "authors.view",
  "authors.manage",
  "authors.verify",

  // Analytics
  "analytics.view",
  "analytics.content",
  "analytics.users",
  "analytics.system",
  "analytics.own",

  // Notifications
  "notifications.view",
  "notifications.manage",

  // Audit logs
  "audit_logs.view",
  "audit_logs.export",

  // Settings
  "settings.view",
  "settings.content",
  "settings.appearance",
  "settings.security",
  "settings.integrations",

  // Announcements
  "announcements.view",
  "announcements.create",
  "announcements.edit",
  "announcements.delete",

  // Deletion requests
  "deletion_requests.view",
  "deletion_requests.create",
  "deletion_requests.approve",
  "deletion_requests.reject",

  // Media
  "media.view",
  "media.upload",
  "media.edit",
  "media.delete",

  // Recycle bin
  "recycle_bin.view",
  "recycle_bin.restore",
  "recycle_bin.permanent_delete",

  // Permissions / admins (superadmin-only)
  "permissions.manage",
  "admin.manage",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

// ── Role → Permission matrix ─────────────────────────────────
// superadmin implicitly owns EVERYTHING (handled in hasPermission).
const ROLE_PERMISSIONS: Record<Exclude<Role, "superadmin">, Permission[]> = {
  admin: [
    "content.view", "content.create", "content.edit",
    "content.publish", "content.unpublish", "content.reject",
    "content.request_revision", "content.hide", "content.restore",
    "story.view", "story.submit", "story.view_own", "story.edit_own", "story.resubmit",
    "story.edit_any", "story.review", "story.approve", "story.reject", "story.request_revision",
    "users.view", "users.manage", "users.suspend", "users.restore",
    "users.verify", "users.reset_password",
    "roles.view", "roles.assign",
    "comments.view", "comments.create", "comments.reply",
    "comments.hide", "comments.restore", "comments.pin",
    "reports.view", "reports.manage", "reports.dismiss",
    "authors.view", "authors.manage", "authors.verify",
    "analytics.view", "analytics.content", "analytics.users",
    "notifications.view", "notifications.manage",
    "audit_logs.view",
    "settings.view", "settings.content", "settings.appearance",
    "announcements.view", "announcements.create", "announcements.edit", "announcements.delete",
    "deletion_requests.view", "deletion_requests.create",
    "media.view", "media.upload", "media.edit", "media.delete",
    "recycle_bin.view", "recycle_bin.restore",
    "posts.view", "posts.create", "posts.edit_own", "posts.delete_own",
    "posts.like", "posts.repost", "posts.comment", "posts.moderate", "posts.ban",
  ],

  content_manager: [
    "content.view", "content.create", "content.edit",
    "content.publish", "content.unpublish", "content.reject",
    "content.request_revision", "content.hide", "content.restore",
    "story.view", "story.submit", "story.view_own", "story.edit_own", "story.resubmit",
    "story.edit_any", "story.review", "story.approve", "story.reject", "story.request_revision",
    "comments.view", "comments.create", "comments.reply",
    "analytics.content",
    "notifications.view",
    "settings.view", "settings.content", "settings.appearance",
    "announcements.view", "announcements.create", "announcements.edit", "announcements.delete",
    "media.view", "media.upload",
    "posts.view", "posts.create", "posts.edit_own", "posts.delete_own",
    "posts.like", "posts.repost", "posts.comment", "posts.moderate", "posts.ban",
  ],

  moderator: [
    "content.view", "story.view",
    "story.submit", "story.view_own", "story.edit_own", "story.resubmit",
    "comments.view", "comments.create", "comments.reply",
    "comments.hide", "comments.restore",
    "reports.view", "reports.manage", "reports.dismiss",
    "analytics.content",
    "notifications.view",
    "posts.view", "posts.create", "posts.edit_own", "posts.delete_own",
    "posts.like", "posts.repost", "posts.comment", "posts.moderate",
  ],

  author: [
    "content.view", "story.view",
    "story.submit", "story.view_own", "story.edit_own", "story.resubmit",
    "comments.view", "comments.create", "comments.reply",
    "analytics.own",
    "notifications.view",
    "posts.view", "posts.create", "posts.edit_own", "posts.delete_own",
    "posts.like", "posts.repost", "posts.comment",
  ],

  user: [
    "content.view", "story.view",
    "comments.view", "comments.create", "comments.reply",
    "notifications.view",
    "posts.view", "posts.create", "posts.edit_own", "posts.delete_own",
    "posts.like", "posts.repost", "posts.comment",
  ],
};

// ── Core helpers ─────────────────────────────────────────────

/** True if the role has the exact permission. superadmin always has every permission. */
export function hasPermission(role: string | undefined, permission: Permission): boolean {
  if (!role) return false;
  if (role === "superadmin") return true;
  const perms = ROLE_PERMISSIONS[role as Exclude<Role, "superadmin">];
  if (!perms) return false;
  return perms.includes(permission);
}

/** True if the role has ANY of the listed permissions. */
export function hasAnyPermission(role: string | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/** True if the role has ALL of the listed permissions. */
export function hasAllPermissions(role: string | undefined, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/** True if the role is at or above the given role in the hierarchy (general comparison). */
export function isAtLeast(role: string | undefined, minRole: Role): boolean {
  if (!role) return false;
  const level = ROLE_LEVELS[role as Role] ?? 0;
  return level >= (ROLE_LEVELS[minRole] ?? 0);
}

export function isAdminOrAbove(role: string | undefined): boolean {
  return isAtLeast(role, "admin");
}

/** Any admin-tier role can access the admin panel (superadmin, admin, content_manager, moderator). */
export function canAccessAdmin(role: string | undefined): boolean {
  return isAtLeast(role, "moderator");
}

export function isSuperAdminRole(role: string | undefined): boolean {
  return role === "superadmin";
}

// ── Named permission checks (reusable) ───────────────────────

export function canDeletePermanently(role: string | undefined): boolean {
  return hasPermission(role, "content.delete_permanent");
}

export function canHideContent(role: string | undefined): boolean {
  return hasPermission(role, "content.hide");
}

export function canPublishContent(role: string | undefined): boolean {
  return hasPermission(role, "content.publish");
}

export function canRejectContent(role: string | undefined): boolean {
  return hasPermission(role, "content.reject");
}

/** Ownership-aware edit: anyone may edit their own story; edit_any is global. */
export function canEditOwnStory(role: string | undefined): boolean {
  return hasPermission(role, "story.edit_own");
}

export function canEditAnyStory(role: string | undefined): boolean {
  return hasPermission(role, "story.edit_any");
}

export function canManageUsers(role: string | undefined): boolean {
  return hasPermission(role, "users.manage");
}

export function canVerifyUsers(role: string | undefined): boolean {
  return hasPermission(role, "users.verify");
}

export function canManageComments(role: string | undefined): boolean {
  return hasPermission(role, "comments.hide");
}

export function canManageReports(role: string | undefined): boolean {
  return hasPermission(role, "reports.manage");
}

export function canAssignRoles(role: string | undefined): boolean {
  return hasPermission(role, "roles.assign");
}

export function canAssignAdmin(role: string | undefined): boolean {
  return hasPermission(role, "roles.assign_admin");
}

export function canManageSettings(role: string | undefined): boolean {
  return hasPermission(role, "settings.content") || hasPermission(role, "settings.appearance");
}

export function canViewSettings(role: string | undefined): boolean {
  return hasPermission(role, "settings.view");
}

export function canViewAuditLogs(role: string | undefined): boolean {
  return hasPermission(role, "audit_logs.view");
}

export function canManageAnnouncements(role: string | undefined): boolean {
  return hasPermission(role, "announcements.edit");
}

// Every non-user role is technically also an author — they can write stories.
export function canWriteStories(role: string | undefined): boolean {
  if (!role) return false;
  return role !== "user";
}

// Admin roles (excluding superadmin) that cannot permanently delete
export function isLimitedAdmin(role: string | undefined): boolean {
  return role === "admin" || role === "content_manager" || role === "moderator";
}

// ── Role metadata for UI ─────────────────────────────────────

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    superadmin: "সুপার অ্যাডমিন",
    admin: "অ্যাডমিন",
    content_manager: "কন্টেন্ট ম্যানেজার",
    moderator: "মডারেটর",
    author: "লেখক",
    user: "ব্যবহারকারী",
  };
  return labels[role] || role;
}

export function getRoleDescription(role: string): string {
  const descriptions: Record<string, string> = {
    superadmin: "সম্পূর্ণ সিস্টেম নিয়ন্ত্রণ করতে পারে।",
    admin: "সিস্টেমের অধিকাংশ পরিচালনামূলক কাজ করতে পারে, তবে স্থায়ী ডিলিট ও admin management করতে পারে না।",
    content_manager: "গল্প review, edit ও publish করতে পারে।",
    moderator: "কমেন্ট ও রিপোর্ট moderation করতে পারে।",
    author: "নিজের গল্প লিখতে ও পরিচালনা করতে পারে।",
    user: "গল্প পড়া ও community features ব্যবহার করতে পারে।",
  };
  return descriptions[role] || "";
}

/** Roles that a given actor may assign (returns [] for those who cannot manage roles). */
export function getAssignableRoles(actorRole: string | undefined): Role[] {
  if (!actorRole) return [];
  if (actorRole === "superadmin") {
    return ["superadmin", "admin", "content_manager", "moderator", "author", "user"];
  }
  if (hasPermission(actorRole, "roles.assign")) {
    // Admin can assign lower-tier operational roles, but never admin/superadmin.
    return ["content_manager", "moderator", "author", "user"];
  }
  return [];
}

export function getRoleTier(role: string | undefined): "user" | "author" | "admin" | "superadmin" {
  if (role === "superadmin") return "superadmin";
  if (role === "admin") return "admin";
  if (role === "content_manager" || role === "moderator") return "admin";
  if (role === "author") return "author";
  return "user";
}
