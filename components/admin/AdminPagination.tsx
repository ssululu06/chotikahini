"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { enToBnNumber } from "@/lib/utils";

/**
 * Client-side pagination for admin tables.
 *
 * Unlike the public `Pagination` (which renders route Links), admin lists
 * are single-page client components backed by a `?page=` query, so this
 * fires `onPageChange` instead of navigating. Same visual language —
 * previous / numbered window / next, with `…` truncation for long ranges —
 * so admins don't learn two different pagers.
 */
export function AdminPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  // Numbered window: always first + last, current ±1 in the middle, `…`
  // filling any gap — so a 200-page list still renders ~7 slots.
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  const btn =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav className="flex items-center justify-center gap-1.5 pt-2" aria-label="ভিডিও তালিকা পেজিনেশন">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPrev}
        className={`${btn} border border-border bg-surface-alt text-fg-muted hover:bg-surface-hover hover:text-fg`}
        aria-label="আগের পাতা"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pages.map((p, idx) =>
        p === "…" ? (
          <span key={`gap-${idx}`} className="px-1 text-sm text-fg-subtle">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={
              `${btn} ` +
              (p === page
                ? "bg-fg text-surface shadow-sm"
                : "border border-border bg-surface-alt text-fg-muted hover:bg-surface-hover hover:text-fg")
            }
          >
            {enToBnNumber(p)}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNext}
        className={`${btn} border border-border bg-surface-alt text-fg-muted hover:bg-surface-hover hover:text-fg`}
        aria-label="পরের পাতা"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}