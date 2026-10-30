import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { getSupabaseAdmin } from "@/lib/supabase";
import { hasPermission } from "@/lib/permissions";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filterAuthorParam = searchParams.get("author")?.trim() || "";
    const brief = searchParams.get("brief") === "1";

    const supabase = getSupabaseAdmin();

    // 1. Pre-fetch all users to map relational author details dynamically
    const { data: users } = await supabase
      .from("users")
      .select("id, username, name, profile_pic");

    const userMap = new Map<string, { id: string; username: string; name: string; profilePic: string }>();
    if (users) {
      for (const u of users) {
        const info = {
          id: u.id,
          username: u.username || "",
          name: u.name || u.username || "অজ্ঞাত লেখক",
          profilePic: u.profile_pic || ""
        };
        if (u.id) userMap.set(u.id.toLowerCase(), info);
        if (u.username) userMap.set(u.username.toLowerCase(), info);
      }
    }

    // 2. Fetch stories from Supabase stories table.
    //    Skip the heavy content column in brief mode; wordCount is precomputed below.
    let query: any = supabase
      .from("stories")
      .select(brief
        ? "uid, slug, title, category, description, cover, tags, previous_post, published_at, updated_at, scheduled_at, status, rejection_reason, history, author_id, content"
        : "*");

    const canReviewAll = searchParams.get("all") === "true" && hasPermission(session.role, "story.review");

    if (!canReviewAll) {
      if (filterAuthorParam) {
        const targetUser = userMap.get(filterAuthorParam.toLowerCase());
        if (targetUser) {
          query = query.eq("author_id", targetUser.id);
        } else {
          query = query.eq("author_id", filterAuthorParam);
        }
      } else {
        query = query.eq("author_id", session.id);
      }
    }

    const { data: supabaseStories, error } = await query;

    if (error) {
      console.error("Error fetching stories from Supabase:", error);
    }

    const authorStories: any[] = [];

    if (Array.isArray(supabaseStories)) {
      for (const s of supabaseStories) {
        const authorKey = (s.author_id || "admin").toString().toLowerCase().trim();
        const relationalUser = userMap.get(authorKey);

        const authorName = relationalUser?.name || "অজ্ঞাত লেখক";
        const authorUsername = relationalUser?.username || "";
        const historyArr = Array.isArray(s.history) ? s.history : [];
        const duplicateMatch = historyArr.find((h: any) => h.event === "duplicate_flagged" && h.duplicateMatch)?.duplicateMatch || s.duplicate_match || null;

        // Crawled stories are managed ONLY in the Auto-Post review queue —
        // exclude them from the story review center.
        const isCrawled = historyArr.some((h: any) => h.event === "crawled" || h.event === "auto_posted");
        if (canReviewAll && isCrawled) continue;

        authorStories.push({
          slug: s.slug,
          fileSlug: s.slug,
          title: s.title || "Untitled Story",
          category: s.category || "golpo",
          description: s.description || "",
          content: brief ? "" : (s.content ? s.content.trim() : ""),
          wordCount: s.content ? s.content.trim().split(/\s+/).length : 0,
          cover: s.cover || "",
          tags: Array.isArray(s.tags) ? s.tags.join(", ") : s.tags || "",
          previousPost: s.previous_post || "",
          publishedAt: s.published_at || s.updated_at || new Date().toISOString(),
          scheduledAt: s.scheduled_at || null,
          status: s.status || "published",
          rejectionReason: s.rejection_reason || null,
          feedbackDate: null,
          version: 1,
          history: historyArr,
          duplicateMatch: duplicateMatch,
          uid: s.uid || s.id,
          author: authorName,
          authorId: s.author_id,
          authorUsername: authorUsername,
          source: "supabase",
        });
      }
    }

    // Sort newest first
    authorStories.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    return NextResponse.json({ stories: authorStories });
  } catch (error: any) {
    console.error("Fetch my stories error:", error);
    return NextResponse.json({ error: "গল্পের তালিকা লোড করা সম্ভব হয়নি।" }, { status: 500 });
  }
}
