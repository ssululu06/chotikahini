"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Rss } from "lucide-react";

interface FooterProps {
  title: string;
  logo: string;
  copyright: string;
  links: { href: string; label: string }[];
  socialLinks: { platform: string; url: string; label: string }[];
  rssUrl: string;
}

export function Footer({
  title,
  logo,
  copyright,
  links,
  socialLinks,
  rssUrl,
}: FooterProps) {
  const pathname = usePathname();
  if (pathname === "/chat") return null;

  return (
    <footer className="mt-16 bg-surface-alt/30 border-t border-border/50">
      {/* Gradient accent line */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-fg/10 to-transparent" />
      <div className="container-page py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-5">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="site-brand flex items-center shrink-0">
              {logo ? (
                <Image
                  src={logo}
                  alt={title}
                  width={22}
                  height={22}
                  className="rounded transition-transform hover:scale-105 safe-blur-exempt"
                />
              ) : null}
            </Link>
            <span className="text-sm text-fg-muted">
              &copy; {new Date().getFullYear()} {copyright}
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 rounded-lg text-sm text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Social — single RSS from socialLinks */}
          <div className="flex items-center gap-1">
            {socialLinks.map((s) =>
              s.platform === "rss" ? (
                <a
                  key={s.platform}
                  href={s.url}
                  className="p-2 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-hover transition-colors"
                  aria-label={s.label}
                >
                  <Rss className="h-4 w-4" />
                </a>
              ) : (
                <a
                  key={s.platform}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-hover transition-colors text-sm"
                  aria-label={s.label}
                >
                  {s.label}
                </a>
              )
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
