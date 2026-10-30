import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getSiteConfig } from "@/lib/config";
import { DEFAULT_SITE_CONFIG } from "@/lib/site-defaults";
import { getAllKeywordPhrases } from "@/lib/keyword-engine";
import { toSiteOgUrl } from "@/lib/og-urls";
import { loadSiteSettings } from "@/lib/site-settings";
import { AuthProvider } from "@/contexts/AuthContext";
import { AgeGateShell } from "@/components/AgeGateShell";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { LoginModalPopup } from "@/components/LoginModalPopup";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { AuthorPromptToast } from "@/components/AuthorPromptToast";
import { SafeModeToggle } from "@/components/SafeModeToggle";
import "./globals.css";

/**
 * Latin UI font, self-hosted by next/font at build time (no external
 * request, no layout shift). Deliberately NOT applied to <body> — that
 * keeps `font-bengali` in charge of the Bangla UI copy, which is the
 * bulk of this site. Inter is opted into by Latin-only surfaces (video
 * titles, metadata, admin tables) via the `font-latin` utility.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-latin",
});

// ── Search-engine crawler detection ──────────────────────────
// The age-gate crawler check lives in `components/AgeGateShell.tsx`.
// It used to read the `user-agent` request header here, which made
// `headers()` a dynamic API and forced every page of the site to be
// server-rendered on demand instead of served from the static / ISR
// cache. On a serverless host that is a per-request CPU cost on the
// hottest routes. The age gate is a client-side overlay, so the check
// now runs in the browser with the same visible result.

export async function generateMetadata(): Promise<Metadata> {
  try {
    await loadSiteSettings();
  } catch (error) {
    console.error("[site-settings] Metadata using cached/default settings:", error);
  }
  const site = getSiteConfig();

  // Enrich site keywords with search.md data
  const searchMdPhrases = getAllKeywordPhrases().slice(0, 10).join(", ");
  const siteKeywords = site.seo?.keywords
    ? `${site.seo.keywords}, ${searchMdPhrases}`
    : searchMdPhrases;

  const baseUrl = site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;
  const ogImgForShare = toSiteOgUrl(site);

  return {
    title: {
      default: site.seo?.defaultTitle || `${site.title} — ${site.tagline}`,
      template: site.seo.titleTemplate || `%s — ${site.title}`,
    },
    description: site.seo?.description || site.description,
    metadataBase: new URL(baseUrl),
    keywords: siteKeywords,
    openGraph: {
      title: site.title,
      description: site.seo?.description || site.description,
      url: baseUrl,
      siteName: site.seo?.siteName || site.title,
      locale: "bn_BD",
      type: "website",
      images: ogImgForShare
        ? [{ url: ogImgForShare, secureUrl: ogImgForShare.replace(/^http:/, "https:"), width: 1200, height: 630, alt: site.title }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: site.title,
      description: site.seo?.description || site.description,
      images: ogImgForShare ? [ogImgForShare] : [],
      creator: site.seo?.twitterCreator || undefined,
    },
    icons: site.favicon
      ? [{ rel: "icon", url: site.favicon }]
      : site.logo
        ? [{ rel: "icon", url: site.logo }]
        : [],
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    verification: {
      google: site.seo?.googleSearchConsole || undefined,
      ...(site.seo?.bingVerification ? { bing: site.seo.bingVerification } : {}),
    },
    other: {
      "theme-color": site.seo?.themeColor || "#2c2c2c",
      rating: "general",
    },
  };
}

function ThemeStyles() {
  const site = getSiteConfig();
  const themeColors = site.themeColors || (DEFAULT_SITE_CONFIG as any).themeColors;
  const { light, dark } = themeColors;

  const cssVar = (prefix: string, map: Record<string, string>) =>
    Object.entries(map)
      .map(([key, val]) => `--color-${prefix}${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${val};`)
      .join("\n    ");

  return (
    <style>{`
      :root {
        ${cssVar("", {
          surface: light.surface,
          "surface-alt": light.surfaceAlt,
          "surface-hover": light.surfaceHover,
          border: light.border,
          fg: light.fg,
          "fg-muted": light.fgMuted,
          "fg-subtle": light.fgSubtle,
          accent: light.accent,
          "accent-hover": light.accentHover,
        })}
        --color-prose-bg: ${light.surface};
        --scrollbar: ${light.border};
        --scrollbar-hover: ${light.fgSubtle};
      }
      .dark {
        ${cssVar("", {
          surface: dark.surface,
          "surface-alt": dark.surfaceAlt,
          "surface-hover": dark.surfaceHover,
          border: dark.border,
          fg: dark.fg,
          "fg-muted": dark.fgMuted,
          "fg-subtle": dark.fgSubtle,
          accent: dark.accent,
          "accent-hover": dark.accentHover,
        })}
        --color-prose-bg: ${dark.surface};
        --scrollbar: ${dark.border};
        --scrollbar-hover: ${dark.fgSubtle};
      }
    `}</style>
  );
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await loadSiteSettings();
  } catch (error) {
    console.error("[site-settings] Layout using cached/default settings:", error);
  }
  const site = getSiteConfig();
  const langAttr = site.locale?.split("-")[0] || "bn";
  const gaId = site.seo?.googleAnalyticsId;
  const gtmId = site.seo?.googleTagManagerId;

  return (
    <html lang={langAttr} className={inter.variable} suppressHydrationWarning>
      <head>
        <ThemeStyles />
        {/* Prevent theme flash — apply dark class before React hydrates */}
        <script
          id="theme-init"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("chittakkho-theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.classList.add("dark");}}catch(e){}})();`,
          }}
        />
        {/* Ad-safe document.write guard and extension error suppressor */}
        <script
          id="doc-write-guard"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var dw=document.write.bind(document);document.write=function(c){try{if(document.readyState==="loading"){dw(c);}}catch(e){}};document.writeln=function(c){try{if(document.readyState==="loading"){dw(c+"\\n");}}catch(e){}};}catch(e){}try{window.addEventListener("unhandledrejection",function(e){if(e&&e.reason&&e.reason.message&&e.reason.message.indexOf("M_ID")!==-1){e.preventDefault();e.stopPropagation();}});}catch(e){}try{var _err=console.error;console.error=function(){if(arguments[0]&&typeof arguments[0]==="string"&&arguments[0].indexOf("bis_skin_checked")!==-1)return;_err.apply(console,arguments);};}catch(e){}})();`,
          }}
        />
        {/* Google Search Console verification — direct fallback */}
        {site.seo?.googleSearchConsole && (
          <meta
            name="google-site-verification"
            content={site.seo.googleSearchConsole}
          />
        )}
      </head>
      <body className="flex min-h-screen flex-col font-bengali" suppressHydrationWarning>
        {/* Google Analytics */}
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script
              id="google-analytics"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${gaId}');
                `,
              }}
            />
          </>
        )}

        {/* Google Tag Manager */}
        {gtmId && (
          <Script
            id="google-tag-manager"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${gtmId}');
              `,
            }}
          />
        )}

        {/* ExoClick Ad Provider for Video Slider and popup ads */}
        <Script
          src="https://a.magsrv.com/ad-provider.js"
          strategy="afterInteractive"
        />

        <ThemeProvider>
          <AuthProvider>
            <PresenceHeartbeat />
            <AgeGateShell />
            <AnnouncementBanner />
            <LoginModalPopup />
            <AuthorPromptToast />
            <SafeModeToggle />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
