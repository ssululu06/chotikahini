"use client";

import { useEffect, useRef } from "react";

// Logs one page visit per reading session so the admin panel's
// "ভিজিটর অ্যানালিটিক্স" (unique visitors / daily counts) can work.
// Fire-and-forget — analytics must never break the reading experience.
export function PageVisitTracker({ slug }: { slug: string }) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;

    // Only record once per browser session per page
    try {
      const sessionKey = `site_visit_${slug}`;
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, "1");
    } catch {}

    sentRef.current = true;

    let visitorId = "";
    try {
      visitorId = localStorage.getItem("site_visitor_id") || "";
      if (!visitorId) {
        visitorId = "vis_" + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
        localStorage.setItem("site_visitor_id", visitorId);
      }
    } catch {
      visitorId = "anon_" + Date.now();
    }

    const referrer = document.referrer || "";

    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, visitorId, referrer }),
    }).catch(() => {});
  }, [slug]);

  return null;
}
