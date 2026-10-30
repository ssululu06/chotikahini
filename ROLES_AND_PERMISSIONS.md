# Cittakkho — রোল ও পারমিশন সিস্টেম (RBAC Documentation)

এই ডকুমেন্টটি `lib/permissions.ts`-এর সাথে সিঙ্ক্রোনাইজড — একটাই কেন্দ্রীয় পারমিশন সিস্টেম ব্যবহার হয় সার্ভার ও UI-তে।

---

## ১. রোল হায়ারার্কি (Role Hierarchy)

| রোল | লেভেল | Admin Panel অ্যাক্সেস | ল্যান্ডিং সেকশন |
|------|:-----:|:-------------------:|:--------------:|
| `superadmin` | 100 | ✅ সম্পূর্ণ | ওভারভিউ |
| `admin` | 80 | ✅ সম্পূর্ণ (ডিলিট ছাড়া) | ওভারভিউ |
| `content_manager` | 60 | ✅ সীমিত (কন্টেন্ট) | **রিভিউ সেন্টার** |
| `moderator` | 40 | ✅ সীমিত (মডারেশন) | মডারেশন ড্যাশবোর্ড |
| `author` | 30 | ❌ (শুধু নিজের গল্প) | — |
| `user` | 10 | ❌ | — |

> ⚠️ **হায়ারার্কি শুধু সাধারণ তুলনার জন্য।** প্রতিটি সংবেদনশীল অ্যাকশনের জন্য **এক্সপ্লিসিট পারমিশন** ব্যবহার হয় — কখনো শুধু লেভেল দিয়ে অথোরাইজ করা হয় না।

> 💡 শুধুমাত্র `user` রোল ছাড়া বাকি **সব রোলই technically লেখক** — গল্প লিখে জমা দিতে পারে।

---

## ২. সম্পূর্ণ পারমিশন তালিকা

### Content
`content.view` `content.create` `content.edit` `content.publish` `content.unpublish` `content.reject` `content.request_revision` `content.hide` `content.restore` `content.delete_permanent`

### Story
`story.view` `story.submit` `story.view_own` `story.edit_own` `story.resubmit` `story.edit_any` `story.review` `story.approve` `story.reject` `story.request_revision`

### Users
`users.view` `users.manage` `users.suspend` `users.restore` `users.verify` `users.reset_password` `users.delete_permanent`

### Roles
`roles.view` `roles.assign` `roles.assign_admin` `roles.remove_admin`

### Comments
`comments.view` `comments.create` `comments.reply` `comments.hide` `comments.restore` `comments.pin` `comments.delete_permanent`

### Reports
`reports.view` `reports.manage` `reports.dismiss`

### Authors
`authors.view` `authors.manage` `authors.verify`

### Analytics
`analytics.view` `analytics.content` `analytics.users` `analytics.system` `analytics.own`

### Notifications
`notifications.view` `notifications.manage`

### Audit Logs
`audit_logs.view` `audit_logs.export`

### Settings
`settings.view` `settings.content` `settings.appearance` `settings.security` `settings.integrations`

### Announcements
`announcements.view` `announcements.create` `announcements.edit` `announcements.delete`

### Deletion Requests
`deletion_requests.view` `deletion_requests.create` `deletion_requests.approve` `deletion_requests.reject`

### Media
`media.view` `media.upload` `media.edit` `media.delete`

### Recycle Bin
`recycle_bin.view` `recycle_bin.restore` `recycle_bin.permanent_delete`

### Permissions / Admins
`permissions.manage` `admin.manage`

---

## ৩. Role → Permission ম্যাট্রিক্স

### SUPERADMIN
**সব পারমিশন** — `hasPermission()`-এ superadmin implicit-ভাবে true।

### ADMIN
সব normal অপারেশনাল পারমিশন **ব্যতীত**:
- ❌ `roles.assign_admin`
- ❌ `roles.remove_admin`
- ❌ `settings.security`
- ❌ `deletion_requests.approve`
- ❌ `users.delete_permanent`
- ❌ `content.delete_permanent`
- ❌ `recycle_bin.permanent_delete`
- ❌ `permissions.manage`

