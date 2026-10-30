import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Globe, Mail, ExternalLink, Calendar, Clock, MessageCircle, BadgeCheck } from "lucide-react";
import { getAuthor, getAuthors, getSiteConfig } from "@/lib/config";
import { getAllPostsAsync } from "@/lib/posts";
import { PostGridWithAds } from "@/components/PostGridWithAds";
import { buildMetadata } from "@/lib/metadata";
import { formatDate , enToBnNumber} from '@/lib/utils';
import { FollowAuthorButton } from "@/components/FollowAuthorButton";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { SectionIcon } from "@/components/SectionIcon";

interface Props {
  params: { id: string };
}

export function generateStaticParams() {
  return getAuthors().map((author) => ({ id: author.id }));
}

export function generateMetadata({ params }: Props): Metadata {
  const author = getAuthor(params.id);
  if (!author) return {};
  const site = getSiteConfig();
  const base = site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;
  return buildMetadata({
    title: `${author.name} — ${site.title}`,
    description: author.bio || `${author.name} — ${site.description || site.seo?.description}`,
    url: `${base}/authors/${params.id}`,
  });
}

export default async function AuthorPage({ params }: Props) {
  // Resolve the real author from the users table first. The static config
  // in `lib/site-defaults.ts` is mostly legacy (placeholders with slugs like
  // "proyash", "roki", … that don't line up with the relational `author_id`
  // we now store on stories). Always preferring the DB row keeps names,
  // counts, and the post list consistent regardless of whether the URL is a
  // username (`/authors/proyash`) or a UUID (`/authors/usr_mgssz752`).
  let author = getAuthor(params.id);
  let isVerified = false;
  let dbUser: { id: string; username: string | null } | null = null;

  try {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    const supabase = getSupabaseAdmin();
    // Only select columns that exist on `users` (no `website`/`facebook`
    // in the actual schema — Supabase would otherwise 400 the request).
    const { data, error } = await supabase
      .from("users")
      .select("id, username, name, profile_pic, bio, is_verified")
      .or(`id.eq.${params.id},username.eq.${params.id}`)
      .maybeSingle();

    if (data) {
      isVerified = data.is_verified === true;
      const site = getSiteConfig();
      dbUser = { id: data.id, username: data.username };
      author = {
        id: data.username || data.id,
        name: data.name || data.username || "অজ্ঞাত লেখক",
        image: data.profile_pic || "",
        bio: data.bio || `${data.name || data.username} - ${site.title} কমিউনিটি সদস্য`,
        facebook: "",
        website: "",
      };
    }
  } catch (e) {}

  if (!author) notFound();

  // Posts reference the relational DB id (s.author_id). The URL param can
  // be either that id or the author's `username` slug, so collect both keys
  // and filter locally — keeps a single `getAllPostsAsync` round-trip.
  const allPosts = await getAllPostsAsync();
  const candidateIds = new Set<string>();
  const pushKey = (v?: string | null) => {
    const k = (v || "").toString().toLowerCase().trim();
    if (k) candidateIds.add(k);
  };
  pushKey(params.id);
  pushKey(author.id);
  if (dbUser) {
    pushKey(dbUser.id);
    pushKey(dbUser.username);
  }

  const posts = allPosts.filter((p) =>
    candidateIds.has((p.authorId || "").toString().toLowerCase().trim())
  );

  return (
    <div className="container-page py-10 sm:py-14">
      {/* Author profile card — modern gradient hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface-alt mb-10">
        {/* Decorative gradient */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-accent/8 via-transparent to-blue-500/8 dark:from-accent/10 dark:to-blue-500/10" />
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />

        <div className="relative p-6 sm:p-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8 text-center sm:text-left">
            {/* Avatar */}
            {author.image ? (
              <div className="relative shrink-0">
                <Image
                  src={author.image || "/images/avatars/1.jpg"}
                  alt={author.name}
                  width={112}
                  height={112}
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover aspect-square overflow-hidden ring-4 ring-accent/15 shadow-xl"
                />
                {isVerified && (
                  <span className="absolute -bottom-1 -right-1 bg-surface-alt rounded-full p-1 ring-2 ring-surface-alt">
                    <VerifiedBadge size="lg" />
                  </span>
                )}
              </div>
            ) : (
              <div className="relative shrink-0">
                <span
                  className="flex items-center justify-center rounded-full overflow-hidden bg-gradient-to-br from-accent to-accent-hover text-surface text-4xl sm:text-5xl font-bold ring-4 ring-accent/15 shadow-xl"
                  style={{ height: "7rem", width: "7rem" }}
                >
                  {author.name.charAt(0)}
                </span>
                {isVerified && (
                  <span className="absolute -bottom-1 -right-1 bg-surface-alt rounded-full p-1 ring-2 ring-surface-alt">
                    <VerifiedBadge size="lg" />
                  </span>
                )}
              </div>
            )}

            {/* Info */}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg flex items-center gap-2 justify-center sm:justify-start">
                {author.name}
                {isVerified && <span className="hidden sm:inline"><VerifiedBadge size="lg" /></span>}
              </h1>

              {author.bio && (
                <p className="text-sm text-fg-muted leading-relaxed mt-2 max-w-2xl">
                  {author.bio}
                </p>
              )}

              {/* Stats row */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-5">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-fg-subtle">
                  <SectionIcon seed={author.id} className="h-9 w-9 shrink-0" />
                  <span className="font-bold text-fg">{enToBnNumber(posts.length)}</span> লেখা
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-fg-subtle">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="font-bold text-fg">সক্রিয়</span> লেখক
                </span>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-4">
                <FollowAuthorButton authorId={author.id} />
                <Link
                  href={`/chat?userId=${author.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent text-surface font-semibold px-4 py-2 text-xs hover:opacity-90 transition-all shadow-sm"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  মেসেজ পাঠান
                </Link>
                {author.website && (
                  <a
                    href={author.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-xs text-fg-subtle hover:text-fg hover:border-fg/30 transition-colors"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    ওয়েবসাইট
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {author.facebook && (
                  <a
                    href={author.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-xs text-fg-subtle hover:text-fg hover:border-fg/30 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    ফেসবুক
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Posts using card-grid (same as homepage) */}
      {posts.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-border bg-surface-alt">
          <p className="text-sm text-fg-muted">এই লেখকের কোনো লেখা নেই</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-5">
            <span className="h-1 w-1 rounded-full bg-fg" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
              লেখাসমূহ
            </h2>
          </div>
          <PostGridWithAds posts={posts} adInterval={4} />
        </>
      )}
    </div>
  );
}
