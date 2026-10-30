"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  FileCheck,
  PlusCircle,
  Sparkles,
  MessageSquare,
  Flag,
  Users,
  UserPlus,
  UserCheck,
  BadgeCheck,
  Bell,
  Mail,
  Trash2,
  Megaphone,
  Settings,
  ShieldCheck,
  ExternalLink,
  LogOut,
  Menu,
  X,
  Search,
  BookOpen,
  ListVideo,
  Power,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, type Permission } from "@/lib/permissions";
import { enToBnNumber } from "@/lib/utils";
import { UserAvatar } from "@/components/UserAvatar";

export interface AdminSidebarBadges {
  pendingReviews?: number;
  unreadNotifications?: number;
  unreadMessages?: number;
  pendingVerifications?: number;
  pendingApplications?: number;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  section?: string;
  permission: Permission;
  badge?: keyof AdminSidebarBadges;
  badgeColor?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "প্রধান (Core)",
    items: [
      {
        id: "overview",
        label: "ড্যাশবোর্ড ওভারভিউ",
        icon: LayoutDashboard,
        href: "/admin",
        section: "dashboard",
        permission: "analytics.view",
      },
      {
        id: "review",
        label: "রিভিউ সেন্টার",
        icon: FileCheck,
        section: "review",
        href: "/admin?section=review",
        permission: "story.review",
        badge: "pendingReviews",
        badgeColor: "bg-amber-500 text-white",
      },
      {
        id: "all_stories",
        label: "সব গল্প ও ড্রাফট",
        icon: BookOpen,
        section: "dashboard",
        href: "/admin?section=dashboard",
        permission: "content.create",
      },
    ],
  },
  {
    title: "কন্টেন্ট ও পাবলিশিং",
    items: [
      {
        id: "editor",
        label: "নতুন গল্প লিখুন",
        icon: PlusCircle,
        href: "/admin/editor",
        permission: "content.create",
      },
      {
        id: "similarity",
        label: "ডুপ্লিকেট স্ক্যান",
        icon: Search,
        section: "similarity",
        href: "/admin?section=similarity",
        permission: "story.review",
      },
      {
        id: "autopost",
        label: "অটো পোস্ট ও ক্রলার",
        icon: Sparkles,
        section: "autopost",
        href: "/admin?section=autopost",
        permission: "content.create",
      },
      {
        id: "comments",
        label: "মন্তব্য মডারেশন",
        icon: MessageSquare,
        href: "/admin/comments",
        permission: "comments.hide",
      },
      {
        id: "reports",
        label: "রিপোর্ট ও অভিযোগ",
        icon: Flag,
        href: "/admin/reports",
        permission: "reports.manage",
      },
    ],
  },
  {
    // Dedicated video section. Each item deep-links into one tab of the
    // video hub at /admin/videos, which carries its own sub-navigation —
    // so the sidebar and the in-page tab bar stay in sync on `view=`.
    title: "ভিডিও",
    items: [
      {
        id: "videos_publish",
        label: "ভিডিও পাবলিশ",
        icon: PlusCircle,
        href: "/admin/videos?view=publish",
        permission: "media.upload",
      },
      {
        id: "videos_list",
        label: "ভিডিও লিস্ট",
        icon: ListVideo,
        href: "/admin/videos?view=list",
        permission: "media.upload",
      },
      {
        id: "videos_settings",
        label: "ভিডিও সেটিংস",
        icon: Power,
        href: "/admin/videos?view=settings",
        permission: "media.upload",
      },
    ],
  },
  {
    title: "লেখক ও ইউজার",
    items: [
      {
        id: "users",
        label: "ইউজার ম্যানেজমেন্ট",
        icon: Users,
        href: "/admin/users",
        permission: "users.view",
      },
      {
        id: "applications",
        label: "লেখক আবেদন",
        icon: UserPlus,
        href: "/admin/applications",
        permission: "authors.manage",
        badge: "pendingApplications",
        badgeColor: "bg-blue-600 text-white",
      },
      {
        id: "authors",
        label: "নিবন্ধিত লেখকবৃন্দ",
        icon: UserCheck,
        section: "authors",
        href: "/admin?section=authors",
        permission: "authors.view",
      },
      {
        id: "verify",
        label: "লেখক ভেরিফিকেশন",
        icon: BadgeCheck,
        section: "verify",
        href: "/admin?section=verify",
        permission: "users.view",
        badge: "pendingVerifications",
        badgeColor: "bg-emerald-600 text-white",
      },
    ],
  },
  {
    title: "সিস্টেম ও সেটিংস",
    items: [
      {
        id: "notifications",
        label: "নোটিফিকেশন সেন্টার",
        icon: Bell,
        section: "notifications",
        href: "/admin?section=notifications",
        permission: "notifications.view",
        badge: "unreadNotifications",
        badgeColor: "bg-rose-600 text-white animate-pulse",
      },
      {
        id: "messages",
        label: "যোগাযোগ বার্তা",
        icon: Mail,
        section: "messages",
        href: "/admin?section=messages",
        permission: "notifications.manage",
        badge: "unreadMessages",
        badgeColor: "bg-indigo-600 text-white",
      },
      {
        id: "deletions",
        label: "স্থায়ী ডিলিট রিকোয়েস্ট",
        icon: Trash2,
        section: "deletions",
        href: "/admin?section=deletions",
        permission: "deletion_requests.view",
      },
      {
        id: "announcement",
        label: "সাইট ঘোষণা",
        icon: Megaphone,
        href: "/admin/announcement",
        permission: "announcements.edit",
      },
      {
        id: "settings",
        label: "সাইট সেটিংস",
        icon: Settings,
        href: "/admin/settings",
        permission: "settings.view",
      },
      {
        id: "audit-logs",
        label: "অডিট লগ",
        icon: ShieldCheck,
        href: "/admin/audit-logs",
        permission: "audit_logs.view",
      },
    ],
  },
];

