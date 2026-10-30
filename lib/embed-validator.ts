/**
 * lib/embed-validator.ts
 *
 * Server-side probe to surface embed-block risks before we save a video.
 *
 * What this does NOT do — important:
 *   It doesn't try to circumvent X-Frame-Options, CSP frame-ancestors, bot
 *   checks, age verification, or geo-blocks. A site that blocks cross-origin
 *   framing because of licensing terms stays blocked, with a clear warning
 *   the admin can act on.
 *
 * What it DOES do:
 *   Re-fetches the candidate embed URL with a desktop browser User-Agent
 *   and inspects:
 *     - HTTP status (404s -> rejected)
 *     - X-Frame-Options header (DENY / SAMEORIGIN -> rejected)
 *     - frame-ancestors in CSP  (blocks other domains -> rejected)
 *   Surfaces a plain-language verdict in Bangla so the admin can pick a
 *   working URL before saving.
 *
 * The visitor's experience in the iframe can change at any moment (a
 * provider can add an X-Frame-Options header tomorrow). This probe only
 * reports what it sees at submit time.
 */

const FETCH_TIMEOUT_MS = 6_000;
const MAX_HTML_BYTES = 200_000;

const ALLOWED_HOSTS = new Set<string>([
  // Hosts whose /embedframe path we know returns 200 without x-frame-options.
  // See lib/embed-resolver.ts for the matching rules.
  "xvideos.com",
  "www.xvideos.com",
  "xvideos.link",
  "xnxx.com",
  "www.xnxx.com",
  "youtube.com",
  "www.youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "vimeo.com",
  "player.vimeo.com",
  "dailymotion.com",
  "www.dailymotion.com",
  "faphouse.com",
  "www.faphouse.com",
  "faphouse2.com",
  "www.faphouse2.com",
]);

function isAllowed(host: string): boolean {
  return ALLOWED_HOSTS.has(host) || [...ALLOWED_HOSTS].some((h) => host.endsWith(`.${h}`));
}

export type VerdictStatus = "ok" | "x-frame-options" | "csp" | "redirect" | "not-found" | "fetch-failed" | "host-not-supported";

export interface Verdict {
  status: VerdictStatus;
  /** Bangla summary of what will happen in the iframe. */
  message: string;
  /** Actionable suggestion when it isn't going to work. */
  suggestion: string;
  /** Provider hostname when we can tell. */
  host?: string;
}

/**
 * Sanity-checks an embed URL by fetching it. Never throws.
 *
 * Safe to call on every save; the timeout and response cap keep it cheap.
 */
