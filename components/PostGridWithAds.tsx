import type { ReactNode } from "react";
import type { PostMeta } from "@/lib/posts";
import { PostCard } from "./PostCard";

import { AD_300x250_HTML } from "@/lib/ad-config";

export function PostGridWithAds({
  posts,
  adInterval = 4,
}: {
  posts: PostMeta[];
  adInterval?: number;
}) {
  const items: ReactNode[] = [];

  posts.forEach((post, index) => {
    items.push(<PostCard key={post.slug} post={post} priority={index < 2} />);

    if ((index + 1) % adInterval === 0 && index < posts.length - 1) {
      items.push(
        <div
          key={`ad-${index}`}
          className="card-hover group overflow-hidden flex flex-col relative h-full rounded-2xl border border-border bg-surface-alt p-3 sm:p-4 text-center items-center justify-center min-h-[340px]"
        >
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-fg-subtle bg-surface px-2.5 py-0.5 rounded-full border border-border shadow-xs">
            বিজ্ঞাপন
          </div>
          <div className="w-full flex-1 flex items-center justify-center overflow-hidden">
            <iframe
              srcDoc={AD_300x250_HTML}
              width="300"
              height="250"
              scrolling="no"
              frameBorder="0"
              style={{
                border: 0,
                width: "100%",
                maxWidth: "300px",
                height: "250px",
                borderRadius: "12px",
                overflow: "hidden",
              }}
              loading="lazy"
              title="বিজ্ঞাপন"
            />
          </div>
        </div>,
      );
    }
  });

  return <div className="card-grid">{items}</div>;
}