interface AdminSidebarProps {
  currentSection?: string;
  onSelectSection?: (section: string) => void;
  badges?: AdminSidebarBadges;
  className?: string;
}

export function AdminSidebar({
  currentSection,
  onSelectSection,
  badges = {},
  className = "",
}: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = user?.role;
  const isDashboardPage = pathname === "/admin";
  const activeSectionFromUrl = searchParams.get("section") || "dashboard";
  const effectiveSection = currentSection || (isDashboardPage ? activeSectionFromUrl : "");

  // Prevent scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleNavClick = (item: NavItem, e: React.MouseEvent) => {
    setMobileOpen(false);

    // If on /admin and the item is an in-page section, switch section directly
    if (isDashboardPage && item.section && onSelectSection) {
      e.preventDefault();
      onSelectSection(item.section);
      const url = item.section === "dashboard" ? "/admin" : `/admin?section=${item.section}`;
      window.history.replaceState(null, "", url);
    }
  };

  const isItemActive = (item: NavItem) => {
    if (isDashboardPage && item.section) {
      return effectiveSection === item.section;
    }
    if (item.href) {
      const cleanHref = item.href.split("?")[0];
      if (cleanHref === "/admin") {
        return pathname === "/admin" && !searchParams.get("section");
      }
      if (!pathname.startsWith(cleanHref)) return false;

      // When several sidebar items share a path and differ only by a
      // `view=` query param (the video hub), match on the param too —
      // otherwise every video link lights up at once on /admin/videos.
      const hrefView = new URLSearchParams(item.href.split("?")[1] || "").get("view");
      if (hrefView) {
        const currentView = searchParams.get("view") || "publish";
        return currentView === hrefView;
      }
      return true;
    }
    return false;
  };

  const roleLabels: Record<string, { label: string; color: string }> = {
    superadmin: { label: "সুপার অ্যাডমিন", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
    admin: { label: "অ্যাডমিন", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
    content_manager: { label: "কন্টেন্ট ম্যানেজার", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
    moderator: { label: "মডারেটর", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
    author: { label: "লেখক", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
    user: { label: "ব্যবহারকারী", color: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20" },
  };

  const userRoleMeta = roleLabels[role || "user"] || { label: role || "ইউজার", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-surface-alt text-fg">
      {/* Site Brand Header */}
      <div className="p-4 border-b border-border/80 bg-surface/40">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2.5 min-w-0 group" title="ওয়েবসাইটের মূল পাতায় যান">
            <Image
              src="/logo.svg"
              alt="Logo"
              width={34}
              height={34}
              priority
              className="h-8 w-auto rounded-lg transition-transform group-hover:scale-105 shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-tight text-fg truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                গল্পকাহিনী
              </h1>
              <div className="flex items-center gap-1 text-[10px] text-fg-subtle font-medium">
                <ShieldCheck className="w-3 h-3 text-blue-500 shrink-0" />
                <span>অ্যাডমিন ড্যাশবোর্ড</span>
              </div>
            </div>
          </Link>
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover border border-border/60 transition-all shrink-0"
            title="লাইভ ওয়েবসাইট নতুন ট্যাবে দেখুন"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Admin Profile Card */}
      <div className="px-4 py-3 border-b border-border/70 flex items-center gap-3 bg-surface-alt/80">
        <div className="relative shrink-0">
          <UserAvatar
            src={user?.profilePic}
            name={user?.name || user?.username}
            size="sm"
            className="ring-2 ring-blue-500/30"
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-surface-alt rounded-full" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-bold text-fg truncate">
            {user?.name || user?.username || "অ্যাডমিন"}
          </h2>
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`inline-flex items-center text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md border ${userRoleMeta.color}`}>
              {userRoleMeta.label}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Links Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar">
        {NAV_GROUPS.map((group) => {
          // Filter items based on user role permissions
          const visibleItems = group.items.filter((item) => hasPermission(role, item.permission));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className="space-y-1">
              <p className="px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-fg-subtle select-none">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isItemActive(item);
                  const badgeValue = item.badge && badges[item.badge];
                  const hasBadge = typeof badgeValue === "number" && badgeValue > 0;
                  const targetHref = item.href || (item.section ? `/admin?section=${item.section}` : "/admin");

                  return (
                    <Link
                      key={item.id}
                      href={targetHref}
                      onClick={(e) => handleNavClick(item, e)}
                      className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        active
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                          : "text-fg-muted hover:bg-surface-hover hover:text-fg"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <item.icon
                          className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                            active ? "text-white" : "text-fg-subtle group-hover:text-blue-500"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {hasBadge && (
                        <span
                          className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded-full transition-all ${
                            active ? "bg-white text-blue-700" : (item.badgeColor || "bg-blue-600 text-white")
                          }`}
                        >
                          {enToBnNumber(badgeValue)}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer / Quick Actions */}
      <div className="p-3 border-t border-border/80 space-y-1 bg-surface-alt/60">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-fg-muted hover:bg-surface-hover hover:text-fg transition-all"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-fg-subtle" /> লাইভ সাইট দেখুন
          </span>
          <span className="text-[10px] text-fg-subtle bg-surface px-1.5 py-0.5 rounded border border-border">
            Tab ↗
          </span>
        </a>

        <button
          onClick={async () => {
            if (confirm("আপনি কি নিশ্চিত যে লগআউট করতে চান?")) {
              await logout();
              router.push("/admin");
            }
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-all text-left"
        >
          <LogOut className="w-4 h-4" /> লগআউট করুন
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Navigation Bar */}
      <div className="md:hidden flex items-center justify-between px-3.5 py-2.5 bg-surface-alt border-b border-border sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl bg-surface border border-border text-fg hover:bg-surface-hover transition-colors"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="Logo"
              width={26}
              height={26}
              className="h-6 w-auto rounded"
            />
            <span className="text-sm font-bold text-fg">গল্পকাহিনী</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md border border-blue-200/50">
              অ্যাডমিন
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-surface border border-border text-fg hover:bg-surface-hover transition-colors"
            title="লাইভ সাইট দেখুন"
          >
            <ExternalLink className="w-4 h-4 text-fg-muted" />
          </Link>
          {badges.unreadNotifications && badges.unreadNotifications > 0 ? (
            <Link
              href="/admin?section=notifications"
              className="relative p-2 rounded-xl bg-surface border border-border text-fg"
            >
              <Bell className="w-4 h-4 text-rose-500" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
            </Link>
          ) : null}
          <UserAvatar
            src={user?.profilePic}
            name={user?.name || user?.username}
            size="sm"
          />
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />

          {/* Slide-out Drawer */}
          <div className="relative w-4/5 max-w-xs h-full bg-surface-alt shadow-2xl z-10 flex flex-col border-r border-border animate-in slide-in-from-left duration-200">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-xs font-bold text-fg-muted uppercase tracking-wider">
                মেনু নেভিগেশন
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg bg-surface border border-border text-fg hover:bg-surface-hover transition-colors"
                aria-label="Close Navigation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{sidebarContent}</div>
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden md:flex flex-col w-64 lg:w-72 shrink-0 bg-surface-alt border-r border-border h-screen sticky top-0 overflow-hidden shadow-xs z-30 select-none ${className}`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