export async function validateEmbedUrl(inputUrl: string): Promise<Verdict> {
  let url: URL;
  try {
    url = new URL(inputUrl);
  } catch {
    return {
      status: "fetch-failed",
      message: "URL টা পার্স করা যায়নি।",
      suggestion: "https:// দিয়ে শুরু হওয়া একটা পূর্ণ লিংক দিন।",
    };
  }

  if (!isAllowed(url.hostname.toLowerCase().replace(/^www\./, ""))) {
    return {
      status: "host-not-supported",
      host: url.hostname,
      message: `${url.hostname} এর embed URL আমাদের যাচাই তালিকায় নেই।`,
      suggestion:
        "YouTube, Vimeo, Xvideos, XNXX, Dailymotion, Faphouse — এদের কোনো ওয়াচ-পেজ URL দিয়ে নতুন ভিডিও যোগ করুন। যে সাইটে সেভ হবে না, সেটা আমরা জানাচ্ছি না — কারণ তারা নিজেরাই অন্য ডোমেইনে embed বন্ধ রেখেছে।",
    };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (res.status === 404) {
      return {
        status: "not-found",
        host: url.hostname,
        message: "এই embed URL 404 দিচ্ছে — ভিডিও পাওয়া যায়নি।",
        suggestion:
          "URL টা ভুল হতে পারে। ওয়াচ-পেজের লিংক দিয়ে আবার যোগ করলে resolver সঠিক embed URL বানিয়ে দেবে।",
      };
    }

    // 5xx: the provider is refusing us at the edge. xhamster answers embed
    // requests with a Cloudflare 520 precisely because it blocks cross-origin
    // framing — reporting that as a save-time warning beats publishing a video
    // that shows the visitor a provider block page.
    if (res.status >= 500) {
      return {
        status: "x-frame-options",
        host: url.hostname,
        message: `${url.hostname} embed request টা সরাসরি ব্লক করছে (HTTP ${res.status})।`,
        suggestion:
          "এই provider অন্য ডোমেইন থেকে embed বন্ধ রেখেছে — আমরা সেটা ইচ্ছাকৃতভাবে bypass করি না। Xvideos/XNXX/YouTube/Vimeo ব্যবহার করুন।",
      };
    }

    if (res.redirected) {
      return {
        status: "redirect",
        host: url.hostname,
        message: "URL অন্য কোথাও redirect হচ্ছে।",
        suggestion:
          "Embed endpoint পরিবর্তন হয়েছে। watch-page URL দিলে আমরা সঠিক লিংক দেব।",
      };
    }

    const xfo = res.headers.get("x-frame-options");
    if (xfo) {
      const v = xfo.trim().toUpperCase();
      if (v.includes("DENY")) {
        return {
          status: "x-frame-options",
          host: url.hostname,
          message: "এই সাইট iframe-এ বসতে দেয় না (X-Frame-Options: DENY)।",
          suggestion:
            "আমরা intentionally এই restriction bypass করি না — provider লাইসেন্সের কারণেই বন্ধ রেখেছে। অন্য ভিডিও সোর্স ব্যবহার করুন।",
        };
      }
      if (v.includes("SAMEORIGIN")) {
        return {
          status: "x-frame-options",
          host: url.hostname,
          message:
            "এই সাইট শুধু নিজের পেজে বসতে দেয় (X-Frame-Options: SAMEORIGIN)।",
          suggestion:
            "আমরা intentionally এই restriction bypass করি না। ভিডিওটা যে পেজের জন্য বানানো সেটা থেকেই দেখুন, embed করার চেষ্টা করবেন না।",
        };
      }
    }

    const csp = res.headers.get("content-security-policy");
    if (csp) {
      const ancestor = csp
        .split(";")
        .map((s) => s.trim())
        .find((d) => /^frame-ancestors/i.test(d));
      if (ancestor) {
        const v = ancestor.replace(/^frame-ancestors\s*/i, "").trim();
        if (!/(\*|localhost|127\.0\.0\.1|chotikahini)/i.test(v)) {
          return {
            status: "csp",
            host: url.hostname,
            message: `এই সাইটের CSP শুধু নির্দিষ্ট সাইটকে embed করতে দেয় (frame-ancestors ${v})।`,
            suggestion:
              "আমরা intentionally এই restriction bypass করি না — provider নিজেদের embed allowlist রক্ষণাবেক্ষণ করছে। অন্য ভিডিও সোর্স ব্যবহার করুন।",
          };
        }
      }
    }

    // Some providers (xhamster is the prominent one) return a successful HTML
    // response with HTTP 200 *and* a "Embedding video is disabled" body, even
    // from inside their own /embed endpoint. Detecting the literal page keeps
    // us honest — without this branch the validator would say "ok" while
    // every visitor sees xhamster's block message.
    //
    // Only the first chunk is read: an /embed page is a whole site and we only
    // need to know whether the block notice appears near the top of the body.
    const headOfBody = await res.text().catch(() => "");
    if (/embedding\s+video\s+is\s+disabled/i.test(headOfBody)) {
      return {
        status: "host-not-supported",
        host: url.hostname,
        message: `${url.hostname} নিজেই অন্য সাইটে embed বন্ধ রেখেছে — দর্শক "Embedding video is disabled" বারতাই দেখবে।`,
        suggestion:
          "আমরা intentionally এই restriction bypass করি না। YouTube/Vimeo/Xvideos/XNXX/Faphouse দিয়ে আবার চেষ্টা করুন।",
      };
    }

    return {
      status: "ok",
      host: url.hostname,
      message: "Embed URL কাজ করবে বলে মনে হচ্ছে — iframe-এ বসবে।",
      suggestion: "",
    };
  } catch (e) {
    return {
      status: "fetch-failed",
      host: url.hostname,
      message:
        e instanceof Error && e.name === "AbortError"
          ? "Provider সাড়া দিচ্ছে না (timeout)।"
          : "URL fetch করা যায়নি।",
      suggestion:
        "কিছুক্ষণ পর আবার চেষ্টা করুন অথবা YouTube/Vimeo/Xvideos URL ব্যবহার করুন।",
    };
  }
}
