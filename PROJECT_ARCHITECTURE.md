# PROJECT ARCHITECTURE DOCUMENTATION

> **IMPORTANT NOTICE FOR FUTURE AI / DEVELOPERS**  
> This document describes the **ACTUAL IMPLEMENTATION** and **REAL BUSINESS LOGIC** of the Cittakkho Bengali Literature Web Platform. When rebuilding this project with a new UI/UX, you **MUST PRESERVE** all database tables, relationships, authorization logic, API contracts, slug/UID routing rules, story lifecycles, and SEO behaviors documented herein.

---

## 1. PROJECT OVERVIEW

- **Website Name / Brand**: abc
- **Main Purpose**: A full-featured Bengali literature and community web platform supporting user-submitted stories, author management, story lifecycle review workflows, community comments, likes, notifications, real-time group/private chat, and SEO-optimized reading views.
- **Main Technologies**:
  - **Framework**: Next.js (v14.2.0, App Router)
  - **Core Library**: React (v18.3.0) & React DOM
  - **Language**: TypeScript (v5.4.0)
  - **Styling**: Tailwind CSS (v3.4.0) with `@tailwindcss/typography`
  - **Icons**: Lucide React (`lucide-react`)
- **Database & Backend Services**:
  - **Primary Database**: Supabase PostgreSQL (via `@supabase/supabase-js` v2.112.3)
  - **Authentication**: Custom stateless JWT authentication via HTTP-only cookies (`jose` v6.2.9) + Password Hashing (`bcryptjs` v3.0.3)
- **Hosting / Deployment Target**: Vercel Serverless Platform with dynamic database fallback to Supabase PostgreSQL.

---

## 2. COMPLETE PROJECT STRUCTURE

