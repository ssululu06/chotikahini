import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/tags/recommendations?tags=রোমান্স,পরকীয়া&category=hot&content=...
 * Recommends tags based on:
 *   1. content keyword relevance (what the story is actually about)
 *   2. tag co-occurrence across published stories
 *   3. tag frequency
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawTags = searchParams.get("tags") || "";
    const category = searchParams.get("category") || "";
    const content = searchParams.get("content") || "";

    const selectedTags = rawTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const selectedSet = new Set(selectedTags);

    const supabase = getSupabaseAdmin();
    const { data: stories } = await supabase
      .from("stories")
      .select("tags, category")
      .eq("status", "published")
      .limit(500);

    if (!stories || stories.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    // ── 1. Content keyword profile ──
    const contentProfile = buildContentProfile(content);

    // ── 2. Co-occurrence + frequency ──
    const coOccurrence = new Map<string, number>();
    const tagFrequency = new Map<string, number>();

    for (const story of stories) {
      if (!Array.isArray(story.tags) || story.tags.length === 0) continue;

      const storyCategoryMatch = category ? (story.category || "").toLowerCase() === category.toLowerCase() : true;
      const categoryWeight = storyCategoryMatch ? 1.5 : 1.0;

      const normalizedTags = story.tags.map((t: string) => String(t).trim()).filter(Boolean);

      for (const t of normalizedTags) {
        const key = t.toLowerCase();
        tagFrequency.set(key, (tagFrequency.get(key) || 0) + 1 * categoryWeight);
      }

      const hasSelectedMatch = selectedTags.some((st) =>
        normalizedTags.some((t) => t.toLowerCase() === st)
      );

      if (selectedTags.length > 0 && hasSelectedMatch) {
        for (const t of normalizedTags) {
          const key = t.toLowerCase();
          if (!selectedSet.has(key)) {
            coOccurrence.set(key, (coOccurrence.get(key) || 0) + 5 * categoryWeight);
          }
        }
      }
    }

    // ── 3. Score candidate tags ──
    const scores = new Map<string, { tag: string; score: number }>();
    const allTags = new Set([...coOccurrence.keys(), ...tagFrequency.keys(), ...contentProfile.keys()]);

    for (const key of allTags) {
      if (selectedSet.has(key)) continue;

      const origTag =
        stories
          .flatMap((s) => (Array.isArray(s.tags) ? s.tags : []))
          .find((t: string) => String(t).trim().toLowerCase() === key) || key;

      const coScore = coOccurrence.get(key) || 0;
      const freqScore = tagFrequency.get(key) || 0;
      const contentScore = contentProfile.get(key) || 0;

      // Content relevance is the strongest signal for the current story
      const totalScore = contentScore * 6 + coScore * 3 + freqScore;

      scores.set(key, { tag: String(origTag).trim(), score: totalScore });
    }

    const sorted = Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .map((item) => item.tag)
      .slice(0, 16);

    return NextResponse.json({ recommendations: sorted });
  } catch (error: any) {
    console.error("Tag recommendations error:", error);
    return NextResponse.json({ recommendations: [] });
  }
}

/**
 * Build a keyword profile from the story content.
 * Extracts meaningful Bengali/English words, counts frequency,
 * and maps them to likely tag keywords.
 */
function buildContentProfile(content: string): Map<string, number> {
  const profile = new Map<string, number>();

  if (!content || content.trim().length < 30) return profile;

  // Common Bengali stop words to ignore
  const stopWords = new Set(
    ("এই সেই যে এবং তার তাদের তখন পরে এখন আর কে না করে ছিল হয় হবে আছে কিন্তু যদি তাই থেকে উপর নিচ জন্য সাথে মাধ্যমে এক দুই তিন চার পাঁচ প্রথম শেষ প্রতি সব কিছু অনেক নিজের আমার তোমার আমাদের আপনার তার তুমি আমি আমরা আপনি যখন যেখানে সেখানে এখানে ওখানে ফলে হিসেবে বলা হয় যায় আসে দেয় নেয় থাকা হওয়া").split(" ")
  );

  const words = content
    .toLowerCase()
    .replace(/[।,;:!?()"'‘’“”\-—…·•*#_\[\]{}|\\/`~@$%^&+=<>]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  // Map frequent content words to tag vocabulary. A tag is relevant if its
  // words (split by space) appear in the content or if the content word
  // appears inside the tag string.
  const tagCandidates: Record<string, string[]> = {
    "রোমান্স": ["রোমান্স", "ভালোবাসা", "প্রেম", "মায়া", "হৃদয়"],
    "প্রেম": ["প্রেম", "ভালোবাসা", "রোমান্টিক"],
    "পরকিয়া": ["পরকিয়া", "পরকীয়া", "স্বামী", "বউ", "স্ত্রী", "প্রেমিক", "প্রেমিকা"],
    "পারিবারিক": ["পারিবারিক", "পরিবার", "মা", "বাবা", "বোন", "ভাই", "শাশুড়ি", "জামাই", "কাকিমা", "মাসি", "খালা", "বৌদি", "ভাবি", "দাদি", "নানি", "সৎ", "দেবর", "ননদ"],
    "গ্যাংব্যাং": ["গ্যাংব্যাং", "গ্রুপ", "একসাথে", "অনেকজন"],
    "কাকোল্ড": ["কাকোল্ড", "স্বামী", "সামনে"],
    "হনিমুন": ["হনিমুন", "মধুচন্দ্রিমা", "নবদম্পতি", "বিয়ের রাত"],
    "ছাত্রী": ["ছাত্রী", "স্টুডেন্ট", "কলেজ", "স্কুল", "পড়ুয়া", "ম্যাডাম"],
    "বিবাহবহির্ভূত": ["বহির্ভূত", "অবৈধ", "লুকানো"],
    "ভাইবোন": ["ভাই", "বোন", "ছোট বোন"],
    "প্রতিবেশি": ["প্রতিবেশি", "পাশের বাড়ি", "আশপাশ"],
    "অফিস": ["অফিস", "বস", "কলিগ", "অফিসের", "কাজের"],
    "অজাচার": ["অজাচার", "আত্মীয়"],
    "গে": ["গে", "সমকামী"],
    "হিজরা": ["হিজরা", "শীমেল"],
    "গরম": ["গরম", "হট", "উত্তপ্ত"],
    "গোপন": ["গোপন", "লুকানো", "চুপি চুপি"],
    "দাম্পত্য": ["দাম্পত্য", "স্বামী", "স্ত্রী", "সংসার", "বিয়ে"],
    "গ্রুপ": ["গ্রুপ", "একসাথে", "অনেকজন"],
    "মিলন": ["মিলন", "আলিঙ্গন", "ঠাপানো"],
  };

  for (const [tag, keywords] of Object.entries(tagCandidates)) {
    let hits = 0;
    for (const kw of keywords) {
      if (freq.has(kw)) hits += freq.get(kw)!;
    }
    if (hits > 0) {
      profile.set(tag, hits);
    }
  }

  return profile;
}
