import fs from "fs";
import path from "path";
import { getSiteConfig } from "./config";

const AVATAR_RE = /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i;

// Refresh the file list periodically so newly-uploaded avatars appear.
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedFiles: string[] | null = null;
let cachedDir: string | null = null;
let cachedAt = 0;

/** Default avatars live in /images/avatars/. */
function getAvatarState(): { urlDir: string; files: string[]; fileNameSet: Set<string> } {
  const urlDir = "/images/avatars/";
  const fsDir = path.join(process.cwd(), "public", urlDir);

  if (cachedFiles !== null && cachedDir === fsDir && Date.now() - cachedAt < CACHE_TTL_MS) {
    return { urlDir, files: cachedFiles, fileNameSet: new Set(cachedFiles) };
  }

  try {
    const files = fs
      .readdirSync(fsDir)
      .filter((f) => AVATAR_RE.test(f))
      .sort();
    cachedFiles = files;
    cachedDir = fsDir;
    cachedAt = Date.now();
    return { urlDir, files, fileNameSet: new Set(files) };
  } catch {
    cachedFiles = [];
    cachedDir = fsDir;
    cachedAt = Date.now();
    return { urlDir, files: [], fileNameSet: new Set() };
  }
}

/** All available default avatars (absolute URL paths). */
export function getAvatarPool(): string[] {
  const state = getAvatarState();
  return state.files.map((f) => `${state.urlDir}${f}`);
}

/** Check whether a stored avatar path is a real file in the pool. */
export function isAvatarAvailable(avatar: string | undefined | null): boolean {
  if (!avatar || typeof avatar !== "string") return false;
  const c = avatar.trim();
  if (!c) return false;
  // External URLs — keep them (legacy user-uploaded images)
  if (/^https?:\/\//i.test(c)) return true;
  const state = getAvatarState();
  const fileName = c.split("/").pop() || "";
  return state.fileNameSet.has(fileName);
}

/**
 * Returns an avatar that is NOT yet used by any user, so every picture is
 * used once before any repeats. Falls back to the least-used one.
 */
export async function getUnusedAvatar(supabase: any): Promise<string> {
  const state = getAvatarState();
  const fallback = state.files.length > 0 ? `${state.urlDir}${state.files[0]}` : "/images/avatars/1.jpg";
  if (state.files.length === 0) return fallback;

  try {
    const { data } = await supabase.from("users").select("profile_pic");
    const usedCounts = new Map<string, number>();
    for (const u of data || []) {
      const c = (u.profile_pic || "") as string;
      if (c.startsWith(state.urlDir)) {
        const name = c.slice(state.urlDir.length);
        usedCounts.set(name, (usedCounts.get(name) || 0) + 1);
      }
    }

    // 1) Prefer completely-unused avatars
    for (const f of state.files) {
      if (!usedCounts.has(f)) return `${state.urlDir}${f}`;
    }

    // 2) All used — reuse the least-used one (even spread)
    let leastName = state.files[0];
    let leastCount = Infinity;
    for (const f of state.files) {
      const count = usedCounts.get(f) || 0;
      if (count < leastCount) { leastCount = count; leastName = f; }
    }
    return `${state.urlDir}${leastName}`;
  } catch {
    // Random fallback if the DB query fails
    return `${state.urlDir}${state.files[Math.floor(Math.random() * state.files.length)]}`;
  }
}
