import { getSiteConfig } from "@/lib/config";
import { VideoListShell } from "@/components/VideoListShell";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { num: string };
}) {
  const page = Number(params.num);
  return {
    title: `ভিডিও — পাতা ${page} | ${getSiteConfig().title}`,
  };
}

const SUBTITLE =
  "Provider-এর player-এ সরাসরি চলে। প্রতিটি দেখা আলাদাভাবে গণনা হয়।";

export default function VideosPagedPage({
  params,
}: {
  params: { num: string };
}) {
  const page = Number(params.num);
  if (!Number.isFinite(page) || page < 2) notFound();
  return (
    <VideoListShell
      title="ভিডিও"
      subtitle={SUBTITLE}
      currentPage={page}
    />
  );
}