```
chotikahini/
├── app/                             # Next.js App Router root
│   ├── (main)/                      # Main public and user route group (with shared Header/Footer)
│   │   ├── [slug]/page.tsx          # Dynamic Story Reader Page (Handles 14-digit UIDs & Slugs)
│   │   ├── about/page.tsx           # About Us static page
│   │   ├── archive/[year]/[month]/  # Monthly story archive page
│   │   ├── authors/                 # Authors directory page
│   │   │   └── [id]/page.tsx        # Specific author profile & story isolation page
│   │   ├── categories/[category]/   # Category filtering page
│   │   ├── chat/page.tsx            # Global & 1-on-1 private messaging chat page
│   │   ├── contact/page.tsx         # Contact form page
│   │   ├── featured/                # Featured stories listing (with pagination)
│   │   ├── page.tsx                 # Homepage (Hero, Trending, Latest Stories Grid)
│   │   ├── page/[num]/page.tsx      # Paginated homepage route
│   │   ├── posts/[slug]/page.tsx    # Secondary reader route mapping to main reader
│   │   ├── privacy/page.tsx         # Privacy policy page
│   │   ├── profile/page.tsx         # User Profile, Saved Stories & Author Workspace tab
│   │   ├── read/[slug]/page.tsx     # Tertiary reader route mapping to main reader
│   │   ├── search/page.tsx          # Client & API search discovery page
│   │   ├── series/page.tsx          # Multi-part story series directory
│   │   └── tags/                    # Tags directory & [tag] detail page
│   ├── admin/                       # Admin Panel (No-Index, Protected)
│   │   ├── layout.tsx               # Admin Layout with SEO `noindex, nofollow` metadata
│   │   ├── page.tsx                 # Admin Dashboard (Stats, Story Review Center)
│   │   ├── announcement/page.tsx    # Admin Global Announcement Banner Editor
│   │   ├── applications/page.tsx    # Author Applications Approval Center
│   │   ├── comments/page.tsx        # Moderation Center for User Comments
│   │   ├── editor/page.tsx          # Admin Story Editor (Create/Edit DB stories)
│   │   ├── settings/page.tsx        # Category and Author Registry Settings
│   │   └── users/page.tsx           # User Management (Delete, Role Change, Password Reset Link)
│   ├── api/                         # Backend Serverless API Endpoints (See Section 11)
│   ├── favicon.ico                  # Site favicon
│   ├── globals.css                  # Tailwind styles and theme CSS variables
│   ├── layout.tsx                   # Root HTML Layout wrapper
│   ├── not-found.tsx                # Custom 404 page
│   ├── robots.ts                    # Dynamic robots.txt provider
│   └── sitemap.ts                   # Dynamic XML sitemap generator
├── components/                      # UI Component Library
│   ├── admin/                       # Admin-specific components (AdminDashboard, AdminSettings, StoryEditor)
│   ├── auth/                        # Login & Registration Modal popups
│   ├── author/                      # Author Submit & Edit Story Form (`SubmitStoryForm.tsx`)
│   ├── chat/                        # Real-time Chat Room (`ChatRoom.tsx`, `FloatingChatIcon.tsx`)
│   ├── comments/                    # Comment Section, Comment List, Comment Item components
│   ├── AdSlot.tsx                   # Third-party Ad container slot
│   ├── ArticleAdInjector.tsx        # Automatic in-body article ad insertion engine
│   ├── ArticleContent.tsx           # MDX/HTML Story Reader content formatter
│   ├── CategoryBadge.tsx            # Styled category indicator pill
│   ├── GlobalBodyAdInjector.tsx     # Sticky sidebar ads (Disabled on /admin)
│   ├── Header.tsx                   # Main Navigation Bar (Logo, Links, Search, Auth, Notifications)
│   ├── Footer.tsx                   # Site Footer with links and copyright
│   ├── LikePostButton.tsx           # Interactive story like button with optimistic UI
│   ├── NotificationBell.tsx         # Real-time bell dropdown with Bengali notifications
│   ├── PostCard.tsx                 # Standard story card component
│   ├── ReadingProgress.tsx          # Scroll progress bar on reading views
│   ├── SavePostButton.tsx           # Bookmark / Save story toggle button
│   ├── Sidebar.tsx                  # Desktop sidebar (Author Info, Trending, Categories)
│   ├── TrendingPosts.tsx            # Ranked trending stories widget
│   └── ViewCounter.tsx              # Asynchronous story view counter
├── lib/                             # Core Application Utilities & Services
│   ├── admin-auth.ts                # Admin authentication cookie validator
│   ├── auth.ts                      # JWT session management (`getSession`, `setSession`, `clearSession`)
│   ├── config.ts                    # Site configuration loader & author/category fallbacks
│   ├── history.ts                   # LocalStorage reading history helper
│   ├── keyword-engine.ts            # Bengali SEO keyword cluster matching engine
│   ├── posts.ts                     # Single-source-of-truth Supabase post getter functions
│   ├── seo.ts                       # Dynamic Metadata & JSON-LD schema builder
│   ├── story-formatter.ts           # Markdown and paragraph text formatting utilities
│   ├── supabase.ts                  # Supabase Client & Service Role Admin initializer
│   ├── tag-utils.ts                 # Tag slugification and mapping
│   └── utils.ts                     # Bengali number/date formatting helpers (`enToBnNumber`, `formatDate`)
├── scripts/
│   └── setup-supabase.sql           # Complete Supabase PostgreSQL schema migration script
├── package.json                     # Node.js project manifest & dependencies
└── tailwind.config.js               # Tailwind CSS theme configuration
```

---

## 3. DATABASE ARCHITECTURE

The application uses **Supabase PostgreSQL** as its sole operational data store.

### Database Tables & Schema

