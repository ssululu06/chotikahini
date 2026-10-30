import { getSiteConfig } from "@/lib/config";
import { VideoListShell } from "@/components/VideoListShell";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: `ভিডিও | ${getSiteConfig().title}`,
    description: "সদ্য প্রকাশিত ভিডিও, দেশভেদে ব্লক ছাড়াই",
  };
}

const SUBTITLE =
  "Provider-এর player-এ সরাসরি চলে — কোনো ফাইল ডাউনলোড নেই, কোনো rehost নেই। প্রতিটি দেখা আলাদাভাবে গণনা হয়।";

export default function VideosPage() {
  return <VideoListShell title="ভিডিও" subtitle={SUBTITLE} currentPage={1} />;
}