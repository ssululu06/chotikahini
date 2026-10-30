"use client";

import { PostVideoEmbed } from "./PostVideoEmbed";
import type { ResolvedVideo } from "@/lib/video-link-resolver";

/**
 * Plain text in which any URL the server resolved to a video renders as an
 * inline player, and every other URL renders as a normal link.
 *
 * Shared by story bodies (`ArticleContent`) and community posts
 * (`PostCard`) so a link behaves the same way wherever it's typed. The
 * `videos` map is keyed by the *exact* URL substring as it appears in the
 * text — which is why the split below keeps the matched substrings rather
 * than normalising them.
 *
 * Everything is rendered as text nodes, so nothing here can inject HTML.
 */

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

export function VideoLinkedText({
  text,
  videos,
  className,
}: {
  text: string;
  videos?: Record<string, ResolvedVideo>;
  className?: string;
}) {
  const parts = text.split(URL_RE);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (!/^https?:\/\//i.test(part)) return <span key={i}>{part}</span>;

        const video = videos?.[part];
        if (video) return <PostVideoEmbed key={i} video={video} />;

        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 underline underline-offset-2 break-all"
          >
            {part}
          </a>
        );
      })}
    </span>
  );
}