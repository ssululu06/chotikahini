"use client";
import { bndSafe } from "@/lib/utils";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, EyeOff, Eye, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

interface Comment {
  id: string;
  postSlug: string;
  postTitle?: string;
  postLink?: string;
  userId: string;
  username: string;
  content: string;
  status: "approved" | "hidden";
  createdAt: string;
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading) {
      const isAllowed = ["superadmin", "admin", "moderator"].includes(user?.role || "");
      if (!user || !isAllowed) {
        router.push("/");
      } else {
        fetchComments();
      }
    }
  }, [user, authLoading, router]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/comments-data");
      if (res.ok) {
        const json = await res.json();
        const sorted = (json.comments || []).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setComments(sorted);
      } else {
        setComments([]);
      }
    } catch (e) {
      console.error(e);
      setError("Failed to fetch comments.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center text-white">Loading...</div>;
  }

  if (!user || !["superadmin", "admin", "moderator"].includes(user.role || "")) {
    return null;
  }

  const handleStatusChange = async (id: string, newStatus: "approved" | "hidden") => {
    try {
      const res = await fetch(`/api/admin/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setComments(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
      } else {
        alert("Failed to update status");
      }
    } catch (e) {
      alert("Failed to update status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this comment?")) return;

    try {
      const res = await fetch(`/api/admin/comments/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setComments(prev => prev.filter(c => c.id !== id));
      } else {
        alert("Failed to delete comment");
      }
    } catch (e) {
      alert("Failed to delete comment");
    }
  };

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-surface flex flex-col md:flex-row">
      <AdminSidebar />
      <main className="flex-1 md:h-screen md:overflow-y-auto p-4 md:p-6 lg:p-8 min-w-0">
        <div className="max-w-7xl mx-auto space-y-6 w-full">
          <header className="flex items-center justify-between gap-3 flex-wrap pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 text-fg-muted hover:text-fg rounded-xl bg-surface-alt border border-border transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-fg">মন্তব্য মডারেশন (Comments)</h1>
              <p className="text-xs text-fg-muted mt-0.5">ব্যবহারকারীদের সমস্ত মন্তব্য অনুমোদন বা নিয়ন্ত্রণ করুন</p>
            </div>
          </div>
          <button 
            onClick={fetchComments}
            className="px-4 py-2 bg-surface-alt border border-border text-xs font-semibold rounded-xl hover:bg-surface-hover transition-colors"
          >
            রিফ্রেশ করুন
          </button>
        </header>

        {error && <div className="p-4 mb-6 bg-red-100 text-red-700 rounded-lg">{error}</div>}

        <div className="bg-surface-alt rounded-xl border border-border overflow-hidden shadow-sm">
          {/* Mobile View Cards */}
          <div className="md:hidden divide-y divide-zinc-200 dark:divide-zinc-800">
            {loading ? (
              <div className="p-6 text-center text-fg-muted animate-pulse">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="p-6 text-center text-fg-muted">No comments found.</div>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-fg text-sm">{comment.username}</span>
                      <span className="text-xs text-fg-muted ml-2">{bndSafe(comment.createdAt, "date")}</span>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                      comment.status === 'approved' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {comment.status}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-lg">
                    &ldquo;{comment.content}&rdquo;
                  </p>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <Link href={comment.postLink || `/${comment.postSlug}`} target="_blank" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline truncate max-w-[240px]">
                      {comment.postTitle || comment.postSlug}
                    </Link>
                    <div className="flex items-center gap-2">
                      {comment.status === 'approved' ? (
                        <button 
                          onClick={() => handleStatusChange(comment.id, 'hidden')}
                          className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded"
                        >
                          <EyeOff className="w-3.5 h-3.5" /> হাইড
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleStatusChange(comment.id, 'approved')}
                          className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> অ্যাপ্রুভ
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(comment.id)}
                        className="p-1 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded"
                        title="ডিলিট করুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-fg-muted dark:text-fg-subtle border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium">Comment</th>
                  <th className="px-6 py-4 font-medium">Post Title</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-fg">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-fg-muted animate-pulse">Loading comments...</td>
                  </tr>
                ) : comments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-fg-muted">No comments found.</td>
                  </tr>
                ) : (
                  comments.map(comment => (
                    <tr key={comment.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-fg">{comment.username}</div>
                        <div className="text-xs text-fg-muted">{bndSafe(comment.createdAt, "date")}</div>
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate" title={comment.content}>
                        {comment.content}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap max-w-[250px] truncate">
                        <Link href={comment.postLink || `/${comment.postSlug}`} target="_blank" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                          {comment.postTitle || comment.postSlug}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          comment.status === 'approved' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {comment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {comment.status === 'approved' ? (
                            <button 
                              onClick={() => handleStatusChange(comment.id, 'hidden')}
                              className="text-yellow-600 hover:text-yellow-700 dark:text-yellow-500 dark:hover:text-yellow-400"
                              title="Hide Comment"
                            >
                              <EyeOff className="w-4 h-4" />
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleStatusChange(comment.id, 'approved')}
                              className="text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400"
                              title="Approve Comment"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleDelete(comment.id)}
                            className="text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
                            title="Delete Comment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
