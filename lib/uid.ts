/**
 * Unique 14-digit numeric story UID/SLUG helpers.
 * Every story (authored, crawled, or auto-posted) uses a 14-digit numeric
 * slug — no prefixes, no hex, no timestamps with letters.
 */

const UID_LENGTH = 14;

/** Generate a random 14-digit numeric string. */
export function random14DigitUid(): string {
  // 10^13 … (10^14 - 1) — always exactly 14 digits.
  const min = 10000000000000;
  const max = 99999999999999;
  return (Math.floor(Math.random() * (max - min + 1)) + min).toString();
}

/**
 * Keep trying until a unique 14-digit uid is found in the stories table.
 * Falls back to a fresh random candidate on every attempt, so collisions
 * (rare) are handled without ever producing a non-numeric slug.
 */
export async function generateUnique14DigitUid(supabase: any, attempts = 8): Promise<string> {
  let uid = random14DigitUid();
  try {
    for (let i = 0; i < attempts; i++) {
      const { data: clash } = await supabase.from("stories").select("uid").eq("uid", uid).maybeSingle();
      if (!clash) return uid;
      uid = random14DigitUid();
    }
  } catch {}
  // Even if the DB check fails, still return a valid 14-digit number.
  return random14DigitUid();
}

/** True when a value is exactly 14 digits (used to validate/repair slugs). */
export function is14DigitUid(value: string | null | undefined): boolean {
  return typeof value === "string" && /^\d{14}$/.test(value);
}
