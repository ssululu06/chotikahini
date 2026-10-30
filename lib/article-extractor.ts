/**
 * Robust article extraction used by the auto-post & crawler features.
 *
 * Strategy:
 *   1. Readability (best quality, strips nav/chrome automatically)
 *   2. JSON-LD `articleBody` (many news/story sites embed full text here)
 *   3. Longest contiguous <p>/<hN> run after removing boilerplate nodes
 *   4. Plain-text fallback with aggressive junk-line filtering
 *
 * All paths end with the same cleaner so "শেয়ার করুন", "আরও পড়ুন",
 * cookie banners and pagination junk are dropped before storing.
 */

export interface ExtractedArticle {
  title: string;
  content: string;
  excerpt?: string;
}

/** Nodes that are never article body — remove before scoring text density. */
const JUNK_SELECTOR = [
  "script", "style", "noscript", "iframe", "form", "button", "nav", "footer", "header",
  "aside", "svg", "canvas", "audio", "video", "figure", "figcaption",
  ".share", ".social", ".sharing", ".related", ".recommended", ".suggestions",
  ".comments", ".comment", ".pagination", ".breadcrumb", ".tags", ".tag-links",
  ".widget", ".sidebar", ".advertisement", ".ads", ".advert", ".cookie", ".newsletter",
  ".popup", ".modal", ".promo", ".menu", ".nav", ".header", ".footer", ".search",
  ".author-info", ".byline", ".meta", ".category-links", ".tags-list",
].join(",");

/** Lines/paragraphs that are almost never story content. */
const NOISE_PATTERNS: RegExp[] = [
  /^(\s*(share|shares?|tweet|tweets?|facebook|twitter|whatsapp|telegram|linkedin|email|print|copy)\s*(on)?\s*(facebook|twitter|whatsapp|telegram|linkedin)?\s*[:]?\s*)$/i,
  /^(আরও (পড়ুন|পড়ুনঃ|দেখুন|শেয়ার)|এগুলোও পড়ুন|এছাড়াও পড়ুন|এছাড়া পড়ুন|মনে রেখো|মনে রাখবেন|ট্যাগস?|লেবেল|ক্যাটাগরি|ক্যাটেগরি)/,
  /^(previous|next|পরবর্তী|পূর্ববর্তী|আগের|পরের|আরও গল্প|অন্যান্য গল্প|সবগুলো গল্প|সংশ্লিষ্ট গল্প|সম্পর্কিত পোস্ট|প্রাসঙ্গিক পোস্ট)/i,
  /^\d+\s*(views?|পঠিত|পড়া|বার পড়া|শেয়ার|কমেন্ট|মন্তব্য|লাইক|ফলোয়ার|ফলোয়ার্স)?$/i,
  /^(আরো পড়ুন|আরো দেখুন|বিস্তারিত পড়ুন|বিস্তারিত|পুরো গল্প পড়ুন|গল্পটি পড়ুন|আর্টিকেল পড়ুন|লেখাটি পড়ুন)/,
  /^(কপিরাইট|copyright|সর্বস্বত্ব|all rights reserved)/i,
  /^(এই ওয়েবসাইট|এই ওয়েবসাইটের|ডিসক্লেইমার|দাবিত্যাগ|গোপনীয়তা|প্রাইভেসি|সাইট ম্যাপ|যোগাযোগ|অ্যাডমিন)/,
  /^.*(newsletter|সাবস্ক্রাইব|নিউজলেটার).*$/i,
  /^(cookie|cookies|কুকিজ|accept|accept all)/i,
  /^(\u00A0|\s+)$/,
];

const CONTENT_MIN_CHARS = 80;

/** Collapse HTML whitespace, decode common entities, trim. */
function cleanText(raw: string): string {
  return raw
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&mdash;|&ndash;/g, "-")
    .replace(/[ \t]+/g, " ")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function looksNoise(line: string): boolean {
  const t = cleanText(line);
  if (!t) return true;
  if (t.length < 2) return true;
  for (const re of NOISE_PATTERNS) {
    if (re.test(t)) return true;
  }
  return false;
}

/** Convert feed HTML into plain text lines (paragraphs preserved). */
export function htmlToText(html: string): string {
  if (!html || !/<[a-z][^>]*>/i.test(html)) return html;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&hellip;|&mdash;|&ndash;/g, (m) => (m === "&hellip;" ? "..." : "-"))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n");
}

/** Split into paragraphs and drop boilerplate lines (repeat-scan to catch
 *  lines with leading "->" or bullets that wrap boilerplate text). */
