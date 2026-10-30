import type { Metadata } from "next";
import { getAuthors, getSiteConfig } from "@/lib/config";
import { getAllPostsAsync } from "@/lib/posts";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { buildMetadata } from "@/lib/metadata";
import { Globe, Mail } from "lucide-react";
import { SectionIcon } from "@/components/SectionIcon";

export const revalidate = 60;

export function generateMetadata(): Metadata {
  const site = getSiteConfig();
  return buildMetadata({
    title: `লেখক — ${site.title}`,
    description: `${getSiteConfig().seo.description} — লেখকবৃন্দ`,
    url: `${site.url.endsWith("/") ? site.url.slice(0, -1) : site.url}/authors`,
  });
}

export default async function AuthorsPage() {
  // Merge static config authors + real DB authors (author/admin/superadmin)
  const authors = [...getAuthors()];
  const allPosts = await getAllPostsAsync();

  // Build a normalised authorId → posts map. A post stores the author's
  // relational DB id (s.author_id). Some authors appear in the UI under
  // their `username` slug, so we need to map every possible key an author
  // may be referenced by back to the same count.
  const postCounts = new Map<string, number>();
  for (const post of allPosts) {
    const key = (post.authorId || "").toString().toLowerCase().trim();
    if (!key) continue;
    postCounts.set(key, (postCounts.get(key) || 0) + 1);
  }

  // Fetch verification status from DB
  let verifiedUsers = new Set<string>();
  let dbUserById = new Map<string, { id: string; username: string | null; name: string | null; profile_pic: string | null; bio: string | null; is_verified: boolean | null }>();
  try {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    const supabase = getSupabaseAdmin();
    const { data: dbUsers } = await supabase
      .from("users")
      .select("id, username, name, profile_pic, bio, is_verified")
      .in("role", ["author", "admin", "superadmin"]);

    if (dbUsers) {
      for (const u of dbUsers) {
        dbUserById.set(u.id.toLowerCase(), u);
        if (u.username) dbUserById.set(u.username.toLowerCase(), u);
        if (u.is_verified) {
          verifiedUsers.add(u.id.toLowerCase());
          if (u.username) verifiedUsers.add(u.username.toLowerCase());
        }
        // Add DB authors that aren't already in the static list
        const id = u.username || u.id;
        if (!authors.some((a) => a.id === id)) {
          authors.push({
            id,
            name: u.name || u.username || "অজ্ঞাত লেখক",
            image: u.profile_pic || "/images/avatars/1.jpg",
            bio: u.bio || "",
            facebook: "",
            website: "",
          });
        }
      }
    }
  } catch (e) {}

  const isVerified = (authorId: string) => verifiedUsers.has(authorId.toLowerCase());

  // Lookup post count using every key an author may be referenced by:
  // 1) author.id as-is (static slug or username)
  // 2) author.id lowercased (DB ids are stored lower-cased in postCounts)
  // 3) DB row's id / username when an author entry can be tied to a user row
  const countFor = (authorId: string): number => {
    const candidates = new Set<string>();
    const a = (authorId || "").toString();
    if (a) {
      candidates.add(a);
      candidates.add(a.toLowerCase());
    }
    const dbUser = dbUserById.get((authorId || "").toLowerCase());
    if (dbUser) {
      if (dbUser.id) candidates.add(dbUser.id.toLowerCase());
      if (dbUser.username) candidates.add(dbUser.username.toLowerCase());
    }
    let max = 0;
    for (const key of candidates) {
      const n = postCounts.get(key);
      if (typeof n === "number" && n > max) max = n;
    }
    return max;
  };

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-1 w-1 rounded-full bg-fg" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
          লেখকবৃন্দ
        </h2>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg mb-2">
        আমাদের লেখক
      </h1>
      <p className="text-sm text-fg-muted mb-8">
        যারা লিখছেন এই ওয়েবসাইটে
      </p>

      {authors.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-border bg-surface-alt">
          <p className="text-sm text-fg-muted">কোনো লেখক পাওয়া যায়নি</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {authors.map((author) => {
            const count = countFor(author.id);
            const hasSocial = author.website || author.facebook || author.email;
            return (
              <Link
                key={author.id}
                href={`/authors/${author.id}`}
                className="group flex flex-col rounded-2xl border border-border bg-surface p-6 transition-all duration-200 hover:bg-surface-hover hover:-translate-y-1 hover:shadow-md"
              >
                {/* Photo / Initial */}
                <div className="flex items-center gap-4">
                  <Image
                    src={author.image || "/images/avatars/1.jpg"}
                    alt={author.name}
                    width={56}
                    height={56}
                    className="rounded-full object-cover shrink-0 ring-2 ring-border/50 aspect-square"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-fg group-hover:text-fg transition-colors truncate flex items-center gap-1">
                      {author.name}
                      {isVerified(author.id) && <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20 shrink-0" />}
                    </p>
                    <p className="inline-flex items-center gap-1 text-xs text-fg-subtle mt-0.5">
                      <SectionIcon seed={author.id} className="h-8 w-8 shrink-0" />
                      {count}টি লেখা
                    </p>
                  </div>
                </div>

                {/* Bio */}
                {author.bio && (
                  <p className="text-xs text-fg-muted leading-relaxed mt-3 line-clamp-2 min-h-[2.5em]">
                    {author.bio}
                  </p>
                )}

                {/* Social links */}
                {hasSocial && (
                  <div className="flex items-center gap-2 mt-auto pt-4 border-t border-border/50">
                    {author.website && (
                      <span className="p-1.5 rounded-lg text-fg-subtle transition-colors" aria-label="ওয়েবসাইট">
                        <Globe className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {author.facebook && (
                      <span className="p-1.5 rounded-lg text-fg-subtle transition-colors" aria-label="ফেসবুক">
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      </span>
                    )}
                    {author.email && (
                      <span className="p-1.5 rounded-lg text-fg-subtle transition-colors" aria-label="ইমেইল">
                        <Mail className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
