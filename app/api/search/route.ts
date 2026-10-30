import { NextResponse } from "next/server";
import { getAllPostsAsync, searchPostsFromDbAsync } from "@/lib/posts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().normalize("NFC").toLowerCase() || "";
  const category = searchParams.get("category");
  const tag = searchParams.get("tag");
  const author = searchParams.get("author");

  try {
    const hasQuery = Array.from(q).length >= 1;
    const hasFilters = Boolean(category || tag || author);
    let results = hasQuery
      ? await searchPostsFromDbAsync(q)
      : hasFilters
        ? await getAllPostsAsync()
        : [];

    if (category) {
      const normalizedCategory = category.trim().toLowerCase();
      results = results.filter(p =>
        p.categoryId.toLowerCase() === normalizedCategory ||
        p.categoryName.toLowerCase() === normalizedCategory
      );
    }
    if (tag) {
      const normalizedTag = tag.trim().normalize("NFC").toLowerCase();
      results = results.filter(p =>
        Array.isArray(p.tags) &&
        p.tags.some(value => value.trim().normalize("NFC").toLowerCase() === normalizedTag)
      );
    }
    if (author) {
      const lower = author.trim().toLowerCase();
      results = results.filter(p => (p.authorId && p.authorId.toLowerCase().includes(lower)) || (p.authorName && p.authorName.toLowerCase().includes(lower)));
    }

    return NextResponse.json(results.slice(0, 50), {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "সার্চ করতে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
