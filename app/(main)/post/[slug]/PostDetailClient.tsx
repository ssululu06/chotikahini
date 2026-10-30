"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageCircle, BadgeCheck } from "lucide-react";
import { PostCard } from "@/components/posts/PostCard";
import { bndSafe } from "@/lib/utils";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/contexts/AuthContext";
import type { Post, PostComment } from "@/lib/posts-types";
import { enToBnNumber } from "@/lib/utils";

export default function PostDetailClient({ postId }: { postId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentMsg, setCommentMsg] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [postRes, commentRes] = await Promise.all([
          fetch(`/api/community/posts/${postId}`),
          fetch(`/api/community/posts/${postId}/comment`),
        ]);
        const postJson = await postRes.json();
        const commentJson = await commentRes.json();
        if (postRes.ok && postJson.post) {
          setPost(postJson.post);
        } else {
          setError(postJson.error || "পোস্টটি পাওয়া যায়নি");
        }
        setComments(commentJson.comments || []);
      } catch (e) {
        setError("নেটওয়ার্ক সমস্যা হয়েছে।");
      } finally {
        setLoading(false);
      }
    })();
  }, [postId]);

  const handleComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || !user || commentLoading) return;
    setCommentLoading(true);
    setCommentMsg("");
    try {
      const res = await fetch(`/api/community/posts/${postId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setCommentText("");
        if (json.pendingApproval) {
          setCommentMsg("লিংক থাকায় মন্তব্যটি পর্যালোচনার জন্য সংরক্ষিত হয়েছে।");
        } else {
          setComments((prev) => [...prev, json.comment]);
          setPost((prev) => prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : prev);
        }
      } else {
        setCommentMsg(json.error || "মন্তব্য করতে ব্যর্থ।");
      }
    } catch (e) {
      setCommentMsg("নেটওয়ার্ক সমস্যা হয়েছে।");
    } finally {
      setCommentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container-article py-10">
        <div className="max-w-2xl mx-auto text-center text-fg-muted animate-pulse">লোড হচ্ছে...</div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="container-article py-10">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-lg font-semibold text-fg">{error || "পোস্টটি পাওয়া যায়নি"}</p>
          <Link href="/posts" className="inline-flex items-center gap-2 mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline">
            <ArrowLeft className="w-4 h-4" /> সব পোস্ট দেখুন
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-article py-6 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SocialMediaPosting",
            headline: `@${post.user?.username || ""} এর পোস্ট`,
            text: post.content.slice(0, 300),
            datePublished: post.createdAt,
            dateModified: post.updatedAt || post.createdAt,
            interactionStatistic: [
              { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: post.likesCount },
              { "@type": "InteractionCounter", interactionType: "https://schema.org/ShareAction", userInteractionCount: post.repostsCount },
              { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: post.commentsCount },
            ],
            author: {
              "@type": "Person",
              name: post.user?.name || post.user?.username || "",
              alternateName: post.user?.username || "",
              url: `${window.location.origin}/authors/${encodeURIComponent(post.user?.username || post.userId)}`,
            },
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": `${window.location.origin}/post/${post.id}`,
            },
          }),
        }}
      />
      <div className="max-w-2xl mx-auto space-y-5">
        <Link href="/posts" className="inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg transition-colors">
          <ArrowLeft className="w-4 h-4" /> সব পোস্ট
        </Link>

        <PostCard
          post={post}
          onUpdated={(p) => setPost(p)}
          onDeleted={() => router.push("/posts")}
        />

        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-fg">
            <MessageCircle className="w-5 h-5 text-blue-500" />
            মন্তব্য {post.commentsCount > 0 && <span className="text-sm text-fg-muted font-medium">({enToBnNumber(post.commentsCount)})</span>}
          </h2>

          {user ? (
            <div className="bg-surface-alt rounded-2xl border border-border p-3 flex items-start gap-3">
              <UserAvatar src={user.profilePic} name={user.name || user.username} userId={user.id} size="md" />
              <div className="flex-1 min-w-0">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="মন্তব্য লিখুন..."
                  rows={2}
                  className="w-full bg-transparent resize-none outline-none text-fg text-[15px] leading-relaxed placeholder:text-fg-subtle"
                />
                {commentMsg && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{commentMsg}</p>}
                <div className="flex items-center justify-end mt-1 pt-2 border-t border-border/60">
                  <button
                    onClick={handleComment}
                    disabled={!commentText.trim() || commentLoading}
                    className="px-4 py-1.5 bg-fg text-surface rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
                  >
                    {commentLoading ? "পাঠানো হচ্ছে..." : "মন্তব্য করুন"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-surface-alt rounded-2xl border border-border p-4 text-sm text-fg-muted">
              মন্তব্য করতে লগইন করুন।
            </div>
          )}

          {comments.length === 0 ? (
            <p className="text-sm text-fg-muted italic text-center py-4">এখনো কোনো মন্তব্য নেই।</p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="bg-surface-alt rounded-xl border border-border p-3 flex items-start gap-3">
                  <UserAvatar src={c.user?.profilePic} name={c.user?.name || c.user?.username || ""} userId={c.user?.id} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-fg text-sm">{c.user?.name || c.user?.username}</span>
                      {c.user?.isVerified && (
                        <span className="text-blue-500 shrink-0" title="যাচাইকৃত">
                          <BadgeCheck className="w-4 h-4 fill-blue-500/20" />
                        </span>
                      )}
                      <span className="text-fg-subtle text-xs">@{c.user?.username}</span>
                      <span className="text-fg-subtle text-xs">• {bndSafe(c.createdAt, "datetime")}</span>
                    </div>
                    <p className="mt-1 text-[14px] leading-relaxed text-fg whitespace-pre-wrap break-words">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}