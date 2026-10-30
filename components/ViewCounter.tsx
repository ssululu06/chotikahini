"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

function getVisitorId(): string {
  try {
    let id = localStorage.getItem("site_visitor_id");
    if (!id) {
      id = "vis_" + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      localStorage.setItem("site_visitor_id", id);
    }
    return id;
  } catch {
    return `vis_${Date.now()}`;
  }
}

export function ViewCounter({ slug }: { slug: string }) {
  const [views, setViews] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;

    async function recordView() {
      try {
        const res = await fetch("/api/views", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            visitorId: getVisitorId(),
            referrer: typeof document !== "undefined" ? document.referrer || "" : "",
          }),
        });

        if (!res.ok) return;
        const data = await res.json();

        if (isMounted && data.views !== undefined) {
          setViews(data.views);
        } else if (isMounted) {
          // If it didn't increment, just fetch the current count
          fetchViews();
        }
      } catch (err) {
        console.error("Failed to record view", err);
      }
    }

    async function fetchViews() {
      try {
        const res = await fetch(`/api/views?slug=${slug}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.views !== undefined) {
          setViews(data.views);
        }
      } catch (err) {
        console.error("Failed to fetch views", err);
      }
    }

    recordView();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  return (
    <span className="flex items-center gap-1.5" title={`${views} বার পড়া হয়েছে`}>
      <Eye className="h-3.5 w-3.5 flex-shrink-0" />
      <span>{views} ভিউ</span>
    </span>
  );
}
