"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function PresenceHeartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    // Never count admin panel visits as site visitors — the admin's own
    // "ভিজিটর অ্যানালিটিক্স" would otherwise be polluted by its usage.
    if (pathname.startsWith("/admin")) return;

    // Generate or retrieve persistent visitor ID in localStorage
    let visitorId = "";
    try {
      visitorId = localStorage.getItem("site_visitor_id") || "";
      if (!visitorId) {
        visitorId = "vis_" + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
        localStorage.setItem("site_visitor_id", visitorId);
      }
    } catch (e) {
      visitorId = "anon_" + Date.now();
    }

    const sendHeartbeat = () => {
      try {
        fetch("/api/analytics/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId, pagePath: pathname }),
        }).catch(() => {});
      } catch (e) {}
    };

    // Initial ping
    sendHeartbeat();

    // Periodic ping every 90 seconds
    const interval = setInterval(sendHeartbeat, 90 * 1000);
    return () => clearInterval(interval);
  }, [pathname]);

  return null;
}
