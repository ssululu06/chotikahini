"use client";

import Link from "next/link";
import { ArrowLeft, FileBox } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/admin/AccessDenied";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import AdminSettings from "@/components/admin/AdminSettings";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-fg-subtle animate-pulse">
        লোড হচ্ছে...
      </div>
    );
  }

  if (!user || !hasPermission(user.role, "settings.view")) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-surface flex flex-col md:flex-row">
      <AdminSidebar />
      <main className="flex-1 md:h-screen md:overflow-y-auto p-4 md:p-6 lg:p-8 min-w-0">
        <div className="max-w-7xl mx-auto space-y-6 w-full">
          <header className="flex items-center gap-3 pb-4 border-b border-border">
            <Link
              href="/admin"
              className="p-2 text-fg-muted hover:text-fg rounded-xl bg-surface-alt border border-border transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-fg flex items-center gap-2">
                <FileBox className="w-6 h-6 text-blue-500" /> সাইট সেটিংস ও কনফিগারেশন
              </h1>
              <p className="text-xs text-fg-muted mt-0.5">
                সাইট মেটাডাটা, ক্যাটাগরি, কভার ডিরেক্টরি ও ব্যাকআপ পরিচালনা করুন
              </p>
            </div>
          </header>

          <AdminSettings initialAuthors={[]} initialCategories={[]} />
        </div>
      </main>
    </div>
  );
}
