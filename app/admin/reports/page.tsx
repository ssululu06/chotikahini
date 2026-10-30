"use client";
import { bndSafe } from "@/lib/utils";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flag, Check, X, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { UserAvatar } from "@/components/UserAvatar";

interface Report {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  status: string;
  created_at: string;
  reporter: { username: string; name: string; profile_pic: string } | null;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading) {
      const isAllowed = ["superadmin", "admin", "moderator"].includes(user?.role || "");
      if (!user || !isAllowed) {
        router.push("/");
      } else {
        fetchReports();
      }
    }
  }, [user, authLoading, router]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/reports");
      if (res.ok) {
        const json = await res.json();
        setReports(json.reports || []);
      }
    } catch (e) {
      setError("Failed to fetch reports.");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        setReports(prev => prev.map(r => (r.id === id ? { ...r, status } : r)));
      }
    } catch (e) {}
  };

  if (authLoading || loading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center text-white">Loading...</div>;
  }

  if (!user || !["superadmin", "admin", "moderator"].includes(user.role || "")) {
    return null;
  }

  const pendingCount = reports.filter(r => r.status === "pending").length;

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-surface flex flex-col md:flex-row">
      <AdminSidebar badges={{ pendingReviews: pendingCount }} />
      <main className="flex-1 md:h-screen md:overflow-y-auto p-4 md:p-6 lg:p-8 min-w-0">
        <div className="max-w-7xl mx-auto space-y-6 w-full">
          <header className="flex items-center justify-between gap-3 flex-wrap pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 text-fg-muted hover:text-fg rounded-xl bg-surface-alt border border-border transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-fg flex items-center gap-2">
                <Flag className="w-6 h-6 text-red-500" /> রিপোর্ট ও অভিযোগ সেন্টার
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">{pendingCount}</span>
                )}
              </h1>
              <p className="text-xs text-fg-muted mt-0.5">গল্প বা মন্তব্য সম্পর্কিত ব্যবহারকারীদের রিপোর্ট পর্যালোচনা করুন</p>
            </div>
          </div>
          <button
            onClick={fetchReports}
            className="px-4 py-2 bg-surface-alt border border-border text-xs font-semibold rounded-xl hover:bg-surface-hover transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> রিফ্রেশ
          </button>
        </header>

        {error && <div className="p-4 mb-6 bg-red-100 text-red-700 rounded-lg">{error}</div>}

        <div className="space-y-3">
          {reports.length === 0 ? (
            <div className="p-10 text-center text-fg-muted bg-surface-alt rounded-xl border border-border">
              কোনো রিপোর্ট নেই।
            </div>
          ) : (
            reports.map(report => (
              <div key={report.id} className="bg-surface-alt rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden">
                      <UserAvatar
                        src={report.reporter?.profile_pic}
                        name={report.reporter?.name || report.reporter?.username}
                        userId={report.reporter_id}
                        size="md"
                        className="w-9 h-9"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-fg">
                        @{report.reporter?.username || report.reporter_id}
                      </p>
                      <p className="text-xs text-fg-muted">
                        {bndSafe(report.created_at, "datetime")}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    report.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                    report.status === "reviewed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-fg-subtle"
                  }`}>
                    {report.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    report.target_type === "story" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                  }`}>
                    {report.target_type === "story" ? "গল্প" : "কমেন্ট"}
                  </span>
                  <Link
                    href={report.target_type === "story" ? `/${report.target_id}` : `/#comment-${report.target_id}`}
                    target="_blank"
                    className="font-mono text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[280px]"
                  >
                    {report.target_id}
                  </Link>
                </div>

                {report.reason && (
                  <p className="text-sm text-fg bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg">
                    &ldquo;{report.reason}&rdquo;
                  </p>
                )}

                <div className="flex items-center gap-2">
                  {report.status !== "reviewed" && (
                    <button
                      onClick={() => updateStatus(report.id, "reviewed")}
                      className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> রিভিউ সম্পন্ন
                    </button>
                  )}
                  {report.status !== "dismissed" && (
                    <button
                      onClick={() => updateStatus(report.id, "dismissed")}
                      className="flex items-center gap-1 text-xs bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-fg px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> ডিসমিস
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        </div>
      </main>
    </div>
  );
}
