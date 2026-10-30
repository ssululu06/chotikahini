"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Heart, Repeat2, MessageCircle, MoreHorizontal, Pencil, Trash2, Share2, Check, BookOpen, Ban, ShieldCheck, History, X, BadgeCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { enToBnNumber } from "@/lib/utils";
import { hasPermission, isAdminOrAbove } from "@/lib/permissions";
import { PostHistoryModal } from "@/components/posts/PostHistoryModal";
import { VideoLinkedText } from "@/components/VideoLinkedText";
import type { Post } from "@/lib/posts-types";

interface PostCardProps {
  post: Post;
  onUpdated?: (post: Post) => void;
  onDeleted?: (id: number) => void;
  showActions?: boolean;
}

export function PostCard({ post, onUpdated, onDeleted, showActions = true }: PostCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [liked, setLiked] = useState(!!post.liked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [reposted, setReposted] = useState(!!post.reposted);
  const [repostsCount, setRepostsCount] = useState(post.repostsCount);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const isOwner = user?.id === post.userId;
  const canModerate = isOwner || hasPermission(user?.role, "posts.moderate");
  const canBan = hasPermission(user?.role, "posts.ban");

  const timeLabel = (() => {
    const ts = post.createdAt ? new Date(post.createdAt).getTime() : NaN;
    if (isNaN(ts)) return "";
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "এখনই";
    if (mins < 60) return `${enToBnNumber(mins)} মি.`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${enToBnNumber(hours)} ঘ.`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${enToBnNumber(days)} দিন`;
    return new Date(post.createdAt).toLocaleDateString("bn-BD");
  })();

  const toggleLike = async () => {
    if (!user) return;
    if (busy) return;
    setBusy(true);
    const prev = liked;
    setLiked(!prev);
    setLikesCount((c) => c + (prev ? -1 : 1));
    try {
      const res = await fetch(`/api/community/posts/${post.id}/like`, { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setLiked(json.liked);
        setLikesCount(json.likesCount);
      } else {
        setLiked(prev);
        setLikesCount((c) => c + (prev ? 1 : -1));
      }
    } catch (e) {
      setLiked(prev);
      setLikesCount((c) => c + (prev ? 1 : -1));
    } finally {
      setBusy(false);
    }
  };

  const toggleRepost = async () => {
    if (!user) return;
    if (busy) return;
    setBusy(true);
    const prev = reposted;
    setReposted(!prev);
    setRepostsCount((c) => c + (prev ? -1 : 1));
    try {
      const res = await fetch(`/api/community/posts/${post.id}/repost`, { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setReposted(json.reposted);
        setRepostsCount(json.repostsCount);
      } else {
        setReposted(prev);
        setRepostsCount((c) => c + (prev ? 1 : -1));
      }
    } catch (e) {
      setReposted(prev);
      setRepostsCount((c) => c + (prev ? 1 : -1));
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    const trimmed = editContent.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setEditing(false);
        if (onUpdated) {
          // Prefer the server's re-resolved `videos` — an edit can add or
          // remove a video link, and keeping the stale map would render a
          // player for a URL the author just deleted (or vice versa).
          onUpdated({ ...post, ...json.post, user: post.user, story: post.story });
        }
      }
    } catch (e) {
    } finally {
      setBusy(false);
    }
  };

  const deletePost = async () => {
    if (!confirm("এই পোস্টটি ডিলিট করবেন?")) return;
    try {
      const res = await fetch(`/api/community/posts/${post.id}`, { method: "DELETE" });
      if (res.ok) {
        if (onDeleted) onDeleted(post.id);
        router.refresh();
      }
    } catch (e) {}
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {}
  };

  const displayName = post.user?.name || post.user?.username || "ব্যবহারকারী";

  return (
    <div className="bg-surface-alt rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Link href={`/authors/${encodeURIComponent(post.user?.username || post.userId)}`} className="shrink-0">
            <UserAvatar src={post.user?.profilePic} name={displayName} userId={post.user?.id} size="lg" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/authors/${encodeURIComponent(post.user?.username || post.userId)}`} className="font-bold text-fg hover:underline truncate">
                {displayName}
              </Link>
              <span className="text-fg-subtle text-sm truncate">@{post.user?.username}</span>
              {post.user?.isVerified && (
                <span className="text-blue-500 shrink-0" title="যাচাইকৃত">
                  <BadgeCheck className="w-4 h-4 fill-blue-500/20" />
                </span>
              )}
              <span className="text-fg-subtle text-xs">• {timeLabel}</span>

              <div className="ml-auto relative">
                {canModerate && (
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    className="p-1.5 rounded-lg text-fg-subtle hover:bg-surface-hover hover:text-fg transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                )}
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-8 z-20 w-40 bg-surface rounded-xl border border-border shadow-lg p-1 space-y-0.5">
                      {isOwner && (
                        <button
                          onClick={() => { setEditing(true); setMenuOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-fg hover:bg-surface-hover rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" /> এডিট
                        </button>
                      )}
                      {isAdminOrAbove(user?.role) && (
                        <button
                          onClick={() => { setShowHistory(true); setMenuOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-fg hover:bg-surface-hover rounded-lg transition-colors"
                        >
                          <History className="w-4 h-4" /> ইতিহাস
                        </button>
                      )}
                      {canModerate && (
                        <button
                          onClick={() => { deletePost(); setMenuOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" /> ডিলিট
                        </button>
                      )}
                      {canBan && !isOwner && (
                        <BanAction userId={post.userId} />
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {editing ? (
              <div className="mt-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={3}
                  className="w-full input-field"
                  maxLength={2000}
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    onClick={() => { setEditing(false); setEditContent(post.content); }}
                    className="px-3 py-1.5 text-sm rounded-lg text-fg-muted hover:bg-surface-hover transition-colors"
                  >
                    বাতিল
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={busy || !editContent.trim()}
                    className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    সেভ করুন
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* A video link in the text renders as an inline player
                    (Facebook-style) instead of a bare link; everything else
                    stays plain text. `post.videos` was resolved server-side
                    in the API route — a client component can't read the
                    video_posts table itself. */}
                <VideoLinkedText
                  text={post.content}
                  videos={post.videos}
                  className="block mt-2 text-[15px] leading-relaxed text-fg whitespace-pre-wrap break-words"
                />
                {post.story && (
                  <Link
                    href={`/${post.story.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-3 p-3 bg-surface rounded-xl border border-border hover:border-accent/50 hover:bg-surface-hover transition-all group"
                  >
                    {post.story.cover && (
                      <span className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-border">
                        <Image
                          src={post.story.cover}
                          alt={post.story.title}
                          width={48}
                          height={48}
                          unoptimized
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-500">
                        <BookOpen className="w-3.5 h-3.5" /> গল্প
                      </span>
                      <span className="block text-sm font-medium text-fg group-hover:text-accent truncate">{post.story.title}</span>
                    </span>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        {showActions && (
          <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/60">
            <Link
              href={`/post/${post.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-fg-muted hover:bg-surface-hover hover:text-fg transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              {post.commentsCount > 0 && enToBnNumber(post.commentsCount)}
            </Link>

            <button
              onClick={toggleRepost}
              disabled={!user}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors disabled:opacity-40 ${
                reposted ? "text-emerald-600 dark:text-emerald-400" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
              }`}
              title="রিপোস্ট"
            >
              <Repeat2 className="w-4 h-4" />
              {repostsCount > 0 && enToBnNumber(repostsCount)}
            </button>

            <button
              onClick={toggleLike}
              disabled={!user}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors disabled:opacity-40 ${
                liked ? "text-rose-600 dark:text-rose-400" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
              }`}
              title="লাইক"
            >
              <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
              {likesCount > 0 && enToBnNumber(likesCount)}
            </button>

            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-fg-muted hover:bg-surface-hover hover:text-fg transition-colors"
              title="লিংক কপি"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
              {copied ? "কপি হয়েছে" : ""}
            </button>
          </div>
        )}
      </div>

      {showHistory && (
        <PostHistoryModal postId={post.id} currentContent={post.content} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}

function BanAction({ userId }: { userId: string }) {
  const [banned, setBanned] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/community/posts/ban?userId=${encodeURIComponent(userId)}`);
        const json = await res.json();
        if (active && res.ok) setBanned(!!json.banned);
      } catch (e) {}
    })();
    return () => { active = false; };
  }, [userId]);

  const toggleBan = async () => {
    if (busy || banned === null) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/community/posts/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, banned: !banned }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setBanned(json.banned);
      } else {
        setError(json.error || "অপারেশন ব্যর্থ");
      }
    } catch (e) {
      setError("নেটওয়ার্ক সমস্যা");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={toggleBan}
        disabled={busy || banned === null}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors disabled:opacity-50"
      >
        {banned === true ? <ShieldCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
        {banned === true ? "বান উঠান" : "পোস্টে বান"}
      </button>
      {error && <span className="absolute top-full left-0 text-[10px] text-red-500 mt-0.5">{error}</span>}
    </div>
  );
}