import fs from "fs";
import path from "path";
import { getSiteConfig } from "./config";

const IMAGE_RE = /\.(jpg|jpeg|png|webp|gif|svg|avif|bmp)$/i;

// Refresh the file list periodically so newly-uploaded covers in the
// folder appear without needing a restart/redeploy.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedFiles: string[] | null = null;
let cachedDir: string | null = null;
let cachedAt = 0;

/**
 * Returns the live cover directory + the set of filenames that exist on
 * disk. Cached for CACHE_TTL_MS to avoid thousands of fs.existsSync calls
 * on every page render (this is the hot path for every post's cover).
 */
function getCoverState(): { urlDir: string; files: string[]; fileNameSet: Set<string> } {
  const config = getSiteConfig();
  const urlDir = (config.coverFallbackDir || "/images/Cover_pic/").replace(/\/?$/, "/");
  const fsDir = path.join(process.cwd(), "public", urlDir);

  if (cachedFiles !== null && cachedDir === fsDir && Date.now() - cachedAt < CACHE_TTL_MS) {
    return { urlDir, files: cachedFiles, fileNameSet: new Set(cachedFiles) };
  }

  try {
    const files = fs
      .readdirSync(fsDir)
      .filter((f) => IMAGE_RE.test(f))
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

/**
 * Returns the list of available fallback cover filenames in a STABLE order
 * (alphabetical) and the URL-prefix directory they live under.
 */
export function getCoverPool(): { files: string[]; urlDir: string } {
  const state = getCoverState();
  return { files: state.files, urlDir: state.urlDir };
}

/**
 * Normalizes cover URLs so only clean file links (like /images/Cover_pic/xxx.jpg or public cover_pic links)
 * are saved into the database, strictly rejecting base64 / raw image payloads.
 */
export function normalizeCoverUrl(cover: string | undefined | null): string {
  if (!cover || typeof cover !== "string") return "";
  const c = cover.trim();
  // Never allow base64 or raw image bytes in DB
  if (!c || c.startsWith("data:image") || c.length > 500) return "";
  if (/^https?:\/\//i.test(c)) return c;

  const state = getCoverState();
  const fileName = c.split("/").pop() || "";
  if (fileName && state.fileNameSet.has(fileName)) {
    return `${state.urlDir}${fileName}`;
  }
  return c;
}

/**
 * O(1) check whether a stored cover is usable.
 *  - empty            → broken, needs a fallback
 *  - base64/raw data  → forbidden in DB, returns false
 *  - external http(s) → assume usable (cannot verify locally)
 *  - cover-folder path → must point to an existing image in Cover_pic.
 *  - other local paths → keep as-is.
 */
export function isCoverAvailable(cover: string | undefined | null): boolean {
  if (!cover || typeof cover !== "string") return false;
  const c = cover.trim();
  if (!c) return false;

  // Never allow base64 or raw image data in database
  if (c.startsWith("data:image") || c.length > 500) return false;

  // External URLs — author-provided, keep them.
  if (/^https?:\/\//i.test(c)) return true;

  const state = getCoverState();
  const fileName = c.split("/").pop() || "";

  // If it points into the fallback cover dir or /cover_pic/
  if (
    c.toLowerCase().startsWith(state.urlDir.toLowerCase()) ||
    c.toLowerCase().startsWith("/cover_pic/") ||
    c.toLowerCase().startsWith("/images/cover_pic/")
  ) {
    return state.fileNameSet.has(fileName);
  }

  // Other local paths — keep as-is.
  return true;
}

/**
 * Returns a cover that is NOT yet used by any story, so every picture is
 * used exactly once before any is reused.
 */
export async function getUnusedCover(supabase: any): Promise<string | null> {
  const state = getCoverState();
  if (state.files.length === 0) return null;

  try {
    const { data } = await supabase.from("stories").select("cover");
    const usedCounts = new Map<string, number>();
    for (const s of data || []) {
      const c = (s.cover || "") as string;
      if (c.startsWith(state.urlDir)) {
        const name = c.slice(state.urlDir.length);
        usedCounts.set(name, (usedCounts.get(name) || 0) + 1);
      }
    }

    // 1) Prefer completely-unused pictures.
    for (const f of state.files) {
      if (!usedCounts.has(f)) {
        return `${state.urlDir}${f}`;
      }
    }

    // 2) All are used — reuse the least-used one (even spread).
    let leastName = state.files[0];
    let leastCount = Infinity;
    for (const f of state.files) {
      const count = usedCounts.get(f) || 0;
      if (count < leastCount) {
        leastCount = count;
        leastName = f;
      }
    }
    return `${state.urlDir}${leastName}`;
  } catch {
    // On any DB error fall back to a deterministic pick.
    return `${state.urlDir}${state.files[Date.now() % state.files.length]}`;
  }
}
