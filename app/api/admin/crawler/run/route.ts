import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabase";
import { clearPostsCache } from "@/lib/posts";
import readingTime from "reading-time";
import { checkStorySimilarity, preprocessForSimilarity, scorePreprocessed } from "@/lib/similarity";
import { extractArticle, cleanArticleContent, makeExcerpt } from "@/lib/article-extractor";
import { generateUnique14DigitUid } from "@/lib/uid";
import { discoverAndFetchFeed, type FeedResult } from "@/lib/feed";

export const dynamic = "force-dynamic";

// ── Auto-categorize: content keyword → category ──
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  hot: ["গরম", "উত্তপ্ত", "হট", "ঝকঝকে"],
  prem: ["প্রেম", "ভালোবাসা", "রোমান্টিক", "হারানো প্রেম"],
  porokiya: ["পরকিয়া", "পরকীয়া", "স্বামী", "বউ", "প্রেমিক", "প্রেমিকা", "স্ত্রী"],
  paribarik: ["পারিবারিক", "পরিবার", "মা", "বাবা", "বোন", "ভাই", "শাশুড়ি", "জামাই", "কাকিমা", "মাসি", "খালা", "বৌদি", "ভাবি", "সৎ"],
  bodhu: ["বধূ", "বৌদি", "গৃহবধূ", "সংসার"],
  kumari: ["কুমারী", "কুমারি", "ভার্জিন", "প্রথমবার"],
  pesha: ["অফিস", "বস", "কলিগ", "পেশাজীবী", "কাজের মেয়ে", "কাজের মেয়ে"],
  aloukik: ["অলৌকিক", "ভূত", "পিশাচ", "জিন", "প্রেত"],
  somokami: ["সমকামী", "গে", "লেসবিয়ান"],
};

function autoCategorize(content: string, defaultCategory: string): string {
  const c = content.toLowerCase();
  let best = defaultCategory || "golpo";
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (c.includes(kw.toLowerCase())) score++;
    }
    if (score > bestScore) { bestScore = score; best = cat; }
  }
  return best;
}

// ── Auto-tag: reuse keyword→tag mapping from the tag recommendations ──
const TAG_KEYWORDS: Record<string, string[]> = {
  "রোমান্স": ["ভালোবাসা", "প্রেম", "মায়া", "রোমান্টিক", "হৃদয়"],
  "পরকিয়া": ["পরকিয়া", "স্বামী", "বউ", "স্ত্রী", "প্রেমিক", "প্রেমিকা"],
  "পারিবারিক": ["পারিবারিক", "পরিবার", "মা", "বোন", "শাশুড়ি", "জামাই", "কাকিমা", "মাসি", "খালা", "বৌদি", "ভাবি", "সৎ"],
  "গরম": ["গরম", "হট", "উত্তপ্ত"],
  "গোপন": ["গোপন", "লুকানো", "চুপি চুপি"],
  "দাম্পত্য": ["দাম্পত্য", "স্বামী", "স্ত্রী", "সংসার", "বিয়ে"],
  "মিলন": ["মিলন", "আলিঙ্গন", "ঠাপানো"],
  "গ্রুপ": ["গ্রুপ", "একসাথে", "অনেকজন"],
  "গ্যাংব্যাং": ["গ্যাংব্যাং", "গ্রুপ"],
};

