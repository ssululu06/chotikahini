"use client";

import { useEffect, useState } from "react";
import { X, Eye, Heart, MessageSquare, Users, TrendingUp, BookOpen, Clock, Loader2 } from "lucide-react";

interface Props {
  storyUid: string | null;
  storySlug: string;
  storyTitle: string;
  onClose: () => void;
}

export function StoryAnalyticsModal({ storyUid, storySlug, storyTitle, onClose }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = storyUid || storySlug;
    if (!ref) { setLoading(false); return; }
    fetch(`/api/author/story-analytics?storyUid=${encodeURIComponent(ref)}`)
      .then((r) => (r.ok ? r.json() : { analytics: [] }))
      .then((d) => setData(d.analytics?.[0] || null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [storyUid, storySlug]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-3xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-fg-subtle hover:text-fg rounded-lg hover:bg-surface-hover transition-colors">
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold text-fg pr-8">গল্পের পরিসংখ্যান</h3>
        <p className="text-sm text-fg-muted mt-1 line-clamp-2">{storyTitle}</p>

        <div className="mt-5">
          {loading ? (
            <div className="py-10 text-center text-fg-muted animate-pulse flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> লোড হচ্ছে...
            </div>
          ) : !data ? (
            <div className="py-10 text-center text-fg-muted italic">এই গল্পের জন্য এখনো কোনো পরিসংখ্যান নেই।</div>
          ) : (
            <div className="space-y-4">
              {/* Main metrics grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl border border-blue-200/60 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/40 to-surface-alt dark:from-blue-950/10 dark:to-surface-alt text-center">
                  <Eye className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-fg">{(data.views || 0).toLocaleString("bn-BD")}</p>
                  <p className="text-[10px] text-fg-muted font-semibold uppercase tracking-wider">ভিউ</p>
                </div>
                <div className="p-4 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/40 to-surface-alt dark:from-indigo-950/10 dark:to-surface-alt text-center">
                  <Users className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-fg">{(data.uniqueReaders || data.uniqueVisitors || 0).toLocaleString("bn-BD")}</p>
                  <p className="text-[10px] text-fg-muted font-semibold uppercase tracking-wider">পাঠক</p>
                </div>
                <div className="p-4 rounded-2xl border border-rose-200/60 dark:border-rose-900/40 bg-gradient-to-br from-rose-50/40 to-surface-alt dark:from-rose-950/10 dark:to-surface-alt text-center">
                  <Heart className="w-5 h-5 text-rose-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-fg">{(data.likes || 0).toLocaleString("bn-BD")}</p>
                  <p className="text-[10px] text-fg-muted font-semibold uppercase tracking-wider">লাইক</p>
                </div>
                <div className="p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/40 to-surface-alt dark:from-emerald-950/10 dark:to-surface-alt text-center">
                  <MessageSquare className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-fg">{(data.comments || 0).toLocaleString("bn-BD")}</p>
                  <p className="text-[10px] text-fg-muted font-semibold uppercase tracking-wider">মতামত</p>
                </div>
              </div>

              {/* Reading progress */}
              <div className="p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/40 to-surface-alt dark:from-emerald-950/10 dark:to-surface-alt">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-semibold text-fg">গড় পড়ার অগ্রগতি</span>
                  </div>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{data.avgCompletion || 0}%</span>
                </div>
                <div className="h-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${Math.min(100, data.avgCompletion || 0)}%` }} />
                </div>
                <p className="text-[11px] text-fg-muted mt-1.5">
                  {data.avgCompletion >= 80 ? (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      অধিকাংশ পাঠক পুরো গল্প পড়েছেন
                    </span>
                  ) : data.avgCompletion >= 40 ? (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                      অর্ধেকের বেশি পাঠক পড়েছেন
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      বেশিরভাগ পাঠক গল্পটি শেষ করেননি
                    </span>
                  )}
                </p>
              </div>

              {/* Engagement ratio */}
              <div className="p-4 rounded-2xl border border-border bg-surface-alt">
                <div className="flex items-center gap-2 text-xs text-fg-muted">
                  <TrendingUp className="w-4 h-4" />
                  <span>এনগেজমেন্ট রেশিও: <strong className="text-fg">{(data.likes || 0) / Math.max(1, data.views || 1) * 100}</strong>% (লাইক/ভিউ)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}