### CONTENT_MANAGER
শুধু content/story-related পারমিশন + `analytics.content` + `notifications.view` + নিজের author পারমিশন (`story.submit`, `story.view_own`, `story.edit_own`, `story.resubmit`)।

**না পারে:** users, roles, verification, settings, announcements, reports, permanent delete।

### MODERATOR
শুধু moderation-related পারমিশন: `comments.*`, `reports.*`, `analytics.content`, `notifications.view` + নিজের author পারমিশন।

**না পারে:** publish, approve submissions, users, roles, settings, verification, permanent delete।

### AUTHOR
শুধু নিজের গল্পের পারমিশন: `story.submit`, `story.view_own`, `story.edit_own`, `story.resubmit`, `analytics.own` + community (comments, content.view)।

**না পারে:** `/admin`, অন্যের গল্প এডিট, status পরিবর্তন।

### USER
শুধু community পারমিশন: `content.view`, `story.view`, `comments.view/create/reply`, `notifications.view`।

---

## ৪. Ownership-Based পারমিশন

দুটি আলাদা কনসেপ্ট সার্ভার-সাইড enforce করা হয়:

| পারমিশন | অর্থ | কে পায় |
|----------|------|---------|
| `story.edit_own` | নিজের গল্প এডিট | author, content_manager, moderator, admin, superadmin |
| `story.edit_any` | যেকোনো গল্প এডিট | content_manager, admin, superadmin |

**উদাহরণ:**
- Author → `story.edit_own` ✅, `story.edit_any` ❌
- Admin → `story.edit_any` ✅

`/api/author/story-content` সার্ভার-সাইডে চেক করে:
1. `canEditOwnStory(role)` — না থাকলে 403
2. গল্প `author_id === session.id`? (ownership)
3. নাকি co-author? (`story_coauthors` টেবিল)
4. নাকি `canEditAnyStory(role)`? (global)

**Client-supplied story ID কখনো trust করা হয় না** — DB থেকে রি-ভেরিফাই করা হয়।

---

## ৫. কেন্দ্রীয় পারমিশন হেল্পার (`lib/permissions.ts`)

```ts
hasPermission(role, "content.publish")        // নির্দিষ্ট পারমিশন
hasAnyPermission(role, [...])                 // যেকোনো একটি
hasAllPermissions(role, [...])                // সবগুলো
isAtLeast(role, "admin")                      // হায়ারার্কি তুলনা
canAccessAdmin(role)                          // admin panel অ্যাক্সেস
canDeletePermanently(role)                    // শুধু superadmin
canHideContent(role)                          // soft delete
canPublishContent(role)                       // publish
canEditOwnStory(role)                         // ownership edit
canEditAnyStory(role)                         // global edit
canManageUsers(role)
canVerifyUsers(role)
canManageComments(role)
canManageReports(role)
canAssignRoles(role)
canAssignAdmin(role)                          // শুধু superadmin
canManageSettings(role)
canManageAnnouncements(role)
canWriteStories(role)                         // user ছাড়া সবাই
getAssignableRoles(actorRole)                 // actor যে রোল দিতে পারে
isSuperAdminRole(role)
```

`lib/admin-auth.ts` — সার্ভার-সাইড গেট:
```ts
isAdminAuthenticated()          // admin-tier অ্যাক্সেস
isFullAdmin()                   // admin + superadmin
isAuthorAuthenticated()         // user ছাড়া সবাই
isSuperAdmin()                  // শুধু superadmin
requirePermission(perm)         // API route গেট → { authorized, session }
```

---

## ৬. API অথোরাইজেশন নিয়ম

প্রতিটি সংবেদনশীল API route:

1. **Authenticate** — `getSession()` (লাইভ রোল DB থেকে)
2. **Check permission** — `requirePermission()` / `hasPermission()`
3. **Check ownership** — যেখানে প্রযোজ্য (story_id, user_id server-side verify)
4. **Perform action**
5. **Audit log** — সংবেদনশীল অ্যাকশনে

**কখনো trust করবেন না:**
- রিকোয়েস্ট বডির `role`
- ক্লায়েন্ট থেকে আসা user ID / story ID
- ক্লায়েন্ট-সাপ্লাইড permission / status / admin flags

