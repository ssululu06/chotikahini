import { ScriptInjector } from "./ScriptInjector";
import { ArticleAdInjector } from "./ArticleAdInjector";
import { VideoLinkedText } from "./VideoLinkedText";
import type { ResolvedVideo } from "@/lib/video-link-resolver";

interface ArticleContentProps {
  /** Raw story content (plain text, frontmatter already stripped). */
  source: string;
  /**
   * Video links the server already resolved, keyed by the exact URL string
   * that appears in the body. When a paragraph's URL has an entry here, the
   * link renders as an inline player instead of a bare anchor.
   *
   * Resolution is server-side because our own /videos links need a DB read;
   * see `StoryWithVideos` which assembles this map.
   */
  videos?: Record<string, ResolvedVideo>;
}

/**
 * Render exactly what the author wrote:
 *  - every line break & blank line is preserved (whitespace-pre-wrap)
 *  - no markdown symbols are interpreted (they are stripped so old
 *    markdown-formatted stories still read cleanly)
 *  - all text is escaped (no HTML/script injection)
 *  - plain URLs become clickable links for convenience
 *  - URLs that resolve to a video become inline players
 */
function stripMarkdownSyntax(line: string): string {
  return line
    // headings: "## Title" -> "Title"
    .replace(/^\s{0,3}#{1,6}\s+/, "")
    // blockquote: "> text" -> "text"
    .replace(/^\s{0,3}>\s?/, "")
    // list items: "- item", "* item", "1. item"
    .replace(/^\s{0,3}([-*+]|\d+[.)])\s+/, "")
    // inline code: `code` -> code
    .replace(/`([^`]+)`/g, "$1")
    // bold: **text** / __text__ -> text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    // italic: *text* / _text_ -> text
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2")
    .replace(/(^|[^_])_([^_\n]+)_/g, "$1$2")
    // strikethrough: ~~text~~ -> text
    .replace(/~~([^~]+)~~/g, "$1")
    // markdown links: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function renderParagraph(
  text: string,
  key: number,
  videos?: Record<string, ResolvedVideo>,
) {
  // Strip markdown markers per line, then preserve the line breaks.
  const clean = text.split("\n").map(stripMarkdownSyntax).join("\n");

  // A video link gets the whole paragraph to itself: the bare URL text is
  // dropped and the player is rendered in its place. A video URL wedged
  // mid-sentence still works — the link becomes a small inline player
  // directly after that sentence's text.
  return (
    <p key={key} className="mb-4 whitespace-pre-wrap break-words leading-relaxed">
      <VideoLinkedText text={clean} videos={videos} />
    </p>
  );
}

export function ArticleContent({ source, videos }: ArticleContentProps) {
  // Split on blank lines to create paragraphs, but keep the raw text
  // inside each paragraph (whitespace-pre-wrap preserves every newline).
  const paragraphs = source.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  return (
    <div className="prose-custom prose-content relative">
      {paragraphs.map((para, i) => renderParagraph(para, i, videos))}
      <ArticleAdInjector source={source} />
      <ScriptInjector />
    </div>
  );
}