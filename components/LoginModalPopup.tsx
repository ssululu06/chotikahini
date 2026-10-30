"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, LogIn, Edit2, Sparkles, Feather } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const POPUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY = "cittakkho_login_popup_dismissed_time";

export function LoginModalPopup() {
  const { user, loading, openAuthModal } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [siteTitle, setSiteTitle] = useState("আমাদের ওয়েবসাইটে");

  useEffect(() => {
    fetch("/api/site-config")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d && d.title) setSiteTitle(d.title);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (loading || user) return; // Don't show if user is logged in or loading auth

    try {
      const lastDismissed = localStorage.getItem(STORAGE_KEY);
      const now = Date.now();

      if (!lastDismissed || now - parseInt(lastDismissed, 10) >= POPUP_INTERVAL_MS) {
        // Wait 3 seconds after page load before opening smoothly
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    } catch (e) {}
  }, [user, loading]);

  const handleDismiss = () => {
    setIsOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch (e) {}
  };

  if (!isOpen || user) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-3xl p-6 sm:p-8 shadow-2xl text-fg">
        {/* Background Subtle Accent Glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-accent/20 rounded-full blur-2xl pointer-events-none" />

        {/* Close / Skip button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-full text-fg-muted hover:text-fg hover:bg-surface-alt transition-colors"
          title="স্কিপ করুন"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Icon & Title */}
        <div className="flex flex-col items-center text-center space-y-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <Feather className="w-7 h-7" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> {siteTitle}-তে স্বাগতম
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-fg">
            লগইন ও লেখক হওয়ার আমন্ত্রণ
          </h2>
          <p className="text-sm text-fg-muted leading-relaxed">
            {siteTitle}-র সকল এক্সক্লুসিভ গল্প পড়তে এবং আপনার নিজের গল্প লিখে প্রকাশ করতে আমাদের ওয়েবসাইটে লগইন করুন অথবা লেখক হতে আবেদন জমা দিন!
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => {
              openAuthModal();
              handleDismiss();
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-accent hover:bg-accent-hover text-surface font-bold rounded-xl shadow-md transition-all text-sm"
          >
            <LogIn className="w-4 h-4" />
            লগইন করুন
          </button>

          <Link
            href="/profile"
            onClick={handleDismiss}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-surface-alt hover:bg-surface-hover border border-border font-semibold text-fg rounded-xl transition-all text-sm"
          >
            <Edit2 className="w-4 h-4 text-accent" />
            লেখক হতে আবেদন করুন
          </Link>

          <button
            onClick={handleDismiss}
            className="w-full text-center py-2 text-xs font-medium text-fg-subtle hover:text-fg transition-colors"
          >
            এখনই নয় (স্কিপ করুন)
          </button>
        </div>
      </div>
    </div>
  );
}
