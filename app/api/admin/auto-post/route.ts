import { bndSafe } from "@/lib/utils";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabase";
import { clearPostsCache } from "@/lib/posts";
import { getClientSiteUrl } from "@/lib/client-config";
import readingTime from "reading-time";
import { extractArticle, cleanArticleContent, makeExcerpt } from "@/lib/article-extractor";
import { generateUnique14DigitUid } from "@/lib/uid";
import { fetchFeed } from "@/lib/feed";
import { preprocessForSimilarity, scorePreprocessed } from "@/lib/similarity";

export const dynamic = "force-dynamic";

interface CreateStoryParams {
  title: string;
  content: string;
  url: string;
  category: string;
  tags: string;
  scheduledAt?: string;
  session: any;
  siteUrl: string;
  isFeed?: boolean;
}

async function createStory(
  supabase: any,
  { title, content, url, category, tags, scheduledAt, session, siteUrl, isFeed }: CreateStoryParams
) {
  const finalTitle = (title || "").trim().slice(0, 200) || "Untitled";
  const articleText = cleanArticleContent(content);
  if (articleText.length < 50) {
    return NextResponse.json({ error: "URL থেকে মূল গল্পের লেখা পাওয়া যায়নি। অন্যভাবে চেষ্টা করুন।" }, { status: 422 });
  }

  // Duplicate / similarity check
  let similarity = 0;
  let similarStory = "";
  try {
    const { data: published } = await supabase
      .from("stories")
      .select("title, content")
      .eq("status", "published")
      .limit(1000);
    const queryText = preprocessForSimilarity(`${finalTitle} ${articleText.slice(0, 4000)}`);
    for (const s of published || []) {
      if (!s.content || s.content.length < 200) continue;
      const score = scorePreprocessed(queryText, preprocessForSimilarity(s.content.slice(0, 6000)));
      if (score > similarity) { similarity = score; similarStory = s.title || ""; }
    }
    similarity = Math.round(similarity * 100);
  } catch {}

  const uid = await generateUnique14DigitUid(supabase);
  const safeCategory = (category || "golpo").trim();
  const tagArray = typeof tags === "string" ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : (Array.isArray(tags) ? tags : []);

  let cover = "";
  try {
    const { getUnusedCover } = await import("@/lib/cover");
    cover = (await getUnusedCover(supabase)) || "";
  } catch {}

  const nowIso = new Date().toISOString();
  const publishedAt = scheduledAt ? new Date(scheduledAt).toISOString() : nowIso;
  const isFuture = scheduledAt && new Date(scheduledAt) > new Date();

  const history: any[] = [
    { event: "auto_posted", at: nowIso, actor: session.username || session.id, source: url },
  ];
  if (similarity > 0) {
    history.push({ event: "similarity", at: nowIso, similarityPercent: similarity, similarStory });
  }

  const { error: insertError } = await supabase.from("stories").insert({
    uid,
    slug: uid,
    title: finalTitle,
    category: safeCategory,
    description: makeExcerpt(articleText, 300),
    content: articleText,
    tags: tagArray,
    cover,
    author_id: session.id,
    status: "published",
    published_at: publishedAt,
    scheduled_at: scheduledAt || null,
    reading_time: readingTime(articleText || "").text,
    created_at: nowIso,
    updated_at: nowIso,
    history,
  });

  if (insertError) {
    return NextResponse.json({ error: `গল্প তৈরি করতে সমস্যা: ${insertError.message}` }, { status: 500 });
  }
  clearPostsCache();

  try {
    await supabase.from("post_metadata").upsert({
      mdx_uid: uid,
      slug: uid,
      author_id: session.id,
      status: "published",
      category: safeCategory,
      published_at: publishedAt,
      updated_at: nowIso,
    }, { onConflict: "slug" });
  } catch {}

  return NextResponse.json({
    success: true,
    message: isFuture
      ? `"${finalTitle}" শিডিউল করা হয়েছে — ${bndSafe(scheduledAt, "datetime")} এ প্রকাশিত হবে।`
      : `"${finalTitle}" অটো-পোস্ট করা হয়েছে!`,
    story: { uid, slug: uid, title: finalTitle, url: `${siteUrl}/${uid}` },
  });
}

// POST /api/admin/auto-post — paste a URL, the system fetches the article,
// extracts the main content, checks similarity, and creates the story.
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !hasPermission(session.role, "content.create")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url, category, tags, scheduledAt, title: manualTitle } = await req.json();
    const cleanUrl = String(url || "").trim();
    if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
      return NextResponse.json({ error: "সঠিক URL দিন (http/https দিয়ে শুরু হতে হবে)।" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const siteUrl = getClientSiteUrl() || "https://chotikahini.vercel.app";

    // ── 1. Fetch page ──
    const res = await fetch(cleanUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CittakkhoBot/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `URL থেকে কন্টেন্ট আনা যায়নি (${res.status})।` }, { status: 502 });
    }
    const body = await res.text();

    // ── 2. If the URL is a feed (RSS/Atom), import the latest entry ──
    const feedResult = await fetchFeed(cleanUrl).catch(() => null);
    if (feedResult && feedResult.entries.length > 0) {
      const entry = feedResult.entries[0];
      const feedContent = entry.content ? cleanArticleContent(entry.content) : "";
      if (feedContent.length >= 100) {
        return await createStory(supabase, {
          title: manualTitle || entry.title,
          content: feedContent,
          url: entry.link,
          category: category || "golpo",
          tags: tags || "",
          scheduledAt,
          session,
          siteUrl,
          isFeed: true,
        });
      }
    }

    // ── 3. Extract with the robust extractor (single article) ──
    const { title, content } = extractArticle(body, cleanUrl);
    const articleText = cleanArticleContent(content);

    if (articleText.length < 50) {
      return NextResponse.json({ error: "URL থেকে মূল গল্পের লেখা পাওয়া যায়নি। অন্যভাবে চেষ্টা করুন।" }, { status: 422 });
    }

    return await createStory(supabase, {
      title: manualTitle || title,
      content: articleText,
      url: cleanUrl,
      category: category || "golpo",
      tags: tags || "",
      scheduledAt,
      session,
      siteUrl,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "অটো-পোস্ট করতে সমস্যা হয়েছে।" }, { status: 500 });
  }
}