export function cleanArticleContent(content: string): string {
  if (!content) return "";
  const plain = htmlToText(content);
  const paragraphs = plain
    .replace(/\u00a0/g, " ")
    .split(/\n{1,}/)
    .map((l) => cleanText(l))
    .filter((l) => !looksNoise(l));

  // Join lines into paragraphs: a non-empty line continues the previous
  // paragraph when the previous line didn't end with sentence punctuation.
  const out: string[] = [];
  for (const line of paragraphs) {
    const last = out[out.length - 1] || "";
    if (
      last &&
      !/[।.!?…]$/.test(last) &&
      !line.match(/^[০-৯0-9a-zA-Z"'(–—-]/) &&
      line.length < 200
    ) {
      out[out.length - 1] = `${last} ${line}`;
    } else {
      out.push(line);
    }
  }

  return out.join("\n\n");
}

/** Pick the longest run of content-ish text blocks (paragraph/heading text). */
function longestTextRun(blocks: string[]): string {
  let best = "";
  let run = "";
  for (const b of blocks) {
    if (b.length >= 40 && !looksNoise(b)) {
      run += b + "\n";
      if (run.length > best.length) best = run;
    } else {
      run = "";
    }
  }
  return best.trim();
}

/** Extract a plain-text body from HTML without Readability. */
function extractFromHtml(html: string): { title: string; content: string } {
  let title = "";
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) title = cleanText(titleMatch[1].replace(/<[^>]+>/g, ""));

  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (ogTitle) title = cleanText(ogTitle[1]);

  // JSON-LD articleBody — many Bengali story/news sites embed the full text.
  const ldMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of ldMatch) {
    try {
      const data = JSON.parse(block.replace(/<\/?script[^>]*>/gi, ""));
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const body =
          (item.articleBody as string) ||
          (item.mainEntity?.articleBody as string) ||
          (Array.isArray(item["@graph"])
            ? (item["@graph"] as any[]).map((g: any) => g.articleBody || "").filter(Boolean).join("\n")
            : "");
        if (body && body.trim().length > CONTENT_MIN_CHARS) {
          return { title, content: body };
        }
      }
    } catch {}
  }

  const { JSDOM } = require("jsdom");
  const dom = new JSDOM(html, { url: "https://example.com" });
  const doc = dom.window.document;

  // Prefer the <article> element when present.
  const articleEl = doc.querySelector("article") || doc.body;

  // Remove junk nodes.
  for (const el of articleEl.querySelectorAll(JUNK_SELECTOR)) {
    el.parentNode?.removeChild(el);
  }

  // Collect text from paragraphs & headings only — most reliable signal.
  const blocks: string[] = [];
  for (const el of articleEl.querySelectorAll("p, h1, h2, h3, h4, div")) {
    if (el.tagName === "DIV") {
      // Only take divs that directly contain text (no block children) to
      // avoid duplicating paragraph text.
      if (el.querySelector("p, h1, h2, h3, h4, li, blockquote")) continue;
      if ((el.textContent || "").trim().length < 40) continue;
    }
    const text = cleanText(el.textContent || "");
    if (text.length >= 40) blocks.push(text);
  }

  const run = longestTextRun(blocks);
  if (run.length >= CONTENT_MIN_CHARS) return { title, content: run };

  // Last resort: whole body text minus junk (already removed).
  const bodyText = cleanText(articleEl.textContent || "");
  return { title, content: bodyText };
}

/**
 * Main entry: fetch has already produced `html`; returns title + cleaned content.
 */
export function extractArticle(html: string, url = ""): ExtractedArticle {
  let title = "";
  let content = "";

  try {
    const { JSDOM } = require("jsdom");
    const { Readability } = require("@mozilla/readability");
    const dom = new JSDOM(html, { url: url || "https://example.com" });
    const article = new Readability(dom.window.document, { charThreshold: 80 }).parse();
    if (article?.textContent) {
      title = article.title ? article.title.trim().slice(0, 200) : "";
      content = article.textContent;
    }
  } catch {}

  if (!content || content.trim().length < CONTENT_MIN_CHARS) {
    const fallback = extractFromHtml(html);
    if (!title) title = fallback.title;
    if (!content || content.trim().length < CONTENT_MIN_CHARS) {
      content = fallback.content;
    }
  }

  const cleaned = cleanArticleContent(content);
  return {
    title: title.trim().slice(0, 200),
    content: cleaned,
  };
}

/** Pick a short excerpt from cleaned content. */
export function makeExcerpt(content: string, max = 300): string {
  const c = (content || "").replace(/\s+/g, " ").trim();
  return c.slice(0, max).replace(/\n/g, " ");
}
