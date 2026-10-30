"use client";
import { bndSafe } from "@/lib/utils";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AccessDenied } from "@/components/admin/AccessDenied";

const ACTION_LABELS: Record<string, string> = {
  "roles.assign": "রোল পরিবর্তন",
  "users.delete_permanent": "ইউজার স্থায়ী ডিলিট",
  "users.verify": "ভেরিফিকেশন",
  "story.approve": "গল্প প্রকাশ",
  "story.reject": "গল্প প্রত্যাখ্যান",
  "story.request_revision": "সংশোধন প্রস্তাব",
  "story.unpublish": "গল্প আনপাবলিশ",
  "content.delete_permanent": "স্থায়ী ডিলিট",
  "deletion_requests.approve": "ডিলিট রিকোয়েস্ট অনুমোদন",
  "authors.manage": "লেখক ম্যানেজ",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] || action;
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const isAllowed = ["admin", "superadmin"].includes(user?.role || "");

  useEffect(() => {
    if (!authLoading) {
      if (!isAllowed) {
        router.push("/admin");
      } else {
        fetchLogs();
      }
    }
  }, [user, authLoading, router, isAllowed]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/audit-logs");
      if (res.ok) {
        const json = await res.json();
        setLogs(json.logs || []);
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center text-fg-muted">Loading...</div>;
  }

  if (!user || !isAllowed) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-surface flex flex-col md:flex-row">
      <AdminSidebar />
      <main className="flex-1 md:h-screen md:overflow-y-auto p-4 md:p-6 lg:p-8 min-w-0">
        <div className="max-w-7xl mx-auto space-y-6 w-full">
          <header className="flex items-center justify-between gap-3 flex-wrap pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 text-fg-muted hover:text-fg rounded-xl bg-surface-alt border border-border transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-fg flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-blue-500" /> সিস্টেম অডিট লগ (Audit Logs)
              </h1>
              <p className="text-xs text-fg-muted mt-0.5">অ্যাডমিন ও মডারেটরদের সমস্ত নিরাপত্তা কার্যক্রম ও পরিবর্তনের ইতিহাস</p>
            </div>
          </div>
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-surface-alt border border-border text-xs font-semibold rounded-xl hover:bg-surface-hover transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> রিফ্রেশ
          </button>
        </header>

          <div className="bg-surface-alt rounded-2xl border border-border shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-sm text-fg-muted animate-pulse">লোড হচ্ছে...</div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-sm text-fg-muted">কোনো অডিট লগ নেই।</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-fg-muted uppercase tracking-wider">
                      <th className="px-4 py-3">সময়</th>
                      <th className="px-4 py-3">অ্যাকশন</th>
                      <th className="px-4 py-3">একজন</th>
                      <th className="px-4 py-3">টার্গেট</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-surface-hover transition-colors">
                        <td className="px-4 py-3 text-xs text-fg-muted whitespace-nowrap">
                          {bndSafe(log.created_at, "datetime")}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-0.5 text-[11px] font-bold rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                            {actionLabel(log.action)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-fg">
                          <span className="font-mono">@{log.actor_username || log.actor_id || "?"}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-fg-muted">
                          <span className="text-fg-subtle">{log.target_type || "-"}</span>
                          {log.target_id && <span className="font-mono ml-1">#{log.target_id}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
