"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Mode = "create" | "reply" | "edit";

interface CommentFormProps {
  postSlug: string;
  mode?: Mode;
  initialContent?: string;
  parentCommentId?: string;
  commentId?: string;
  onSuccess?: (comment?: any) => void;
  onCancel?: () => void;
}

export function CommentForm({
  postSlug,
  mode = "create",
  initialContent = "",
  parentCommentId,
  commentId,
  onSuccess,
  onCancel,
}: CommentFormProps) {
  const { user } = useAuth();
  const [content, setContent] = useState(initialContent);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "deploying" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user) return;

    setStatus("saving");
    setMessage(mode === "edit" ? "Updating comment..." : "Saving comment...");

    try {
      let res;
      if (mode === "edit") {
        res = await fetch(`/api/comments/${commentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
      } else {
        res = await fetch("/api/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postSlug, content, parentCommentId, isSpoiler }),
        });
      }

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "আপনার মন্তব্য সফলভাবে পোস্ট হয়েছে।");
        if (mode === "create") {
          setContent(""); // clear form
          setIsSpoiler(false);
        }
        
        // Let the user see the success message briefly, then refresh
        setTimeout(() => {
          if (onSuccess) onSuccess(data.comment);
        }, 2500);
      } else {
        setStatus("error");
        setMessage(data.error || "Could not save your comment. Please try again.");
      }
    } catch (err) {
      setStatus("error");
      setMessage("Could not save your comment. Please try again.");
    }
  };

  if (status === "success") {
    return (
      <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-800 text-sm">
        {message}
        {(mode === "reply" || mode === "edit") && (
          <button onClick={onCancel} className="ml-3 underline font-medium">Close</button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={mode === "reply" ? "উত্তর লিখুন..." : "মন্তব্য লিখুন..."}
          className="input-field p-3 resize-y min-h-[100px]"
          disabled={status === "saving" || status === "deploying"}
          maxLength={2000}
        />
        
        {status !== "idle" && (
          <div className={`text-sm ${status === "error" ? "text-red-500" : "text-blue-500 dark:text-blue-400 font-medium animate-pulse"}`}>
            {message}
          </div>
        )}

        {mode !== "edit" && (
          <button
            type="button"
            onClick={() => setIsSpoiler(!isSpoiler)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              isSpoiler
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                : "bg-surface text-fg-muted hover:text-fg border-border hover:border-fg/30"
            }`}
            title="মন্তব্যটিকে স্পয়লার হিসেবে চিহ্নিত করুন (ব্লার করা দেখাবে)"
          >
            {isSpoiler ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {isSpoiler ? "স্পয়লার চালু আছে" : "স্পয়লার চিহ্নিত করুন"}
          </button>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!content.trim() || status === "saving" || status === "deploying"}
            className="btn-primary "
          >
            {mode === "edit" ? "Save Edit" : mode === "reply" ? "Reply" : "Comment"}
          </button>
          
          {(mode === "reply" || mode === "edit") && (
            <button
              type="button"
              onClick={onCancel}
              disabled={status === "saving" || status === "deploying"}
              className="px-4 py-2 border border-border bg-surface hover:bg-surface-alt text-fg font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