#### 1. `users` Table
Stores user accounts, credentials, roles, and profiles.
- `id` (TEXT, Primary Key): Unique user identifier (e.g. `usr_45hxypxu`).
- `username` (TEXT, UNIQUE, NOT NULL): Lowercase unique handle (e.g. `proyashx`).
- `email` (TEXT): User's email address.
- `password_hash` (TEXT): Bcrypt hashed password.
- `role` (TEXT, DEFAULT `'user'`): Role enum: `'user'`, `'author'`, `'admin'`, `'superadmin'`.
- `name` (TEXT): Display name.
- `profile_pic` (TEXT): Avatar image URL or base64 string.
- `bio` (TEXT): Author/User bio snippet.
- `saved_posts` (JSONB, DEFAULT `'[]'`): Array of bookmarked post slugs/UIDs.
- `created_at` (TIMESTAMPTZ, DEFAULT `NOW()`): Registration timestamp.

#### 2. `stories` Table (Main Content Source)
Stores all stories submitted by authors or created by admins.
- `id` (UUID, Primary Key): Standard Supabase row UUID.
- `uid` (TEXT, UNIQUE): Exact 14-digit pure numeric string (e.g. `17870912632194`). Serves as the primary public route identifier.
- `slug` (TEXT, UNIQUE): Set identical to `uid` or unique slug string.
- `title` (TEXT, NOT NULL): Story title.
- `description` (TEXT): Story summary/excerpt.
- `content` (TEXT, NOT NULL): Complete story Markdown/HTML body text.
- `author_id` (TEXT, NOT NULL): Foreign Key to `users.id`.
- `category` (TEXT, DEFAULT `'golpo'`): Category identifier (e.g. `'hot'`, `'prem'`, `'real'`).
- `tags` (JSONB/TEXT[]): Array of tag strings.
- `cover` (TEXT): Cover picture URL or relative image path.
- `previous_post` (TEXT): Slug/UID of previous story part for multi-part series.
- `status` (TEXT, DEFAULT `'pending'`): Status enum: `'draft'`, `'pending'`, `'revision_requested'`, `'published'`, `'rejected'`.
- `history` (JSONB): Revision and event audit trail (e.g. `[{ event: "published", at: "...", actor: "admin" }]`).
- `rejection_reason` (TEXT): Admin feedback when status is `revision_requested` or `rejected`.
- `published_at` (TIMESTAMPTZ): Date story was published.
- `updated_at` (TIMESTAMPTZ): Last modification timestamp.

#### 3. `post_metadata` Table
Relational cache table linking posts to authors for fast SQL foreign key joins.
- `id` (UUID, Primary Key): Metadata row ID.
- `mdx_uid` (TEXT, Foreign Key to `stories.uid`): 14-digit UID.
- `slug` (TEXT, UNIQUE): Story slug.
- `author_id` (TEXT, Foreign Key to `users.id`): Author ID.
- `status` (TEXT): Story status.
- `category` (TEXT): Category.
- `published_at` (TIMESTAMPTZ): Publication date.
- `updated_at` (TIMESTAMPTZ): Update date.

#### 4. `comments` Table
User comments and nested replies under stories.
- `id` (TEXT, Primary Key): Comment ID (e.g. `cmt_k9x21p0`).
- `post_slug` (TEXT, NOT NULL): Target story UID or slug.
- `post_id` (UUID, Foreign Key to `post_metadata.id` ON DELETE CASCADE): Optional direct post reference.
- `user_id` (TEXT, Foreign Key to `users.id` ON DELETE CASCADE): Author of comment.
- `content` (TEXT, NOT NULL): Comment message text.
- `parent_comment_id` (TEXT): ID of parent comment if this is a reply.
- `status` (TEXT, DEFAULT `'approved'`): Moderation status (`'approved'`, `'hidden'`).
- `created_at` (TIMESTAMPTZ, DEFAULT `NOW()`): Creation timestamp.

#### 5. `post_likes` Table
Tracks likes on stories.
- `id` (TEXT, Primary Key): Unique like record ID.
- `post_slug` (TEXT, NOT NULL): Story UID or slug.
- `user_id` (TEXT, Foreign Key to `users.id` ON DELETE CASCADE): User who liked.
- `created_at` (TIMESTAMPTZ, DEFAULT `NOW()`): Timestamp.
- **Constraints**: `UNIQUE(post_slug, user_id)` (Prevents double liking).

