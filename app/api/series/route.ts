import { NextResponse } from "next/server";
import { getSeries } from "@/lib/posts";
import { getSeriesId, getSeriesTitle } from "@/lib/series-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const seriesList = await getSeries();
    
    // We only need metadata for the frontend, trim the content to save bandwidth
    const trimmedSeries = seriesList.map((series) => ({
      id: getSeriesId(series),
      title: getSeriesTitle(series),
      cover: series.find((post) => post.cover)?.cover || "",
      episodes: series.map((post) => ({
        slug: post.slug,
        uid: post.uid || post.slug,
        title: post.title,
        cover: post.cover || "",
        authorName: post.authorName,
        publishedAt: post.publishedAt,
      })),
    }));

    return NextResponse.json(trimmedSeries, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET series error:", error);
    return NextResponse.json({ error: "Failed to fetch series" }, { status: 500 });
  }
}
