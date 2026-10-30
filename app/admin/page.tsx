import { isAdminAuthenticated } from "@/lib/admin-auth";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { getAllPostsAsync } from "@/lib/posts";
import { getSiteConfig } from "@/lib/config";

export function generateMetadata() {
  const site = getSiteConfig();
  return {
    title: `Admin Panel | ${site.title}`,
  };
}

export default async function AdminPage() {
  const isAuthenticated = await isAdminAuthenticated();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-zinc-400">You must be logged in as an Admin to view this page.</p>
        </div>
      </div>
    );
  }

  // Fetch published posts directly from Supabase database
  const allPosts = await getAllPostsAsync();
  const publishedPosts = allPosts.map(post => ({
    title: post.title,
    uid: post.uid || "",
    slug: post.slug,
    fileSlug: post.fileSlug,
    publishedAt: post.publishedAt,
    categoryName: post.categoryName,
    cover: post.cover || "",
    scheduledAt: post.scheduledAt || null,
    status: "published",
    history: [],
  }));

  return <AdminDashboard publishedPosts={publishedPosts} />;
}
