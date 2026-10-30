// ─────────────────────────────────────────────────────────────
// lib/bot-guard.ts — identify obvious automated scrapers.
//
// Purpose: several public endpoints perform expensive work on behalf of
// the caller (fetching a remote URL, rendering an image with sharp,
// running HTML through a regex parser). Those endpoints are unauthenticated
// by design, so an automated scraper can drive arbitrary CPU cost.
//
// This helper identifies user agents that are unambiguously automated and
// not legitimate search engines. It deliberately ALLOWS every major
// search-engine crawler, social preview bot, and link unfurler, because
// those drive real traffic and are needed for the site to be indexed and
// shared correctly.
//
// Server-only. No dependencies.
// ─────────────────────────────────────────────────────────────

/**
 * User-agent substrings that identify a legitimate crawler we must not
 * block. Search engines need to reach every page (SEO), and social
 * preview bots need the OG image endpoints (sharing).
 */
const ALLOWED_BOT_MARKERS = [
  // Search engines
  "googlebot",
  "google-inspectiontool",
  "bingbot",
  "bingpreview",
  "yandex",
  "duckduckbot",
  "baiduspider",
  "slurp",
  "applebot",
  "petalbot",
  "seznambot",
  "naver",
  "yeti",
  "sogou",
  "exabot",
  "facebot",
  "ia_archiver",
  // Social / link preview unfurlers
  "facebookexternalhit",
  "facebookcatalog",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "slack-imgproxy",
  "discordbot",
  "telegrambot",
  "whatsapp",
  "pinterest",
  "redditbot",
  "vkshare",
  "skypeuripreview",
  "embedly",
  "quora link preview",
  "nuzzel",
  "outbrain",
  "viber",
  "bitlybot",
  "flipboard",
  "tumblr",
  "mastodon",
  "signal-preview",
  "bluesky",
  "cohere",
  "perplexity",
  "chatgpt",
  "gptbot",
  "oai-searchbot",
  "claudebot",
  "anthropic-ai",
  "ccbot",
  "amazonbot",
  "applebot-extended",
];

/**
 * User-agent markers that indicate a scraper, an SEO audit tool, or a
 * headless browser hammering the site. These are blocked ONLY on the
 * expensive unauthenticated endpoints — never on normal page routes, so
 * a misdetection can never break a real visitor or a crawler.
 */
const BLOCKED_BOT_MARKERS = [
  // Generic scraping / automation libs
  "scrapy",
  "python-requests",
  "python-urllib",
  "python-httpx",
  "aiohttp",
  "httpx",
  "beautifulsoup",
  "go-http-client",
  "java/",
  "okhttp",
  "apache-httpclient",
  "wget",
  "curl/",
  "libwww-perl",
  "lwp::simple",
  "node-fetch",
  "axios",
  "got/",
  "superagent",
  "cheerio",
  "puppeteer",
  "playwright",
  "headlesschrome",
  "phantomjs",
  "selenium",
  "webdriver",
  "electron",
  // SEO / audit / bulk tools
  "ahrefs",
  "semrush",
  "mj12",
  "dotbot",
  "rogerbot",
  "screaming frog",
  "sitebulb",
  "serpstat",
  "linkdexer",
  "megaindex",
  "seokicks",
  "seostar",
  "majestic",
  "zgrab",
  "masscan",
  "nmap",
  "dataprovider",
  "cliqzbot",
  "adsbot",
  "archive.org_bot",
  "commoncrawl",
  // Generic non-browser agents
  "spider",
  "crawler",
  "crawling",
  "fetcher",
  "scraper",
  "http-client",
  "postman",
  "insomnia",
  "httpie",
  "powershell",
];

/**
 * Returns true when the request should be treated as an obvious
 * automated scraper.
 *
 * When no User-Agent header is present at all, the request is allowed —
 * some legitimate clients omit it, and rejecting them would break real
 * usage of the public endpoints.
 */
export function isObviousBot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent || "").trim().toLowerCase();
  if (!ua) return false;

  // A legitimate crawler always identifies itself, and it must never be
  // blocked — check this first.
  for (const marker of ALLOWED_BOT_MARKERS) {
    if (ua.includes(marker)) return false;
  }

  for (const marker of BLOCKED_BOT_MARKERS) {
    if (ua.includes(marker)) return true;
  }

  return false;
}

/**
 * Convenience wrapper that reads the User-Agent from a request.
 */
export function isBotRequest(req: Request): boolean {
  return isObviousBot(req.headers.get("user-agent"));
}
