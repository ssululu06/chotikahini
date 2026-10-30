import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { extractArticle, cleanArticleContent } from "@/lib/article-extractor";

export const dynamic = "force-dynamic";

// POST /api/admin/import-url — fetch a URL and extract ONLY the main article
// text (Readability → JSON-LD → density fallback), so the admin can import
// the story body without navigation / footer / ad / sidebar text.
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !hasPermission(session.role, "content.create")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await req.json();
    const cleanUrl = String(url || "").trim();
    if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
      return NextResponse.json({ error: "সঠিক URL দিন (http/https দিয়ে শুরু হতে হবে)।" }, { status: 400 });
    }

    const res = await fetch(cleanUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CittakkhoBot/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `URL থেকে কন্টেন্ট আনা যায়নি (${res.status})।` }, { status: 502 });
    }

    const html = await res.text();

    // Robust main-article extraction.
    const { title, content } = extractArticle(html, cleanUrl);
    const cleaned = cleanArticleContent(content);

    if (cleaned.length < 50) {
      return NextResponse.json({ error: "URL থেকে মূল গল্পের লেখা পাওয়া যায়নি।" }, { status: 422 });
    }

    return NextResponse.json({ success: true, title, content: cleaned });
  } catch (e: any) {
    return NextResponse.json({ error: "URL থেকে কন্টেন্ট আনা সম্ভব হয়নি।" }, { status: 500 });
  }
}
