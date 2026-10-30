import type { Metadata } from "next";
import { getSiteConfig } from "@/lib/config";
import { Mail } from "lucide-react";
import { buildMetadata } from "@/lib/metadata";
import { todayDhaka } from "@/lib/utils";

export function generateMetadata(): Metadata {
  const site = getSiteConfig();
  return buildMetadata({
    title: `গোপনীয়তা নীতি — ${site.title}`,
    description: `${site.title} — গোপনীয়তা নীতি, কুকি নীতি ও শর্তাবলী সম্পর্কে জানুন`,
    url: `${site.url.endsWith("/") ? site.url.slice(0, -1) : site.url}/privacy`,
  });
}

export default function PrivacyPage() {
  const site = getSiteConfig();

  return (
    <div className="container-article py-10 sm:py-14">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-1 w-1 rounded-full bg-fg" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
          গোপনীয়তা
        </h2>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg mb-8">
        গোপনীয়তা নীতি
      </h1>

      <div className="space-y-8">
        {/* Card: তথ্য সংগ্রহ */}
        <div className="rounded-xl border border-border bg-surface-alt p-5">
          <h2 className="text-sm font-semibold text-fg mb-2">তথ্য সংগ্রহ</h2>
          <p className="text-sm text-fg-muted leading-relaxed">
            এই ওয়েবসাইটে কোনো ব্যবহারকারী অ্যাকাউন্ট, নিবন্ধন বা ব্যক্তিগত
            তথ্য সংগ্রহের ব্যবস্থা নেই। আপনি যে তথ্য স্বেচ্ছায় Contact ফর্মের
            মাধ্যমে পাঠান, তা কেবলমাত্র আপনার সাথে যোগাযোগের জন্যই ব্যবহার করা হয়।
          </p>
        </div>

        {/* Card: কুকি */}
        <div className="rounded-xl border border-border bg-surface-alt p-5">
          <h2 className="text-sm font-semibold text-fg mb-2">কুকি</h2>
          <p className="text-sm text-fg-muted leading-relaxed">
            এই ওয়েবসাইট থিম সংরক্ষণ (ডার্ক/লাইট মোড) এবং মৌলিক কার্যকারিতার
            জন্য কুকি ব্যবহার করতে পারে। এসব কুকি ব্যবহারকারীকে শনাক্ত করে না।
          </p>
        </div>

        {/* Card: তৃতীয় পক্ষের সার্ভিস */}
        <div className="rounded-xl border border-border bg-surface-alt p-5">
          <h2 className="text-sm font-semibold text-fg mb-2">তৃতীয় পক্ষের সার্ভিস</h2>
          <p className="text-sm text-fg-muted leading-relaxed">
            মন্তব্য বিভাগের জন্য Giscus ব্যবহার করা হয়, যা GitHub-এর
            আলোচনা সিস্টেমের উপর ভিত্তি করে কাজ করে। Giscus-এর নিজস্ব
            গোপনীয়তা নীতি প্রযোজ্য।
          </p>
        </div>

        {/* Card: যোগাযোগ */}
        <div className="rounded-xl border border-border bg-surface-alt p-5">
          <h2 className="text-sm font-semibold text-fg mb-2">যোগাযোগ</h2>
          <p className="text-sm text-fg-muted leading-relaxed">
            কোনো প্রশ্ন থাকলে নিচের ইমেইলে যোগাযোগ করুন।
          </p>
          <div className="inline-flex items-center gap-2 mt-3 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm">
            <Mail className="h-4 w-4 text-fg-subtle shrink-0" />
            <a
              href={`mailto:${site.email}`}
              className="text-fg hover:text-fg-muted transition-colors"
            >
              {site.email}
            </a>
          </div>
        </div>

        <p className="text-xs text-fg-subtle text-center pt-2">
          সর্বশেষ আপডেট: {todayDhaka()}
        </p>
      </div>
    </div>
  );
}