**উদাহরণ (ম্যালিসিয়াস রিকোয়েস্ট):**
```json
{ "role": "superadmin" }
```
→ সার্ভার actual session থেকে role নেয়, বডি ignore করে।

---

## ৭. ডিলিট ওয়ার্কফ্লো (Safe Deletion)

```
অ্যাডমিন/কন্টেন্ট ম্যানেজার "ডিলিট" ক্লিক করে
        ↓
সফট হাইড (status → hidden) — পাবলিক থেকে লুকানো
        ↓
deletion_requests → pending
        ↓
সুপার অ্যাডমিন নোটিফিকেশন
        ↓
সুপার অ্যাডমিন রিভিউ
        ↓
├── approve → permanent delete (শুধু এখানে স্থায়ী ডিলিট)
└── reject → item হাইড থাকবে / প্রয়োজনে restore
```

- **শুধু `content.delete_permanent` পারমিশনওয়ালা** (superadmin) permanent delete করতে পারে।
- সব ডিলিট এন্ডপয়েন্ট এই নিয়ম enforce করে (`posts/manage`, `comments/[id]`, `deletion-requests`).
- অনুমোদনের পর `deletion_requests.approve` audit log হয়।

---

## ৮. রোল ম্যানেজমেন্ট

| Actor | কী করতে পারে |
|-------|-------------|
| **superadmin** | সব রোল assign/remove — এমনকি admin |
| **admin** | user/author/content_manager/moderator assign — কিন্তু **admin নয়**, superadmin নয় |
| **content_manager** | ❌ রোল ম্যানেজ করতে পারে না |
| **moderator** | ❌ |
| **author/user** | ❌ |

**সুরক্ষা:**
- `roles.assign_admin` → শুধু superadmin
- **Protected superadmin:** শেষ superadmin-কে delete/demote করা যায় না
- **Self-protection:** নিজের রোল পরিবর্তন করা যায় না; নিজের অ্যাকাউন্ট ডিলিট করা যায় না
- UI-তে unauthorized রোল অপশন **হাইড** হয় + backend-এ **reject** হয়

---

## ৯. অ্যাডমিন প্যানেল সেকশন ও পারমিশন

| সেকশন | Required Permission | superadmin | admin | content_manager | moderator |
|--------|--------------------|:---------:|:-----:|:---------------:|:---------:|
| ড্যাশবোর্ড | `analytics.view` | ✅ | ✅ | ✅ | ✅ |
| রিভিউ সেন্টার | `story.review` | ✅ | ✅ | ✅ (default) | ❌ |
| নিবন্ধিত লেখক | `authors.view` | ✅ | ✅ | ❌ | ❌ |
| নোটিফিকেশন | `notifications.view` | ✅ | ✅ | ✅ | ✅ |
| ভেরিফিকেশন | `users.verify` | ✅ | ✅ | ❌ | ❌ |
| ডিলিট রিকোয়েস্ট | `deletion_requests.view` | ✅ | ✅ | ❌ | ❌ |
| ইউজার ম্যানেজমেন্ট | `users.view` | ✅ | ✅ | ❌ | ❌ |
| মতামত | `comments.hide` | ✅ | ✅ | ❌ | ✅ |
| রিপোর্ট | `reports.manage` | ✅ | ✅ | ❌ | ✅ |
| সেটিংস | `settings.view` | ✅ | ✅ | ❌ | ❌ |
| ঘোষণা | `announcements.edit` | ✅ | ✅ | ❌ | ❌ |
| অডিট লগ | `audit_logs.view` | ✅ | ✅ | ❌ | ❌ |

AdminSidebar শুধু পারমিশন থাকলে item দেখায় (`hasPermission`-ভিত্তিক, hard-coded role check নেই)।

---

## ১০. লাইভ রোল চেঞ্জ

- `lib/auth.ts`-এর `getSession()` প্রতিটি রিকোয়েস্টে **DB থেকে লাইভ role** ফেচ করে।
- রোল বদলালে (promote/demote) → **পেজ রিলোড করলেই** নতুন পারমিশন অ্যাক্টিভ — re-login লাগে না।

---

