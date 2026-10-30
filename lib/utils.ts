const TIMEZONE = "Asia/Dhaka";

/**
 * NaN-safe replacement for the `new Date(x).toLocale*()` pattern that was
 * scattered across the app. Those raw calls rendered the literal string
 * "Invalid Date" whenever a row came back with a null / empty / malformed
 * timestamp (legacy rows, admin-inserted data, optimistic rows).
 *
 * `kind` picks the presentation; `locale` defaults to bn-BD.
 * Returns "" when the value is missing or unparseable — never "Invalid Date".
 */
export function bndSafe(
  input: unknown,
  kind: "date" | "datetime" = "date",
  locale = "bn-BD"
): string {
  if (input == null || input === "") return "";
  const d = input instanceof Date ? input : new Date(String(input));
  if (!(d instanceof Date) || isNaN(d.getTime())) return "";
  try {
    if (kind === "datetime") return d.toLocaleString(locale);
    return d.toLocaleDateString(locale);
  } catch {
    return "";
  }
}

/**
 * Parse an ISO-ish date string that is already in Asia/Dhaka offset (+06:00)
 * and return the date components WITHOUT converting to UTC.
 *
 * The stored publishedAt/updatedAt fields always use the format
 * "2026-07-25T01:00:00+06:00", so the first 10 characters are the
 * correct year-month-day in Asia/Dhaka.
 */
/**
 * Safely format a time for UI (HH:MM in 24h).
 * Returns "" if the input is missing or unparseable, so callers never
 * render the literal "Invalid Date" string a buggy `toLocaleTimeString`
 * would otherwise emit.
 */
export function safeFormatTime(input: unknown): string {
  if (input == null || input === "") return "";
  const d = input instanceof Date ? input : new Date(String(input));
  if (!(d instanceof Date) || isNaN(d.getTime())) return "";
  try {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function dhakaDateParts(dateStr: string) {
  const year = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(5, 7), 10);
  const day = parseInt(dateStr.slice(8, 10), 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

/** Format a stored date string for Bengali display locked to Bangladesh Time (Asia/Dhaka). */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat("bn-BD", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  } catch (e) {
    const parts = dhakaDateParts(dateStr);
    if (!parts) return dateStr;
    const { year, month, day } = parts;
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString("bn-BD", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}

/** Format a stored date string for Bengali display with Date & Time in Bangladesh Time (Asia/Dhaka). */
export function formatDateTime(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat("bn-BD", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch (e) {
    return formatDate(dateStr);
  }
}

/** Format a stored Asia/Dhaka date string for English display. */
export function formatDateEn(date: string): string {
  const parts = dhakaDateParts(date);
  if (!parts) return "";
  const { year, month, day } = parts;
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Get today's date formatted as YYYY-MM-DD in Asia/Dhaka timezone. */
export function todayDhaka(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Format a stored Asia/Dhaka date string as "YYYY-MM-DD". */
export function formatDateISO(date: string): string {
  const parts = dhakaDateParts(date);
  if (!parts) return "";
  const { year, month, day } = parts;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Format a stored Asia/Dhaka date string for RSS pubDate. */
export function formatRssDate(date: string): string {
  const parts = dhakaDateParts(date);
  if (!parts) return "";
  const { year, month, day } = parts;
  // Rebuild as a Date in local time (so toUTCString gives the right day)
  const d = new Date(year, month - 1, day, 0, 0, 0);
  if (isNaN(d.getTime())) return "";
  return d.toUTCString();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u0980-\u09FF]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function excerpt(text: string, maxLength = 160): string {
  const plain = text.replace(/[#*`\[\]()]/g, "").trim();
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}

/** Converts English numbers (0-9) to Bengali numbers (০-৯) */
export function enToBnNumber(num: string | number): string {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().replace(/[0-9]/g, (w) => bnDigits[parseInt(w, 10)]);
}

/**
 * Human-readable Bengali relative time, e.g. "৩ ঘণ্টা আগে".
 * Returns "" for missing/invalid input rather than "Invalid Date".
 */
export function timeAgoBn(input: unknown): string {
  const raw = input instanceof Date ? input.getTime() : Date.parse(String(input ?? ""));
  if (!Number.isFinite(raw)) return "";
  const diffMs = Date.now() - raw;
  // Future timestamps (scheduled posts) read as "এইমাত্র" rather than
  // "0 মিনিট আগে", which would be confusing.
  if (diffMs < 0) return "এইমাত্র";

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "এইমাত্র";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${enToBnNumber(min)} মিনিট আগে`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${enToBnNumber(hr)} ঘণ্টা আগে`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${enToBnNumber(day)} দিন আগে`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${enToBnNumber(wk)} সপ্তাহ আগে`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${enToBnNumber(mo)} মাস আগে`;
  return `${enToBnNumber(Math.floor(day / 365))} বছর আগে`;
}

/** Helper to normalize reference strings (e.g. "https://site.com/17870912632194" -> "17870912632194") */
export function normalizeRef(ref: any): string {
  if (!ref) return "";
  let s = String(ref).trim();
  try {
    if (s.startsWith("http")) {
      const url = new URL(s);
      s = url.pathname;
    }
  } catch (e) {}
  s = s.replace(/^\/?(read|posts|golpo)\//i, "");
  s = s.replace(/^story[-_]/i, "");
  s = s.replace(/^\//, "");
  s = s.replace(/\.mdx$/i, "");
  return s.trim().toLowerCase();
}

/**
 * Validate that a string is a "safe" identifier before it is interpolated
 * into a PostgREST `.or()` filter. PostgREST treats commas as OR separators
 * and dots as field delimiters, so an attacker-supplied value like
 * "abc,role.eq.admin" can be used to bypass authorisation checks. We only
 * accept the characters that can legitimately appear in a slug or
 * `users.id` (UUIDs, prefixed ids like `usr_xxx`, `admin-1`, numeric story
 * UIDs, etc.).
 *
 * Returns the value if valid, otherwise the empty string (caller must
 * handle a "not found" response).
 */
export function safeIdentifier(input: unknown, maxLen = 80): string {
  if (typeof input !== "string") return "";
  const s = input.trim();
  if (!s) return "";
  if (s.length > maxLen) return "";
  // Allow letters, digits, dash, underscore, dot. Reject everything else,
  // especially PostgREST filter metacharacters: comma, parens, spaces, quotes.
  if (!/^[A-Za-z0-9._-]+$/.test(s)) return "";
  return s;
}
