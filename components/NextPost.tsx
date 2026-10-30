import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPostBySlugAsync } from "@/lib/posts";

export async function NextPost({ slug }: { slug: string | null | undefined }) {
  if (!slug) return null;

  const post = await getPostBySlugAsync(slug);
  if (!post) return null;

  return (
    <div className="mb-6 rounded-2xl border border-border bg-surface-alt p-4">
      <Link
        href={`/${post.uid || post.slug}`}
        className="group flex items-center justify-end gap-3 text-right"
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-fg-subtle">
            পরের পর্ব পড়ুন
          </p>
          <p className="text-sm font-medium text-fg group-hover:text-fg-muted transition-colors line-clamp-1">
            {post.title}
          </p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-fg-muted group-hover:text-fg transition-colors">
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </div>
  );
}
