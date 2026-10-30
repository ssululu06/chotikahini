"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export function FloatingChatIcon() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/chat/unread-count");
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unread || 0);
        }
      } catch (e) {}
    };
    fetchUnread();
    
    const interval = setInterval(fetchUnread, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [user]);

  // Hide the floating icon if the user is already on the chat page or admin pages
  if (pathname === "/chat" || pathname.startsWith("/admin")) return null;

  return (
    <Link 
      href="/chat"
      className="md:hidden fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-40 flex items-center justify-center w-14 h-14 bg-blue-600 dark:bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all"
      aria-label="চ্যাট করুন"
    >
      <MessageCircle className="w-6 h-6" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white border-2 border-surface">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
