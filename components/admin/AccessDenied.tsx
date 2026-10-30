"use client";

import Link from "next/link";
import { ShieldX, ArrowLeft } from "lucide-react";

export function AccessDenied({ title = "Access Denied" }: { title?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-6">
      <div className="text-center max-w-md">
        <span className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 dark:bg-red-900/20 text-red-500 mb-6">
          <ShieldX className="w-10 h-10" />
        </span>
        <h1 className="text-3xl font-bold text-fg mb-3">403 — {title}</h1>
        <p className="text-sm text-fg-muted dark:text-fg-subtle leading-relaxed mb-8">
          আপনার এই বিভাগটি দেখার অনুমতি নেই। এই এলাকার তথ্য সীমিত করা হয়েছে।
        </p>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> ড্যাশবোর্ডে ফিরে যান
        </Link>
      </div>
    </div>
  );
}
