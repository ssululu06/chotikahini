"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldAlert, ShieldCheck, Loader2, FileSearch } from "lucide-react";

interface Match {
  uid: string | null;
  slug: string;
  title: string;
  similarity: number;
  authorName?: string;
}

interface Props {
  content: string;
  title?: string;
  excludeRef?: string | null;
}

export function SimilarityCheck({ content, title, excludeRef }: Props) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [totalChecked, setTotalChecked] = useState(0);

  const runCheck = async () => {
    if (!content || content.trim().length < 100) {
      setError("পর্যাপ্ত লেখা নেই — অন্তত ১০০ অক্ষর লিখে আবার চেষ্টা করুন।");
      return;
    }
    setLoading(true);
    setError("");
    setChecked(false);
    try {
      const res = await fetch("/api/admin/similarity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, title: title || "", excludeRef: excludeRef || null }),
      });
      const json = await res.json();
      if (res.ok) {
        setMatches(json.matches || []);
        setTotalChecked(json.totalChecked || 0);
        setChecked(true);
      } else {
        setError(json.error || "মিল যাচাই করতে সমস্যা হয়েছে।");
      }
    } catch {
      setError("নেটওয়ার্ক সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  const maxSim = matches.length > 0 ? matches[0].similarity : 0;
  const isHigh = maxSim >= 70;
  const isMedium = maxSim >= 40 && maxSim < 70;

  return (
    <div className="rounded-2xl border border-border bg-surface-alt p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileSearch className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-fg">মিল যাচাই (Similarity Check)</h3>
        </div>
        <button
          type="button"
          onClick={runCheck}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          {loading ? "যাচাই হচ্ছে..." : "মিল যাচাই করুন"}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg">
          {error}
        </div>
      )}

      {checked && (
        <div className="space-y-2.5">
          <div className={`flex items-center justify-between gap-2 p-3 rounded-xl border ${
            isHigh
              ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20"
              : isMedium
                ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
                : "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20"
          }`}>
            <div className="flex items-center gap-2">
              {isHigh ? (
                <ShieldAlert className="w-5 h-5 text-red-500" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-green-500" />
              )}
              <div>
                <p className={`text-sm font-bold ${isHigh ? "text-red-700 dark:text-red-400" : isMedium ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400"}`}>
                  সর্বোচ্চ মিল: {maxSim}%
                </p>
                <p className="text-[11px] text-fg-muted dark:text-fg-subtle">
                  {totalChecked}টি পোস্টের সাথে তুলনা করা হয়েছে
                </p>
              </div>
            </div>
            {isHigh && (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded-full">
                সতর্কতা!
              </span>
            )}
          </div>

          {matches.length === 0 ? (
            <p className="text-xs text-fg-muted dark:text-fg-subtle italic">
              কোনো মিল পাওয়া যায়নি — এই লেখাটি অনন্য।
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-fg-muted dark:text-fg-subtle uppercase tracking-wider">
                সবচেয়ে কাছাকাছি পোস্ট
              </p>
              {matches.map((m, i) => (
                <Link
                  key={m.slug + i}
                  href={`/${m.uid || m.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{m.title}</p>
                    {m.authorName && <p className="text-[10px] text-fg-subtle">@{m.authorName}</p>}
                  </div>
                  <span className={`shrink-0 text-xs font-bold ${
                    m.similarity >= 70 ? "text-red-600 dark:text-red-400" : m.similarity >= 40 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                  }`}>
                    {m.similarity}%
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