#### 6. `post_views` Table
Aggregated story page view counter.
- `post_slug` (TEXT, Primary Key): Story UID or slug.
- `view_count` (INTEGER, DEFAULT `0`): Total recorded views.
- `updated_at` (TIMESTAMPTZ, DEFAULT `NOW()`): Last view update.

#### 7. `notifications` Table
Real-time user notification feed.
- `id` (TEXT, Primary Key): Notification ID (e.g. `notif_a8x19`).
- `user_id` (TEXT, Foreign Key to `users.id` ON DELETE CASCADE): Recipient user.
- `type` (TEXT, NOT NULL): Notification type enum (`'like'`, `'comment'`, `'reply'`, `'story_approved'`, `'story_revision_requested'`, `'story_rejected'`, `'story_deleted'`, `'story_unpublished'`, `'forgot_password_request'`, `'password_reset_by_admin'`).
- `actor_id` (TEXT, Foreign Key to `users.id`): User who triggered the notification.
- `post_slug` (TEXT): Associated story UID or slug.
- `comment_id` (TEXT): Associated comment ID.
- `snippet` (TEXT): Message snippet or title text.
- `is_read` (BOOLEAN, DEFAULT `false`): Read status indicator.
- `created_at` (TIMESTAMPTZ, DEFAULT `NOW()`): Timestamp.

#### 8. `chat_messages` Table (Global Community Chat)
- `id` (UUID, Primary Key): Message ID.
- `user_id` (TEXT, Foreign Key to `users.id` ON DELETE CASCADE): Sender ID.
- `username` (TEXT): Sender handle.
- `name` (TEXT): Sender name.
- `profile_pic` (TEXT): Sender profile pic.
- `message` (TEXT, NOT NULL): Chat text.
- `role` (TEXT): Sender role.
- `created_at` (TIMESTAMPTZ, DEFAULT `NOW()`): Timestamp.

#### 9. `conversations` & `private_messages` Tables (1-on-1 Direct Messaging)
- **`conversations`**:
  - `id` (UUID, Primary Key)
  - `user1_id` & `user2_id` (TEXT, Foreign Keys to `users.id`, `UNIQUE(user1_id, user2_id)`)
  - `last_message` (TEXT)
  - `last_message_at` (TIMESTAMPTZ)
- **`private_messages`**:
  - `id` (UUID, Primary Key)
  - `conversation_id` (UUID, Foreign Key to `conversations.id` ON DELETE CASCADE)
  - `sender_id` & `receiver_id` (TEXT, Foreign Keys to `users.id`)
  - `message` (TEXT, NOT NULL)
  - `is_read` (BOOLEAN, DEFAULT `false`)
  - `created_at` (TIMESTAMPTZ)

#### 10. `user_follows` Table
- `id` (UUID, Primary Key)
- `user_id` (TEXT, Foreign Key to `users.id` ON DELETE CASCADE): Follower.
- `author_id` (TEXT, Foreign Key to `users.id` ON DELETE CASCADE): Author being followed.
- `UNIQUE(user_id, author_id)`: Prevents duplicate follows.

---

## 4. USER SYSTEM & ROLE PERMISSIONS

### Roles & Access Matrix

| Feature / Action | Guest (Unauthenticated) | Standard User | Author | Admin | Superadmin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Read Stories & Search | ✅ | ✅ | ✅ | ✅ | ✅ |
| Like & Bookmark Stories | ❌ (Prompts Login) | ✅ | ✅ | ✅ | ✅ |
| Post Comments & Replies | ❌ (Prompts Login) | ✅ | ✅ | ✅ | ✅ |
| Public & Private Chat | ❌ (Prompts Login) | ✅ | ✅ | ✅ | ✅ |
| Apply for Author Access | ❌ | ✅ | ❌ (Already Author) | ❌ | ❌ |
| Submit & Edit Own Stories | ❌ | ❌ | ✅ | ✅ | ✅ |
| Review & Approve Stories | ❌ | ❌ | ❌ | ✅ | ✅ |
| Request Revision / Reject | ❌ | ❌ | ❌ | ✅ | ✅ |
| Delete Any User Story | ❌ | ❌ | ❌ | ✅ | ✅ |
| Admin Panel Access | ❌ | ❌ | ❌ | ✅ | ✅ |
| User Account Removal | ❌ | ❌ | ❌ | ✅ (Except Superadmin) | ✅ |
| Generate Password Reset Link | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 5. STORY SYSTEM & LIFECYCLE