## ১১. অডিট লগ

**টেবিল:** `admin_audit_logs` (আগে `lib/audit.ts`-এর `logAudit()`)

**রেকর্ড হয়:**
- রোল পরিবর্তন (`roles.assign`)
- গল্প প্রকাশ/প্রত্যাখ্যান/সংশোধন (`story.approve/reject/request_revision`)
- স্থায়ী ডিলিট (`content.delete_permanent`, `users.delete_permanent`)
- ভেরিফিকেশন (`users.verify`)
- লেখক ম্যানেজ (`authors.manage`)
- ডিলিট রিকোয়েস্ট অনুমোদন (`deletion_requests.approve`)

**রেকর্ড:**
`actor_id`, `actor_username`, `action`, `target_type`, `target_id`, `prev_state` (JSONB), `new_state` (JSONB), `created_at`

**নিয়ম:** পাসওয়ার্ড/সিক্রেট কখনো লগ হয় না। Fail-open — অডিট ব্যর্থ হলেও মূল অপারেশন চলে।

**UI:** `/admin/audit-logs` (permission: `audit_logs.view` — admin + superadmin)

**Fail-closed নিয়ম:** Role change, admin promotion, permanent delete ও security changes-এর ক্ষেত্রে audit লেখা ব্যর্থ হলে **অপারেশন নিজেই বাতিল** হয় (`logAuditCritical`)। সাধারণ content action-এ fail-open (`logAudit`)।

---

## ১২. নোটিফিকেশন ভিজিবিলিটি

| রোল | নোটিফিকেশন পায় |
|------|-----------------|
| superadmin | deletion requests, admin changes, security events, verification, system events |
| admin | author submissions, verification, reports, content events |
| content_manager | story submissions, revision activity, content events |
| moderator | comment reports, moderation reports, community safety |
| author | story status changes, revision requests, publication, comments on own stories |
| user | comments, replies, reactions, application status |

**কখনো অন্যের private নোটিফিকেশন দেখানো হয় না** — `user_id` দিয়ে ফিল্টার।

---

## ১৩. API Security Checklist

- [x] Privilege escalation blocked (role বডি থেকে নেওয়া হয় না)
- [x] IDOR blocked (user/story ID server-side verify)
- [x] Unauthorized API access blocked (`requirePermission`)
- [x] Client-side-only authorization নেই (সব API server-side check)
- [x] Role spoofing blocked (লাইভ DB role)
- [x] Unauthorized deletion blocked (delete flow)
- [x] Unauthorized publishing blocked (`content.publish`)
- [x] Unauthorized role assignment blocked (`roles.assign*`)

---

## ১৪. ফাইল রেফারেন্স

| ফাইল | কাজ |
|------|-----|
| `lib/permissions.ts` | একক পারমিশন রেজিস্ট্রি + ম্যাট্রিক্স + হেল্পার |
| `lib/admin-auth.ts` | সার্ভার-সাইড অথোরাইজেশন গেট |
| `lib/auth.ts` | JWT + লাইভ রোল ফেচ |
| `lib/audit.ts` | অডিট লগিং |
| `app/api/admin/posts/manage/route.ts` | গল্প approve/reject/hide/delete + audit |
| `app/api/admin/users/route.ts` | রোল ম্যানেজ + superadmin protection + audit |
| `app/api/admin/deletion-requests/route.ts` | ডিলিট রিকোয়েস্ট ফ্লো + audit |
| `app/api/admin/verify-requests/route.ts` | ভেরিফিকেশন + audit |
| `app/api/admin/applications/route.ts` | লেখক আবেদন + audit |
| `app/api/admin/reports/route.ts` | রিপোর্ট (reports.manage) |
| `app/api/admin/comments/[id]/route.ts` | কমেন্ট (comments.manage + soft delete) |
| `app/api/admin/announcement/route.ts` | ঘোষণা (announcements.edit) |
| `app/api/admin/audit-logs/route.ts` | অডিট লগ API |
| `components/admin/AdminSidebar.tsx` | permission-aware sidebar |
| `components/admin/AdminDashboard.tsx` | role-aware dashboard |
| `components/admin/AccessDenied.tsx` | 403 পেজ |
