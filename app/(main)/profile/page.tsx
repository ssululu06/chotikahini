"use client";
import { bndSafe } from "@/lib/utils";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, User as UserIcon, Lock, MessageSquare, Bookmark, Calendar, Activity, Edit2, Clock, Heart, PenTool, Share2, Copy, Check, Users, BadgeCheck, X } from "lucide-react";
import { formatDate , enToBnNumber} from '@/lib/utils';
import { getHistory, type HistoryItem } from '@/lib/history';
import { SubmitStoryForm } from "@/components/author/SubmitStoryForm";
import { BadgesSection } from "@/components/BadgesSection";
import { CountdownTimer } from "@/components/CountdownTimer";
import { UserAvatar } from "@/components/UserAvatar";
import { MyPosts } from "@/components/posts/MyPosts";
import { StoryAnalyticsModal } from "@/components/StoryAnalyticsModal";
import { AvatarPicker } from "@/components/AvatarPicker";

interface UserComment {
  id: string;
  postSlug: string;
  postTitle: string | null;
  content: string;
  createdAt: string;
  status: string;
  parentCommentId: string | null;
}

export default function ProfilePage() {
  const { user, loading, logout, refreshSession } = useAuth();
  const router = useRouter();

  const isAuthorOrAbove = (role: string) => ["author", "admin", "superadmin", "content_manager", "moderator"].includes(role);
  const [activeTab, setActiveTab] = useState<"activity" | "settings" | "author" | "submit-story" | "posts">("author");
  const [copiedLink, setCopiedLink] = useState(false);

  // Reading history (local storage)
  const [readHistory, setReadHistory] = useState<HistoryItem[]>([]);
  // Liked posts
  const [likedPosts, setLikedPosts] = useState<any[]>([]);
  const [likedLoading, setLikedLoading] = useState(false);

  // Settings state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [bio, setBio] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  const [updateStatus, setUpdateStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [updateMsg, setUpdateMsg] = useState("");

  // Author application state
  const [appRealName, setAppRealName] = useState("");
  const [appSampleLink, setAppSampleLink] = useState("");
  const [appMessage, setAppMessage] = useState("");
  const [appStatus, setAppStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [appMsg, setAppMsg] = useState("");
  const [existingApp, setExistingApp] = useState<any>(null);

  // Content state
  const [comments, setComments] = useState<UserComment[]>([]);
  const [postsMap, setPostsMap] = useState<Record<string, string>>({});
  const [contentLoading, setContentLoading] = useState(true);

  // Author stories state
  const [myStories, setMyStories] = useState<any[]>([]);
  const [myStoriesLoading, setMyStoriesLoading] = useState(false);
  const [storyFilter, setStoryFilter] = useState<"all" | "published" | "pending" | "revision_requested" | "rejected" | "draft">("all");
  const [selectedStoryToEdit, setSelectedStoryToEdit] = useState<any>(null);
  const [expandedTimelineSlug, setExpandedTimelineSlug] = useState<string | null>(null);
  const [authorStoriesPage, setAuthorStoriesPage] = useState(1);
  const [copiedStorySlug, setCopiedStorySlug] = useState<string | null>(null);

  const [followersList, setFollowersList] = useState<any[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [showFollowersModal, setShowFollowersModal] = useState(false);

  // Following feed
  const [followingStories, setFollowingStories] = useState<any[]>([]);
  const [followingLoading, setFollowingLoading] = useState(false);

  // Story analytics
  const [storyAnalytics, setStoryAnalytics] = useState<any[]>([]);
  // Story similarity map (uid -> { maxSimilarity, matched })
  const [similarityMap, setSimilarityMap] = useState<Record<string, any>>({});
  // Per-story analytics modal
  const [analyticsStory, setAnalyticsStory] = useState<{ uid: string; title: string } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsPage, setAnalyticsPage] = useState(1);
  const ANALYTICS_PER_PAGE = 5;

  // Verification request modal
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyReason, setVerifyReason] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [verifyMsg, setVerifyMsg] = useState("");
  const [existingVerifyReq, setExistingVerifyReq] = useState<any>(null);

  useEffect(() => {
    fetch("/api/author/verify-request")
      .then(r => r.ok ? r.json() : { request: null })
      .then(d => setExistingVerifyReq(d.request || null))
      .catch(() => {});
  }, [user?.id]);

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyStatus("submitting");
    setVerifyMsg("");
    try {
      const res = await fetch("/api/author/verify-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: verifyReason }),
      });
      const data = await res.json();
      if (res.ok) {
        setVerifyStatus("success");
        setVerifyMsg(data.message || "আবেদন সফলভাবে জমা হয়েছে!");
        setExistingVerifyReq({ status: "pending" });
      } else {
        setVerifyStatus("error");
        setVerifyMsg(data.error || "আবেদন জমা দিতে সমস্যা হয়েছে।");
      }
    } catch {
      setVerifyStatus("error");
      setVerifyMsg("একটি অপ্রত্যাশিত সমস্যা হয়েছে।");
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    setAnalyticsLoading(true);
    fetch("/api/author/story-analytics")
      .then(r => r.ok ? r.json() : { analytics: [] })
      .then(d => setStoryAnalytics(d.analytics || []))
      .catch(() => setStoryAnalytics([]))
      .finally(() => setAnalyticsLoading(false));
  }, [user?.id]);

  // Load similarity data for the author's own stories (id -> max match %)
  useEffect(() => {
    if (!user?.id) return;
    fetch("/api/admin/story-similarity")
      .then(r => r.ok ? r.json() : { results: [] })
      .then(d => {
        const map: Record<string, any> = {};
        for (const r of d.results || []) {
          map[r.uid || r.slug] = r;
        }
        setSimilarityMap(map);
      })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    setFollowingLoading(true);
    fetch("/api/user/following-feed")
      .then(r => r.ok ? r.json() : { stories: [] })
      .then(d => setFollowingStories(d.stories || []))
      .catch(() => setFollowingStories([]))
      .finally(() => setFollowingLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetch(`/api/follow?authorId=${user.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d) {
            setFollowersList(d.followers || []);
            setFollowerCount(d.count || 0);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setProfilePic(user.profilePic || "");
    }
  }, [user, loading, router]);

  // Load reading history from localStorage
  useEffect(() => {
    setReadHistory(getHistory());
  }, []);

  useEffect(() => {
    if (!user) return;
    setLikedLoading(true);
    fetch("/api/likes/user")
      .then(r => r.ok ? r.json() : { posts: [] })
      .then(d => setLikedPosts(d.posts || []))
      .catch(() => setLikedPosts([]))
      .finally(() => setLikedLoading(false));

    setMyStoriesLoading(true);
    fetch("/api/author/my-stories?brief=1")
      .then(r => r.ok ? r.json() : { stories: [] })
      .then(d => setMyStories(d.stories || []))
      .catch(() => setMyStories([]))
      .finally(() => setMyStoriesLoading(false));
  }, [user]);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        const [commentsRes, postsRes, appRes] = await Promise.all([
          fetch("/api/comments/all"),
          fetch("/api/posts"),
          fetch("/api/author-apply")
        ]);

        if (appRes.ok) {
          const aData = await appRes.json();
          setExistingApp(aData.application || null);
        }

        if (postsRes.ok) {
          const pData = await postsRes.json();
          const map: Record<string, string> = {};
          pData.forEach((p: any) => map[p.slug] = p.title);
          setPostsMap(map);
        }

        if (commentsRes.ok) {
          const json = await commentsRes.json();
          const myComments = (json.comments || [])
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
          setComments(myComments);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setContentLoading(false);
      }
    }
    fetchData();
  }, [user]);

  if (loading || !user) {
    return <div className="min-h-[50vh] flex items-center justify-center">Loading...</div>;
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateStatus("saving");
    setUpdateMsg("প্রোফাইল আপডেট হচ্ছে...");

    try {
      const payload: any = { name, email, profilePic, bio };
      if (currentPassword && newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await fetch("/api/auth/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setUpdateStatus("success");
        setUpdateMsg(data.passwordChanged ? "প্রোফাইল ও পাসওয়ার্ড সফলভাবে আপডেট হয়েছে! পরিবর্তনগুলো দেখতে কয়েক মিনিট সময় লাগতে পারে।" : "প্রোফাইল সফলভাবে আপডেট হয়েছে! পরিবর্তনগুলো দেখতে কয়েক মিনিট সময় লাগতে পারে।");
        setCurrentPassword("");
        setNewPassword("");
        await refreshSession();
      } else {
        setUpdateStatus("error");
        setUpdateMsg(data.error || "প্রোফাইল আপডেট করতে সমস্যা হয়েছে");
      }
    } catch (e) {
      setUpdateStatus("error");
      setUpdateMsg("একটি অপ্রত্যাশিত সমস্যা হয়েছে");
    }
  };

  const handleApplyAuthor = async (e: React.FormEvent) => {
    e.preventDefault();
    setAppStatus("submitting");
    setAppMsg("আবেদন জমা হচ্ছে...");

    try {
      const res = await fetch("/api/author-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realName: appRealName, sampleLink: appSampleLink, message: appMessage })
      });
      const data = await res.json();
      
      if (res.ok) {
        setAppStatus("success");
        setAppMsg("আবেদন সফলভাবে জমা হয়েছে! শীঘ্রই অ্যাডমিন পর্যালোচনা করবেন।");
      } else {
        setAppStatus("error");
        setAppMsg(data.error || "আবেদন জমা দিতে সমস্যা হয়েছে।");
      }
    } catch (e) {
      setAppStatus("error");
      setAppMsg("একটি অপ্রত্যাশিত সমস্যা হয়েছে");
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const myComments = comments.filter(c => !c.parentCommentId);
  const myReplies = comments.filter(c => c.parentCommentId);

  return (
    <div className="container-page py-10">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Sidebar */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-surface border border-border p-6 rounded-2xl text-center shadow-sm">
            <div className="mb-4 mx-auto flex justify-center">
              <UserAvatar src={user.profilePic} name={user.name || user.username} userId={user.id} size="3xl" />
            </div>
            <h2 className="text-xl font-bold text-fg flex items-center justify-center gap-1.5">
              {user.name || user.username}
              {(user as any).isVerified && (
                <span className="inline-flex items-center justify-center" title="যাচাইকৃত লেখক">
                  <svg className="w-5 h-5 text-blue-500 fill-blue-500/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>
                </span>
              )}
            </h2>
            <p className="text-fg-muted font-mono text-sm mt-0.5">@{user.username}</p>
            
            <button
              onClick={() => setShowFollowersModal(true)}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold text-xs rounded-full border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
            >
              <Users className="w-3.5 h-3.5" /> ফলোয়ার: {enToBnNumber(followerCount)} জন
            </button>
            
            {(user as any).bio && (
              <p className="text-xs text-fg-muted italic my-3 px-2 line-clamp-3">
                {(user as any).bio}
              </p>
            )}
            
            {user.createdAt && (
              <p className="text-xs text-fg-subtle flex items-center justify-center gap-1.5 bg-surface-alt rounded-lg py-1.5 px-2">
                <Calendar className="w-3.5 h-3.5" />
                যোগদান {bndSafe(user.createdAt, "date")}
              </p>
            )}

            {isAuthorOrAbove(user.role || "") && (
              <>
              <div className="mt-4 p-3 bg-surface-alt border border-border rounded-xl">
                <p className="text-[11px] font-bold text-fg-muted uppercase tracking-wider mb-2 text-left">আপনার পাবলিক প্রোফাইল</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-fg-subtle truncate text-left" title={`${window.location.origin}/authors/${user.username}`}>
                    {`${window.location.origin}/authors/${user.username}`}
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/authors/${user.username}`);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="p-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg transition-colors shrink-0"
                    title="লিংক কপি করুন"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <Link 
                    href={`/authors/${user.username}`}
                    target="_blank"
                    className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg transition-colors shrink-0"
                    title="প্রোফাইল ভিজিট করুন"
                  >
                    <Share2 className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Verified badge application */}
              <div className="mt-3 p-3 bg-surface-alt border border-border rounded-xl">
                <p className="text-[11px] font-bold text-fg-muted uppercase tracking-wider mb-2 text-left flex items-center gap-1">
                  <BadgeCheck className="w-3.5 h-3.5 text-blue-500" /> ভেরিফাইড ব্যাজ
                </p>
                {(user as any).isVerified ? (
                  <p className="text-xs text-green-600 dark:text-green-400 font-semibold text-left flex items-center gap-1.5">
                    <BadgeCheck className="w-4 h-4" /> আপনার ব্যাজ অনুমোদিত
                  </p>
                ) : (
                  <button
                    onClick={() => setShowVerifyModal(true)}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    ভেরিফিকেশন ব্যাজের জন্য আবেদন করুন
                  </button>
                )}
              </div>
              </>
            )}

            <div className="mt-6 flex flex-col gap-2">
              <button 
                onClick={() => setActiveTab("author")}
                className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2.5 ${activeTab === 'author' ? 'bg-fg text-surface shadow-sm' : 'text-fg-muted hover:bg-surface-hover hover:text-fg'}`}
              >
                <PenTool className="w-4 h-4 text-accent" /> আমার ড্যাশবোর্ড
              </button>
              <button 
                onClick={() => setActiveTab("activity")}
                className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2.5 ${activeTab === 'activity' ? 'bg-fg text-surface shadow-sm' : 'text-fg-muted hover:bg-surface-hover hover:text-fg'}`}
              >
                <Activity className="w-4 h-4 text-blue-500" /> আমার অ্যাক্টিভিটি
              </button>
              <button 
                onClick={() => setActiveTab("posts")}
                className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2.5 ${activeTab === 'posts' ? 'bg-fg text-surface shadow-sm' : 'text-fg-muted hover:bg-surface-hover hover:text-fg'}`}
              >
                <MessageSquare className="w-4 h-4 text-amber-500" /> আমার পোস্ট
              </button>
              {isAuthorOrAbove(user.role || "") && (
                <button 
                  onClick={() => { setActiveTab("submit-story"); setSelectedStoryToEdit(null); }}
                  className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2.5 ${activeTab === 'submit-story' ? 'bg-fg text-surface shadow-sm' : 'text-fg-muted hover:bg-surface-hover hover:text-fg'}`}
                >
                  <Edit2 className="w-4 h-4 text-emerald-500" /> গল্প লিখুন
                </button>
              )}
              <button 
                onClick={() => setActiveTab("settings")}
                className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2.5 ${activeTab === 'settings' ? 'bg-fg text-surface shadow-sm' : 'text-fg-muted hover:bg-surface-hover hover:text-fg'}`}
              >
                <UserIcon className="w-4 h-4 text-purple-500" /> সেটিংস
              </button>
            </div>
            
            <button 
              onClick={handleLogout}
              className="mt-6 flex items-center justify-center gap-2 w-full py-2 border border-red-200 dark:border-red-900/50 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium text-sm"
            >
              <LogOut className="w-4 h-4" />
              লগআউট</button>
          </div>
        </div>

        {/* Main Content */}
        <div className="md:col-span-3">
          
          {activeTab === "activity" && (
            <div className="space-y-8 animate-fade-in">
              {/* Achievements & Level (full width) */}
              <BadgesSection
                readCount={readHistory.length}
                publishedCount={myStories.filter((s: any) => s.status === "published").length}
                savedCount={user.savedPosts?.length || 0}
              />

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm hover:border-accent/30 transition-colors">
                  <span className="text-3xl font-bold text-fg mb-1">{enToBnNumber(myComments.length)}</span>
                  <span className="text-xs text-fg-muted uppercase tracking-wider font-semibold">মতামত</span>
                </div>
                <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm hover:border-accent/30 transition-colors">
                  <span className="text-3xl font-bold text-fg mb-1">{enToBnNumber(myReplies.length)}</span>
                  <span className="text-xs text-fg-muted uppercase tracking-wider font-semibold">উত্তর</span>
                </div>
                <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm hover:border-accent/30 transition-colors">
                  <span className="text-3xl font-bold text-fg mb-1">{enToBnNumber(user.savedPosts?.length || 0)}</span>
                  <span className="text-xs text-fg-muted uppercase tracking-wider font-semibold">সংরক্ষিত</span>
                </div>
              </div>

              {/* Feed Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Comments & Replies */}
                <div className="space-y-6">
                  <section className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-border bg-surface-alt flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-accent" />
                      <h3 className="font-bold text-fg">আমার মতামত ও উত্তর</h3>
                    </div>
                    <div className="p-5">
                      {contentLoading ? (
                        <div className="text-center text-fg-muted animate-pulse py-8 text-sm">লোড হচ্ছে...</div>
                      ) : comments.length === 0 ? (
                        <div className="text-center text-fg-muted italic py-8 text-sm">কোনো অ্যাক্টিভিটি নেই।</div>
                      ) : (
                        <div className="space-y-4">
                          {comments.map((comment) => (
                            <div key={comment.id} className="p-3 bg-surface-alt rounded-xl border border-border">
                              <div className="flex justify-between items-start mb-2">
                                <Link href={`/${comment.postSlug}#comment-${comment.id}`} className="text-sm font-medium text-accent hover:underline line-clamp-1">
                                  {comment.postTitle || comment.postSlug}
                                </Link>
                              </div>
                              <p className="text-sm text-fg line-clamp-2">
                                {comment.parentCommentId && <span className="text-xs font-semibold text-fg-subtle bg-surface border border-border px-1.5 py-0.5 rounded mr-1">উত্তর</span>}
                                {comment.content}
                              </p>
                              <div className="flex justify-between items-center mt-2">
                                <span className="text-[10px] text-fg-muted">{formatDate(comment.createdAt)}</span>
                                {comment.status === 'hidden' && (
                                  <span className="text-[10px] font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded">
                                    লুকানো
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                {/* Saved Posts */}
                <div className="space-y-6">
                  <section className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-border bg-surface-alt flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-accent" />
                      <h3 className="font-bold text-fg">সংরক্ষিত গল্প</h3>
                    </div>
                    <div className="p-5">
                      {!user.savedPosts || user.savedPosts.length === 0 ? (
                        <div className="text-center text-fg-muted italic py-8 text-sm">কোনো সংরক্ষিত গল্প নেই।</div>
                      ) : (
                        <div className="space-y-3">
                          {user.savedPosts.map((slug) => (
                            <Link key={slug} href={`/${slug}`} className="block p-3 bg-surface-alt rounded-xl border border-border hover:border-accent/50 transition-all group">
                              <p className="text-sm font-medium text-fg group-hover:text-accent line-clamp-2">
                                {postsMap[slug] || slug}
                              </p>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                </div>

              </div>

              {/* Reading History */}
              <section className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-border bg-surface-alt flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent" />
                  <h3 className="font-bold text-fg">সম্প্রতি পঠিত</h3>
                </div>
                <div className="p-5">
                  {readHistory.length === 0 ? (
                    <div className="text-center text-fg-muted italic py-8 text-sm">সম্প্রতি কোনো গল্প পড়া হয়নি।</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {readHistory.slice(0, 5).map((item) => (
                        <Link key={item.slug} href={`/${item.slug}`} className="group block rounded-xl overflow-hidden border border-border hover:border-accent/50 transition-all bg-surface-alt">
                          {item.cover ? (
                            <div className="h-24 overflow-hidden relative">
                              <Image src={item.cover} alt={item.title} fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-300" />
                            </div>
                          ) : (
                            <div className="h-24 bg-surface-alt flex items-center justify-center">
                              <Clock className="w-6 h-6 text-fg-subtle" />
                            </div>
                          )}
                          <div className="p-2">
                            <p className="text-xs font-medium text-fg line-clamp-2">{item.title}</p>
                            <p className="text-[10px] text-fg-muted mt-0.5">{formatDate(item.readAt)}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Following Feed — new stories from followed authors */}
              <section className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-border bg-surface-alt flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <h3 className="font-bold text-fg">ফলো করা লেখকদের নতুন গল্প</h3>
                  <span className="ml-auto text-xs text-fg-muted">{enToBnNumber(followingStories.length)}টি</span>
                </div>
                <div className="p-5">
                  {followingLoading ? (
                    <div className="text-center text-fg-muted animate-pulse py-8 text-sm">লোড হচ্ছে...</div>
                  ) : followingStories.length === 0 ? (
                    <div className="text-center text-fg-muted italic py-8 text-sm">
                      আপনি কোনো লেখককে ফলো করেননি বা নতুন গল্প নেই। লেখক প্রোফাইলে গিয়ে ফলো করুন!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {followingStories.slice(0, 8).map((story) => (
                        <Link key={story.uid || story.slug} href={`/${story.uid || story.slug}`} className="group flex items-start gap-3 p-3 bg-surface-alt rounded-xl border border-border hover:border-accent/50 transition-all">
                          {story.cover ? (
                            <div className="w-16 h-14 rounded-lg overflow-hidden shrink-0 relative">
                              <Image src={story.cover} alt={story.title} fill sizes="64px" className="object-cover group-hover:scale-105 transition-transform duration-300" />
                            </div>
                          ) : (
                            <div className="w-16 h-14 bg-surface rounded-lg flex items-center justify-center shrink-0 border border-border">
                              <Heart className="w-5 h-5 text-fg-subtle" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-fg group-hover:text-accent line-clamp-1">{story.title}</p>
                            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-fg-muted">
                              <span className="inline-flex items-center gap-1 font-semibold text-blue-500">
                                {story.authorProfilePic && (
                                  <div className="w-3.5 h-3.5 rounded-full overflow-hidden shrink-0 relative inline-block">
                                    <Image src={story.authorProfilePic} alt="" fill sizes="14px" className="object-cover" unoptimized />
                                  </div>
                                )}
                                @{story.authorUsername}
                              </span>
                              <span>•</span>
                              <span>{formatDate(story.createdAt)}</span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Liked Posts */}
              <section className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-border bg-surface-alt flex items-center gap-2">
                  <Heart className="w-4 h-4 text-accent" />
                  <h3 className="font-bold text-fg">পছন্দের গল্প</h3>
                </div>
                <div className="p-5">
                  {likedLoading ? (
                    <div className="text-center text-fg-muted animate-pulse py-8 text-sm">লোড হচ্ছে...</div>
                  ) : likedPosts.length === 0 ? (
                    <div className="text-center text-fg-muted italic py-8 text-sm">কোনো পছন্দ করা গল্প নেই।</div>
                  ) : (
                    <div className="space-y-3">
                      {likedPosts.map((post: any) => (
                        <Link key={post.slug} href={`/${post.uid || post.slug}`} className="block p-3 bg-surface-alt rounded-xl border border-border hover:border-accent/50 transition-all group">
                          <p className="text-sm font-medium text-fg group-hover:text-accent line-clamp-2">
                            {postsMap[post.slug] || post.slug}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>

            </div>
          )}

          {activeTab === "settings" && (
            <div className="animate-fade-in space-y-8">
              <section className="bg-surface border border-border p-6 md:p-8 rounded-2xl shadow-sm">
                <h3 className="text-xl font-bold text-fg mb-6 flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-accent" />
                  প্রোফাইল সেটিংস
                </h3>
                
                {updateStatus === "success" && (
                  <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-800 text-sm">
                    {updateMsg}
                  </div>
                )}
                
                {updateStatus === "error" && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800 text-sm">
                    {updateMsg}
                  </div>
                )}

                <form onSubmit={handleUpdate} className="space-y-6">
                  <div className="space-y-4 max-w-lg">
                    <div>
                      <label className="block text-sm font-medium text-fg-muted mb-1 flex items-center justify-between">
                        <span>ইউজারনেম (স্থায়ী)</span>
                        <span className="text-[10px] text-fg-subtle">ইউজারনেম পরিবর্তনযোগ্য নয়</span>
                      </label>
                      <input
                        type="text"
                        disabled
                        value={`@${user.username}`}
                        className="input-field bg-surface-alt/70 text-fg-muted cursor-not-allowed opacity-80 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fg-muted mb-1">প্রদর্শন নাম (Display Name)</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="input-field "
                        placeholder="যেমন: রাহেলা বেগম"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fg-muted mb-1">ইমেইল</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input-field "
                        placeholder="যেমন: you@example.com"
                      />
                    </div>
                    <div>
                      <AvatarPicker value={profilePic} onChange={setProfilePic} />
                      {profilePic && (
                        <div className="mt-3 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full overflow-hidden border border-border shadow-sm relative">
                            <Image src={profilePic} alt="Preview" fill sizes="48px" className="object-cover" unoptimized />
                          </div>
                          <span className="text-xs text-fg-subtle font-medium">প্রোফাইল পিক প্রিভিউ</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fg-muted mb-1">বায়ো / পরিচিতি (Bio)</label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="input-field h-20 resize-none"
                        placeholder="আপনার নিজের সম্পর্কে সংক্ষিপ্ত পরিচিতি লিখুন..."
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-border space-y-4 max-w-lg">
                    <h4 className="text-lg font-bold text-fg flex items-center gap-2">
                      <Lock className="w-4 h-4 text-accent" />
                      পাসওয়ার্ড পরিবর্তন
                    </h4>
                    <div>
                      <label className="block text-sm font-medium text-fg-muted mb-1">বর্তমান পাসওয়ার্ড</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="input-field "
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fg-muted mb-1">নতুন পাসওয়ার্ড</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input-field "
                        minLength={6}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={updateStatus === "saving"}
                    className="btn-primary "
                  >
                    {updateStatus === "saving" ? "সংরক্ষণ হচ্ছে..." : "পরিবর্তন সংরক্ষণ করুন"}
                  </button>
                </form>
              </section>
            </div>
          )}

          {activeTab === "submit-story" && (
            <div className="animate-fade-in space-y-8">
              <SubmitStoryForm initialStoryData={selectedStoryToEdit} />
            </div>
          )}

          {activeTab === "posts" && (
            <div className="animate-fade-in space-y-6">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-bold text-fg">আমার পোস্ট</h3>
              </div>
              <MyPosts userId={user?.id} />
            </div>
          )}

          {activeTab === "author" && (
            <div className="animate-fade-in space-y-8">
              {user.role !== "user" || existingApp?.status === "approved" ? (
                <div className="space-y-6">
                  {/* Author Overview Header */}
                  <div className="bg-surface border border-border p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-fg">আমার ওয়ার্কস্পেস (Author Workspace)</h3>
                        <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          রোল: {user.role || "author"}
                        </span>
                      </div>
                      <p className="text-xs text-fg-muted mt-1">এখানে আপনার সকল গল্পের স্ট্যাটাস, টাইমলাইন, এডমিন পরামর্শ ও রিসাবমিট অপশন রয়েছে।</p>
                    </div>

                    <button
                      onClick={() => { setActiveTab("submit-story"); setSelectedStoryToEdit(null); }}
                      className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shrink-0"
                    >
                      <PenTool className="w-3.5 h-3.5" /> + নতুন গল্প লিখুন
                    </button>
                  </div>

                  {/* Real-time Overview Statistics Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                      { key: "all", label: "মোট গল্প", count: myStories.length, color: "border-border bg-surface" },
                      { key: "published", label: "প্রকাশিত", count: myStories.filter(s => s.status === "published").length, color: "border-green-300 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20 text-green-700 dark:text-green-300" },
                      { key: "pending", label: "অপেক্ষমাণ", count: myStories.filter(s => s.status === "pending").length, color: "border-amber-300 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300" },
                      { key: "revision_requested", label: "সংশোধন প্রস্তাব", count: myStories.filter(s => s.status === "revision_requested").length, color: "border-blue-300 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300" },
                      { key: "rejected", label: "প্রত্যাখ্যাত", count: myStories.filter(s => s.status === "rejected").length, color: "border-red-300 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 text-red-700 dark:text-red-300" },
                      { key: "draft", label: "ড্রাফট", count: myStories.filter(s => s.status === "draft").length, color: "border-zinc-300 dark:border-zinc-800 bg-surface-alt text-fg-muted" },
                    ].map(stat => (
                      <button
                        key={stat.key}
                        onClick={() => { setStoryFilter(stat.key as any); setAuthorStoriesPage(1); }}
                        className={`p-3 rounded-2xl border text-left transition-all hover:scale-[1.02] ${stat.color} ${
                          storyFilter === stat.key ? "ring-2 ring-accent font-bold" : ""
                        }`}
                      >
                        <span className="text-[11px] block font-medium opacity-80">{stat.label}</span>
                        <span className="text-xl font-extrabold block mt-0.5">{enToBnNumber(stat.count)}</span>
                      </button>
                    ))}
                  </div>

                  {/* Story Analytics */}
                  <section className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-border bg-surface-alt flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-500" />
                      <h3 className="font-bold text-fg">গল্পের পারফরম্যান্স (Analytics)</h3>
                      <span className="ml-auto text-xs text-fg-muted">পাঠক-পড়ার অগ্রগতি ও এনগেজমেন্ট</span>
                    </div>
                    <div className="p-5">
                      {analyticsLoading ? (
                        <div className="text-center text-fg-muted animate-pulse py-6 text-sm">অ্যানালিটিক্স লোড হচ্ছে...</div>
                      ) : storyAnalytics.length === 0 ? (
                        <div className="text-center text-fg-muted italic py-6 text-sm">
                          কোনো পরিসংখ্যান নেই। গল্প প্রকাশের পর এখানে ভিউ, লাইক ও পড়ার অগ্রগতি দেখা যাবে।
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2.5">
                            {storyAnalytics.slice((analyticsPage - 1) * ANALYTICS_PER_PAGE, analyticsPage * ANALYTICS_PER_PAGE).map((a: any) => (
                            <div key={a.uid || a.slug} className="p-3.5 rounded-xl border border-border bg-surface-alt space-y-2.5">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-fg line-clamp-1">{a.title}</p>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                  a.status === "published" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                }`}>
                                  {a.status === "published" ? "প্রকাশিত" : a.status}
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-2 text-center">
                                <div className="bg-surface rounded-lg py-2 px-1 border border-border">
                                  <p className="text-base font-extrabold text-fg">{enToBnNumber(a.views)}</p>
                                  <p className="text-[9px] text-fg-muted font-semibold uppercase tracking-wide">ভিউ</p>
                                </div>
                                <div className="bg-surface rounded-lg py-2 px-1 border border-border">
                                  <p className="text-base font-extrabold text-fg">{enToBnNumber(a.uniqueReaders)}</p>
                                  <p className="text-[9px] text-fg-muted font-semibold uppercase tracking-wide">পাঠক</p>
                                </div>
                                <div className="bg-surface rounded-lg py-2 px-1 border border-border">
                                  <p className="text-base font-extrabold text-rose-500">{enToBnNumber(a.likes)}</p>
                                  <p className="text-[9px] text-fg-muted font-semibold uppercase tracking-wide">লাইক</p>
                                </div>
                                <div className="bg-surface rounded-lg py-2 px-1 border border-border">
                                  <p className="text-base font-extrabold text-blue-500">{enToBnNumber(a.comments)}</p>
                                  <p className="text-[9px] text-fg-muted font-semibold uppercase tracking-wide">মতামত</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-surface border border-border rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
                                    style={{ width: `${a.avgCompletion}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-fg-muted font-semibold shrink-0">
                                  গড় পড়া: {enToBnNumber(a.avgCompletion)}%
                                </span>
                              </div>
                            </div>
                          ))}
                          </div>

                          {/* Analytics Pagination */}
                          {(() => {
                            const totalAPages = Math.ceil(storyAnalytics.length / ANALYTICS_PER_PAGE);
                            if (totalAPages <= 1) return null;
                            return (
                              <div className="mt-4 p-3 bg-surface-alt border border-border rounded-xl flex items-center justify-between gap-2 text-xs">
                                <span className="text-fg-muted font-medium">
                                  পেজ {enToBnNumber(analyticsPage)} / {enToBnNumber(totalAPages)} (মোট {enToBnNumber(storyAnalytics.length)}টি)
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    disabled={analyticsPage === 1}
                                    onClick={() => setAnalyticsPage(p => Math.max(1, p - 1))}
                                    className="px-2.5 py-1 rounded-lg bg-surface border border-border disabled:opacity-40 font-medium"
                                  >
                                    আগেরটি
                                  </button>
                                  <button
                                    disabled={analyticsPage === totalAPages}
                                    onClick={() => setAnalyticsPage(p => Math.min(totalAPages, p + 1))}
                                    className="px-2.5 py-1 rounded-lg bg-surface border border-border disabled:opacity-40 font-medium"
                                  >
                                    পরবর্তী
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </section>

                  {/* Stories Filter Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border">
                    {[
                      { key: "all", label: "সব গল্প" },
                      { key: "published", label: "প্রকাশিত" },
                      { key: "pending", label: "অপেক্ষমাণ" },
                      { key: "revision_requested", label: "সংশোধন প্রস্তাব" },
                      { key: "rejected", label: "প্রত্যাখ্যাত" },
                      { key: "draft", label: "ড্রাফট" },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => { setStoryFilter(tab.key as any); setAuthorStoriesPage(1); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                          storyFilter === tab.key
                            ? "bg-fg text-surface shadow-sm"
                            : "text-fg-muted hover:text-fg hover:bg-surface-hover"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Written Stories List */}
                  <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden p-5 space-y-4">
                    {(() => {
                      const filteredList = myStories.filter(s => storyFilter === "all" ? true : s.status === storyFilter);
                      const totalAuthorPages = Math.ceil(filteredList.length / 5) || 1;
                      const paginatedList = filteredList.slice((authorStoriesPage - 1) * 5, authorStoriesPage * 5);

                      return (
                        <>
                          <h4 className="text-base font-bold text-fg flex items-center gap-2 border-b border-border pb-3">
                            <PenTool className="w-4 h-4 text-accent" /> আমার গল্পের তালিকা ({filteredList.length}টি)
                          </h4>

                          {myStoriesLoading ? (
                            <div className="p-8 text-center text-sm text-fg-muted animate-pulse">গল্পের তালিকা লোড হচ্ছে...</div>
                          ) : filteredList.length === 0 ? (
                            <div className="p-8 text-center text-sm text-fg-muted italic">এই ক্যাটাগরিতে কোনো গল্প পাওয়া যায়নি।</div>
                          ) : (
                            <>
                              <div className="divide-y divide-border">
                                {paginatedList.map((story) => {
                                  const words = story.wordCount || (story.content ? story.content.trim().split(/\s+/).length : 0);
                                  const readMins = Math.max(1, Math.ceil(words / 180));
                                  const isTimelineOpen = expandedTimelineSlug === story.slug;

                                  return (
                                    <div key={story.slug} className="py-4 space-y-3">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                          <h5 className="font-bold text-fg text-base">{story.title}</h5>
                                          <div className="flex items-center flex-wrap gap-2 text-xs text-fg-muted mt-1">
                                            {(() => {
                                              const sim = similarityMap[story.uid || story.slug];
                                              if (sim) {
                                                return (
                                                  <span
                                                    title={sim.matched ? `"${sim.matched.title}" গল্পের সাথে মিল` : ""}
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                      sim.maxSimilarity >= 70
                                                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                        : sim.maxSimilarity >= 40
                                                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                    }`}
                                                  >
                                                    {sim.maxSimilarity}% মিল
                                                  </span>
                                                );
                                              }
                                              return null;
                                            })()}
                                            <span className="bg-surface-alt px-2 py-0.5 rounded border border-border font-mono">{story.category}</span>
                                            <span>&bull;</span>
                                            <span>জমা: {bndSafe(story.publishedAt, "date")}</span>
                                            <span>&bull;</span>
                                            <span>{enToBnNumber(words)} শব্দ (~{enToBnNumber(readMins)} মিনিট পড়া)</span>
                                            {story.version > 1 && (
                                              <>
                                                <span>&bull;</span>
                                                <span className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">
                                                  v{story.version}
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                          {story.status === "published" && (
                                            <>
                                              <Link href={`/${story.uid || story.slug}`} target="_blank" className="btn-secondary text-xs px-3 py-1.5">
                                                গল্পটি পড়ুন &rarr;
                                              </Link>
                                              <button
                                                type="button"
                                                onClick={() => setAnalyticsStory({ uid: story.uid || story.slug, title: story.title })}
                                                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                                                title="গল্পের পরিসংখ্যান"
                                              >
                                                <Activity className="w-3.5 h-3.5" /> পরিসংখ্যান
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const url = `${window.location.origin}/${story.uid || story.slug}`;
                                                  navigator.clipboard.writeText(url);
                                                  setCopiedStorySlug(story.slug);
                                                  setTimeout(() => setCopiedStorySlug(null), 2000);
                                                }}
                                                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 text-accent border-accent/30 hover:bg-accent/10"
                                                title="গল্পের লিঙ্ক কপি করুন"
                                              >
                                                {copiedStorySlug === story.slug ? (
                                                  <>
                                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                                    <span className="text-green-600 dark:text-green-400 font-bold">কপি হয়েছে!</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Copy className="w-3.5 h-3.5" />
                                                    <span>লিঙ্ক কপি</span>
                                                  </>
                                                )}
                                              </button>
                                            </>
                                          )}
                                          
                                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                                            story.status === "published" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
                                            story.status === "pending" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" :
                                            story.status === "rejected" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
                                            story.status === "revision_requested" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" :
                                            "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                                          }`}>
                                            {story.status === "published" ? "প্রকাশিত" :
                                             story.status === "pending" ? "অপেক্ষমাণ" :
                                             story.status === "rejected" ? "প্রত্যাখ্যাত" :
                                             story.status === "revision_requested" ? "সংশোধন প্রস্তাব" : "ড্রাফট"}
                                          </span>
                                          {story.scheduledAt && new Date(story.scheduledAt).getTime() > Date.now() && (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 shrink-0">
                                              <Clock className="w-3 h-3" />
                                              শিডিউলড: <CountdownTimer target={story.scheduledAt} />
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Admin Rejection / Revision Feedback Box */}
                                      {story.rejectionReason && (
                                        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs rounded-xl border border-amber-200 dark:border-amber-800/50 space-y-1">
                                          <span className="font-bold block flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                                            <MessageSquare className="w-3.5 h-3.5" /> এডমিন পরামর্শ / ফিডব্যাক:
                                          </span>
                                          <p className="leading-relaxed">&ldquo;{story.rejectionReason}&rdquo;</p>
                                        </div>
                                      )}

                                      {/* Actions & Timeline toggle */}
                                      <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                                        <button
                                          onClick={() => setExpandedTimelineSlug(isTimelineOpen ? null : story.slug)}
                                          className="text-xs text-fg-subtle hover:text-fg flex items-center gap-1 transition-colors"
                                        >
                                          <Clock className="w-3.5 h-3.5" /> টাইমলাইন ({isTimelineOpen ? "আড়াল করুন" : "দেখুন"})
                                        </button>

                                        <div className="flex items-center gap-2">
                                          {story.status === "published" && (
                                            <Link href={`/${story.uid || story.slug}`} target="_blank" className="btn-secondary text-xs px-3 py-1.5">
                                              গল্পটি পড়ুন &rarr;
                                            </Link>
                                          )}

                                          {(story.status === "revision_requested" || story.status === "rejected" || story.status === "draft" || story.status === "published") && (
                                            <button
                                              onClick={async () => {
                                                // Load the full story body (brief mode strips content) before editing
                                                try {
                                                  const res = await fetch(`/api/author/story-content?uid=${encodeURIComponent(story.uid || story.slug)}`);
                                                  if (res.ok) {
                                                    const json = await res.json();
                                                    setSelectedStoryToEdit(json.story || story);
                                                  } else {
                                                    setSelectedStoryToEdit(story);
                                                  }
                                                } catch {
                                                  setSelectedStoryToEdit(story);
                                                }
                                                setActiveTab("submit-story");
                                              }}
                                              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" /> এডিট ও পুনরায় জমা দিন
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      {/* Timeline Accordion */}
                                      {isTimelineOpen && (
                                        <div className="mt-3 p-3.5 bg-surface-alt rounded-xl border border-border space-y-2 text-xs">
                                          <span className="font-bold text-fg block mb-2">গল্পের টাইমলাইন ও ইতিহাস:</span>
                                          {Array.isArray(story.history) && story.history.length > 0 ? (
                                            story.history.map((h: any, idx: number) => (
                                              <div key={idx} className="flex items-start gap-2 text-fg-muted border-l-2 border-accent/40 pl-2.5 py-0.5">
                                                <div className="min-w-0">
                                                  <span className="font-semibold text-fg">
                                                    {h.event === "created" ? "গল্প ড্রাফট তৈরি করা হয়েছে" :
                                                     h.event === "submitted" ? "পর্যালোচনার জন্য জমা দেওয়া হয়েছে" :
                                                     h.event === "revision_requested" ? "এডমিন সংশোধনের প্রস্তাব দিয়েছেন" :
                                                     h.event === "resubmitted" ? "পুনরায় জমা দেওয়া হয়েছে" :
                                                     h.event === "published" ? "গল্পটি প্রকাশিত হয়েছে" :
                                                     h.event === "rejected" ? "গল্পটি বাতিল করা হয়েছে" : h.event}
                                                  </span>
                                                  {h.at && <span className="text-[10px] text-fg-subtle ml-2">{bndSafe(h.at, "datetime")}</span>}
                                                  {h.feedback && <p className="text-[11px] text-amber-700 dark:text-amber-300 italic mt-0.5">&ldquo;{h.feedback}&rdquo;</p>}
                                                </div>
                                              </div>
                                            ))
                                          ) : (
                                            <p className="text-fg-subtle italic">টাইমলাইন পাওয়া যায়নি।</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Author Stories Pagination Bar */}
                              {totalAuthorPages > 1 && (
                                <div className="p-3 bg-surface-alt border-t border-border flex items-center justify-between gap-2 text-xs rounded-xl mt-4">
                                  <span className="text-fg-muted font-medium">
                                    পেজ {enToBnNumber(authorStoriesPage)} / {enToBnNumber(totalAuthorPages)} (মোট {enToBnNumber(filteredList.length)}টি গল্প)
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      disabled={authorStoriesPage === 1}
                                      onClick={() => setAuthorStoriesPage(p => Math.max(1, p - 1))}
                                      className="px-2.5 py-1 rounded-lg bg-surface border border-border disabled:opacity-40 font-medium"
                                    >
                                      আগেরটি
                                    </button>
                                    <button
                                      disabled={authorStoriesPage === totalAuthorPages}
                                      onClick={() => setAuthorStoriesPage(p => Math.min(totalAuthorPages, p + 1))}
                                      className="px-2.5 py-1 rounded-lg bg-surface border border-border disabled:opacity-40 font-medium"
                                    >
                                      পরবর্তী
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <section data-author-apply className="bg-surface border border-border p-6 md:p-8 rounded-2xl shadow-sm space-y-6">
                  <h3 className="text-xl font-bold text-fg flex items-center gap-2">
                    <Edit2 className="w-5 h-5 text-accent" />
                    লেখক হতে আবেদন
                  </h3>
                  <p className="text-fg-muted text-sm leading-relaxed">
                    আমাদের ওয়েবসাইটে আপনার নিজের গল্প বা লেখা প্রকাশ করতে চান? আপনার তথ্য দিয়ে আবেদন জমা দিন। এডমিন প্যানেল থেকে পর্যালোচনা করে আপনাকে অনুমোদন দেওয়া হবে।
                  </p>
                  
                  {existingApp?.status === "pending" && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-xl border border-amber-200 dark:border-amber-800 text-sm font-medium">
                      আপনার লেখক আবেদনটি বর্তমানে পর্যালোচনায় রয়েছে। এডমিন শীঘ্রই অনুমোদন প্রদান করবেন।
                    </div>
                  )}

                  {appStatus === "success" && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-xl border border-green-200 dark:border-green-800 text-sm font-medium">
                      {appMsg}
                    </div>
                  )}
                  
                  {appStatus === "error" && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-800 text-sm font-medium">
                      {appMsg}
                    </div>
                  )}

                  {(!existingApp || existingApp.status === "rejected") && appStatus !== "success" && (
                    <form onSubmit={handleApplyAuthor} className="space-y-5 max-w-lg">
                      {existingApp?.status === "rejected" && (
                        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                          আপনার পূর্বের আবেদনটি সফল হয়নি। আপনি নিচে তথ্য সংশোধন করে পুনরায় আবেদন করতে পারেন:
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-bold text-fg-muted mb-1">আপনার প্রকৃত নাম <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          required
                          value={appRealName}
                          onChange={(e) => setAppRealName(e.target.value)}
                          className="input-field"
                          placeholder="আপনার নাম লিখুন"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-fg-muted mb-1">পূর্বের কোনো লেখার নমুনা বা লিংক <span className="text-red-500">*</span></label>
                        <input
                          type="url"
                          required
                          value={appSampleLink}
                          onChange={(e) => setAppSampleLink(e.target.value)}
                          className="input-field"
                          placeholder="Google Docs, Facebook পোস্ট বা ব্লগের লিংক"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-fg-muted mb-1">আপনার বার্তা বা পরিচিতি (ঐচ্ছিক)</label>
                        <textarea
                          value={appMessage}
                          onChange={(e) => setAppMessage(e.target.value)}
                          className="input-field h-24 resize-none"
                          placeholder="আপনি কী ধরণের গল্প লিখতে পছন্দ করেন লিখুন..."
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={appStatus === "submitting"}
                        className="btn-primary"
                      >
                        {appStatus === "submitting" ? "আবেদন জমা হচ্ছে..." : "আবেদন জমা দিন"}
                      </button>
                    </form>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      {/* VERIFICATION BADGE APPLICATION MODAL */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base text-fg flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-blue-500" /> ভেরিফাইড লেখক ব্যাজের আবেদন
              </h3>
              <button
                onClick={() => { setShowVerifyModal(false); setVerifyStatus("idle"); }}
                className="p-1 rounded-lg text-fg-muted hover:text-fg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {existingVerifyReq?.status === "pending" ? (
              <div className="py-6 text-center">
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" /> আপনার আবেদনটি পর্যালোচনায় রয়েছে
                </p>
                <p className="text-xs text-fg-muted mt-2">অ্যাডমিন অনুমোদন করলে আপনার প্রোফাইলে নীল চেক ব্যাজ দেখা যাবে।</p>
              </div>
            ) : existingVerifyReq?.status === "approved" ? (
              <div className="py-6 text-center">
                <p className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center justify-center gap-2">
                  <BadgeCheck className="w-5 h-5" /> আপনার ব্যাজ অনুমোদিত হয়েছে!
                </p>
              </div>
            ) : (
              <>
                {verifyStatus === "success" && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-xl text-sm font-medium">
                    {verifyMsg}
                  </div>
                )}
                {verifyStatus === "error" && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl text-sm font-medium">
                    {verifyMsg}
                  </div>
                )}
                {verifyStatus !== "success" && (
                  <form onSubmit={handleVerifySubmit} className="space-y-3">
                    <p className="text-xs text-fg-muted leading-relaxed">
                      ভেরিফিকেশন ব্যাজটি প্রমাণ করে আপনি একজন যাচাইকৃত লেখক। অ্যাডমিন আপনার গল্প ও কার্যক্রম পর্যালোচনা করে অনুমোদন দেবেন।
                    </p>
                    <textarea
                      value={verifyReason}
                      onChange={(e) => setVerifyReason(e.target.value)}
                      className="input-field h-24 resize-none"
                      placeholder="আপনার লেখার অভিজ্ঞতা বা কেন এই ব্যাজ প্রয়োজন তা সংক্ষেপে লিখুন..."
                      required
                    />
                    {existingVerifyReq?.status === "rejected" && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">পূর্বের আবেদন প্রত্যাখ্যাত হয়েছে। নতুনভাবে আবেদন করতে পারেন।</p>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => { setShowVerifyModal(false); setVerifyStatus("idle"); }}
                        className="px-3 py-1.5 text-xs text-fg-muted hover:bg-surface-hover rounded-lg"
                      >
                        বাতিল
                      </button>
                      <button
                        type="submit"
                        disabled={verifyStatus === "submitting" || !verifyReason.trim()}
                        className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        {verifyStatus === "submitting" ? "জমা হচ্ছে..." : "আবেদন জমা দিন"}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* FOLLOWERS LIST MODAL POPUP */}
      {showFollowersModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" /> আপনার ফলোয়ারবৃন্দ ({enToBnNumber(followersList.length)})
              </h3>
              <button
                onClick={() => setShowFollowersModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
              {followersList.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-500">এখনো কোনো ফলোয়ার নেই। নতুন গল্প তৈরি করে আপনার অনুরাগী বাড়ান!</div>
              ) : (
                followersList.map((f: any, idx: number) => (
                  <div key={idx} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden border border-blue-200">
                        <UserAvatar
                          src={f.profilePic}
                          name={f.name || f.username}
                          userId={f.id || f.userId}
                          size="md"
                          className="w-10 h-10"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-zinc-900 dark:text-white text-sm truncate">{f.name}</p>
                        <p className="text-xs text-zinc-500 font-mono truncate">@{f.username}</p>
                      </div>
                    </div>
                    <Link
                      href={`/authors/${f.username}`}
                      target="_blank"
                      className="px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium rounded-xl hover:bg-blue-100 transition-colors shrink-0"
                    >
                      প্রোফাইল
                    </Link>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowFollowersModal(false)}
              className="w-full py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs rounded-xl hover:bg-zinc-200 transition-colors"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}

      {/* Per-story analytics modal */}
      {analyticsStory && (
        <StoryAnalyticsModal
          storyUid={analyticsStory.uid}
          storySlug={analyticsStory.uid}
          storyTitle={analyticsStory.title}
          onClose={() => setAnalyticsStory(null)}
        />
      )}
    </div>
  );
}
