import { ArticleContent } from "@/components/ArticleContent";
import { isVideoSectionEnabled } from "@/lib/config";
import {
  resolveVideoLink,
  type ResolvedVideo,
} from "@/lib/video-link-resolver";

/**
 * Story body with inline video embeds.
 *
 * Scans the story for URLs and resolves any it can turn into a player,
 * handing the results to `ArticleContent` as a map keyed by the literal
 * URL string. Doing the resolution here (server-side, once per request)
 * keeps `ArticleContent` synchronous and lets us reuse the site's
 * `/videos/<id>` database rows instead of embedding third-party frames for
 * videos we already host.
 *
 * Resolution is deliberately best-effort: an unrecognised or unpublished
 * link simply stays a plain hyperlink, exactly as before this feature.
 */
export async function StoryWithVideos({ source }: { source: string }) {
  // The kill switch hides the standalone video section. Stories that embed
  // one would otherwise 404 behind the player, so honour it here too.
  if (!isVideoSectionEnabled()) {
    return <ArticleContent source={source} />;
  }

  const urls = collectUrls(source);
  if (urls.length === 0) {
    return <ArticleContent source={source} />;
  }

  // Resolve in parallel, and only keep the ones that actually resolved.
  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        return { url, video: await resolveVideoLink(url) };
      } catch {
        // A resolver failure must never take the whole story down.
        return { url, video: null };
      }
    }),
  );

  const videos: Record<string, ResolvedVideo> = {};
  for (const { url, video } of results) {
    if (video) videos[url] = video;
  }

  return <ArticleContent source={source} videos={videos} />;
}

/** Every distinct http(s) URL in the body, in first-seen order. */
function collectUrls(source: string): string[] {
  const matches = source.match(/https?:\/\/[^\s<>"']+/g);
  if (!matches) return [];
  // Cap the work: a pathological body with thousands of links shouldn't
  // turn into thousands of DB round-trips.
  return Array.from(new Set(matches)).slice(0, 10);
}