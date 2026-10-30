import Link from "next/link";
import Image from "next/image";
import { BadgeCheck } from "lucide-react";
import {
  Tag,
  ChevronDown,
  Archive,
  Flame,
} from "lucide-react";
import { getCategoriesAsync, getAllPostsAsync, getTopTags } from "@/lib/posts";
import { getAuthor } from "@/lib/config";
import { formatDate } from "@/lib/utils";
import { tagSlug } from "@/lib/tag-utils";
import { getArchiveTree } from "@/lib/archive";
import { UserAvatar } from "./UserAvatar";
import { ArchiveWidget } from "./ArchiveWidget";
import { AuthorSocialIcons } from "./AuthorSocialIcons";
import { TrendingPosts } from "./TrendingPosts";
import { SectionIcon } from "./SectionIcon";

/* ── Category accent colours (matches PlaceholderCover palette) ── */
const categoryColor: Record<string, string> = {
  hot: "#e11d48",
  bodhu: "#db2777",
  tarona: "#9333ea",
  obibahito: "#35a99a",
  bibahito: "#5488dc",
  porokiya: "#be123c",
  kumari: "#fb7185",
  prem: "#e11d48",
  pesha: "#2563eb",
  paribarik: "#368fa8",
  somokami: "#a21caf",
  aloukik: "#7c3aed",
};

export async function Sidebar({
  authorId,
  authorName,
  authorImage,
  authorBio,
  authorVerified,
}: {
  authorId?: string;
  authorName?: string;
  authorImage?: string;
  authorBio?: string;
  authorVerified?: boolean;
}) {
  const categories = await getCategoriesAsync();
  const featuredTags = await getTopTags(5);
  const allPosts = await getAllPostsAsync();
  const latestPosts = allPosts.slice(0, 5);
  let author = authorId ? getAuthor(authorId) : null;
  let authorVerifiedState = authorVerified || false;

  // Use the already-resolved post author info when available (avoids a
  // separate DB lookup that can fail due to .or() query edge cases).
  if (authorId && authorName) {
    author = {
      ...(author || {}),
      id: authorId,
      name: authorName,
      image: authorImage || author?.image || "",
      bio: authorBio || author?.bio || "",
      facebook: (author as any)?.facebook || "",
      website: (author as any)?.website || "",
    } as any;
    authorVerifiedState = authorVerified || false;
  } else if (authorId && author && (author.name === authorId || author.id.startsWith("usr_") || author.id.length > 20)) {
    try {
      const { getSupabaseAdmin } = await import("@/lib/supabase");
      const supabase = getSupabaseAdmin();
      const { data: dbUser } = await supabase
        .from("users")
        .select("id, username, name, profile_pic, bio, website, facebook, is_verified")
        .or(`id.eq.${authorId},username.eq.${authorId}`)
        .maybeSingle();

      if (dbUser) {
        authorVerifiedState = dbUser.is_verified === true;
        author = {
          ...(author || {}),
          id: dbUser.username || dbUser.id,
          name: dbUser.name || dbUser.username || "অজ্ঞাত লেখক",
          image: dbUser.profile_pic || "",
          bio: dbUser.bio || "",
          facebook: dbUser.facebook || "",
          website: dbUser.website || "",
        } as any;
      }
    } catch (e) {}
  }

  const archiveTree = getArchiveTree();

  return (
    <aside className="hidden overflow-visible lg:block">
      <div className="max-h-none space-y-8 overflow-visible">
        {/* Author (article pages only) — bordered card */}
        {author && (
          <section>
            <h3 className="sidebar-title">লেখক</h3>
            <div className="block rounded-xl border border-border bg-surface p-4 space-y-3 shadow-sm hover:bg-surface-hover transition-colors group">
              <Link href={`/authors/${author.id}`} className="flex items-center gap-3">
                <UserAvatar src={author.image} name={author.name} userId={author.id} size="lg" className="ring-2 ring-border/50 group-hover:ring-fg/30 transition-all" />
                <div>
                  <p className="text-sm font-medium text-fg group-hover:text-fg-muted transition-colors flex items-center gap-1">
                    {author.name}
                    {authorVerifiedState && <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20 shrink-0" />}
                  </p>
                  {author.bio && (
                    <p className="text-xs text-fg-muted leading-relaxed mt-0.5">
                      {author.bio}
                    </p>
                  )}
                </div>
              </Link>
              {/* Social links */}
              <AuthorSocialIcons
                website={author.website}
                facebook={author.facebook}
              />
            </div>
          </section>
        )}

        {/* Trending Posts */}
        <section className="sidebar-section">
          <h3 className="sidebar-title flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-red-500" />
            ট্রেন্ডিং গল্প
          </h3>
          <TrendingPosts />
        </section>

        {/* Categories — rounded cards with colour dots and icons */}
        {categories.length > 0 && (
          <section className="sidebar-section">
            <h3 className="sidebar-title">বিভাগ</h3>
            <div className="flex flex-col gap-1.5">
              {categories.map((cat) => {
                const accent = categoryColor[cat.slug] || "var(--color-fg)";
                return (
                  <Link
                    key={cat.slug}
                    href={`/categories/${cat.slug}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-fg-muted hover:text-fg hover:bg-surface-hover transition-all duration-200"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${accent}14`, color: accent }}
                    >
                      <SectionIcon seed={cat.slug} className="h-8 w-8 shrink-0" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-fg">{cat.name}</p>
                    </div>
                    <span className="text-xs text-fg-subtle bg-surface-alt rounded-full px-2 py-0.5 border border-border/50">
                      {cat.count}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Featured Tags (top 5 by usage) */}
        {featuredTags.length > 0 && (
          <section className="sidebar-section">
            <h3 className="sidebar-title">নির্বাচিত ট্যাগ</h3>
            <div className="flex flex-wrap gap-1.5">
              {featuredTags.map((t) => (
                <Link
                  key={t.tag}
                  href={`/tags/${tagSlug(t.tag)}`}
                  className="tag-cloud"
                >
                  <Tag className="h-3 w-3" />
                  {t.tag}
                  <span className="text-[10px] opacity-60">({t.count})</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Latest Posts with dividers */}
        {latestPosts.length > 0 && (
          <section className="sidebar-section">
            <h3 className="sidebar-title">সর্বশেষ</h3>
            <div className="divide-y divide-border/60 rounded-xl border border-border bg-surface shadow-sm">
              {latestPosts.map((post) => (
                <Link
                  key={post.uid || post.slug}
                  href={`/${post.uid || post.slug}`}
                  className="group block px-4 py-3 first:rounded-t-xl last:rounded-b-xl hover:bg-surface-hover transition-colors"
                >
                  <p className="text-sm font-medium text-fg group-hover:text-fg transition-colors leading-snug">
                    {post.title}
                  </p>
                  <p className="text-xs text-fg-subtle mt-1.5">
                    {formatDate(post.publishedAt)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Archive by year/month */}
        <ArchiveWidget tree={archiveTree} />
      </div>
    </aside>
  );
}
