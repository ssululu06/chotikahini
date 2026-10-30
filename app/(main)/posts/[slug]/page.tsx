import { redirect } from "next/navigation";
import { getPostBySlugAsync } from "@/lib/posts";

interface Props {
  params: { slug: string };
}

export function generateStaticParams() {
  return [];
}

export default async function OldPostRedirect({ params }: Props) {
  const post = await getPostBySlugAsync(params.slug);
  if (!post) redirect("/");
  redirect(`/${post.slug}`);
}