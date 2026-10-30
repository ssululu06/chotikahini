import type { Metadata } from "next";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { AccessDenied } from "@/components/admin/AccessDenied";

export const metadata: Metadata = {
  title: "Admin Panel",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

// Force every admin page to run dynamically so the auth check below is
// re-evaluated on every request.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side authentication gate. The client-side `useAuth()` checks
  // inside individual pages are a UX nicety; THIS is the actual security
  // boundary. Without it, the page HTML and JS bundles ship to anyone
  // who can guess `/admin/*` URLs, and an unauthenticated client can
  // probe the data API endpoints that the page would call.
  const isAuthed = await isAdminAuthenticated();
  if (!isAuthed) {
    return <AccessDenied title="Admin access required" />;
  }
  return <>{children}</>;
}
