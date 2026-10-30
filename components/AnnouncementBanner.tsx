"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, X } from "lucide-react";

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<{ id?: string; text: string; active: boolean; color: string; link?: string; updated_at?: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Clear any legacy sessionStorage lock that permanently blocked announcements across reloads
    try {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("ann_dismissed_")) {
          sessionStorage.removeItem(key);
        }
      });
    } catch {}

    const fetchAnnouncement = () => {
      // No cache-buster and a normal cache mode: the endpoint is served
      // from the CDN, so polling it no longer wakes a serverless function
      // on every tick.
      fetch("/api/admin/announcement")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && d.active && d.text && d.text.trim().length > 0) {
            setAnnouncement(d);
          } else {
            setAnnouncement(null);
          }
        })
        .catch(() => {});
    };

    fetchAnnouncement();
    // 60s instead of 15s: the announcement changes rarely, and each poll
    // used to force a cold function invocation on every visitor's tab.
    const interval = setInterval(fetchAnnouncement, 60000);
    return () => clearInterval(interval);
  }, []);

  const dismiss = () => {
    setDismissed(true);
  };

  if (!announcement || !announcement.active || !announcement.text || dismissed) return null;

  const colors: Record<string, string> = {
    blue: "bg-blue-600 text-white",
    amber: "bg-amber-500 text-white",
    red: "bg-red-600 text-white",
    green: "bg-green-600 text-white",
  };

  const colorClass = colors[announcement.color] || colors.blue;

  return (
    <div className={`w-full py-2.5 px-4 text-center text-sm font-medium flex items-center justify-center gap-2.5 ${colorClass} relative z-40 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300`}>
      <Megaphone className="w-4 h-4 shrink-0 opacity-90" />
      <span className="truncate max-w-[85vw] sm:max-w-none">
        {announcement.link ? (
          <Link href={announcement.link} className="underline underline-offset-2 hover:opacity-80 transition-opacity">
            {announcement.text}
          </Link>
        ) : (
          announcement.text
        )}
      </span>
      <button
        onClick={dismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="বন্ধ করুন"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
