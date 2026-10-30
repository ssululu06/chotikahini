"use client";

/* eslint-disable @next/next/no-img-element */
import { enToBnNumber } from '@/lib/utils';
import React, { useEffect, useState } from "react";
import { Comment } from "./types";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { CommentForm } from "./CommentForm";
import { CommentItem } from "./CommentItem";
import { AuthModal } from "../auth/AuthModal";

export function CommentSection({ postSlug, authorId }: { postSlug: string; authorId?: string | null }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const canPin = !!authorId && !!user && user.id === authorId;

  const fetchComments = async () => {
    try {
      // URLSearchParams handles the `video:<uuid>` slug used on video pages —
      // hand-concatenating would leave the colon unescaped in the query.
      const qs = new URLSearchParams({ postSlug });
      const res = await fetch(`/api/comments?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (e) {
      console.error("Failed to fetch comments", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCommentSuccess = (newCmt?: Comment) => {
    if (newCmt) {
      setComments(prev => {
        if (prev.some(c => c.id === newCmt.id)) {
          return prev.map(c => c.id === newCmt.id ? newCmt : c);
        }
        return [...prev, newCmt];
      });
    } else {
      fetchComments();
    }
  };

  const handlePinChange = (id: string, isPinned: boolean) => {
    setComments(prev => {
      const updated = prev.map(c => (c.id === id ? { ...c, isPinned } : c));
      updated.sort((a: any, b: any) => {
        if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      return updated;
    });
  };

  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postSlug]);

  // Organize into tree
  const topLevelComments = comments.filter(c => !c.parentCommentId);

  return (
    <div className="mt-12 pt-8 border-t border-border" id="comments">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-bold text-fg">মতামত ({enToBnNumber(comments.length)})</h3>
        <button 
          onClick={fetchComments}
          className="text-sm text-fg-muted hover:text-fg transition-colors flex items-center gap-1"
          title="রিফ্রেশ comments"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          রিফ্রেশ
        </button>
      </div>

      <div className="mb-10 bg-surface rounded-2xl p-6 border border-border shadow-sm">
        {user ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden">
                <UserAvatar src={user.profilePic} name={user.name || user.username} userId={user.id} size="lg" className="w-full h-full rounded-full" />
              </div>
              <div>
                <p className="text-sm font-semibold text-fg">মন্তব্য করছেন: <span className="text-accent">{user.username}</span></p>
              </div>
            </div>
            <CommentForm postSlug={postSlug} mode="create" onSuccess={handleCommentSuccess} />
          </div>
        ) : (
          <div className="text-center py-6">
            <h4 className="text-lg font-medium text-fg mb-2">আলোচনায় যোগ দিন</h4>
            <p className="text-fg-muted text-sm mb-6">মন্তব্য করতে লগিন করুন।</p>
            <button 
              onClick={() => setAuthModalOpen(true)}
              className="btn-primary "
            >
              লগিন করুন
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-center text-fg-muted animate-pulse">মন্তব্য লোড হচ্ছে...</div>
      ) : comments.length === 0 ? (
        <div className="py-10 text-center text-fg-muted italic">এখনো কোনো মন্তব্য নেই। প্রথম মন্তব্য করুন!</div>
      ) : (
        <div className="space-y-6">
          {topLevelComments.map(comment => {
            const replies = comments.filter(c => c.parentCommentId === comment.id);
            return (
              <CommentItem 
                key={comment.id} 
                comment={comment} 
                replies={replies} 
                allComments={comments} 
                postSlug={postSlug} 
                canPin={canPin}
                onCommentSuccess={handleCommentSuccess}
                onPinChange={handlePinChange}
              />
            );
          })}
        </div>
      )}

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
