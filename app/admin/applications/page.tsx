"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, ShieldAlert, UserPlus } from "lucide-react";
import { enToBnNumber, bndSafe } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/admin/AccessDenied";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function ApplicationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    if (authLoading) return;
    if (!user || !hasPermission(user.role, "authors.manage")) {
      router.push("/admin");
      return;
    }
    fetchApplications();
  }, [user, authLoading, router]);

  const fetchApplications = async () => {
    try {
      const res = await fetch("/api/admin/applications");
      if (res.ok) {
        const data = await res.json();
        // API returns snake_case (real_name, sample_link, created_at); the UI
        // was built against camelCase keys, so every field resolved to
        // undefined — which is why "লেখার নমুনা" rendered as an empty link.
        const rows = (data.applications || []).map((a: any) => ({
          id: a.id,
          userId: a.user_id ?? a.users?.id ?? null,
          username: a.username,
          realName: a.real_name,
          sampleLink: a.sample_link,
          message: a.message,
          status: a.status,
          createdAt: a.created_at,
          reviewedAt: a.reviewed_at,
          profilePic: a.users?.profile_pic ?? null,
          email: a.users?.email ?? null,
        }));
        setApps(rows);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (appId: string) => {
    setMsg({ type: "", text: "" });
    try {
      const res = await fetch(`/api/admin/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", appId })
      });
      
      if (res.ok) {
        setMsg({ type: "success", text: "আবেদন অনুমোদন করা হয়েছে! ব্যবহারকারী এখন লেখক হিসেবে যোগ হয়েছেন।" });
        fetchApplications();
      } else {
        const data = await res.json();
        setMsg({ type: "error", text: data.error || "আবেদন অনুমোদন করতে সমস্যা হয়েছে।" });
      }
    } catch (e) {
      setMsg({ type: "error", text: "একটি অনাকাঙ্ক্ষিত সমস্যা হয়েছে।" });
    }
  };

  const handleReject = async (appId: string) => {
    if (!confirm("আপনি কি নিশ্চিত যে এই লেখক আবেদনটি বাতিল করতে চান?")) return;
    setMsg({ type: "", text: "" });
    try {
      const res = await fetch(`/api/admin/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", appId })
      });
      
      if (res.ok) {
        setMsg({ type: "success", text: "আবেদন বাতিল করা হয়েছে।" });
        fetchApplications();
      } else {
        setMsg({ type: "error", text: "আবেদন বাতিল করতে সমস্যা হয়েছে।" });
      }
    } catch (e) {
      setMsg({ type: "error", text: "একটি অনাকাঙ্ক্ষিত সমস্যা হয়েছে।" });
    }
  };

  const pendingApps = apps.filter(a => a.status === "pending");

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-surface text-fg-muted animate-pulse">লোড হচ্ছে...</div>;
  }

  if (!user || !hasPermission(user.role, "authors.manage")) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-surface flex flex-col md:flex-row">
      <AdminSidebar badges={{ pendingApplications: pendingApps.length }} />
      <main className="flex-1 md:h-screen md:overflow-y-auto p-4 md:p-6 lg:p-8 min-w-0">
        <div className="max-w-7xl mx-auto space-y-6 w-full">
          <header className="flex items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 text-fg-muted hover:text-fg rounded-xl bg-surface-alt border border-border transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-fg flex items-center gap-2">
                <UserPlus className="w-6 h-6 text-blue-500" /> লেখক আবেদনসমূহ
                {pendingApps.length > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded-full">
                    {enToBnNumber(pendingApps.length)}
                  </span>
                )}
              </h1>
              <p className="text-xs text-fg-muted mt-0.5">নতুন লেখক হওয়ার আবেদন পর্যালোচনা ও অনুমোদন করুন</p>
            </div>
          </div>
        </header>
        {msg.text && (
          <div className={`p-4 rounded-xl text-sm font-medium ${msg.type === "error" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200"}`}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-fg-muted animate-pulse">আবেদনপত্র লোড হচ্ছে...</div>
        ) : pendingApps.length === 0 ? (
          <div className="text-center py-20 bg-surface-alt rounded-2xl border border-border">
            <h2 className="text-xl font-bold text-fg">কোনো অপেক্ষমাণ আবেদন নেই</h2>
            <p className="text-fg-muted mt-2 text-sm">বর্তমানে নতুন কোনো লেখক আবেদন জমা নেই।</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingApps.map(app => (
              <div key={app.id} className="bg-surface-alt border border-border rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <h3 className="text-lg font-bold text-fg flex items-center gap-2">
                      {app.realName} <span className="text-xs font-normal text-fg-muted bg-surface-hover px-2 py-1 rounded">@{app.username}</span>
                    </h3>
                    <p className="text-sm text-fg-muted">
                      <strong>লেখার নমুনা:</strong> <a href={app.sampleLink} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">{app.sampleLink}</a>
                    </p>
                    {app.message && (
                      <p className="text-sm text-fg mt-3 p-3 bg-surface rounded-xl border border-border">
                        &ldquo;{app.message}&rdquo;
                      </p>
                    )}
                    <p className="text-xs text-fg-subtle mt-2">আবেদনের তারিখ: {bndSafe(app.createdAt, "date")}</p>
                  </div>
                  
                  <div className="flex items-start gap-2 shrink-0">
                    <button 
                      onClick={() => handleApprove(app.id)}
                      className="px-4 py-2 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <CheckCircle className="w-4 h-4" /> অনুমোদন
                    </button>
                    <button 
                      onClick={() => handleReject(app.id)}
                      className="px-4 py-2 text-xs font-bold bg-zinc-100 hover:bg-red-50 text-zinc-700 hover:text-red-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-xl flex items-center gap-1.5 transition-all"
                    >
                      <XCircle className="w-4 h-4" /> বাতিল
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
