"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Search, Bell, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { NotificationBell } from "./NotificationBell";
import { UserAvatar } from "./UserAvatar";

export function BottomNav() {
  const pathname = usePathname();
  const { user, openAuthModal } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetch("/api/notifications?limit=20")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.notifications) {
          const unread = d.notifications.filter((n: any) => !n.isRead).length;
          setUnreadCount(unread);
        }
      })
      .catch(() => {});
  }, [user, pathname]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-border">
      <div className="flex items-center justify-around px-1 py-1.5">
        <Link href="/" className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[3.5rem] min-h-[44px] justify-center ${isActive("/") ? "text-accent" : "text-fg-muted hover:text-fg"}`}>
          <Home className={`w-5 h-5 transition-transform ${isActive("/") ? "scale-110" : ""}`} />
          <span className={`text-[10px] font-medium leading-none ${isActive("/") ? "font-bold" : ""}`}>হোম</span>
        </Link>

        <Link href="/tags" className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[3.5rem] min-h-[44px] justify-center ${isActive("/tags") ? "text-accent" : "text-fg-muted hover:text-fg"}`}>
          <BookOpen className={`w-5 h-5 transition-transform ${isActive("/tags") ? "scale-110" : ""}`} />
          <span className={`text-[10px] font-medium leading-none ${isActive("/tags") ? "font-bold" : ""}`}>ট্যাগ</span>
        </Link>

        <Link href="/search" className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[3.5rem] min-h-[44px] justify-center ${isActive("/search") ? "text-accent" : "text-fg-muted hover:text-fg"}`}>
          <Search className={`w-5 h-5 transition-transform ${isActive("/search") ? "scale-110" : ""}`} />
          <span className={`text-[10px] font-medium leading-none ${isActive("/search") ? "font-bold" : ""}`}>খুঁজুন</span>
        </Link>

        {user ? (
          <div className="flex flex-col items-center gap-0.5 px-1 min-w-[3.5rem] min-h-[44px] justify-center">
            <span className="relative flex items-center justify-center">
              <NotificationBell />
              {unreadCount > 0 && (
                <span className="absolute -top-1 right-2 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-0.5 leading-none pointer-events-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium leading-none text-fg-muted">নোটিফিকেশন</span>
          </div>
        ) : (
          <button onClick={openAuthModal} className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[3.5rem] min-h-[44px] justify-center text-fg-muted hover:text-fg">
            <Bell className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">নোটিফিকেশন</span>
          </button>
        )}

        {user ? (
          <Link href="/profile" className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[3.5rem] min-h-[44px] justify-center ${isActive("/profile") ? "text-accent" : "text-fg-muted hover:text-fg"}`}>
            <span className={`flex w-6 h-6 rounded-full overflow-hidden border transition-all shrink-0 ${isActive("/profile") ? "border-accent ring-1 ring-accent/30" : "border-border"}`}>
              <UserAvatar src={user.profilePic} name={user.name || user.username} userId={user.id} size="sm" className="w-full h-full rounded-full" />
            </span>
            <span className={`text-[10px] font-medium leading-none ${isActive("/profile") ? "font-bold" : ""}`}>প্রোফাইল</span>
          </Link>
        ) : (
          <button onClick={openAuthModal} className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[3.5rem] min-h-[44px] justify-center text-fg-muted hover:text-fg">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">প্রবেশ করুন</span>
          </button>
        )}
      </div>
    </nav>
  );
}
