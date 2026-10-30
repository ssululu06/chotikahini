import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * Fast Google Translate API with Parallel Batch Execution
 * Translates English/Banglish text to Bengali fast & free while preserving Markdown!
 */
async function translateChunk(text: string): Promise<string> {
  if (!text || !text.trim()) return text;
  
  try {
    // Ultra-fast Google Translate GTX endpoint
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=bn&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      next: { revalidate: 3600 }
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0].map((item: any) => item[0]).join("");
        if (translated) return translated;
      }
    }

    // Fallback: Google Translate M-web endpoint
    const fallbackUrl = `https://translate.googleapis.com/translate_a/single?client=at&sl=auto&tl=bn&dt=t&q=${encodeURIComponent(text)}`;
    const fbRes = await fetch(fallbackUrl);
    if (fbRes.ok) {
      const fbData = await fbRes.json();
      if (Array.isArray(fbData) && Array.isArray(fbData[0])) {
        return fbData[0].map((item: any) => item[0]).join("");
      }
    }
  } catch (err) {
    console.error("Chunk translate error:", err);
  }

  return text;
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ translatedText: "" });
    }

    const sourceText = text.trim();

    // Group lines into chunks of up to 1000 characters to minimize network requests while maintaining instant speed
    const lines = sourceText.split("\n");
    const chunks: string[] = [];
    let currentChunk = "";

    for (const line of lines) {
      if ((currentChunk + "\n" + line).length > 1000) {
        chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
      }
    }
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    // Execute translation chunks concurrently via Promise.all for maximum speed
    const translatedChunks = await Promise.all(
      chunks.map(chunk => translateChunk(chunk))
    );

    const translatedText = translatedChunks.join("\n");

    return NextResponse.json({ success: true, translatedText });
  } catch (error) {
    console.error("Translation API error:", error);
    return NextResponse.json({ error: "অনুবাদ করতে সমস্যা হয়েছে।" }, { status: 500 });
  }
}
