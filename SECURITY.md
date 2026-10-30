# Cittakkho — Security Audit & Hardening

আপনার ওয়েবসাইটের নিরাপত্তা অডিট ও হার্ডনিংয়ের সম্পূর্ণ বিবরণ। নিচের **ACTION REQUIRED** অংশগুলো অবশ্যই করবেন।

---

## 🚨 ACTION REQUIRED (আপনাকে করতে হবে)

### 1. Admin password পরিবর্তন করুন (জরুরি!)
`.env.local`-এ `ADMIN_PASSWORD=123456` — **এটি যেকোনো জায়গায় ভাঙা যায়।** অবিলম্বে একটি শক্তিশালী পাসওয়ার্ড দিন:
```
ADMIN_PASSWORD=একটি-লম্বা-এবং-জটিল-পাসওয়ার্ড
```

### 2. Supabase-এ Security-Hardening SQL চালান
Supabase Dashboard → SQL Editor-এ `scripts/security-hardening.sql` চালান। এটি সব বিপজ্জনক RLS policy সরিয়ে দেবে।

### 3. Supabase CORS সীমিত করুন
Supabase Dashboard → Settings → API → CORS-এ শুধু আপনার ডোমেইন রাখুন:
```
https://chotikahini.vercel.app
```
(`*` কখনোই রাখবেন না)

### 4. Service Role Key ঘুরান (rotate)
Supabase Dashboard → Settings → API → **Rotate keys**। Service role key-টি কখনো public bundle-এ থাকা উচিত নয়। যদি সন্দেহ হয় কোনো জায়গায় ফাঁস হয়েছে, rotate করুন।

### 5. .env.local কখনো Git-এ দেবেন না
`.env.local` gitignore-এ আছে ✓ — নিশ্চিত করুন অন্য কেউ commit না করে।

---

## ✅ যা কোডে ফিক্স করা হয়েছে

### ১. Users টেবিল আর public-রিডেবল নয় (CRITICAL)
**আগে:** `users` টেবিলে `FOR SELECT USING (true)` policy ছিল → **যেকোনো ব্যক্তি** anon key দিয়ে সব users-এর **ইমেইল ও password_hash** পড়তে পারত।

**এখন:** `scripts/security-hardening.sql` + `scripts/setup-supabase.sql`-এ policy মুছে দেওয়া হয়েছে। সব data এখন শুধু server API routes দিয়ে যায় (service role key)।

### ২. Chat/Private messages আর public নয়
**আগে:** `chat_messages` public-রিডেবল ছিল → কেউ Realtime subscribe করে **সব প্রাইভেট মেসেজ** দেখতে পারত।

**এখন:** public policy সরানো হয়েছে।

### ৩. অন্যান্য সংবেদনশীল টেবিল বন্ধ
`reports`, `story_progress`, `verification_requests`, `deletion_requests`, `author_applications` (রিয়েল নাম!), `admin_audit_logs`, `comment_reactions` — সব public-রিডেবল policy সরানো হয়েছে।

### ৪. Public pages থেকে Email বাদ
- `content/authors/authors.json` — সব real email মুছে দেওয়া হয়েছে
- `/authors/[id]` পেজ — mailto ইমেইল বাটন বাদ
- `AuthorSocialIcons` — email icon বাদ
- `Sidebar` / author page — DB থেকে `email` field আর fetch হয় না

### ৫. Login/Password-reset-এ Rate Limiting
- `lib/rate-limit.ts` — IP-based rate limiter
- Login: ১০ মিনিটে ৫টি চেষ্টা → এরপর 429
- Forgot-password: ১০ মিনিটে ১০টি চেষ্টা

### ৬. রোল ভিত্তিক permission system
আগের কাজ থেকে: `lib/permissions.ts` — superadmin/admin/content_manager/moderator/author/user প্রতিটির জন্য explicit permission। সার্ভার-সাইড enforcement + audit log।

---

## 🔒 ইতিমধ্যে থাকা নিরাপত্তা ফিচার

- **CSP** (Content-Security-Policy) — `next.config.js`-এ
- **X-Frame-Options: SAMEORIGIN** — clickjacking প্রতিরোধ
- **X-Content-Type-Options: nosniff** — MIME sniffing বন্ধ
- **Referrer-Policy: strict-origin-when-cross-origin**
- **Permissions-Policy** — camera/mic/geolocation blocked
- **HSTS** — HTTPS ফোর্স
- **robots.txt** — `/api/admin/`, `/api/auth/` disallowed
- **Service role key** — শুধু server-side (কখনো client bundle-এ যায় না)
- **bcrypt** password hashing
- **Live role refresh** — রোল পরিবর্তন সাথে সাথে কার্যকর
- **Audit log** — সংবেদনশীল admin অ্যাকশন

---

## 📋 ডেটাবেস সিকিউরিটি সারাংশ

| টেবিল | Public Read? | কারণ |
|--------|:-----------:|------|
| users | ❌ (বন্ধ) | ইমেইল, password_hash |
| chat_messages | ❌ (বন্ধ) | প্রাইভেট কথোপকথন |
| private_messages | ❌ (বন্ধ) | প্রাইভেট |
| conversations | ❌ (বন্ধ) | প্রাইভেট |
| notifications | ❌ (বন্ধ) | ব্যক্তিগত |
| reports | ❌ (বন্ধ) | রিপোর্টার info |
| author_applications | ❌ (বন্ধ) | রিয়েল নাম |
| verification_requests | ❌ (বন্ধ) | ব্যক্তিগত কারণ |
| admin_audit_logs | ❌ (বন্ধ) | অ্যাডমিন অ্যাকশন |
| comments | ✅ | পাবলিক কনটেন্ট |
| post_likes | ✅ | পাবলিক কাউন্ট |
| post_reactions | ✅ | পাবলিক রিঅ্যাকশন |
| post_views | ✅ | পাবলিক কাউন্ট |
| story_coauthors | ✅ | পাবলিক প্রদর্শন |

> সব রাইট অপারেশন anon/authenticated থেকে revoked — শুধু service role key লিখতে পারে।
