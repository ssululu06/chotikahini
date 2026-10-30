"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { PenLine, X } from "lucide-react";

const STORAGE_KEY = "chittakkho-author-prompt-last";
const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function AuthorPromptToast() {
  const { user } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || dismissed) return;
    // Only show for plain "user" role (authors/admins/managers don't need the prompt)
    if (user.role && user.role !== "user") return;

    const lastShown = localStorage.getItem(STORAGE_KEY);
    const now = Date.now();
    if (lastShown && now - Number(lastShown) < INTERVAL_MS) return;

    const timer = setTimeout(() => {
      setVisible(true);
      localStorage.setItem(STORAGE_KEY, String(now));
    }, 10000); // wait 10s after page load, then show

    return () => clearTimeout(timer);
  }, [user, dismissed]);

  if (!visible || !user) return null;
  if (user.role && user.role !== "user") return null;

  const handleClick = () => {
    setVisible(false);
    setDismissed(true);
    router.push("/profile");
    // Auto-scroll to settings section after navigation
    setTimeout(() => {
      const authorTab = document.querySelector("[data-author-apply]");
      if (authorTab) (authorTab as HTMLElement).click();
    }, 500);
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-50 max-w-xs animate-slide-up">
      <div className="bg-surface border border-accent/30 rounded-2xl shadow-xl p-4 space-y-3 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 text-fg-subtle hover:text-fg rounded-full transition-colors"
          aria-label="বন্ধ করুন"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <PenLine className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-fg">লেখক হতে চান?</p>
            <p className="text-xs text-fg-muted leading-tight mt-0.5">
              আপনার নিজের গল্প লিখুন, প্রকাশ করুন এবং পাঠকদের সাথে শেয়ার করুন!
            </p>
          </div>
        </div>
        <button
          onClick={handleClick}
          className="w-full py-2 px-3 bg-accent text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all"
        >
          লেখক হওয়ার আবেদন করুন
        </button>
      </div>
    </div>
  );
}