"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token") || "";
  const username = searchParams.get("user") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "idle" | "error" | "success"; message: string }>({
    type: "idle",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !username) {
      setStatus({ type: "error", message: "অকার্যকর অথবা অসম্পূর্ণ রিসেট লিঙ্ক।" });
      return;
    }

    if (newPassword.length < 6) {
      setStatus({ type: "error", message: "পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে।" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus({ type: "error", message: "দুটি পাসওয়ার্ড হুবহু মিলছে না।" });
      return;
    }

    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          username,
          newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus({ type: "success", message: data.message });
        setTimeout(() => {
          router.push("/");
        }, 3000);
      } else {
        setStatus({ type: "error", message: data.error || "পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে।" });
      }
    } catch (err) {
      setStatus({ type: "error", message: "একটি নেটওয়ার্ক ত্রুটি ঘটেছে। আবার চেষ্টা করুন।" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-surface border border-border rounded-3xl shadow-xl space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent mx-auto flex items-center justify-center">
          <KeyRound className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-extrabold text-fg">নতুন পাসওয়ার্ড সেট করুন</h1>
        {username && <p className="text-xs text-fg-subtle">অ্যাকাউন্ট: <span className="font-bold text-fg">@{username}</span></p>}
      </div>

      {status.type === "error" && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{status.message}</span>
        </div>
      )}

      {status.type === "success" ? (
        <div className="p-6 text-center space-y-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-2xl text-green-800 dark:text-green-200">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
          <p className="font-bold text-sm">{status.message}</p>
          <p className="text-xs opacity-80">আপনাকে হোমপেজে নিয়ে যাওয়া হচ্ছে...</p>
          <Link href="/" className="inline-block mt-2 text-xs font-bold underline text-accent">
            সরাসরি হোমপেজে যান
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-fg mb-1">নতুন পাসওয়ার্ড (ন্যূনতম ৬ অক্ষর):</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full p-3 rounded-xl border border-border bg-surface-alt text-fg outline-none focus:border-accent text-sm"
                placeholder="নতুন পাসওয়ার্ড লিখুন"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-3 text-fg-subtle hover:text-fg"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold text-fg mb-1">নতুন পাসওয়ার্ড নিশ্চিত করুন:</label>
            <input
              type={showPass ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full p-3 rounded-xl border border-border bg-surface-alt text-fg outline-none focus:border-accent text-sm"
              placeholder="পাসওয়ার্ডটি পুনরায় লিখুন"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-accent text-surface font-bold text-sm hover:opacity-90 transition-all shadow-md disabled:opacity-50"
          >
            {loading ? "পাসওয়ার্ড আপডেট হচ্ছে..." : "পাসওয়ার্ড আপডেট করুন"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-fg-subtle">লোড হচ্ছে...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
