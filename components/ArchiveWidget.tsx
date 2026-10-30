"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { YearArchive } from "@/lib/archive";

export function ArchiveWidget({ tree }: { tree: YearArchive[] }) {
  const [expandedYears, setExpandedYears] = useState<Set<number>>(() => {
    // Expand the most recent year by default
    if (tree.length > 0) return new Set([tree[0].year]);
    return new Set();
  });

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  if (tree.length === 0) return null;

  return (
    <section className="sidebar-section">
      <h3 className="sidebar-title">আর্কাইভ</h3>
      <div className="rounded-xl border border-border bg-surface shadow-sm divide-y divide-border/60">
        {tree.map((year) => {
          const isOpen = expandedYears.has(year.year);
          const totalPosts = year.months.reduce((s, m) => s + m.postCount, 0);
          return (
            <div key={year.year}>
              <button
                onClick={() => toggleYear(year.year)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-fg hover:bg-surface-hover transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                <span>{year.year}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[11px] text-fg-subtle font-normal">{totalPosts}টি</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-fg-subtle transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </span>
              </button>
              {isOpen && (
                <div className="px-4 pb-2.5 space-y-0.5">
                  {year.months.map((m) => (
                    <Link
                      key={m.month}
                      href={`/archive/${m.year}/${String(m.month).padStart(2, "0")}`}
                      className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors"
                    >
                      <span>{m.monthName}</span>
                      <span className="text-[11px] text-fg-subtle">{m.postCount}টি</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
