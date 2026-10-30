import fs from "fs";
import path from "path";
import { isAuthorAuthenticated } from "@/lib/admin-auth";
import StoryEditor from "@/components/admin/StoryEditor";
import { getAllPostsAsync, getPostBySlugAsync, getAllTags } from "@/lib/posts";
import { getAllCategoryConfigs, getSiteConfig } from "@/lib/config";
import { getSupabaseAdmin } from "@/lib/supabase";

export function generateMetadata() {
  const site = getSiteConfig();
  return {
    title: `Story Editor | ${site.title}`,
  };
}

export default async function EditorPage({
  searchParams,
}: {
  searchParams: { uid?: string; draft?: string };
}) {
  if (!(await isAuthorAuthenticated())) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-fg-subtle">You must be logged in as an Author or Admin to view this page.</p>
        </div>
      </div>
    );
  }

  let initialData = null;
  let nextUid = "";
  const allPosts = await getAllPostsAsync({ includePending: true });
  const uids = allPosts.map(p => p.uid).filter(Boolean);
  let maxNum = 0;
  for (const u of uids) {
    const match = u?.match(/^golpo(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  nextUid = `golpo${maxNum + 1}`;

  if (searchParams.uid) {
    const post = await getPostBySlugAsync(searchParams.uid);
    if (post) {
      initialData = {
        uid: post.uid,
        fileSlug: post.fileSlug,
        title: post.title || "",
        description: post.description || "",
        author: post.authorId || "",
        category: post.categoryId || "",
        tags: post.tags?.join(", ") || "",
        cover: post.cover || "",
        content: post.content || "",
        previousPost: post.previousPost || "",
        featured: post.featured || false,
        publishedAt: post.publishedAt || "",
        scheduledAt: post.scheduledAt || null,
        isDraft: false,
      };
    }
  } else if (searchParams.draft) {
    // Draft will be fetched on client
  }

  // Get categories, authors, and tags
  const categories = getAllCategoryConfigs().map(c => ({ id: c.id, name: c.name }));

  // Authors: show REAL registered users (author/admin/superadmin) so a
  // selected author always exists and the post keeps their name. The "admin"
  // entry maps to the logged-in admin. Static config authors that don't
  // match a real user are excluded (they would otherwise publish as admin).
  const authorMap = new Map<string, { id: string; name: string }>();
  authorMap.set("admin", { id: "admin", name: "admin" });

  const { getSupabaseAdmin } = await import("@/lib/supabase");
  try {
    const supabase = getSupabaseAdmin();
    const { data: dbAuthors } = await supabase
      .from("users")
      .select("id, username, name, role")
      .in("role", ["author", "admin", "superadmin"]);
    (dbAuthors || []).forEach((u: any) => {
      if (!u.id) return;
      const label = u.name || u.username || u.id;
      // Store by id only — username is also stored in the map for lookups,
      // but Array.from(values()) would give duplicates. Dedupe by id.
      if (!authorMap.has(u.id)) {
        authorMap.set(u.id, { id: u.id, name: label });
      }
      // Also store by username for the lookup at line 97 below.
      if (u.username) authorMap.set(u.username, { id: u.id, name: label });
    });
  } catch (e) {}
  // Deduplicate by id so the dropdown never shows the same author twice.
  const seenIds = new Set<string>();
  const authors: { id: string; name: string }[] = [];
  for (const a of authorMap.values()) {
    if (!seenIds.has(a.id)) { seenIds.add(a.id); authors.push(a); }
  }

  // Ensure the post being edited always has its real author in the dropdown
  if (initialData?.author) {
    const existing = authorMap.get(initialData.author);
    if (!existing) {
      try {
        const supabase = getSupabaseAdmin();
        const { data: postAuthor } = await supabase
          .from("users")
          .select("id, username, name")
          .or(`id.eq.${initialData.author},username.eq.${initialData.author}`)
          .maybeSingle();
        if (postAuthor?.id && !seenIds.has(postAuthor.id)) {
          authors.push({ id: postAuthor.id, name: postAuthor.name || postAuthor.username || postAuthor.id });
          seenIds.add(postAuthor.id);
        }
      } catch (e) {}
    }
  }
  
  // Get all unique tags from all posts to provide suggestions
  const allTagsData = await getAllTags();
  const allTags = allTagsData.map(t => t.tag);

  // Get all cover images
  let availableCovers: string[] = [];
  try {
    const coversDir = path.join(process.cwd(), "public", (getSiteConfig().coverFallbackDir || "/images/Cover_pic/").replace(/^\//, ""));
    availableCovers = fs.readdirSync(coversDir).filter(f => !f.startsWith('.'));
  } catch (e) {
    // fallback
  }

  return (
    <StoryEditor 
      initialData={initialData} 
      draftName={searchParams.draft} 
      categories={categories}
      authors={authors}
      suggestedTags={allTags}
      nextUid={nextUid}
      availableCovers={availableCovers}
    />
  );
}
