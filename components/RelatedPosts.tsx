import { type PostMeta } from "@/lib/posts";
import type { ReactNode } from "react";
import { PostCard } from "./PostCard";
import { AdSlot } from "./AdSlot";

import { AD_300x250_HTML } from "@/lib/ad-config";

const RELATED_AD_HTML = AD_300x250_HTML;

export function RelatedPosts({ posts }: { posts: PostMeta[] }) {
  if (posts.length === 0) return null;

  const items: ReactNode[] = [];

  posts.forEach((post, index) => {
    items.push(<PostCard key={post.slug} post={post} />);
    if ((index + 1) % 4 === 0) {
      items.push(
        <AdSlot key={`related-ad-${index}`} id={`related-ad-${index}`} html={RELATED_AD_HTML} />,
      );
    }
  });

  return (
    <section className="mt-12 pt-10 border-t border-border">
      <h2 className="text-xl font-semibold text-fg mb-6">আরও পড়ুন</h2>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {items}
      </div>
    </section>
  );
}
