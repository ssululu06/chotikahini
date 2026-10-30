import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GlobalBodyAdInjector } from "@/components/GlobalBodyAdInjector";
import { BackToTop } from "@/components/BackToTop";
import { getSiteConfig, getNavigation, isVideoSectionEnabled } from "@/lib/config";
import { FloatingChatIcon } from "@/components/chat/FloatingChatIcon";
import { BottomNav } from "@/components/BottomNav";
import { PopupVideoAd } from "@/components/PopupVideoAd";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const site = getSiteConfig();
  const videoOn = isVideoSectionEnabled();
  // Hide every `/videos*` link from the chrome — header, footer, bottom
  // nav — when the section is off, so visitors never see a link to a 404.
  const filterVideo = (href: string) => !(href === "/videos" || href.startsWith("/videos/")) || videoOn;
  const nav = {
    main: getNavigation().main.filter((n) => filterVideo(n.href)),
    footer: getNavigation().footer.filter((n) => filterVideo(n.href)),
  };
  const gtmId = site.seo?.googleTagManagerId;

  return (
    <>
      {/* Sticky Ads Placeholders */}
      <div id="sticky-ad-left" className="sticky-ad-left" suppressHydrationWarning />
      <div id="sticky-ad-right" className="sticky-ad-right" suppressHydrationWarning />

      
      {/* Google Tag Manager (noscript) */}
      {gtmId && (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
      )}

      <Header
        title={site.title}
        logo={site.logo}
        navigation={nav.main}
      />
      
      <GlobalBodyAdInjector />
      
      <main className="flex-1">{children}</main>
      
      <Footer
        title={site.title}
        logo={site.logo}
        copyright={site.copyright}
        links={nav.footer}
        socialLinks={site.socialLinks}
        rssUrl="/rss.xml"
      />
      
      <FloatingChatIcon />
      <BackToTop />
      {/* Spacer so fixed BottomNav never covers footer content on mobile */}
      <div className="md:hidden h-16" aria-hidden suppressHydrationWarning />
      <BottomNav />
      <PopupVideoAd />
    </>
  );
}