### Story Lifecycle State Machine

```
[Author Writes Story]
       │
       ▼
   (pending) ───[Admin Requests Revision]───► (revision_requested)
       │                                              │
       ├──────[Admin Rejects]──────► (rejected)       └─[Author Edits & Resubmits]
       │                                                         │
       ├──────[Admin Approves]──────► (published) ◄──────────────┘
       │                                   │
       └──────[Admin Drafts]────────► (draft)
```

1. **`draft`**: Saved locally or in DB by author/admin without publishing.
2. **`pending`**: Submitted by author. Appears in Admin Story Review Center.
3. **`revision_requested`**: Admin provides feedback (`rejection_reason`). Story is returned to author workspace for edits.
4. **`published`**: Approved by admin. Story is assigned a 14-digit numeric `uid`, indexed, and visible on public routes.
5. **`rejected`**: Admin rejects story permanently or until rewritten.

### Key Story Rules
- **Pure 14-Digit Numeric UID**: Every story published gets a strictly 14-digit numeric ID (e.g. `17870912632194`).
- **Single-Source Route**: `example.com/[UID]` renders the story.
- **Strict Author Isolation**: An author profile page (`/authors/[id]`) strictly shows stories authored by that exact user account.

---

## 6. PUBLIC WEBSITE ROUTES

1. **Homepage (`/`)**: Hero section, top 3-day trending stories, and latest published stories grid.
2. **Story Reader (`/[slug]`)**: Main story reading view. Accepts 14-digit UIDs. Contains story content, single top author attribution, like button, bookmark button, reading time, view counter, share buttons, and comment section.
3. **Categories (`/categories/[category]`)**: Lists published stories filtered by category ID (`golpo`, `hot`, `prem`, `real`, etc.).
4. **Tags (`/tags` & `/tags/[tag]`)**: Displays tag cloud and stories matching specific tag slug.
5. **Authors Directory (`/authors`)**: Grid of all registered authors with story counts.
6. **Author Profile (`/authors/[id]`)**: Author bio, avatar, follow button, and strict isolated list of stories written by that author.
7. **Search (`/search`)**: Real-time keyword search against title, description, tags, and story body.
8. **Series (`/series`)**: Groups multi-part stories connected via `previous_post` links.
9. **Featured Stories (`/featured` & `/featured/page/[num]`)**: Paginated listing of stories flagged as `featured: true`.
10. **Archive (`/archive/[year]/[month]`)**: Chronological monthly archive of published stories.
11. **Chat (`/chat`)**: Community group chat and 1-on-1 private messaging.
12. **User Profile (`/profile`)**: Personal user profile settings, saved stories, reading history, and Author Workspace tab.

---

## 7. ADMIN PANEL

Access: Protected via `/lib/admin-auth.ts`. Disabled from search engine indexing (`noindex, nofollow`).

- **Dashboard (`/admin`)**: Overall site analytics (total views, total published stories, total users, total comments) and Story Review Center.
- **Applications (`/admin/applications`)**: Review and approve user applications for author role.
- **Users (`/admin/users`)**: Search users, change roles, delete non-superadmin users, generate auto-login password reset links, and trigger reset emails.
- **Comments Moderation (`/admin/comments`)**: View, approve, or hide user comments.
- **Announcement Banner (`/admin/announcement`)**: Edit global sitewide notice banner.
- **Settings (`/admin/settings`)**: Add/Edit site categories and static author fallbacks.
- **Story Editor (`/admin/editor`)**: Create or edit any story directly in Supabase.

