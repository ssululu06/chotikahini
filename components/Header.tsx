"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Search, Sun, Moon, Menu, X, User } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { SearchModal } from "./SearchModal";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "./NotificationBell";
import { UserAvatar } from "./UserAvatar";

interface HeaderProps {
  title: string;
  logo: string;
  navigation: { href: string; label: string }[];
}

export function Header({ title, logo, navigation }: HeaderProps) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { user, openAuthModal } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Only flip once the visitor is clearly past the fold. A threshold of
    // 10px made the header resize mid-scroll, which reads as jitter — the
    // layout below it reflows on every frame the boolean flips.
    const update = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };
  const isChatPage = pathname === "/chat";

  // Strip any pre-existing /videos entry, then re-inject it as the second
  // visible item — right after Home — so the eye lands on it instead of
  // having to scan to the end of the bar.
  //
  // The server (app/(main)/layout.tsx) filters /videos out of `navigation`
  // entirely when the video section is switched off, so the presence of a
  // /videos entry here is the signal that the section is live. Re-injecting
  // unconditionally would put a link to a 404 in the header.
  const cleaned = navigation.filter((item) => item.href !== "/videos");
  const videoOn = navigation.some((item) => item.href === "/videos");
  const homeIdx = cleaned.findIndex((item) => item.href === "/");
  const mainNavigation = !videoOn
    ? cleaned
    : homeIdx >= 0
      ? [
          ...cleaned.slice(0, homeIdx + 1),
          { href: "/videos", label: "ভিডিও" },
          ...cleaned.slice(homeIdx + 1),
        ]
      : [...cleaned, { href: "/videos", label: "ভিডিও" }];

  return (
    <>
      <header
        suppressHydrationWarning
        className={`sticky top-0 z-50 transition-shadow duration-200 ${
          scrolled
            ? "border-b border-border/80 bg-surface/75 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/60 shadow-sm shadow-black/[0.02]"
            : "border-b border-transparent bg-surface"
        }`}
      >
        {/* The BAR carries the height change, not the <header> — the mobile
            dropdown hangs below the bar and must not be clipped by a fixed
            header height. One element animates height with a single ease-out;
            that coordinated single animation is what reads as a smooth
            settle instead of the old padding+height double-transition
            jitter. */}
        <div
          className={`container-page flex items-center justify-between overflow-hidden transition-[height] duration-300 ease-out ${
            isChatPage ? "h-[52px]" : scrolled ? "h-[58px]" : "h-[86px]"
          }`}
          suppressHydrationWarning
        >
          <Link
            href="/"
            className="site-brand flex items-center shrink-0"
            aria-label="Choti Kahini Bangla — হোম"
          >
            {logo ? (
              /* The logo's *height* animates (86px header → 58px header, logo
                 80px → 46px) as one coordinated ease-out. Only height
                 transitions, and only one element drives the layout, so
                 the shrink reads as a smooth settle rather than the old
                 padding+height double-animation that jittered. */
              <Image
                src={logo}
                alt="Choti Kahini Bangla"
                width={160}
                height={150}
                priority
                className={`w-auto transition-[height] duration-300 ease-out ${
                  isChatPage
                    ? "h-9"
                    : scrolled
                      ? "h-9 sm:h-10 md:h-[46px]"
                      : "h-14 sm:h-16 md:h-20"
                }`}
              />
            ) : (
              <span
                className={`flex shrink-0 items-center justify-center rounded-lg bg-fg text-surface text-sm font-bold transition-[width,height] duration-300 ease-out ${
                  isChatPage
                    ? "h-9 w-9"
                    : scrolled
                      ? "h-9 w-9 sm:h-10 sm:w-10 md:h-[46px] md:w-[46px]"
                      : "h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20"
                }`}
              >
                {title.charAt(0)}
              </span>
            )}
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {mainNavigation.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive(link.href)
                    ? "text-fg bg-surface-alt font-medium"
                    : "text-fg-muted hover:text-fg hover:bg-surface-hover"
                }`}
              >
                {link.label}
                {link.href === "/chat" && (
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                  </span>
                )}
              </Link>
            ))}
            {!navigation.some((l) => l.href === "/posts") && (
              <Link
                href="/posts"
                className={`relative px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive("/posts")
                    ? "text-fg bg-surface-alt font-medium"
                    : "text-fg-muted hover:text-fg hover:bg-surface-hover"
                }`}
              >
                পোস্ট
              </Link>
            )}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1 sm:gap-2" suppressHydrationWarning>
            
            {user && (
              <span className="hidden md:inline-flex">
                <NotificationBell />
              </span>
            )}

            {user ? (
              <Link 
                href="/profile" 
                className="hidden md:flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full hover:ring-2 hover:ring-accent/50 transition-all overflow-hidden"
                title="প্রোফাইল"
              >
                <UserAvatar src={user.profilePic} name={user.name || user.username} userId={user.id} size="md" className="w-full h-full rounded-full" />
              </Link>
            ) : (
              <button 
                onClick={openAuthModal}
                className="inline-flex items-center justify-center px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold bg-fg text-surface hover:bg-accent-hover transition-colors shadow-sm"
              >
                প্রবেশ করুন
              </button>
            )}
            <button
              onClick={openSearch}
              className="btn-ghost hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-fg-muted border border-border"
              aria-label="খুঁজুন"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden md:inline">খুঁজুন</span>
              <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border border-border bg-surface-alt px-1 py-0.5 text-[10px] font-medium">
                <span>⌘</span>K
              </kbd>
            </button>

            <button
              onClick={openSearch}
              className="btn-ghost sm:hidden p-2 rounded-lg"
              aria-label="খুঁজুন"
            >
              <Search className="h-4 w-4" />
            </button>

            <button
              onClick={toggle}
              className="btn-ghost p-2 rounded-lg"
              aria-label={
                theme === "dark" ? "সাদা মোডে যান" : "কালো মোডে যান"
              }
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="btn-ghost p-2 rounded-lg md:hidden"
              aria-label={menuOpen ? "মেনু বন্ধ করুন" : "মেনু খুলুন"}
            >
              {menuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {menuOpen && (
          <nav className="md:hidden border-t border-border bg-surface px-4 py-3 space-y-1 animate-fade-in max-h-[calc(100vh-4rem)] overflow-y-auto">
            {mainNavigation.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative block px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive(link.href)
                    ? "text-fg bg-surface-alt font-medium"
                    : "text-fg-muted hover:text-fg hover:bg-surface-hover"
                }`}
              >
                {link.label}
                {link.href === "/chat" && (
                  <span className="absolute top-3 right-3 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                  </span>
                )}
              </Link>
            ))}
            {!navigation.some((l) => l.href === "/posts") && (
              <Link
                href="/posts"
                className={`relative block px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive("/posts")
                    ? "text-fg bg-surface-alt font-medium"
                    : "text-fg-muted hover:text-fg hover:bg-surface-hover"
                }`}
              >
                পোস্ট
              </Link>
            )}
            <button
              onClick={openSearch}
              className="flex w-full items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors"
            >
              <Search className="h-4 w-4" />
              খুঁজুন
            </button>
            {user ? (
              <Link 
                href="/profile"
                className="flex w-full items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-fg bg-surface-alt font-medium transition-colors mt-2"
              >
                <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
                  <UserAvatar src={user.profilePic} name={user.name || user.username} size="sm" className="w-full h-full rounded-full" />
                </div>
                প্রোফাইল
              </Link>
            ) : (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  openAuthModal();
                }}
                className="btn-primary flex w-full items-center gap-2 text-sm mt-2"
              >
                <User className="h-4 w-4" />
                লগিন করুন
              </button>
            )}
          </nav>
        )}
      </header>

      <SearchModal isOpen={searchOpen} onClose={closeSearch} />
    </>
  );
}
