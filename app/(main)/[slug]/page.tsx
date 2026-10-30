import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Calendar, Clock, Tag, User, BadgeCheck, AlertCircle } from "lucide-react";
import {
  getAllPostsAsync,
  getPostBySlugAsync,
  getRelatedPosts,
  type Post,
} from "@/lib/posts";
import { formatDate, formatDateTime } from "@/lib/utils";
import { getSiteConfig, getAuthor } from "@/lib/config";
import { generatePostMetadata, generatePostJsonLd } from "@/lib/seo";
import { tagSlug } from "@/lib/tag-utils";
import { getSession } from "@/lib/auth";
import { isAtLeast, hasPermission } from "@/lib/permissions";
import { StoryWithVideos } from "@/components/StoryWithVideos";
import { AdSlot } from "@/components/AdSlot";
import { CategoryBadge } from "@/components/CategoryBadge";
import { PlaceholderCover } from "@/components/PlaceholderCover";
import { RelatedPosts } from "@/components/RelatedPosts";
import { CommentSection } from "@/components/comments/CommentSection";
import { CoAuthors } from "@/components/CoAuthors";
import { ReadingProgress } from "@/components/ReadingProgress";
import { Sidebar } from "@/components/Sidebar";
import { PreviousPost } from "@/components/PreviousPost";
import { NextPost } from "@/components/NextPost";
import { CopyAttribution } from "@/components/CopyAttribution";
import { InlineAttribution } from "@/components/InlineAttribution";
import { TableOfContents } from "@/components/TableOfContents";
import { AuthorSocialIcons } from "@/components/AuthorSocialIcons";
import { SavePostButton } from "@/components/SavePostButton";
import { RecordHistory } from "@/components/RecordHistory";
import { ReadingProgressTracker } from "@/components/ReadingProgressTracker";
import { PageVisitTracker } from "@/components/PageVisitTracker";
import { CoverLightbox } from "@/components/CoverLightbox";
import { UserAvatar } from "@/components/UserAvatar";
import { LikePostButton } from "@/components/LikePostButton";
import { ShareButtons } from "@/components/ShareButtons";
import { ReportButton } from "@/components/ReportButton";
import { FontSizeControl } from "@/components/FontSizeControl";
import { ViewCounter } from "@/components/ViewCounter";

import { ReadingMode } from "@/components/ReadingMode";

export const revalidate = 60; // ISR: story pages are cached; invalidated instantly on publish/unpublish/delete via /api/admin/posts/manage
export const dynamicParams = true;

