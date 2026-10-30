import { Calendar, Eye, ThumbsUp } from "lucide-react";
import { enToBnNumber, safeFormatTime } from "@/lib/utils";

interface Meta {
  publishedAt: string | null;
  viewCount: number;
  likeCount: number;
  description?: string | null;
}

/**
 * Compact stat strip used between the player and the title on the video
 * detail page. Looks like the YT metadata bar (· separated values).
 */
export function VideoDetailMeta({ publishedAt, viewCount, likeCount }: Meta) {
  return (
    <p className="font-latin flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
      {publishedAt ? (
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          <time dateTime={publishedAt}>{safeFormatTime(publishedAt)}</time>
        </span>
      ) : null}
      <Dot />
      <span className="inline-flex items-center gap-1">
        <Eye className="h-3.5 w-3.5" />
        {enToBnNumber(viewCount)} ভিউ
      </span>
      <Dot />
      <span className="inline-flex items-center gap-1">
        <ThumbsUp className="h-3.5 w-3.5" />
        {enToBnNumber(likeCount)} লাইক
      </span>
    </p>
  );
}

function Dot() {
  return <span aria-hidden className="text-fg-subtle">•</span>;
}