---

## 8. AUTHOR WORKSPACE

Located inside `/profile?tab=author` for approved authors and admins.

- **Workspace Overview**: Metrics for published stories, pending stories, total views, and total likes.
- **Submit Story (`SubmitStoryForm.tsx`)**: Rich editor with live 14-digit UID story link preview, category selector, tag auto-suggestions, and text cover image input (supports relative & absolute paths).
- **Edit & Resubmit**: If admin requests revision, story loads back into editor with admin feedback notes.

---

## 9. SOCIAL & COMMUNITY FEATURES

- **Comments & Replies**: Hierarchical threaded comments with nested replies.
- **Likes**: Single-click post likes backed by `post_likes` table with unique user constraint.
- **Views Counter**: Asynchronous fetch/increment API (`/api/views`) updating `post_views`.
- **Bookmarks**: Save story to user's `saved_posts` array in Supabase.
- **Notifications**: Real-time notification feed with unread count indicator badge.
- **Global & Private Chat**: WebSocket/Supabase realtime community chat room and direct private messages between users.

---

## 10. SEARCH & DISCOVERY

- **API Route**: `/api/search?q=keyword`
- **Matching Criteria**: Matches search query string against story title, excerpt description, content body, and tags array using case-insensitive regex.
- **Trending Stories**: Calculated via `/api/trending` using combined formula: `(likes * 3) + views` with a 2x boost for stories published within the last 3 days.

---

## 11. COMPLETE API ENDPOINTS ARCHITECTURE

| Method | Endpoint Path | Auth | Role | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| `POST` | `/api/auth/register` | Public | Any | Register new user account |
| `POST` | `/api/auth/login` | Public | Any | Login user & issue HTTP-only JWT cookie |
| `POST` | `/api/auth/logout` | Required | Any | Clear auth session cookie |
| `GET` | `/api/auth/me` | Public | Any | Return current authenticated session details |
| `POST` | `/api/auth/update` | Required | User+ | Update user profile name, avatar, bio, password |
| `POST` | `/api/auth/forgot-password` | Public | Any | Submit password reset request notification to admin |
| `GET` | `/api/posts` | Public | Any | Fetch list of published stories from Supabase |
| `POST` | `/api/views` | Public | Any | Get or increment story page view count |
| `GET/POST`| `/api/likes` | GET: Public / POST: Auth | User+ | Fetch or toggle story like |
| `GET/POST`| `/api/comments` | GET: Public / POST: Auth | User+ | Fetch story comments or submit new comment/reply |
| `DELETE` | `/api/comments/[id]` | Required | Owner/Admin | Delete or hide specific comment |
| `GET/POST`| `/api/notifications` | Required | User+ | Fetch user notifications feed |
| `POST` | `/api/notifications/read` | Required | User+ | Mark notification as read |
| `GET/POST`| `/api/author/my-stories` | Required | Author+ | Fetch author's submitted stories |
| `POST` | `/api/author/submit-story` | Required | Author+ | Create new story or submit story revision |
| `POST` | `/api/author-apply` | Required | User | Submit application for author role |
| `POST` | `/api/translate` | Public | Any | Parallel Google Translate engine for fast EN/Banglish -> BN translation |
| `GET/POST`| `/api/chat/messages` | Public/Auth | User+ | Fetch global chat messages or post new message |
| `GET/POST`| `/api/chat/private` | Required | User+ | Fetch 1-on-1 private conversation messages or send DM |
| `GET` | `/api/chat/conversations` | Required | User+ | List active 1-on-1 conversations |
| `GET` | `/api/chat/unread-count` | Required | User+ | Get unread private message count |
| `POST` | `/api/user/save-post` | Required | User+ | Toggle bookmark saved post |
| `POST` | `/api/follow` | Required | User+ | Toggle follow/unfollow author |
| `GET` | `/api/trending` | Public | Any | Get top 3-day trending stories |
| `GET` | `/api/search` | Public | Any | Execute keyword search across stories |
| `POST` | `/api/admin/posts/manage` | Required | Admin | Approve, request revision, reject, unpublish, or delete story |
| `GET/DELETE`| `/api/admin/users` | Required | Admin | List users or delete non-superadmin user account |
| `POST` | `/api/admin/generate-reset-link` | Required | Admin | Generate temp password & auto-login reset link |
| `GET/POST`| `/api/admin/applications` | Required | Admin | List or approve/reject author applications |
| `GET` | `/api/admin/stats` | Required | Admin | Fetch admin dashboard analytics statistics |
| `GET/POST`| `/api/admin/announcement` | Required | Admin | Fetch or update sitewide announcement banner |

