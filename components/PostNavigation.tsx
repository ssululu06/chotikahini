import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { type PostMeta } from "@/lib/posts";

export function PostNavigation({
  prev,
  next,
}: {
  prev: PostMeta | null;
  next: PostMeta | null;
}) {
  if (!prev && !next) return null;

  return (
    <nav className="mt-10 pt-8 border-t border-border">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {prev ? (
          <Link
            href={`/${prev.slug}`}
            className="group rounded-2xl border border-border bg-surface p-4 transition-all duration-200 hover:bg-surface-hover hover:-translate-y-0.5"
          >
            <span className="flex items-center gap-1.5 text-xs text-fg-subtle mb-1.5">
              <ArrowLeft className="h-3 w-3" /> আগের লেখা
            </span>
            <span className="block text-sm font-medium text-fg group-hover:text-fg-muted transition-colors line-clamp-1">
              {prev.title}
            </span>
          </Link>
        ) : (
          <div />
        )}
        {next ? (
          <Link
            href={`/${next.slug}`}
            className="group rounded-2xl border border-border bg-surface p-4 text-right transition-all duration-200 hover:bg-surface-hover hover:-translate-y-0.5"
          >
            <span className="flex items-center justify-end gap-1.5 text-xs text-fg-subtle mb-1.5">
              পরের লেখা <ArrowRight className="h-3 w-3" />
            </span>
            <span className="block text-sm font-medium text-fg group-hover:text-fg-muted transition-colors line-clamp-1">
              {next.title}
            </span>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </nav>
  );
}
