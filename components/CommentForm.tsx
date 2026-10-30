"use client";

import { useState, type FormEvent } from "react";
import { MessageCircle, Send, User, Mail, CheckCircle, AlertCircle, Copy, Check } from "lucide-react";

interface CommentFormProps {
  postId: string;
  postTitle: string;
  postUrl: string;
  commentForm?: {
    action: string;
    entries: {
      postId: string;
      postTitle: string;
      postUrl: string;
      name: string;
      email: string;
      comment: string;
      date: string;
    };
  };
}

export function CommentForm({ postId, postTitle, postUrl, commentForm }: CommentFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [lastComment, setLastComment] = useState<{
    name: string;
    comment: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !comment.trim()) return;

    if (!commentForm) {
      setSubmitted(true);
      setLastComment({ name: name.trim(), comment: comment.trim() });
      return;
    }

    setSending(true);
    setError(null);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    try {
      const res = await fetch("/api/submit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: commentForm.action,
          entries: commentForm.entries,
          values: {
            postId,
            postTitle,
            postUrl,
            name: name.trim(),
            email: email.trim(),
            comment: comment.trim(),
            date: today,
          },
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSubmitted(true);
        setLastComment({ name: name.trim(), comment: comment.trim() });
      } else {
        const msg = data.errors?.join(" ") || "মন্তব্য পাঠাতে সমস্যা হয়েছে।";
        setError(msg);
      }
    } catch {
      setError("মন্তব্য পাঠাতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
    } finally {
      setSending(false);
    }
  };

  const copyToClipboard = async () => {
    if (!lastComment) return;
    const text = JSON.stringify(lastComment, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (submitted && lastComment) {
    return (
      <section className="mt-10 pt-8 border-t border-border">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-fg mb-4">
          <MessageCircle className="h-5 w-5" />
          মন্তব্য
        </h2>
        <div className="rounded-2xl border border-border p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="font-medium text-fg">আপনার মন্তব্য জমা দেওয়া হয়েছে।</span>
          </div>
          <p className="text-xs text-fg-subtle">
            এটি প্রকাশিত হতে কিছু সময় লাগতে পারে।
          </p>
          
        </div>
      </section>
    );
  }

  return (
    <section className="mt-10 pt-8 border-t border-border">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-fg mb-4">
        <MessageCircle className="h-5 w-5" />
        মন্তব্য করুন
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="আপনার নাম"
              required
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-surface text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 transition-shadow"
            />
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ইমেইল (ঐচ্ছিক)"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-surface text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 transition-shadow"
            />
          </div>
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="আপনার মন্তব্য লিখুন..."
          rows={4}
          required
          className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 transition-shadow resize-none"
        />

        <button
          type="submit"
          disabled={sending}
          className={`btn-primary inline-flex items-center gap-2 ${sending ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <Send className="h-4 w-4" />
          {sending ? "পাঠানো হচ্ছে..." : "পাঠান"}
        </button>
      </form>
    </section>
  );
}