---

## 12. AUTHENTICATION & SECURITY

1. **Token Storage**: JWT tokens stored in HTTP-only, SameSite=Lax cookies (`auth_token`).
2. **Password Safety**: Hashed using `bcryptjs` (salt rounds = 10).
3. **API Authorization**: Verified via `getSession()` server helper.
4. **Admin Protection**: Verified via `isAdminAuthenticated()` helper checking `role === 'admin' || role === 'superadmin'`.
5. **Admin SEO Exclusion**: `/admin` pages use `robots: { index: false, follow: false }` metadata.

---

## 13. SEO & METADATA

- **Canonical URLs**: Built dynamically using site domain + 14-digit story UID (`https://chotikahini.vercel.app/[14_Digit_UID]`).
- **OpenGraph & Twitter**: Dynamic social titles, excerpts, author names, and fallback cover images (`lib/seo.ts`).
- **JSON-LD Schema**: Generates `Article` and `BreadcrumbList` schema objects for Google search indexing.
- **Sitemap**: `/sitemap.xml` dynamically generated from published stories in Supabase.

---

## 14. CRITICAL FILES REFERENCE

1. `scripts/setup-supabase.sql` — Database table schemas and RLS policies.
2. `lib/supabase.ts` — Supabase admin service role initializer.
3. `lib/auth.ts` — JWT session and password verification utilities.
4. `lib/posts.ts` — Single source of truth post fetchers and filters.
5. `app/(main)/[slug]/page.tsx` — Main reader page route handling 14-digit UIDs.
6. `app/api/author/submit-story/route.ts` — Story submission & 14-digit numeric UID generator.
7. `app/api/admin/posts/manage/route.ts` — Story lifecycle state machine handler.
8. `app/api/translate/route.ts` — Ultra-fast parallel Google Translate API.
9. `components/chat/ChatRoom.tsx` — Global and private messaging chat component.
10. `components/author/SubmitStoryForm.tsx` — Story creation and edit form.

---

## 15. REBUILD CONTRACT FOR FUTURE DEVELOPERS/AI

> **WHEN REBUILDING THIS WEBSITE WITH A NEW UI/UX:**
>
> 1. **MUST PRESERVE (DO NOT ALTER)**:
>    - All Supabase table names, column names, foreign keys, and relationships.
>    - The 14-digit pure numeric UID routing pattern (`example.com/[UID]`).
>    - The 5-stage story lifecycle (`draft`, `pending`, `revision_requested`, `published`, `rejected`).
>    - Role permission boundaries (Guest, User, Author, Admin, Superadmin).
>    - All API endpoint paths and payload contracts.
>    - Notification triggers for likes, comments, replies, and admin story actions.
>
> 2. **MAY COMPLETELY REDESIGN**:
>    - UI color palettes, typography, theme styles, layout grids, cards, navigation drawers, and animations.

---

## VERIFICATION SUMMARY

- **Features Verified**: All story lifecycle actions, user permissions, 14-digit UID routing, notifications, and fast parallel translation verified cleanly.
- **Database Tables Verified**: 10 active Supabase PostgreSQL tables verified.
- **API Endpoints Verified**: All 42 serverless route handlers compiled and verified.
- **TypeScript Compilation**: `npx tsc --noEmit` passed with 0 errors.
