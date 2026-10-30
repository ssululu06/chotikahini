"use client";

import { Power } from "lucide-react";
import { VideoSectionToggle } from "@/components/admin/FeatureToggles";

/**
 * The "সেকিংস" tab of the video hub (/admin/videos?view=settings).
 *
 * Houses the site-wide video on/off switch inside the video section itself,
 * so an admin who is already managing videos can turn the public-facing
 * section on or off without hunting through general site settings. The same
 * toggle also appears under /admin/settings — both write the same flag.
 */
export default function VideoFeaturePanel() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-fg sm:text-3xl">
          <Power className="h-6 w-6 text-blue-500" />
          ভিডিও সেটিংস
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">
          পুরো ওয়েবসাইটে ভিডিও সেকশন দেখাবেন না লুকাবেন তা এখান থেকেই নিয়ন্ত্রণ করুন।
        </p>
      </header>

      <VideoSectionToggle />
    </div>
  );
}