"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LogIn, UserPlus, User, Lock, Mail, X, CheckCircle2, Copy, Check, KeyRound, ArrowLeft } from "lucide-react";

export function AuthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [loading, setLoading] = useState(false);
  
  // Login / Forgot Fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [forgotInput, setForgotInput] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  
  // Register Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  
  // States
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [newCredentials, setNewCredentials] = useState<{ username: string; password?: string; newPassword?: string; email?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { refreshSession } = useAuth();

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        await refreshSession();
        onClose();
      } else {
        const msg = data.error || "লগইন ব্যর্থ হয়েছে।";
        if (res.status === 401 || res.status === 400) {
          setError(`${msg} — যদি ভুলে গিয়ে থাকেন, নিচের "পাসওয়ার্ড ভুলে গেছেন?" ব্যবহার করুন।`);
        } else {
          setError(msg);
        }
      }
    } catch (err) {
      setError("একটি অপ্রত্যাশিত সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");
    setNewCredentials(null);

    if (!email.trim()) {
      setError("ইমেইল ঠিকানা দেওয়া আবশ্যক।");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setSuccessMsg("অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে! ইউজারনেম স্থায়ী থাকবে।");
        setNewCredentials(data.data);
      } else {
        setError(data.error || "নিবন্ধন ব্যর্থ হয়েছে।");
      }
    } catch (err) {
      setError("একটি অপ্রত্যাশিত সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");
    setNewCredentials(null);

    if (!forgotInput.trim() || !forgotEmail.trim()) {
      setError("ইউজারনেম এবং ইমেইল ঠিকানা দুটিই লিখুন।");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotInput.trim(), email: forgotEmail.trim() })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setSuccessMsg("আপনার পাসওয়ার্ড রিসেটের একক লিঙ্ক অনুরোধটি সফল হয়েছে। ইমেইল চেক করুন।");
        setNewCredentials({ username: data.data?.username, email: data.data?.email });
      } else {
        setError(data.error || "পাসওয়ার্ড রিসেট করা সম্ভব হয়নি।");
      }
    } catch (err) {
      setError("একটি অপ্রত্যাশিত সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!newCredentials) return;
    const pwd = newCredentials.password || newCredentials.newPassword;
    const text = `ইউজারনেম: ${newCredentials.username}\nপাসওয়ার্ড: ${pwd}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="bg-surface border border-border w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl relative text-fg">
        
        {/* Top Header Bar & Close */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/80 sticky top-0 bg-surface/95 backdrop-blur z-10">
          <div className="flex items-center gap-2">
            {mode === "login" && <LogIn className="w-5 h-5 text-accent" />}
            {mode === "register" && <UserPlus className="w-5 h-5 text-accent" />}
            {mode === "forgot" && <KeyRound className="w-5 h-5 text-accent" />}
            <h2 className="text-base sm:text-lg font-bold">
              {mode === "login" && "অ্যাকাউন্টে প্রবেশ করুন"}
              {mode === "register" && "নতুন অ্যাকাউন্ট তৈরি করুন"}
              {mode === "forgot" && "পাসওয়ার্ড উদ্ধার করুন"}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full text-fg-muted hover:text-fg hover:bg-surface-alt transition-colors"
            title="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        {mode !== "forgot" && (
          <div className="p-4 pb-0">
            <div className="grid grid-cols-2 p-1 bg-surface-alt rounded-2xl border border-border">
              <button
                className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                  mode === "login" ? 'bg-fg text-surface shadow-sm' : 'text-fg-muted hover:text-fg'
                }`}
                onClick={() => { if(!loading) setMode("login"); }}
              >
                <LogIn className="w-4 h-4" /> প্রবেশ
              </button>
              <button
                className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                  mode === "register" ? 'bg-fg text-surface shadow-sm' : 'text-fg-muted hover:text-fg'
                }`}
                onClick={() => { if(!loading) setMode("register"); }}
              >
                <UserPlus className="w-4 h-4" /> নিবন্ধন
              </button>
            </div>
          </div>
        )}

        {/* Modal Form Content */}
        <div className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs sm:text-sm font-medium rounded-xl border border-red-200 dark:border-red-800/50">
              {error}
            </div>
          )}
          
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-fg-muted mb-1.5">ইউজারনেম বা ইমেইল</label>
                <div className="relative">
                  <User className="w-4 h-4 text-fg-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl border border-border bg-surface-alt text-fg focus:ring-2 focus:ring-accent outline-none text-sm transition-all"
                    placeholder="আপনার ইউজারনেম বা ইমেইল"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-fg-muted">পাসওয়ার্ড</label>
                  <button
                    type="button"
                    onClick={() => { setError(""); setMode("forgot"); }}
                    className="text-xs text-accent font-semibold hover:underline"
                  >
                    পাসওয়ার্ড ভুলে গেছেন?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-fg-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl border border-border bg-surface-alt text-fg focus:ring-2 focus:ring-accent outline-none text-sm transition-all"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-fg text-surface hover:opacity-90 font-bold rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2 mt-2"
              >
                {loading ? "প্রবেশ করা হচ্ছে..." : "প্রবেশ করুন"}
              </button>
            </form>
          )}

          {mode === "forgot" && (
            <div className="space-y-4">
              {!newCredentials ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-xs text-fg-muted leading-relaxed">
                    আপনার অ্যাকাউন্টের ইউজারনেম এবং নিবন্ধিত ইমেইল ঠিকানা দুটিই লিখুন। আপনাকে একটি একক ব্যবহারযোগ্য রিসেট লিঙ্ক পাঠানো হবে।
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-fg-muted mb-1.5">ইউজারনেম</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-fg-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={forgotInput}
                        onChange={(e) => setForgotInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl border border-border bg-surface-alt text-fg focus:ring-2 focus:ring-accent outline-none text-sm transition-all"
                        placeholder="আপনার ইউজারনেম"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-fg-muted mb-1.5">নিবন্ধিত ইমেইল ঠিকানা</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-fg-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl border border-border bg-surface-alt text-fg focus:ring-2 focus:ring-accent outline-none text-sm transition-all"
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-fg text-surface hover:opacity-90 font-bold rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2 mt-2"
                  >
                    {loading ? "অনুরোধ পাঠানো হচ্ছে..." : "পাসওয়ার্ডের জন্য অনুরোধ পাঠান"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="w-full py-2 text-xs font-semibold text-fg-muted hover:text-fg flex items-center justify-center gap-1.5 mt-2"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> লগইনে ফিরে যান
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800/50 space-y-3">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                      অনুরোধ সফলভাবে পাঠানো হয়েছে!
                    </div>
                    <p className="text-xs text-fg-muted leading-relaxed">
                      {successMsg || "আপনার পাসওয়ার্ড রিসেট করার অনুরোধটি অ্যাডমিন প্যানেলে জমা হয়েছে। অ্যাডমিন পর্যালোচনা করে আপনার নিবন্ধিত ইমেইলে নতুন পাসওয়ার্ড পাঠিয়ে দেবেন।"}
                    </p>
                    
                    <div className="bg-surface p-3.5 rounded-xl border border-border space-y-1">
                      <span className="text-[10px] text-fg-muted uppercase tracking-wider font-bold">অনুরোধকৃত ইউজারনেম</span>
                      <p className="font-mono font-bold text-sm text-fg">@{newCredentials.username}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setNewCredentials(null);
                      setMode("login");
                      setUsername(newCredentials.username);
                      setPassword("");
                    }}
                    className="w-full py-3 px-4 bg-fg text-surface font-bold rounded-xl text-sm transition-all shadow-md"
                  >
                    লগইনে ফিরে যান
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === "register" && (
            <div>
              {!newCredentials ? (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-fg-muted mb-1.5">আপনার নাম</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-fg-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl border border-border bg-surface-alt text-fg focus:ring-2 focus:ring-accent outline-none text-sm transition-all"
                        placeholder="আপনার নাম লিখুন (যেমন: তানভীর আহমেদ)"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-fg-muted mb-1.5">ইমেইল ঠিকানা</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-fg-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl border border-border bg-surface-alt text-fg focus:ring-2 focus:ring-accent outline-none text-sm transition-all"
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-fg text-surface hover:opacity-90 font-bold rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2 mt-2"
                  >
                    {loading ? "অ্যাকাউন্ট তৈরি হচ্ছে..." : "অ্যাকাউন্ট তৈরি করুন"}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-2xl border border-green-200 dark:border-green-800/50 space-y-3">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                      অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!
                    </div>
                    <p className="text-xs text-fg-muted leading-relaxed">
                      আপনার নামের সাথে সামঞ্জস্য রেখে স্থায়ী ইউজারনেম এবং পাসওয়ার্ড নিচে তৈরি করে দেওয়া হলো। এটি সংরক্ষণ করে রাখুন।
                    </p>
                    
                    <div className="bg-surface p-3.5 rounded-xl border border-border space-y-2">
                      <div>
                        <span className="text-[10px] text-fg-muted uppercase tracking-wider font-bold">ইউজারনেম (স্থায়ী)</span>
                        <p className="font-mono font-bold text-base text-fg">{newCredentials.username}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-fg-muted uppercase tracking-wider font-bold">পাসওয়ার্ড</span>
                        <p className="font-mono font-bold text-base text-fg">{newCredentials.password}</p>
                      </div>
                    </div>

                    <button
                      onClick={handleCopyCredentials}
                      className="w-full py-2 px-3 bg-surface text-fg border border-border rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-hover transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-green-600" /> কপি হয়েছে!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-fg-muted" /> তথ্য কপি করুন
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setNewCredentials(null);
                      setMode("login");
                      setUsername(newCredentials.username);
                      setPassword("");
                    }}
                    className="w-full py-3 px-4 bg-fg text-surface font-bold rounded-xl text-sm transition-all shadow-md"
                  >
                    লগইন করুন
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
