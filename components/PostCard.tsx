import Link from "next/link";
import Image from "next/image";
import { Calendar, Clock, PenLine, BadgeCheck } from "lucide-react";
import { type PostMeta } from "@/lib/posts";
import { formatDate } from "@/lib/utils";
import { CategoryBadge } from "./CategoryBadge";
import { PlaceholderCover } from "./PlaceholderCover";
import { InlineViewCount } from "./InlineViewCount";

/**
 * Generate descriptive alt text for post cover images using keyword data.
 */
function postImageAlt(post: PostMeta): string {
  const base = post.title.replace(/[#*`]/g, "").trim();
  return `${base} — ${post.categoryName || "গল্প"} বিভাগের গল্প`;
}

export function PostCard({ post, priority = false }: { post: PostMeta; priority?: boolean }) {
  const targetUrl = `/${post.uid || post.slug}`;

  return (
    <article className="card-hover group relative flex h-full flex-col overflow-hidden">
      {/* Full-card click overlay */}
      <Link
        href={targetUrl}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:ring-2 focus-visible:ring-gray-400"
        aria-label={post.title}
      >
        <span className="sr-only">{post.title}</span>
      </Link>

      {/* Cover — fixed 16:9 for perfectly uniform cards */}
      <div className="pointer-events-none shrink-0 overflow-hidden rounded-t-2xl">
        {post.cover ? (
          <div className="relative overflow-hidden bg-surface-alt">
            <Image
              src={post.cover}
              alt={postImageAlt(post)}
              width={1200}
              height={675}
              priority={priority}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              loading={priority ? "eager" : "lazy"}
              className="card-image w-full object-cover"
              style={{ aspectRatio: "16/9", height: "auto" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </div>
        ) : (
          <PlaceholderCover
            title={post.title}
            categoryId={post.categoryId}
            categoryName={post.categoryName}
            className="w-full"
            style={{ aspectRatio: "16/9" }}
          />
        )}
      </div>

      {/* Body — flex column so every card matches in height */}
      <div className="pointer-events-none flex min-h-0 flex-1 flex-col p-4 sm:p-5">
        <div className="pointer-events-auto relative z-20 mb-2.5">
          <CategoryBadge categoryId={post.categoryId} categoryName={post.categoryName} />
        </div>

        {/* Title — fixed 2-line clamp */}
        <h2 className="text-base sm:text-lg font-bold leading-snug text-fg line-clamp-2 min-h-[2.5rem] sm:min-h-[2.75rem]">
          {post.title}
        </h2>

        {/* Description — fixed 2-line clamp */}
        {post.description ? (
          <p className="mt-1.5 text-xs sm:text-sm text-fg-muted leading-relaxed line-clamp-2 min-h-[2.5rem]">
            {post.description}
          </p>
        ) : (
          <div className="mt-1.5 min-h-[2.5rem]" />
        )}

        {/* Spacer pushes footer to bottom — equalizes card heights */}
        <div className="flex-1" />

        {/* Author row — always present, same position */}
        <Link
          href={`/authors/${post.authorId}`}
          className="pointer-events-auto relative z-20 mt-3 inline-flex max-w-full items-center gap-1.5 text-[11px] font-semibold text-fg-muted transition-colors hover:text-accent"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <PenLine className="h-3 w-3" />
          </span>
          <span className="truncate">{post.authorName}</span>
          {post.authorVerified && (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-blue-500 fill-blue-500/20" />
          )}
        </Link>

        {/* Metadata footer wraps on narrow cards so the view count stays visible */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-2 border-t border-border/60 pt-3 text-xs text-fg-subtle">
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Calendar className="h-3.5 w-3.5 text-fg-subtle" />
            <span>{formatDate(post.publishedAt)}</span>
          </span>

          <span className="text-border/60">·</span>

          <span className="flex items-center gap-1 whitespace-nowrap">
            <Clock className="h-3.5 w-3.5 text-fg-subtle" />
            <span>{post.readingTime}</span>
          </span>

          <span className="text-border/60">·</span>

          <div className="pointer-events-auto relative z-20">
            <InlineViewCount slug={post.slug} />
          </div>
        </div>
      </div>
    </article>
  );
}
