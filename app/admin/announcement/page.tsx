"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Megaphone, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/admin/AccessDenied";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

const COLOR_OPTIONS = [
  { value: "blue", label: "নীল (তথ্য)", cls: "bg-blue-600" },
  { value: "green", label: "সবুজ (সফলতা)", cls: "bg-green-600" },
  { value: "amber", label: "হলুদ (সতর্কতা)", cls: "bg-amber-500" },
  { value: "red", label: "লাল (জরুরি)", cls: "bg-red-600" },
];

export default function AnnouncementAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [text, setText] = useState("");
  const [active, setActive] = useState(true);
  const [color, setColor] = useState("blue");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | ""; msg: string }>({ type: "", msg: "" });

  useEffect(() => {
    if (authLoading) return;
    if (!user || !hasPermission(user.role, "announcements.edit")) {
      setLoading(false);
      return;
    }
    fetch(`/api/admin/announcement?_t=${Date.now()}`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setText(d.text || "");
          setActive(!!d.active);
          setColor(d.color || "blue");
          setLink(d.link || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  const handleSave = async () => {
    setSaving(true);
    setStatus({ type: "", msg: "" });
    try {
      const res = await fetch("/api/admin/announcement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, active, color, link }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.announcement) {
          setText(data.announcement.text || "");
          setActive(!!data.announcement.active);
          setColor(data.announcement.color || "blue");
          setLink(data.announcement.link || "");
        }
        setStatus({ type: "success", msg: "ঘোষণা সফলভাবে সংরক্ষিত হয়েছে!" });
      } else {
        const d = await res.json();
        setStatus({ type: "error", msg: d.error || "সংরক্ষণ ব্যর্থ হয়েছে।" });
      }
    } catch {
      setStatus({ type: "error", msg: "একটি অনাকাঙ্ক্ষিত সমস্যা হয়েছে।" });
    } finally {
      setSaving(false);
    }
  };

  const colorMap: Record<string, string> = {
    blue: "bg-blue-600 text-white",
    green: "bg-green-600 text-white",
    amber: "bg-amber-500 text-white",
    red: "bg-red-600 text-white",
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-surface text-fg-subtle animate-pulse">লোড হচ্ছে...</div>;
  }

  if (!user || !hasPermission(user.role, "announcements.edit")) {
    return <AccessDenied />;
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-surface text-fg-subtle animate-pulse">লোড হচ্ছে...</div>;
  }

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-surface flex flex-col md:flex-row">
      <AdminSidebar />
      <main className="flex-1 md:h-screen md:overflow-y-auto p-4 md:p-6 lg:p-8 min-w-0">
        <div className="max-w-7xl mx-auto space-y-6 w-full">
          <header className="flex items-center gap-3 pb-4 border-b border-border">
          <Link href="/admin" className="p-2 text-fg-muted hover:text-fg rounded-xl bg-surface-alt border border-border transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-fg flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-amber-500" /> সাইট ঘোষণা ব্যানার
            </h1>
            <p className="text-xs text-fg-muted mt-0.5">পুরো ওয়েবসাইটের উপরে প্রদর্শিত ঘোষণা ব্যানার নিয়ন্ত্রণ করুন</p>
          </div>
        </header>
        {/* Status */}
        {status.msg && (
          <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${
            status.type === "error"
              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800"
              : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800"
          }`}>
            {status.type === "error" ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
            {status.msg}
          </div>
        )}

        {/* Live Preview */}
        <div>
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">প্রিভিউ</h2>
          {active && text ? (
            <div className={`w-full py-2.5 px-4 text-center text-sm font-medium rounded-xl ${colorMap[color] || colorMap.blue}`}>
              {link ? (
                <span className="underline underline-offset-2">{text}</span>
              ) : (
                text
              )}
              {link && <span className="ml-2 opacity-70 text-xs">→ {link}</span>}
            </div>
          ) : (
            <div className="w-full py-2.5 px-4 text-center text-sm text-zinc-600 bg-zinc-900 border border-zinc-800 rounded-xl italic">
              ব্যানার নিষ্ক্রিয় বা কোনো টেক্সট নেই
            </div>
          )}
        </div>

        {/* Form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5">
          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-200">ব্যানার সক্রিয়</p>
              <p className="text-xs text-fg-muted mt-0.5">সাইটের সকল পেজে দেখাবে</p>
            </div>
            <button
              type="button"
              onClick={() => setActive(v => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${active ? "bg-green-500" : "bg-zinc-700"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${active ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>

          {/* Text */}
          <div>
            <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1.5">ঘোষণার টেক্সট</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-xl text-sm focus:ring-1 focus:ring-zinc-500 outline-none resize-none placeholder:text-zinc-600"
              placeholder="যেমন: ঈদ মোবারক! সকল পাঠকদের জানাই শুভেচ্ছা।"
            />
          </div>

          {/* Link */}
          <div>
            <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1.5">লিংক (ঐচ্ছিক)</label>
            <input
              type="url"
              value={link}
              onChange={e => setLink(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-xl text-sm focus:ring-1 focus:ring-zinc-500 outline-none placeholder:text-zinc-600"
              placeholder="https://example.com"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-2">রঙ</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setColor(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                    color === opt.value
                      ? "border-zinc-400 bg-zinc-700 text-zinc-100"
                      : "border-zinc-700 bg-zinc-800 text-fg-subtle hover:border-zinc-500"
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${opt.cls}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? "সংরক্ষণ হচ্ছে..." : "ঘোষণা সংরক্ষণ করুন"}
        </button>
        </div>
      </main>
    </div>
  );
}
