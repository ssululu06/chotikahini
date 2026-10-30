import { redirect } from "next/navigation";
import { getPostBySlugAsync } from "@/lib/posts";
import { getSiteConfig } from "@/lib/config";
import { getSupabaseAdmin } from "@/lib/supabase";
import { buildMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import PostDetailClient from "./PostDetailClient";

interface Props {
  params: { slug: string };
}

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = getSiteConfig();
  const slug = params.slug;

  if (!isNaN(Number(slug))) {
    try {
      const supabase = getSupabaseAdmin();
      const { data: raw } = await supabase
        .from("posts")
        .select("id, content, likes_count, reposts_count, comments_count, created_at, users:user_id ( username, name )")
        .eq("id", Number(slug))
        .eq("status", "published")
        .maybeSingle();

      if (raw) {
        const u = Array.isArray(raw.users) ? raw.users[0] : raw.users;
        const authorName = u?.name || u?.username || "";
        const desc = (raw.content || "").slice(0, 200).replace(/\s+/g, " ").trim();
        const title = `@${u?.username || ""} এর পোস্ট`;
        const baseUrl = site.url.endsWith("/") ? site.url.slice(0, -1) : site.url;

        return buildMetadata({
          title,
          description: desc || "পোস্ট দেখুন",
          url: `${baseUrl}/post/${slug}`,
          type: "article",
          robots: "index, follow",
        });
      }
    } catch (e) {}

    return { title: `পোস্ট #${slug} | ${site.title}` };
  }

  return { title: site.title };
}

export default async function PostDetailPage({ params }: Props) {
  const slug = params.slug;

  if (!isNaN(Number(slug))) {
    return <PostDetailClient postId={slug} />;
  }

  const post = await getPostBySlugAsync(slug);
  if (!post) redirect("/");
  redirect(`/${post.slug}`);
}