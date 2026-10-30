import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPostBySlugAsync } from "@/lib/posts";

export async function PreviousPost({ slug }: { slug: string | null }) {
  if (!slug) return null;

  const post = await getPostBySlugAsync(slug);
  if (!post) return null;

  return (
    <div className="mb-6 rounded-2xl border border-border bg-surface-alt p-4">
      <Link
        href={`/${post.uid || post.slug}`}
        className="group flex items-center gap-3"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-fg-muted group-hover:text-fg transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-fg-subtle">
            আগের পর্ব পড়ুন
          </p>
          <p className="text-sm font-medium text-fg group-hover:text-fg-muted transition-colors line-clamp-1">
            {post.title}
          </p>
        </div>
      </Link>
    </div>
  );
}
