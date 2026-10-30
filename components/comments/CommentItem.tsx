/* eslint-disable @next/next/no-img-element */
import React, { useState } from "react";
import Link from "next/link";
import { MessageCircle, Pin, Eye, EyeOff } from "lucide-react";
import { Comment } from "./types";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { CommentForm } from "./CommentForm";
import { CommentReactions } from "./CommentReactions";
import { ReportButton } from "@/components/ReportButton";

interface CommentItemProps {
  comment: Comment;
  replies: Comment[];
  allComments: Comment[];
  postSlug: string;
  canPin?: boolean;
  onCommentSuccess?: (cmt?: any) => void;
  onPinChange?: (id: string, isPinned: boolean) => void;
}

function RoleBadge({ role }: { role?: string }) {
  if (role === "author") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ml-1.5">
        লেখক
      </span>
    );
  }
  if (role === "admin" || role === "superadmin") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ml-1.5">
        অ্যাডমিন
      </span>
    );
  }
  return null;
}

export function CommentItem({ comment, replies, allComments, postSlug, canPin, onCommentSuccess, onPinChange }: CommentItemProps) {
  const { user } = useAuth();
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "deleting" | "success" | "error">("idle");
  const [deleteMsg, setDeleteMsg] = useState("");
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [pinned, setPinned] = useState(!!comment.isPinned);

  const isOwner = user?.id === comment.userId;
  const isAdminUser = user?.role === "admin" || user?.role === "superadmin";

  const handleDelete = async () => {
    setDeleteStatus("deleting");
    setDeleteMsg("মুছছে...");
    try {
      const res = await fetch(`/api/comments/${comment.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteStatus("success");
        setDeleteMsg("মন্তব্য মুছে ফেলা হয়েছে।");
      } else {
        const data = await res.json();
        setDeleteStatus("error");
        setDeleteMsg(data.error || "মুছতে সমস্যা হয়েছে");
      }
    } catch (e) {
      setDeleteStatus("error");
      setDeleteMsg("মুছতে সমস্যা হয়েছে");
    }
  };

  const handleTogglePin = async () => {
    setPinning(true);
    try {
      const res = await fetch("/api/comments/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId: comment.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPinned(data.isPinned);
        if (onPinChange) onPinChange(comment.id, data.isPinned);
      }
    } catch (e) {
      // noop
    } finally {
      setPinning(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('bn-BD', { 
      month: 'short', day: 'numeric', year: 'numeric', 
      hour: 'numeric', minute: '2-digit' 
    }).format(d);
  };

  if (deleteStatus === "success") {
    return <div className="p-4 text-sm text-red-500 italic border-l-2 border-red-500 bg-red-50/50 dark:bg-red-900/10 rounded-r-lg my-2">{deleteMsg}</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`p-4 bg-surface rounded-xl border shadow-sm ${pinned ? "border-accent/50 bg-accent/5" : "border-border"}`}>
        {pinned && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-accent uppercase tracking-wider mb-2">
            <Pin className="w-3 h-3" /> লেখক কর্তৃক পিন করা মন্তব্য
          </div>
        )}

        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full aspect-square overflow-hidden bg-accent/10 flex-shrink-0">
              <UserAvatar src={comment.profilePic} name={comment.name || comment.username} userId={comment.userId} size="lg" className="w-full h-full rounded-full" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-1">
                <p className="font-semibold text-sm text-fg">{comment.name || comment.username}</p>
                <RoleBadge role={(comment as any).role} />
                {user && !isOwner && (
                  <Link 
                    href={`/chat?userId=${comment.userId}`}
                    title="বার্তা পাঠান"
                    className="inline-flex items-center text-fg-subtle hover:text-accent p-1 transition-colors ml-1"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
              <p className="text-xs text-fg-muted">
                {formatDate(comment.createdAt)}
                {comment.updatedAt && <span className="ml-1">(সম্পাদিত)</span>}
              </p>
            </div>
          </div>
        </div>

        {isEditing ? (
          <div className="mt-3">
            <CommentForm 
              postSlug={postSlug} 
              mode="edit" 
              initialContent={comment.content} 
              commentId={comment.id}
              onCancel={() => setIsEditing(false)}
              onSuccess={(cmt) => {
                setIsEditing(false);
                if (onCommentSuccess) onCommentSuccess(cmt);
              }}
            />
          </div>
        ) : comment.isSpoiler && !isEditing ? (
          <div className="mt-3">
            <button
              onClick={() => setSpoilerRevealed(!spoilerRevealed)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                spoilerRevealed
                  ? "border-border bg-surface-alt"
                  : "border-amber-300/60 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/20"
              }`}
              title={spoilerRevealed ? "স্পয়লার লুকান" : "স্পয়লার দেখতে ক্লিক করুন"}
            >
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 mb-1.5">
                {spoilerRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {spoilerRevealed ? "স্পয়লার লুকান" : "স্পয়লার! দেখতে ক্লিক করুন"}
              </span>
              <span className={`text-sm text-fg leading-relaxed whitespace-pre-wrap ${spoilerRevealed ? "" : "blur-[5px] select-none pointer-events-none"}`}>
                {comment.content}
              </span>
            </button>
          </div>
        ) : (
          <div className="text-sm text-fg leading-relaxed whitespace-pre-wrap mt-2">
            {comment.content}
          </div>
        )}

        {/* Emoji Reactions */}
        {!isEditing && (
          <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between gap-2 flex-wrap">
            <CommentReactions commentId={comment.id} />
            <ReportButton targetType="comment" targetId={comment.id} />
          </div>
        )}

        {!isEditing && (
          <div className="mt-4 flex items-center gap-4 text-xs font-medium text-fg-muted flex-wrap">
            {user && (
              <button 
                onClick={() => setIsReplying(!isReplying)}
                className="hover:text-accent transition-colors"
              >
                উত্তর দিন
              </button>
            )}
            
            {isOwner && !isDeleting && (
              <>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="hover:text-blue-500 transition-colors"
                >
                  সম্পাদনা
                </button>
                <button 
                  onClick={() => setIsDeleting(true)}
                  className="hover:text-red-500 transition-colors"
                >
                  মুছুন
                </button>
              </>
            )}

            {/* Admin can delete any comment */}
            {isAdminUser && !isOwner && !isDeleting && (
              <button 
                onClick={() => setIsDeleting(true)}
                className="hover:text-red-500 transition-colors"
              >
                মুছুন (অ্যাডমিন)
              </button>
            )}

            {/* Pin / Unpin — story author or admin */}
            {(canPin || isAdminUser) && !isDeleting && (
              <button
                onClick={handleTogglePin}
                disabled={pinning}
                className={`inline-flex items-center gap-1 hover:text-accent transition-colors ${pinned ? "text-accent font-bold" : ""}`}
              >
                <Pin className="w-3 h-3" />
                {pinned ? "পিন খুলুন" : "পিন করুন"}
              </button>
            )}

            {isDeleting && (
              <div className="flex items-center gap-2">
                <span className="text-red-500">নিশ্চিত?</span>
                <button onClick={handleDelete} className="text-red-600 hover:underline">হ্যাঁ</button>
                <button onClick={() => { setIsDeleting(false); setDeleteStatus("idle"); }} className="text-fg hover:underline">না</button>
                {deleteStatus !== "idle" && <span className="ml-2 text-red-500 italic">{deleteMsg}</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {isReplying && (
        <div className="ml-2 sm:ml-4 pl-2 border-l-2 border-border mt-2">
          <CommentForm 
            postSlug={postSlug} 
            mode="reply" 
            parentCommentId={comment.id} 
            onCancel={() => setIsReplying(false)}
            onSuccess={(cmt) => {
              setIsReplying(false);
              if (onCommentSuccess) onCommentSuccess(cmt);
            }}
          />
        </div>
      )}

      {replies.length > 0 && (
        <div className="ml-2 sm:ml-6 pl-2 sm:pl-4 border-l-2 border-border space-y-4 mt-2">
          {replies.map(reply => {
            const childReplies = allComments.filter(c => c.parentCommentId === reply.id);
            return (
              <CommentItem 
                key={reply.id} 
                comment={reply} 
                replies={childReplies} 
                allComments={allComments}
                postSlug={postSlug}
                canPin={canPin}
                onCommentSuccess={onCommentSuccess}
                onPinChange={onPinChange}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
