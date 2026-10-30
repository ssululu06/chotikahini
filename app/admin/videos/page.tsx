import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { VideoManager } from "@/components/admin/VideoManager";
import { VideoHubNav } from "@/components/admin/VideoHubNav";
import VideoFeaturePanel from "@/components/admin/VideoFeaturePanel";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminVideosPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "media.upload")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6 text-center">
        <div>
          <h1 className="text-xl font-bold text-fg">অ্যাক্সেস নেই</h1>
          <p className="mt-2 text-sm text-fg-muted">ভিডিও ম্যানেজ করতে অনুমতি প্রয়োজন।</p>
        </div>
      </div>
    );
  }

  const view = searchParams.view === "settings" ? "settings" : searchParams.view === "list" ? "list" : "publish";

  return (
    <div className="min-h-screen bg-surface md:flex md:h-screen md:overflow-hidden">
      <AdminSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        {/* Sub-navigation: publish / list / settings — the video hub's own
            section tabs, separate from the global admin sidebar. */}
        <VideoHubNav />
        {view === "settings" ? <VideoFeaturePanel /> : <VideoManager view={view === "list" ? "list" : "publish"} />}
      </main>
    </div>
  );
}