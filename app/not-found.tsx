import Link from "next/link";
import { getSiteConfig } from "@/lib/config";
import { buildMetadata } from "@/lib/metadata";

export function generateMetadata() {
  const site = getSiteConfig();
  return buildMetadata({
    title: `৪০৪ — পৃষ্ঠা পাওয়া যায়নি — ${site.title}`,
    description: `আপনি যে পৃষ্ঠাটি খুঁজছেন তা বিদ্যমান নেই। ${site.seo?.description || site.description} এর হোমপেজে ফিরে যান।`,
    robots: "noindex, follow",
  });
}

export default function NotFound() {
  const site = getSiteConfig();

  return (
    <div className="container-article py-20 sm:py-28 text-center">
      <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-fg">
        ৪০৪
      </h1>
      <p className="mt-4 text-base text-fg-muted">
        পৃষ্ঠাটি পাওয়া যায়নি
      </p>
      <p className="mt-2 text-sm text-fg-subtle">
        আপনি যে পৃষ্ঠাটি খুঁজছেন তা বিদ্যমান নেই বা সরানো হয়েছে।
      </p>
      <div className="mt-8">
        <Link href="/" className="btn-primary">
          {site.title} — হোমপেজ
        </Link>
      </div>
    </div>
  );
}