import { AD_300x250_HTML } from "@/lib/ad-config";
const POST_PAGE_AD_HTML = AD_300x250_HTML;

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  try {
    const reserved = new Set([
      "about",
      "api",
      "authors",
      "categories",
      "contact",
      "page",
      "posts",
      "privacy",
      "read",
      "rss.xml",
      "search",
      "sitemap",
      "tags",
      "not-found",
    ]);
    const posts = await getAllPostsAsync();
    return posts
      .filter((p) => !reserved.has(p.slug))
      .map((post) => ({ slug: post.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props) {
  try {
    const posts = await getAllPostsAsync({ includeFuture: true, includePending: true });
    const post = posts.find((p) => p.slug === params.slug || p.uid === params.slug || p.fileSlug === params.slug) || null;
    if (!post) return {};
    const isPublished = post.status === "published" && new Date(post.publishedAt).getTime() <= Date.now();
    if (!isPublished) {
      // Suppress SEO & OpenGraph tags for unapproved/pending stories
      return {
        title: "গল্পটি পাওয়া যায়নি",
        robots: { index: false, follow: false },
      };
    }
    const site = getSiteConfig();
    return generatePostMetadata(post, site);
  } catch {
    return {};
  }
}

export default async function PostPage({ params }: Props) {
  let post: Post | null = null;
  try {
    post = await getPostBySlugAsync(params.slug);
  } catch {
    post = null;
  }
  if (!post) notFound();

  const isPublished = post.status === "published" && new Date(post.publishedAt).getTime() <= Date.now();
  let isPendingPreview = false;

  if (!isPublished) {
    // Only unpublished stories need the viewer identity. Reading the session
    // cookie makes the route dynamic, so it is deliberately deferred to this
    // branch — published stories stay statically cached (ISR) and are served
    // without re-rendering on every view.
    const session = await getSession();
    const isAuthor = !!session && (session.id === post.authorId || session.username === post.authorId);
    const isAdmin = !!session && (isAtLeast(session.role, "moderator") || hasPermission(session.role, "story.review"));

    if (!isAuthor && !isAdmin) {
      notFound();
    }
    isPendingPreview = true;
  }

  const site = getSiteConfig();
  const siteUrl = site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;
  const related = getRelatedPosts(post, 4);
  const author_meta = getAuthor(post.authorId);
  const jsonLd = generatePostJsonLd(post, site);

  // Keyword-enriched image alt text for SEO
  const imageAlt = `${post.title} — ${post.categoryName} বিভাগের ${site.shortName} গল্প | ${site.title}`;

  return (
    <>
      <RecordHistory slug={post.slug} title={post.title} cover={post.cover || ""} />
      <ReadingProgressTracker postSlug={post.slug} />
      <PageVisitTracker slug={post.slug} />
      <ReadingProgress />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="article-layout py-8 sm:py-10">
        <article>
          {isPendingPreview && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center gap-3 text-sm font-medium animate-in fade-in duration-200">
              <AlertCircle className="w-6 h-6 shrink-0 text-amber-500" />
              <div>
                <p className="font-bold text-base">অপেক্ষমাণ গল্প (Pending Approval)</p>
                <p className="text-xs opacity-90">এই গল্পটি এখনো অ্যাডমিন কর্তৃক অনুমোদিত ও প্রকাশিত হয়নি। শুধুমাত্র লেখক হিসেবে আপনি এবং অ্যাডমিনরা এটি দেখতে পাচ্ছেন।</p>
              </div>
            </div>
          )}

          {(post.previousPost || post.nextPost) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PreviousPost slug={post.previousPost} />
              <NextPost slug={post.nextPost} />
            </div>
          )}

          <header className="mb-8 space-y-4">
            <CategoryBadge
              categoryId={post.categoryId}
              categoryName={post.categoryName}
              size="lg"
            />

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-snug text-fg">
              {post.title}
            </h1>

            {post.description && (
              <p className="text-sm sm:text-base text-fg-muted leading-relaxed font-normal">
                {post.description}
              </p>
            )}

            {/* Ultra-Modern Editorial Hero Meta Bar */}
            <div className="pt-2">
              {/* Mobile-Only Minimalist Author Pill */}
              <div className="lg:hidden flex items-center justify-between gap-3 mb-4 bg-gradient-to-r from-accent/10 via-surface-alt to-transparent p-2.5 pl-3 rounded-2xl border border-accent/15">
                <Link href={`/authors/${post.authorId}`} className="flex items-center gap-2.5 min-w-0 group">
                  <UserAvatar src={author_meta?.image} name={post.authorName} userId={post.authorId} size="md" className="ring-2 ring-accent/30 group-hover:scale-105 transition-transform" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-accent">লেখক</p>
                    <p className="text-xs font-bold text-fg group-hover:text-accent transition-colors truncate flex items-center gap-1">
                      {post.authorName}
                      {post.authorVerified && (
                        <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20 shrink-0" />
                      )}
                    </p>
                  </div>
                </Link>

                <Link
                  href={`/authors/${post.authorId}`}
                  className="px-3 py-1 text-[11px] font-bold rounded-full bg-accent text-surface hover:opacity-90 transition-opacity shrink-0"
                >
                  প্রোফাইল
                </Link>
              </div>

              {/* Clean Editorial Stats & Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-fg-subtle pt-2 border-t border-border/60">
                <div className="flex flex-wrap items-center gap-3 font-medium">
                  <span className="flex items-center gap-1.5 hover:text-fg transition-colors">
                    <Calendar className="h-3.5 w-3.5 text-accent shrink-0" />
                    <span>{formatDateTime(post.publishedAt)}</span>
                  </span>

                  <span className="text-border">/</span>

                  <span className="flex items-center gap-1.5 hover:text-fg transition-colors">
                    <Clock className="h-3.5 w-3.5 text-accent shrink-0" />
                    <span>{post.readingTime}</span>
                  </span>

                  <span className="text-border">/</span>

                  <ViewCounter slug={post.slug} />
                </div>

                {/* Like, Save, Report & Reading Mode Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <ReadingMode
                    title={post.title}
                    authorName={post.authorName}
                    categoryName={post.categoryName}
                    readingTime={post.readingTime}
                    content={post.content}
                  />
                  <LikePostButton postSlug={post.slug} />
                  <SavePostButton postSlug={post.slug} />
                  <ReportButton targetType="story" targetId={post.slug} />
                </div>
              </div>
            </div>

          </header>

          {post.cover ? (
            <div className="mb-8 -mx-4 sm:-mx-0">
              <CoverLightbox src={post.cover} alt={imageAlt} />
            </div>
          ) : (
            <div className="mb-8 rounded-2xl overflow-hidden shadow-lg shadow-black/10 dark:shadow-black/40 ring-1 ring-black/5 dark:ring-white/5">
              <PlaceholderCover
                title={post.title}
                categoryId={post.categoryId}
                categoryName={post.categoryName}
                className="w-full"
                style={{ aspectRatio: "16/9", maxHeight: "420px" }}
              />
            </div>
          )}

          <StoryWithVideos source={post.content} />

          <TableOfContents content={post.content} />

          <AdSlot id="post-inline-ad" html={POST_PAGE_AD_HTML} className="my-8" />

          {/* Share buttons (Bottom of article) */}
          <div className="mt-8 pt-6 border-t border-border flex items-center">
            <ShareButtons title={post.title} url={`${siteUrl}/${post.slug}`} />
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-8 pt-8 border-t border-border">
            <InlineAttribution />
            <AuthorSocialIcons
              website={author_meta?.website}
              facebook={author_meta?.facebook}
            />
          </div>

          {(post.previousPost || post.nextPost) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
              <PreviousPost slug={post.previousPost} />
              <NextPost slug={post.nextPost} />
            </div>
          )}

          <CopyAttribution />

            {post.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/tags/${tagSlug(tag)}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-alt px-2.5 py-1 text-xs font-medium text-fg-muted hover:text-fg hover:border-fg/30 transition-colors"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </Link>
                ))}
              </div>
            )}



          <CommentSection postSlug={post.slug} authorId={post.authorId} />
          <CoAuthors storyUid={post.uid || post.slug} />
          <RelatedPosts posts={related} />
        </article>

        <Sidebar
          authorId={post.authorId}
          authorName={post.authorName}
          authorImage={post.authorImage}
          authorBio={post.authorBio}
          authorVerified={post.authorVerified}
        />
      </div>
      <FontSizeControl />
    </>
  );
}
