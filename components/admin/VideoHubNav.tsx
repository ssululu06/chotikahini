"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, ListVideo, Power } from "lucide-react";

/**
 * Sub-navigation for the video hub at /admin/videos.
 *
 * Renders as a horizontal tab bar — top to bottom on mobile (scrollable
 * horizontally) — listing the three video sections:
 *   • পাবলিশ    — publish / edit form
 *   • লিস্ট     — all video posts, filter, edit, delete
 *   • সেটিংস    — site-wide video on/off toggle
 *
 * Lives inside the admin sub-page rather than the main AdminSidebar so a
 * future "stories hub" can have its own sub-nav without touching the
 * global sidebar data.
 */
const VIDEO_TABS = [
  { key: "publish", label: "পাবলিশ", href: "/admin/videos?view=publish", icon: Plus },
  { key: "list", label: "লিস্ট", href: "/admin/videos?view=list", icon: ListVideo },
  { key: "settings", label: "সেটিংস", href: "/admin/videos?view=settings", icon: Power },
] as const;

export function VideoHubNav() {
  const params = useSearchParams();
  const view = params.get("view") || "publish";

  return (
    <nav
      aria-label="ভিডিও হাব"
      className="sticky top-0 z-10 -mx-4 mb-5 border-b border-border bg-surface/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <div className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {VIDEO_TABS.map((tab) => {
          const active = view === tab.key;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={
                "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition " +
                (active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-fg-muted hover:bg-surface-hover hover:text-fg")
              }
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}