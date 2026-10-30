"use client";
import { bndSafe } from "@/lib/utils";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CopyCheck, Trash2, Link as LinkIcon, Check, X } from "lucide-react";

interface ClusterItem {
  uid: string | null;
  slug: string;
  title: string;
  status: string;
  publishedAt: string;
  wordCount: number;
  keep: boolean;
}

interface Cluster {
  id: string;
  items: ClusterItem[];
  relations: { from: string; to: string; percent: number }[];
  maxPercent: number;
  recommendation: string;
}

export function SimilarityClusters() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletedRefs, setDeletedRefs] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ type: string; text: string }>({ type: "", text: "" });

  useEffect(() => {
    fetch("/api/admin/similarity-clusters")
      .then((r) => (r.ok ? r.json() : { clusters: [] }))
      .then((d) => setClusters(d.clusters || []))
      .catch(() => setError("ডুপ্লিকেট স্ক্যান করতে সমস্যা হয়েছে।"))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (item: ClusterItem) => {
    const ref = item.uid || item.slug;
    if (!confirm(`"${item.title}" গল্পটি ডিলিট করবেন?\n\n${item.status === "published" ? "গল্পটি হাইড হবে এবং স্থায়ী ডিলিটের জন্য সুপার অ্যাডমিনের অনুমোদন লাগবে।" : "গল্পটি ডিলিট করা হবে।"}`)) return;
    setDeleting(ref);
    setMsg({ type: "", text: "" });
    try {
      const res = await fetch("/api/admin/posts/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", fileSlug: item.slug || item.uid, reason: "ডুপ্লিকেট ক্লাস্টার থেকে ডিলিট" }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setMsg({ type: "success", text: json.message || `"${item.title}" ডিলিট করা হয়েছে।` });
        setDeletedRefs(prev => new Set(prev).add(ref));
      } else {
        setMsg({ type: "error", text: json.error || "ডিলিট করতে সমস্যা হয়েছে।" });
      }
    } catch {
      setMsg({ type: "error", text: "নেটওয়ার্ক সমস্যা হয়েছে।" });
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="p-10 text-center text-fg-muted animate-pulse flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> ডুপ্লিকেট স্ক্যান হচ্ছে...
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="p-10 text-center">
        <CopyCheck className="w-10 h-10 text-green-500 mx-auto mb-3" />
        <p className="text-fg font-semibold">কোনো ডুপ্লিকেট মেলেনি</p>
        <p className="text-sm text-fg-muted mt-1">সব গল্পই মৌলিক দেখাচ্ছে।</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg text-fg flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-red-500" /> সম্ভাব্য ডুপ্লিকেট ক্লাস্টার
        </h3>
        <span className="text-xs text-fg-muted font-medium">{clusters.length}টি ক্লাস্টার</span>
      </div>

      {msg.text && (
        <div className={`p-4 rounded-xl text-sm font-medium border ${msg.type === "error" ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800" : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800"}`}>
          {msg.text}
        </div>
      )}

      {clusters.map((cluster) => (
        <div key={cluster.id} className="rounded-2xl border border-border bg-surface-alt shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-gradient-to-r from-red-50/60 to-surface-alt dark:from-red-950/10 dark:to-surface-alt">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[11px] font-bold">
                সর্বোচ্চ মিল: {cluster.maxPercent}%
              </span>
              <span className="text-xs text-fg-muted">{cluster.items.length}টি গল্প একে অপরের সাথে মিলছে</span>
            </div>
            <p className="text-xs text-fg-muted mt-2 leading-relaxed">
              <span className="font-bold text-fg">সাজেশন:</span> {cluster.recommendation}
            </p>
          </div>

          <div className="divide-y divide-border">
            {cluster.items.map((item) => {
              const ref = item.uid || item.slug;
              const isDeleted = deletedRefs.has(ref);
              return (
                <div key={ref} className={`p-4 flex items-center justify-between gap-3 ${item.keep ? "bg-green-50/40 dark:bg-green-950/10" : ""} ${isDeleted ? "opacity-40" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isDeleted ? (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold">ডিলিট হয়েছে</span>
                      ) : item.keep ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold">
                          <Check className="w-3 h-3" /> রাখুন
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold">
                          <X className="w-3 h-3" /> ডুপ্লিকেট?
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === "published" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}>
                        {item.status === "published" ? "প্রকাশিত" : item.status}
                      </span>
                      <span className="text-[10px] text-fg-muted">{item.wordCount} শব্দ</span>
                    </div>
                    <p className="text-sm font-semibold text-fg mt-1.5 truncate">{item.title}</p>
                    <p className="text-[11px] text-fg-muted font-mono truncate">
                      {item.publishedAt ? bndSafe(item.publishedAt, "date") : ""} • {item.uid || item.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isDeleted ? null : item.keep ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400">
                        <CopyCheck className="w-4 h-4" /> রাখুন
                      </span>
                    ) : (
                      <>
                        <Link
                          href={`/${item.uid || item.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs bg-surface text-fg border border-border hover:bg-surface-hover px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          <LinkIcon className="w-3.5 h-3.5" /> দেখুন
                        </Link>
                        <button
                          onClick={() => handleDelete(item)}
                          disabled={deleting === ref}
                          className="flex items-center gap-1 text-xs bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {deleting === ref ? "ডিলিট..." : "ডিলিট"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
