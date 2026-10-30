import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { PostFeed } from "@/components/posts/PostFeed";
import { getSiteConfig } from "@/lib/config";
import { buildMetadata } from "@/lib/metadata";

export const revalidate = 30;

export async function generateMetadata(): Promise<Metadata> {
  const site = getSiteConfig();
  return buildMetadata({
    title: "পোস্ট — কমিউনিটি",
    description: "ব্যবহারকারীদের পোস্ট ফিড — মতামত শেয়ার করুন, লাইক ও মন্তব্য করুন।",
    url: `${site.url.endsWith("/") ? site.url.slice(0, -1) : site.url}/posts`,
  });
}

export default async function PostsPage() {
  return (
    <div className="container-page py-8 sm:py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="flex items-center gap-3 mb-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-alt border border-border text-blue-500">
            <MessageSquare className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="h-1 w-1 rounded-full bg-fg" />
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">কমিউনিটি</h2>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">সবাই যা লিখছেন</h1>
          </div>
        </header>
        <p className="text-sm text-fg-muted -mt-2 mb-2">
          মতামত, অভিজ্ঞতা ও গল্প নিয়ে আলোচনা করুন — লাইক ও মন্তব্যে অংশ নিন।
        </p>

        <PostFeed />
      </div>
    </div>
  );
}