function autoTags(content: string, defaultTags: string): string[] {
  const c = content.toLowerCase();
  const stop = new Set("এই সেই যে এবং তার তখন পরে এখন আর কে না করে ছিল হয় হবে আছে কিন্তু যদি তাই থেকে উপর নিচ জন্য".split(" "));
  const freq = new Map<string, number>();
  c.replace(/[।,;:!?()"'\-—\s]+/g, " ").split(" ").filter(w => w.length > 2 && !stop.has(w)).forEach(w => freq.set(w, (freq.get(w) || 0) + 1));

  const tags = new Set<string>();
  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    for (const kw of keywords) if (freq.has(kw)) { tags.add(tag); break; }
  }
  // Add default tags
  (defaultTags || "").split(",").map(t => t.trim()).filter(Boolean).forEach(t => tags.add(t));
  return Array.from(tags).slice(0, 6);
}

/** Simple URL extraction from homepage HTML — finds story-ish links. */
function extractStoryLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const base = new URL(baseUrl);
  const anchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    let href = m[1];
    // Normalize relative / absolute
    try {
      const u = new URL(href, base.origin);
      if (u.hostname === base.hostname) href = u.href;
      else continue;
    } catch { continue; }
    // Heuristic: story links usually have 2+ path segments or look like slugs
    const path = href.replace(base.origin, "");
    if (path === "/" || path.length < 5) continue;
    if (/(\.jpg|\.png|\.css|\.js|\.webp|\.svg|\.ico|#|javascript:)/i.test(href)) continue;
    if (/\.(com|net|org)\/tag\/|\/category\/|\/about|\/contact|\/privacy|\/login|\/register/i.test(href)) continue;
    links.add(href);
  }
  return Array.from(links).slice(0, 30);
}

// POST /api/admin/crawler/run — crawl all active sources and auto-post new stories
export async function POST() {
  try {
    const session = await getSession();
    if (!session || !hasPermission(session.role, "content.create")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: sources } = await supabase.from("crawler_sources").select("*").eq("active", true);
    if (!sources || sources.length === 0) {
      return NextResponse.json({ success: true, checked: 0, posted: 0, message: "কোনো অ্যাক্টিভ সোর্স নেই।" });
    }

    const nowIso = new Date().toISOString();
    const results = { checked: 0, posted: 0, skipped: 0, stories: [] as any[] };

    for (const source of sources) {
      try {
        // ── 1. Fetch homepage (for feed discovery + fallback links) ──
        const homepage = await fetch(source.url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; CittakkhoCrawler/1.0)" },
          redirect: "follow",
          signal: AbortSignal.timeout(15000),
        });
        if (!homepage.ok) continue;
        const html = await homepage.text();

        // ── 2. Try feed first (RSS/Atom) — much more reliable than link extraction ──
        const feedResult = await discoverAndFetchFeed(source.url, html);
        const feedItems = feedResult?.entries || [];

        // Remember the discovered feed URL on the source so the admin can see
        // which feed is being used.
        if (feedResult?.feedUrl) {
          try {
            await supabase.from("crawler_sources").update({ feed_url: feedResult.feedUrl }).eq("id", source.id);
          } catch {}
        }

        // ── 3. Fallback: extract story links from homepage HTML ──
        const fallbackLinks = feedItems.length === 0 ? extractStoryLinks(html, source.url) : [];

        // Combine feed items + fallback links, cap at 15 per source.
        const tasks: { link: string; title?: string; feedContent?: string }[] = [];

        for (const entry of feedItems) {
          if (tasks.length >= 15) break;
          tasks.push({ link: entry.link, title: entry.title, feedContent: entry.content });
        }
        for (const link of fallbackLinks) {
          if (tasks.length >= 15) break;
          if (!tasks.some((t) => t.link === link)) tasks.push({ link });
        }

        for (const task of tasks) {
          results.checked++;
          try {
            // Already posted? Check history for this source URL
            const { data: existing } = await supabase
              .from("stories")
              .select("uid, history")
              .contains("history", [{ source: task.link }]);
            if (existing && existing.length > 0) { results.skipped++; continue; }

            let title = task.title || "";
            let content = "";

            // If the feed entry already has content, clean it directly.
            if (task.feedContent && task.feedContent.trim().length >= 100) {
              content = cleanArticleContent(task.feedContent);
            }

            // Otherwise fetch the article page and extract.
            if (!content || content.trim().length < 100) {
              try {
                const storyRes = await fetch(task.link, {
                  headers: { "User-Agent": "Mozilla/5.0 (compatible; CittakkhoCrawler/1.0)" },
                  redirect: "follow",
                  signal: AbortSignal.timeout(20000),
                });
                if (storyRes.ok) {
                  const storyHtml = await storyRes.text();
                  const extracted = extractArticle(storyHtml, task.link);
                  if (!title) title = extracted.title;
                  content = cleanArticleContent(extracted.content);
                }
              } catch {}
            }

            if (!content || content.trim().length < 100) continue;

            const finalTitle = title || `অটো-পোস্ট ${Date.now().toString(36)}`;

            // ── SIMILARITY CHECK: skip if it matches an existing story ──
            let similarity = 0;
            let similarStory = "";
            try {
              const dup = await checkStorySimilarity(content, finalTitle, null, 0.45);
              if (dup.isDuplicate) { results.skipped++; continue; }
              if (dup.matchedStory) {
                similarity = dup.matchedStory.similarityPercent;
                similarStory = dup.matchedStory.title;
              }
            } catch {}

            const category = autoCategorize(content, source.category);
            const tags = autoTags(content, source.default_tags);

            const uid = await generateUnique14DigitUid(supabase);

            let cover = "";
            try {
              const { getUnusedCover } = await import("@/lib/cover");
              cover = (await getUnusedCover(supabase)) || "";
            } catch {}

            const history: any[] = [
              { event: "crawled", at: nowIso, source: task.link, state: "awaiting_review" },
            ];
            if (similarity > 0) {
              history.push({ event: "similarity", at: nowIso, similarityPercent: similarity, similarStory });
            }

            const { error: insertError } = await supabase.from("stories").insert({
              uid,
              slug: uid,
              title: finalTitle,
              category,
              description: makeExcerpt(content, 300),
              content,
              tags,
              cover,
              author_id: session.id,
              status: "pending",
              published_at: null,
              reading_time: readingTime(content || "").text,
              created_at: nowIso,
              updated_at: nowIso,
              history,
            });
            if (insertError) throw insertError;

            results.posted++;
            results.stories.push({ uid, slug: uid, title: finalTitle, category, url: task.link, status: "pending" });
          } catch {}
        }

        // Update last_crawled_at
        await supabase.from("crawler_sources").update({ last_crawled_at: nowIso }).eq("id", source.id);
      } catch {}
    }

    if (results.posted > 0) clearPostsCache();
    return NextResponse.json({
      success: true,
      ...results,
      message: `${results.posted}টি নতুন গল্প অটো-পোস্ট হয়েছে।`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
