import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// The browser client MUST bypass platform fetch caching because Supabase
// attaches per-request auth headers that the data cache cannot dedupe
// safely. The server admin client intentionally uses the default fetch
// (no `cache: "no-store"` override) because the read data cache is handled
// in `lib/cache.ts` via `unstable_cache` with explicit `revalidate` — that
// is what makes ISR prerender work on Vercel. Forcing `no-store` on the
// server client was breaking every ISR page's static prerender and
// ballooning build times from ~30s to 6+ minutes (Next 14 throws
// "Dynamic server usage: no-store fetch" for each of the 307 pages).
const noStoreFetch = (url: RequestInfo | URL, options: RequestInit = {}) =>
  fetch(url, { ...options, cache: "no-store" as RequestCache });

// Client-side Supabase client (used for reading and Realtime)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  global: { fetch: noStoreFetch },
});

// Singleton admin client. Creating a client is cheap-ish but there were 200+
// call sites, and each `createClient` allocates a fresh auth/realtime/agent
// stack. Reuse one instance per process (keyed by the service-role key so an
// env change during dev still takes effect).
let adminClient: SupabaseClient | null = null;
let adminClientKey = "";

// Server-side Admin client (used for inserting/deleting messages securely).
// This should ONLY be imported and used in API routes / server code, NEVER in
// client components (it carries the service-role key).
export function getSupabaseAdmin(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!adminClient || adminClientKey !== serviceRoleKey) {
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
      // Intentionally NOT overriding `fetch` with `noStoreFetch` here.
      // The server read paths are wrapped in `unstable_cache` (see
      // `lib/cache.ts`) and rely on the platform data cache for ISR.
    });
    adminClientKey = serviceRoleKey;
  }
  return adminClient;
}
