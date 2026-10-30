"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, ExternalLink, KeyRound, CheckCircle2, PenLine, XCircle, Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "./UserAvatar";
import { useRouter } from "next/navigation";
import { formatDate , enToBnNumber, normalizeRef } from '@/lib/utils';

interface Notification {
  id: string;
  userId: string;
  type: string;
  actorId: string;
  actorName: string;
  actorProfilePic?: string;
  postSlug: string;
  commentId: string;
  snippet: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const fetchNotifs = async () => {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchNotifs();
    // Poll periodically so authors see approval/revision updates without
    // having to manually refresh the page.
    const interval = setInterval(fetchNotifs, 45000);
    return () => clearInterval(interval);
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const unreadCount = notifications.filter(n => !n.isRead && !(n as any).read).length;

  const handleRead = async (notification: any) => {
    setIsOpen(false);

    // Optimistically mark the notification as read in local state so the
    // bell badge and "X অপঠিত" pill update instantly. We revert this on
    // API failure so the UI never shows a false "read" state.
    const wasUnread = !notification.isRead && !notification.read;
    if (wasUnread) {
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, isRead: true, read: true } : n)
      );

      try {
        const res = await fetch("/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: notification.id })
        });
        if (!res.ok) {
          // 404 (foreign / unknown id) or 5xx — roll the optimistic update
          // back so the next poll can reconcile from the source of truth.
          setNotifications(prev =>
            prev.map(n => n.id === notification.id ? { ...n, isRead: false, read: false } : n)
          );
        }
      } catch (e) {
        console.error(e);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, isRead: false, read: false } : n)
        );
      }
    }

    const cleanSlug = notification.postSlug ? normalizeRef(notification.postSlug) : "";

    if (notification.type === "forgot_password_request") {
      router.push("/admin/users");
    } else if (cleanSlug && notification.commentId) {
      router.push(`/${cleanSlug}#comment-${notification.commentId}`);
    } else if (cleanSlug) {
      router.push(`/${cleanSlug}`);
    } else {
      router.push("/profile");
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors focus:outline-none"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-surface shadow-sm"></span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-x-3 bottom-16 sm:bottom-auto sm:top-auto sm:right-0 sm:absolute sm:inset-x-auto sm:mt-2 w-auto sm:w-80 max-h-[75vh] overflow-y-auto bg-surface border border-border rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200">
          <div className="sticky top-0 bg-surface/95 backdrop-blur border-b border-border p-3 flex justify-between items-center z-10">
            <h3 className="font-bold text-fg text-sm flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-accent" /> বিজ্ঞপ্তি
            </h3>
            {unreadCount > 0 ? (
              <span className="text-xs text-red-500 font-semibold bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                {enToBnNumber(unreadCount)}টি অপঠিত
              </span>
            ) : (
              <span className="text-xs text-fg-subtle">সব পঠিত</span>
            )}
          </div>

          <div className="divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-fg-muted italic">
                No notifications yet.
              </div>
            ) : (
              notifications.map((notif: any) => {
                const isUnread = !notif.isRead && !notif.read;
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleRead(notif)}
                    className={`w-full text-left p-3 hover:bg-surface-alt transition-colors flex gap-3 items-start ${isUnread ? "bg-accent/5 dark:bg-accent/10" : ""}`}
                  >
                    <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
                      <UserAvatar src={notif.actorProfilePic} name={notif.actorName || "Admin"} size="md" className="w-full h-full rounded-full" />
                    </div>
<div className="flex-1 min-w-0">
                      {notif.type === "forgot_password_request" ? (
                        <p className="text-xs text-fg font-medium leading-snug">
                          <KeyRound className="w-4 h-4 inline mr-1 text-amber-500" /><span className="font-bold">{notif.actorName}</span> পাসওয়ার্ড রিসেটের অনুরোধ করেছেন
                        </p>
                      ) : notif.type === "story_approved" ? (
                        <p className="text-xs text-fg font-medium leading-snug"><CheckCircle2 className="w-4 h-4 inline mr-1 text-green-500" />গল্প অনুমোদিত ও প্রকাশিত হয়েছে</p>
                      ) : notif.type === "story_revision_requested" ? (
                        <p className="text-xs text-fg font-medium leading-snug"><PenLine className="w-4 h-4 inline mr-1 text-amber-500" />গল্পে সংশোধন প্রস্তাব করা হয়েছে</p>
                      ) : notif.type === "story_rejected" ? (
                        <p className="text-xs text-fg font-medium leading-snug"><XCircle className="w-4 h-4 inline mr-1 text-red-500" />গল্পটি প্রত্যাখ্যান করা হয়েছে</p>
                      ) : notif.type === "story_unpublished" ? (
                        <p className="text-xs text-fg font-medium leading-snug"><Download className="w-4 h-4 inline mr-1 text-blue-500" />গল্পটি ড্রাফটে স্থানান্তরিত হয়েছে</p>
                      ) : notif.type === "story_deleted" ? (
                        <p className="text-xs text-fg font-medium leading-snug"><Trash2 className="w-4 h-4 inline mr-1 text-red-500" />গল্পটি মুছে ফেলা হয়েছে</p>
                      ) : notif.type === "reply" || notif.type === "comment_reply" ? (
                        <p className="text-xs text-fg">
                          <span className="font-semibold">{notif.actorName}</span> আপনার মন্তব্যে উত্তর দিয়েছেন
                        </p>
                      ) : notif.message ? (
                        <p className="text-xs text-fg font-medium leading-snug">{notif.message}</p>
                      ) : (
                        <p className="text-xs text-fg">
                          <span className="font-semibold">{notif.actorName}</span> একটি নোটিফিকেশন পাঠিয়েছেন
                        </p>
                      )}
                      {notif.snippet && <p className="text-xs text-fg-muted line-clamp-2 italic mt-0.5 whitespace-pre-line">&ldquo;{notif.snippet}&rdquo;</p>}
                      <p className="text-[10px] text-fg-subtle mt-1">{formatDate(notif.createdAt)}</p>
                    </div>
                    {isUnread && (
                      <div className="w-2 h-2 bg-accent rounded-full mt-1.5 flex-shrink-0"></div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
