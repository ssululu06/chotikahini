"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { PenLine, X, BookOpen, Link as LinkIcon, Video } from "lucide-react";
import { enToBnNumber } from "@/lib/utils";
import { extractOwnVideoId } from "@/lib/video-link-resolver";

const MAX_LENGTH = 2000;

interface PostComposerProps {
  onPosted: (post: any) => void;
  placeholder?: string;
  compact?: boolean;
}

export function PostComposer({ onPosted, placeholder, compact = false }: PostComposerProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [storyLink, setStoryLink] = useState("");
  const [attachedStory, setAttachedStory] = useState<{ slug: string; title: string; cover: string | null } | null>(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyError, setStoryError] = useState("");

  /**
   * A live preview is the only useful affordance here: the server only
   * resolves the link once the post is created, but the author needs to know
   * *while typing* that this is a video link, not just text. The cheap
   * `extractOwnVideoId` test runs on every keystroke and lights up the hint
   * without touching the DB.
   */
  const ownVideoUrl = extractOwnVideoId(content);
  const hasNonVideoLink = (() => {
    const urls = content.match(/https?:\/\/[^\s<>"']+/g) || [];
    return urls.some((u) => !extractOwnVideoId(u));
  })();

  if (!user) {
    return (
      <div className="bg-surface-alt rounded-2xl border border-border p-4 flex items-center gap-3 text-sm text-fg-muted">
        <span className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center shrink-0">
          <PenLine className="w-5 h-5" />
        </span>
        <span>পোস্ট করতে লগইন করুন।</span>
      </div>
    );
  }

  const resolveStory = async () => {
    const url = storyLink.trim();
    if (!url) return;
    setStoryLoading(true);
    setStoryError("");
    try {
      const res = await fetch(`/api/posts/lookup?ref=${encodeURIComponent(url)}`);
      const json = await res.json();
      if (res.ok && json.slug) {
        setAttachedStory({
          slug: json.slug,
          title: json.title || json.slug,
          cover: json.cover || "/images/placeholder.svg",
        });
        setStoryLink("");
      } else {
        setStoryError("গল্পটি পাওয়া যায়নি। সঠিক লিংক দিন।");
      }
    } catch (e) {
      setStoryError("গল্প খুঁজতে ব্যর্থ।");
    } finally {
      setStoryLoading(false);
    }
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError("");
    try {
      const body: any = { content: trimmed };
      if (attachedStory) {
        body.storySlug = attachedStory.slug;
        body.storyTitle = attachedStory.title;
        body.storyCover = attachedStory.cover;
      }
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setContent("");
        setAttachedStory(null);
        if (onPosted) onPosted(json.post);
      } else {
        setError(json.error || "পোস্ট করতে ব্যর্থ।");
      }
    } catch (e) {
      setError("নেটওয়ার্ক সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  const remaining = MAX_LENGTH - content.length;
  const overLimit = content.length > MAX_LENGTH;

  return (
    <div className={`bg-surface-alt rounded-2xl border border-border shadow-sm ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start gap-3">
        <UserAvatar src={user.profilePic} name={user.name || user.username} userId={user.id} size={compact ? "md" : "lg"} />
        <div className="flex-1 min-w-0">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder || "আপনার ভাবনা শেয়ার করুন..."}
            rows={compact ? 2 : 3}
            className="w-full bg-transparent resize-none outline-none text-fg text-[15px] leading-relaxed placeholder:text-fg-subtle"
          />

          {ownVideoUrl && (
            /* Live preview: an inline player for the pasted video link,
               exactly as the published post will render it. The embed URL
               for our own /videos/<id> is a same-site path, so no third-party
               frame or tracking is involved. */
            <div className="mt-2 flex items-start gap-3 p-2.5 bg-surface rounded-xl border border-blue-500/30">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                <Video className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-fg">ভিডিও লিংক পাওয়া গেছে</p>
                <p className="text-[11px] text-fg-muted break-all">/videos/{ownVideoUrl}</p>
                <p className="text-[11px] text-fg-subtle mt-0.5">
                  পোস্ট করলে এখানে সরাসরি ভিডিওটি দেখা যাবে — প্লেয়ার বাটনে ক্লিক করলে চালু হবে।
                </p>
              </div>
            </div>
          )}

          {attachedStory && (
            <div className="mt-2 p-2.5 bg-surface rounded-xl border border-border flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-blue-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg truncate">{attachedStory.title}</p>
                <p className="text-[11px] text-fg-muted">{attachedStory.slug}</p>
              </div>
              <button
                onClick={() => setAttachedStory(null)}
                className="p-1 text-fg-subtle hover:text-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {hasNonVideoLink && (
            /* The API only accepts links we can embed as a video, so flag a
               foreign URL here rather than letting the user fill 2000
               characters and then get a 400. */
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5 shrink-0" />
              শুধু আমাদের সাইটের ভিডিও লিংক (যেমন /videos/…) দেওয়া যাবে।
            </p>
          )}

          {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}

          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/60">
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={storyLink}
                  onChange={(e) => { setStoryLink(e.target.value); setStoryError(""); }}
                  placeholder="গল্পের লিংক দিন... (ঐচ্ছিক)"
                  className="w-44 text-[11px] py-1.5 px-2.5 rounded-lg bg-surface border border-border text-fg placeholder:text-fg-subtle outline-none focus:ring-1 focus:ring-accent"
                />
                {storyLink && (
                  <button
                    onClick={resolveStory}
                    disabled={storyLoading}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-blue-500 hover:text-blue-600 transition-colors"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                  </button>
                )}
                {storyError && <p className="absolute top-full left-0 text-[10px] text-red-500 mt-0.5">{storyError}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-medium ${overLimit ? "text-red-600 dark:text-red-400" : "text-fg-subtle"}`}>
                {enToBnNumber(content.length)}/{enToBnNumber(MAX_LENGTH)}
              </span>
              {content && (
                <button
                  onClick={() => setContent("")}
                  className="p-1.5 rounded-lg text-fg-subtle hover:bg-surface-hover hover:text-fg transition-colors"
                  title="মুছুন"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={!content.trim() || loading || overLimit}
                className="px-4 py-1.5 bg-fg text-surface rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                <PenLine className="w-4 h-4" />
                {loading ? "পোস্ট হচ্ছে..." : "পোস্ট করুন"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}