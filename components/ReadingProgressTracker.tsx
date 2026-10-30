"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

// Tracks scroll-based reading progress and reports % completion to the server
// so authors can see how far readers actually get into their stories.
export function ReadingProgressTracker({ postSlug }: { postSlug: string }) {
  const { user } = useAuth();
  const lastReportedRef = useRef(0);
  const reportedOnceRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    let lastSent = 0;
    let fired = false;

    const compute = () => {
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || document.body.scrollTop;
      const total = doc.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const pct = Math.round((scrollTop / total) * 100);
      if (!fired && pct >= 5) {
        fired = true;
        report(5);
      }
      // Report at milestones: 25%, 50%, 75%, 100%
      for (const m of [25, 50, 75, 100]) {
        if (pct >= m && lastSent < m) {
          lastSent = m;
          report(m);
        }
      }
    };

    const report = (p: number) => {
      fetch("/api/analytics/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postSlug, percent: p }),
      }).catch(() => {});
    };

    const onScroll = () => {
      if (Date.now() - lastReportedRef.current < 3000) return;
      lastReportedRef.current = Date.now();
      compute();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // Report initial load milestone
    const t = setTimeout(compute, 2000);

    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postSlug, !!user]);

  return null;
}
