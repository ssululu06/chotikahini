"use client";

import { getClientSiteName, getClientSiteUrl } from "@/lib/client-config";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  LogOut, Plus, Edit, FileText, Search, Trash2, LayoutDashboard, FileBox, 
  ShieldAlert, MessageSquare, Menu, X, UserCog, Megaphone, CheckCircle2, 
  AlertCircle, EyeOff, Eye, Clock, Users, FileCheck, RotateCcw, Send, Filter,
  Activity, Calendar, TrendingUp, UserCheck, Mail, Bell, Flag, UserPlus, KeyRound, Copy, BadgeCheck,
  AlertTriangle, ExternalLink, Globe, Loader2, PenLine, Rss
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { enToBnNumber, bndSafe } from "@/lib/utils";
import { hasPermission as hasPerm } from "@/lib/permissions";
import { getAllCategoryConfigs } from "@/lib/config";
import { RoleGuide } from "./RoleGuide";
import { AdminSidebar } from "./AdminSidebar";
import { SimilarityCheck } from "./SimilarityCheck";
import { SimilarityClusters } from "./SimilarityClusters";
import { CountdownTimer } from "@/components/CountdownTimer";
import { StoryAnalyticsModal } from "@/components/StoryAnalyticsModal";
import { AvatarPicker } from "@/components/AvatarPicker";
import { UserAvatar } from "@/components/UserAvatar";

interface PostSummary {
  title: string;
  uid: string;
  slug: string;
  fileSlug: string;
  publishedAt: string;
  categoryName: string;
  status?: string;
  author?: string;
  rejectionReason?: string;
  history?: any[];
  content?: string;
  cover?: string;
}

interface DraftSummary {
  name: string;
  path: string;
  sha: string;
}

interface ShareSuggestion {
  slug: string;
  uid: string;
  title: string;
  cover: string;
  viewCount: number;
  likeCount?: number;
  commentCount?: number;
  authorName?: string;
  categoryId?: string | null;
  score?: number;            // 0..1 raw Opportunity Score from the engine
  reasons?: string[];        // human-readable explanations
}

interface ShareSuggestionsFunnel {
  postsFetched: number;
  postsWithSlug: number;
  candidates: number;
  ranked: number;
  metadataRows: number;
  viewRows: number;
  logTableAvailable: boolean;
}

interface ShareSuggestionsMeta {
  limit: number;
  cooldownDays: number;
  today: string;
  servedToday: number;
  remainingToday: number;
  logTableAvailable: boolean;
  capActive?: boolean;
  funnel: ShareSuggestionsFunnel;
}

interface WelcomeRecipient {
  id: string;
  name: string;
  username: string;
  email: string;
  createdAt: string;
  welcomeMessage: string;
  sentAt: boolean;
}

export default function AdminDashboard({ publishedPosts }: { publishedPosts: PostSummary[] }) {
  const [postsList, setPostsList] = useState<PostSummary[]>(publishedPosts);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { logout, user } = useAuth();

  // Role-aware landing section: each admin role starts at the panel that fits its job.
  const role = user?.role;
  const [activeSection, setActiveSection] = useState<"dashboard" | "review" | "authors" | "messages" | "notifications" | "verify" | "deletions" | "similarity" | "autopost">(
    role === "content_manager" ? "review" : "dashboard"
  );
  const searchParams = useSearchParams();

  useEffect(() => {
    const sec = searchParams?.get("section");
    if (sec && ["dashboard", "review", "authors", "messages", "notifications", "verify", "deletions", "similarity", "autopost"].includes(sec)) {
      setActiveSection(sec as any);
      if (sec === "messages") fetchContactMessages();
      if (sec === "notifications") fetchAdminNotifications();
      if (sec === "deletions") fetchDeletionRequests();
    }
  }, [searchParams]);

  const [contactMessages, setContactMessages] = useState<any[]>([]);
  const [loadingContactMessages, setLoadingContactMessages] = useState(false);
  const [selectedContactMessage, setSelectedContactMessage] = useState<any | null>(null);

  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [loadingAdminNotifications, setLoadingAdminNotifications] = useState(false);
  const [welcomeRecipients, setWelcomeRecipients] = useState<WelcomeRecipient[]>([]);
  const [loadingWelcomeRecipients, setLoadingWelcomeRecipients] = useState(false);
  const [welcomeRecipientsError, setWelcomeRecipientsError] = useState("");
  const [showSentWelcomeEmails, setShowSentWelcomeEmails] = useState(false);
  const [savingWelcomeStatus, setSavingWelcomeStatus] = useState<string | null>(null);

  const fetchAdminNotifications = async () => {
    setLoadingAdminNotifications(true);
    try {
      const res = await fetch("/api/admin/notifications");
      if (res.ok) {
        const json = await res.json();
        setAdminNotifications(json.notifications || []);
      }
    } catch (e) {
      console.error("Failed to fetch admin notifications", e);
    } finally {
      setLoadingAdminNotifications(false);
    }
  };

  const fetchWelcomeRecipients = useCallback(async () => {
    if (!hasPerm(user?.role, "notifications.manage")) return;
    setLoadingWelcomeRecipients(true);
    setWelcomeRecipientsError("");
    try {
      const res = await fetch("/api/admin/welcome-emails");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "নতুন ব্যবহারকারীর তালিকা লোড করা যায়নি।");
      setWelcomeRecipients(data.recipients || []);
    } catch (error) {
      console.error("Failed to load welcome email recipients", error);
      setWelcomeRecipientsError(
        error instanceof Error ? error.message : "নতুন ব্যবহারকারীর তালিকা লোড করা যায়নি।",
      );
    } finally {
      setLoadingWelcomeRecipients(false);
    }
  }, [user?.role]);

  const updateWelcomeEmailStatus = async (recipient: WelcomeRecipient, sent: boolean) => {
    setSavingWelcomeStatus(recipient.id);
    setWelcomeRecipientsError("");
    try {
      const res = await fetch("/api/admin/welcome-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: recipient.id, sent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ইমেইল পাঠানোর অবস্থা সংরক্ষণ করা যায়নি।");
      setWelcomeRecipients((prev) =>
        prev.map((item) => item.id === recipient.id ? { ...item, sentAt: sent } : item),
      );
    } catch (error) {
      console.error("Failed to save welcome email status", error);
      setWelcomeRecipientsError(
        error instanceof Error ? error.message : "ইমেইল পাঠানোর অবস্থা সংরক্ষণ করা যায়নি।",
      );
    } finally {
      setSavingWelcomeStatus(null);
    }
  };

  const markAllAdminNotificationsRead = async () => {
    try {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setAdminNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {}
  };

  const deleteAdminNotification = async (id: string) => {
    try {
      await fetch(`/api/admin/notifications?id=${id}`, { method: "DELETE" });
      setAdminNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {}
  };

  const fetchVerifyRequests = async () => {
    try {
      setLoadingVerifyRequests(true);
      const res = await fetch("/api/admin/verify-requests");
      if (res.ok) {
        const json = await res.json();
        setVerifyRequests(json.requests || []);
      }
    } catch (e) {
    } finally {
      setLoadingVerifyRequests(false);
    }
  };

  const fetchDeletionRequests = async () => {
    try {
      setLoadingDeletionRequests(true);
      const res = await fetch("/api/admin/deletion-requests");
      if (res.ok) {
        const json = await res.json();
        setDeletionRequests(json.requests || []);
      }
    } catch (e) {
    } finally {
      setLoadingDeletionRequests(false);
    }
  };

  const handleDeletionDecision = async (id: string, status: "approved" | "rejected") => {
    if (status === "approved" && !confirm("এই আইটেমটি স্থায়ীভাবে মুছে ফেলা হবে! আপনি কি নিশ্চিত?")) return;
    try {
      const res = await fetch("/api/admin/deletion-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        alert(status === "approved" ? "আইটেমটি স্থায়ীভাবে মুছে ফেলা হয়েছে।" : "ডিলিট অনুরোধটি প্রত্যাখ্যান করা হয়েছে।");
        fetchDeletionRequests();
        fetchStats();
        fetchStorySimilarity();
        router.refresh();
      } else {
        const json = await res.json();
        alert(json.error || "অপারেশন ব্যর্থ হয়েছে।");
      }
    } catch (e) {
      alert("নেটওয়ার্ক সমস্যা হয়েছে।");
    }
  };

  const handleVerifyDecision = async (id: string, status: "approved" | "rejected") => {
    if (status === "rejected" && !confirm("আবেদনটি প্রত্যাখ্যান করবেন? নিশ্চিত?")) return;
    try {
      const res = await fetch("/api/admin/verify-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        alert(status === "approved" ? "ভেরিফিকেশন অনুমোদিত হয়েছে! লেখকের প্রোফাইলে এখন নীল ব্যাজ দেখা যাবে।" : "আবেদনটি প্রত্যাখ্যান করা হয়েছে।");
        fetchVerifyRequests();
      } else {
        const json = await res.json();
        alert(json.error || "অপারেশন ব্যর্থ হয়েছে।");
      }
    } catch (e) {
      alert("নেটওয়ার্ক সমস্যা হয়েছে।");
    }
  };

  // Opens a prefilled welcome email in the admin's configured mail app.
  const sendWelcomeEmail = (ntf: any) => {
    const data = ntf.data || {};
    const email = typeof data.email === "string" ? data.email.trim() : "";
    if (!email) {
      alert("এই ইউজারের কোনো ইমেইল নেই। ইউজার ম্যানেজমেন্ট থেকে যোগাযোগ করুন।");
      return;
    }
    const siteName = getClientSiteName() || "আমাদের প্ল্যাটফর্ম";
    const subject = `স্বাগতম ${siteName}-এ!`;
    const welcomeMessage = typeof data.welcomeMessage === "string" && data.welcomeMessage.trim()
      ? data.welcomeMessage
      : `প্রিয় ${data.name || ntf.title || "বন্ধু"},\n\n${siteName}-এ আপনাকে স্বাগতম! আপনার অ্যাকাউন্ট তৈরি হয়েছে। এখানে আপনার পছন্দের গল্প পড়ুন, লেখকদের সঙ্গে যুক্ত থাকুন, আর চাইলে নিজের গল্পও শেয়ার করুন।\n\nশুভেচ্ছান্তে,\n${siteName} টিম`;
    const body = data.username
      ? `${welcomeMessage}\n\nআপনার ইউজারনেম: ${data.username}`
      : welcomeMessage;
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Admin generates a password reset link for a forgot-password request and emails it
  const handleGenerateResetLink = async (ntf: any) => {
    const userId = ntf.data?.userId;
    if (!userId) {
      alert("ইউজার আইডি পাওয়া যায়নি।");
      return;
    }
    setResetLoading(ntf.id);
    try {
      const res = await fetch("/api/admin/generate-reset-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setResetModalData({ ...json.data, notifId: ntf.id });
        markAllAdminNotificationsRead();
      } else {
        alert(json.error || "রিসেট লিঙ্ক তৈরি করতে ব্যর্থ হয়েছে।");
      }
    } catch (e) {
      alert("নেটওয়ার্ক সমস্যা হয়েছে।");
    } finally {
      setResetLoading(null);
    }
  };

  const fetchContactMessages = async () => {
    setLoadingContactMessages(true);
    try {
      const res = await fetch("/api/admin/contact-messages");
      if (res.ok) {
        const json = await res.json();
        setContactMessages(json.messages || []);
      }
    } catch (e) {
      console.error("Failed to fetch contact messages", e);
    } finally {
      setLoadingContactMessages(false);
    }
  };

  const toggleContactReadStatus = async (id: string, currentRead: boolean) => {
    try {
      await fetch("/api/admin/contact-messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isRead: !currentRead }),
      });
      setContactMessages((prev) => prev.map((m) => (m.id === id ? { ...m, isRead: !currentRead } : m)));
      if (selectedContactMessage?.id === id) {
        setSelectedContactMessage((prev: any) => (prev ? { ...prev, isRead: !currentRead } : null));
      }
    } catch (e) {}
  };

  const deleteContactMessage = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিত যে এই বার্তাটি ডিলিট করতে চান?")) return;
    try {
      await fetch(`/api/admin/contact-messages?id=${id}`, { method: "DELETE" });
      setContactMessages((prev) => prev.filter((m) => m.id !== id));
      if (selectedContactMessage?.id === id) setSelectedContactMessage(null);
    } catch (e) {}
  };

  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [shareSuggestions, setShareSuggestions] = useState<ShareSuggestion[]>([]);
  const [loadingShareSuggestions, setLoadingShareSuggestions] = useState(false);
const [shareSuggestionsMeta, setShareSuggestionsMeta] = useState<ShareSuggestionsMeta | null>(null);
  const [shareSuggestionsError, setShareSuggestionsError] = useState("");
  const [copiedSuggestion, setCopiedSuggestion] = useState<string | null>(null);
  const [publishedPage, setPublishedPage] = useState(1);

  // Reset link modal state (for forgot-password notification handling)
  const [resetModalData, setResetModalData] = useState<any | null>(null);
  const [resetLoading, setResetLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLinkUid, setCopiedLinkUid] = useState<string | null>(null);

  const copyStoryLink = async (uid: string, slug?: string) => {
    try {
      const base = window.location.origin;
      await navigator.clipboard.writeText(`${base}/${uid || slug}`);
      setCopiedLinkUid(uid || slug || null);
      setTimeout(() => setCopiedLinkUid(null), 2000);
    } catch {
      alert("লিংক কপি করা যায়নি।");
    }
  };

  // Verification requests state
  const [verifyRequests, setVerifyRequests] = useState<any[]>([]);
  const [loadingVerifyRequests, setLoadingVerifyRequests] = useState(false);

  // Deletion requests state (superadmin approval)
  const [deletionRequests, setDeletionRequests] = useState<any[]>([]);
  const [backfilling, setBackfilling] = useState(false);

  // Story similarity map (uid -> { maxSimilarity, matched })
  const [similarityMap, setSimilarityMap] = useState<Record<string, any>>({});
  // Auto post state
  const [autoPostUrl, setAutoPostUrl] = useState("");
  const [autoPostCategory, setAutoPostCategory] = useState("golpo");
  const [autoPostTags, setAutoPostTags] = useState("");
  const [autoPostSchedule, setAutoPostSchedule] = useState("");
  const [autoPostLoading, setAutoPostLoading] = useState(false);
  const [autoPostMsg, setAutoPostMsg] = useState<{ type: string; text: string }>({ type: "", text: "" });
  // Crawler sources state
  const [crawlerSources, setCrawlerSources] = useState<any[]>([]);
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourceCategory, setNewSourceCategory] = useState("golpo");
  const [newSourceTags, setNewSourceTags] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [crawlerMsg, setCrawlerMsg] = useState<{ type: string; text: string }>({ type: "", text: "" });
  // Crawled review queue state
  const [crawledStories, setCrawledStories] = useState<any[]>([]);
  const [selectedCrawled, setSelectedCrawled] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const [editingTagsFor, setEditingTagsFor] = useState<string | null>(null);
  const [editTagsValue, setEditTagsValue] = useState("");
  const [schedulingFor, setSchedulingFor] = useState<string | null>(null);
  const [scheduleTimeValue, setScheduleTimeValue] = useState("");
  const [publishInterval, setPublishInterval] = useState(60);
  // Full edit modal state
  const [editingStory, setEditingStory] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("golpo");
  const [editTags, setEditTags] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [authorsList, setAuthorsList] = useState<any[]>([]);
  // Per-story analytics modal
  const [analyticsStory, setAnalyticsStory] = useState<{ uid: string; title: string } | null>(null);

  // Add author modal
  const [showAddAuthor, setShowAddAuthor] = useState(false);
  const [addAuthorForm, setAddAuthorForm] = useState({
    name: "", username: "", email: "", bio: "", profilePic: "", website: "", facebook: "", password: "",
  });
  const [addAuthorLoading, setAddAuthorLoading] = useState(false);
  const [addAuthorMsg, setAddAuthorMsg] = useState<{ type: string; text: string }>({ type: "", text: "" });
  const [loadingDeletionRequests, setLoadingDeletionRequests] = useState(false);

  // Review modal state
  const [reviewStory, setReviewStory] = useState<any | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"all" | "pending" | "revision_requested" | "published" | "rejected">("pending");
  const [selectedAuthorFilter, setSelectedAuthorFilter] = useState<string>("");
  const [reviewActionType, setReviewActionType] = useState<"revision" | "reject" | "edit_publish" | null>(null);
  const [feedbackInput, setFeedbackInput] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedCategory, setEditedCategory] = useState("");
  const [editedTags, setEditedTags] = useState("");
  const [editedAuthor, setEditedAuthor] = useState("");
  const [editedCover, setEditedCover] = useState("");
  const [editedPreviousPost, setEditedPreviousPost] = useState("");
  const [coauthors, setCoauthors] = useState<any[]>([]);
  const [coauthorInput, setCoauthorInput] = useState("");
  const [coauthorBusy, setCoauthorBusy] = useState(false);
  const [coauthorMsg, setCoauthorMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Hydrate the co-author chips whenever the review modal opens for a
  // different story. Without this the editor would always show an empty
  // list even when the story already has co-authors saved.
  useEffect(() => {
    if (!reviewStory?.uid) {
      setCoauthors([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/story-coauthors?storyUid=${encodeURIComponent(reviewStory.uid)}`);
        if (!res.ok) {
          if (!cancelled) setCoauthors([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) setCoauthors(data.coauthors || []);
      } catch {
        if (!cancelled) setCoauthors([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reviewStory?.uid]);
  const [reviewMsg, setReviewMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Authors state & Author stories view modal
  const [authors, setAuthors] = useState<any[]>([]);
  const [loadingAuthors, setLoadingAuthors] = useState(false);
  const [viewingAuthor, setViewingAuthor] = useState<any | null>(null);
  const [viewingAuthorStories, setViewingAuthorStories] = useState<any[]>([]);
  const [loadingAuthorStories, setLoadingAuthorStories] = useState(false);

  // Bulk Actions
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const fetchDrafts = async () => {
    try {
      const res = await fetch("/api/author/my-stories");
      const json = await res.json();
      if (res.ok && Array.isArray(json.stories)) {
        const draftStories = json.stories.filter((s: any) => s.status === "draft");
        setDrafts(draftStories.map((s: any) => ({ name: s.title, path: s.slug, sha: s.uid })));
      }
    } catch (err) {
      console.error("Failed to fetch drafts", err);
    } finally {
      setLoadingDrafts(false);
    }
  };

  const fetchAuthors = async () => {
    setLoadingAuthors(true);
    try {
      const res = await fetch("/api/admin/authors");
      if (res.ok) {
        const json = await res.json();
        setAuthors(json.authors || []);
      }
    } catch (e) {
      console.error("Failed to fetch authors", e);
    } finally {
      setLoadingAuthors(false);
    }
  };

  const [allStoriesQueue, setAllStoriesQueue] = useState<any[]>([]);
  const [loadingStoriesQueue, setLoadingStoriesQueue] = useState(false);

  const fetchAllStoriesForReview = async () => {
    setLoadingStoriesQueue(true);
    try {
      const res = await fetch("/api/author/my-stories?all=true");
      if (res.ok) {
        const json = await res.json();
        const stories = json.stories || [];
        setAllStoriesQueue(stories);
      }
    } catch (e) {
      console.error("Failed to fetch all stories for review", e);
    } finally {
      setLoadingStoriesQueue(false);
    }
  };

  const fetchAnalytics = useCallback(async () => {
    if (!hasPerm(user?.role, "analytics.view")) return; // visitor analytics is admin/superadmin only
    try {
      const res = await fetch("/api/admin/analytics");
      if (res.ok) {
        const json = await res.json();
        setAnalytics(json);
      }
    } catch (e) {}
  }, [user?.role]);

  const fetchShareSuggestions = useCallback(async () => {
    if (!hasPerm(user?.role, "analytics.view")) return;
    setLoadingShareSuggestions(true);
    setShareSuggestionsError("");
    try {
      const res = await fetch("/api/admin/share-suggestions");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "শেয়ার সাজেশন লোড করা যায়নি।");
      setShareSuggestions(json.suggestions || []);
setShareSuggestionsMeta(json.meta || null);
    } catch (error) {
      console.error("Failed to fetch story share suggestions", error);
      setShareSuggestionsError(error instanceof Error ? error.message : "শেয়ার সাজেশন লোড করা যায়নি।");
    } finally {
      setLoadingShareSuggestions(false);
    }
  }, [user?.role]);

  const copySuggestionLink = async (post: ShareSuggestion) => {
    try {
      const base = getClientSiteUrl() || window.location.origin;
      await navigator.clipboard.writeText(`${base}/${post.uid || post.slug}`);
      setCopiedSuggestion(post.slug);
      setTimeout(() => setCopiedSuggestion(null), 2000);
    } catch (error) {
      console.error("Failed to copy suggested story link", error);
      alert("লিংক কপি করা যায়নি।");
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const json = await res.json();
        setStats(json);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchDrafts();
    fetchStats();
    fetchAnalytics();
    fetchShareSuggestions();
    fetchAuthors();
    fetchAllStoriesForReview();
    fetchContactMessages();
    fetchAdminNotifications();
    fetchWelcomeRecipients();
    fetchStorySimilarity();
    fetchCrawlerSources();
    fetchCrawledStories();

    // Live-refresh badges (notifications, deletion requests, messages,
    // pending reviews, verification) every 30s so sidebar counts update
    // without a manual refresh.
    //
    // Note: fetchShareSuggestions is intentionally NOT in this 30s loop —
    // the ranking is heavy (multiple DB queries + file-system scan) and
    // the served set only changes once per admin per day. We refresh
    // it lazily after 60s instead, and only when the admin opens the
    // dashboard (focus listener below).
    const interval = setInterval(() => {
      fetchAdminNotifications();
      fetchWelcomeRecipients();
      fetchDeletionRequests();
      fetchContactMessages();
      fetchAllStoriesForReview();
      fetchVerifyRequests();
      fetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchAnalytics, fetchShareSuggestions, fetchWelcomeRecipients]);

  // Share suggestions refresh on a much slower cadence (5 min) and
  // re-run when the tab regains focus. Running it in the 30s badge
  // loop re-ran a multi-query route every 30 seconds, which was the
  // main source of the sluggish /admin dashboard.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        fetchShareSuggestions();
      }
    };
    const interval = setInterval(refresh, 5 * 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fetchShareSuggestions]);

  const handleOpenAuthorStories = async (authorObj: any) => {
    setViewingAuthor(authorObj);
    setLoadingAuthorStories(true);
    try {
      const res = await fetch(`/api/author/my-stories?author=${encodeURIComponent(authorObj.username)}`);
      if (res.ok) {
        const json = await res.json();
        setViewingAuthorStories(json.stories || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAuthorStories(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleManagePost = async (action: string, fileSlug: string, postTitle?: string, extraData?: any) => {
    if (action === "delete" && !confirm(`আপনি কি নিশ্চিত যে "${postTitle || fileSlug}" গল্পটি ডিলিট করতে চান?`)) {
      return;
    }
    
    setReviewSubmitting(true);
    setReviewMsg(null);

    try {
      const res = await fetch("/api/admin/posts/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          fileSlug,
          feedback: extraData?.feedback,
          reason: extraData?.reason,
          editedTitle: extraData?.editedTitle,
          editedContent: extraData?.editedContent,
          editedDescription: extraData?.editedDescription,
          editedCategory: extraData?.editedCategory,
          editedTags: extraData?.editedTags,
          editedAuthor: extraData?.editedAuthor,
          editedCover: extraData?.editedCover,
          editedPreviousPost: extraData?.editedPreviousPost,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setReviewMsg({ type: "success", text: json.message || "অপারেশন সফলভাবে সম্পন্ন হয়েছে!" });
        setPostsList((prev) => prev.filter((p) => (p.fileSlug || p.slug) !== fileSlug));
        fetchDrafts();
        fetchAuthors();
        fetchAllStoriesForReview();
        fetchStats();
        router.refresh();
        if (viewingAuthor) {
          handleOpenAuthorStories(viewingAuthor);
        }
        setTimeout(() => {
          setReviewStory(null);
          setReviewActionType(null);
          setFeedbackInput("");
          setReviewMsg(null);
        }, 1500);
      } else {
        setReviewMsg({ type: "error", text: json.error || "অপারেশন ব্যর্থ হয়েছে।" });
      }
    } catch (err) {
      setReviewMsg({ type: "error", text: "নেটওয়ার্ক সমস্যা হয়েছে।" });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUids(new Set(paginatedPosts.map(p => p.uid).filter(Boolean) as string[]));
    } else {
      setSelectedUids(new Set());
    }
  };

  const toggleSelect = (uid: string) => {
    setSelectedUids(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleAddAuthor = async () => {
    if (!addAuthorForm.name.trim() || !addAuthorForm.username.trim()) {
      setAddAuthorMsg({ type: "error", text: "নাম ও ইউজারনেম আবশ্যক।" });
      return;
    }
    setAddAuthorLoading(true);
    setAddAuthorMsg({ type: "", text: "" });
    try {
      const res = await fetch("/api/admin/authors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addAuthorForm),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setAddAuthorMsg({ type: "success", text: json.message });
        setAddAuthorForm({ name: "", username: "", email: "", bio: "", profilePic: "", website: "", facebook: "", password: "" });
        fetchAuthors();
      } else {
        setAddAuthorMsg({ type: "error", text: json.error || "লেখক যোগ করা যায়নি।" });
      }
    } catch {
      setAddAuthorMsg({ type: "error", text: "নেটওয়ার্ক সমস্যা হয়েছে।" });
    } finally {
      setAddAuthorLoading(false);
    }
  };

  const fetchStorySimilarity = async () => {
    try {
      const res = await fetch("/api/admin/story-similarity");
      if (res.ok) {
        const json = await res.json();
        const map: Record<string, any> = {};
        for (const r of json.results || []) {
          map[r.uid || r.slug] = r;
        }
        setSimilarityMap(map);
      }
    } catch (e) {}
  };

  const fetchCrawlerSources = async () => {
    try {
      const res = await fetch("/api/admin/crawler/sources");
      if (res.ok) {
        const json = await res.json();
        setCrawlerSources(json.sources || []);
      }
    } catch {}
  };

  const fetchCrawledStories = async () => {
    try {
      const res = await fetch("/api/admin/crawler/publish");
      if (res.ok) {
        const json = await res.json();
        setCrawledStories(json.stories || []);
        if (json.config?.intervalMinutes) setPublishInterval(json.config.intervalMinutes);
        if (json.autoPublished) {
          setCrawlerMsg({ type: "success", text: `"${json.autoPublished}" প্রকাশিত হয়েছে।` });
        }
      }
    } catch {}
  };

  const setScheduleInterval = async () => {
    setCrawlerMsg({ type: "", text: "" });
    try {
      const res = await fetch("/api/admin/crawler/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "schedule", intervalMinutes: publishInterval }),
      });
      const json = await res.json();
      setCrawlerMsg(json.success ? { type: "success", text: json.message } : { type: "error", text: json.error || "শিডিউল ব্যর্থ।" });
    } catch { setCrawlerMsg({ type: "error", text: "নেটওয়ার্ক সমস্যা।" }); }
  };

  const toggleCrawled = (uid: string) => {
    setSelectedCrawled(prev => { const n = new Set(prev); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });
  };

  const publishCrawled = async (mode: "all" | "selected" | "one", uids?: string[]) => {
    setPublishing(true);
    setCrawlerMsg({ type: "", text: "" });
    try {
      const res = await fetch("/api/admin/crawler/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, uids }),
      });
      const json = await res.json();
      if (res.ok) {
        setCrawlerMsg({ type: "success", text: json.message });
        setSelectedCrawled(new Set());
        fetchCrawledStories();
        fetchStats();
        router.refresh();
      } else {
        setCrawlerMsg({ type: "error", text: json.error || "পাবলিশ ব্যর্থ।" });
      }
    } catch { setCrawlerMsg({ type: "error", text: "নেটওয়ার্ক সমস্যা।" }); }
    finally { setPublishing(false); }
  };

  const saveCrawledEdit = async (uid: string, tags: string) => {
    try {
      await fetch("/api/admin/crawler/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, tags }),
      });
      setEditingTagsFor(null);
      fetchCrawledStories();
    } catch {}
  };

  const scheduleCrawledPost = async (uid: string) => {
    if (!scheduleTimeValue) { setCrawlerMsg({ type: "error", text: "তারিখ/সময় দিন।" }); return; }
    try {
      const res = await fetch("/api/admin/crawler/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, scheduledAt: new Date(scheduleTimeValue).toISOString() }),
      });
      const json = await res.json();
      if (res.ok) {
        setCrawlerMsg({ type: "success", text: `শিডিউল করা হয়েছে — ${bndSafe(scheduleTimeValue, "datetime")} এ প্রকাশ হবে।` });
        setSchedulingFor(null);
        setScheduleTimeValue("");
        fetchCrawledStories();
      } else {
        setCrawlerMsg({ type: "error", text: json.error || "শিডিউল ব্যর্থ।" });
      }
    } catch {}
  };

  const deleteCrawledStory = async (uid: string, title: string) => {
    if (!confirm(`"${title}" গল্পটি ডিলিট করবেন?`)) return;
    try {
      const res = await fetch(`/api/admin/crawler/publish?uid=${encodeURIComponent(uid)}`, { method: "DELETE" });
      if (res.ok) {
        setCrawlerMsg({ type: "success", text: `"${title}" ডিলিট হয়েছে।` });
        setSelectedCrawled(prev => { const n = new Set(prev); n.delete(uid); return n; });
        fetchCrawledStories();
      }
    } catch {}
  };

  const openStoryEdit = async (story: any) => {
    setEditingStory(story);
    setEditTitle(story.title || "");
    setEditCategory(story.category || "golpo");
    setEditTags(Array.isArray(story.tags) ? story.tags.join(", ") : story.tags || "");
    setEditAuthor(story.authorId || "");
    setEditContent("");
    setEditLoading(true);
    // Load authors list for the author dropdown
    try {
      const aRes = await fetch("/api/admin/authors");
      if (aRes.ok) { const j = await aRes.json(); setAuthorsList(j.authors || []); }
    } catch {}
    // Load full content
    try {
      const cRes = await fetch(`/api/author/story-content?uid=${encodeURIComponent(story.uid)}`);
      if (cRes.ok) { const j = await cRes.json(); setEditContent(j.story?.content || ""); }
    } catch {}
    setEditLoading(false);
  };

  const saveStoryEdit = async () => {
    if (!editingStory) return;
    try {
      const res = await fetch("/api/admin/crawler/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: editingStory.uid,
          title: editTitle,
          category: editCategory,
          tags: editTags,
          authorId: editAuthor,
          content: editContent,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setCrawlerMsg({ type: "success", text: "গল্পটি আপডেট হয়েছে।" });
        setEditingStory(null);
        fetchCrawledStories();
      } else {
        setCrawlerMsg({ type: "error", text: json.error || "আপডেট ব্যর্থ।" });
      }
    } catch {}
  };

  const addCoauthor = async () => {
    if (!reviewStory?.uid) return;
    const value = coauthorInput.trim();
    if (!value) {
      setCoauthorMsg({ type: "error", text: "ইউজারনেম বা আইডি লিখুন।" });
      return;
    }
    // Don't add the same author twice — keeps the chip list tidy.
    const alreadyAdded = coauthors.some(
      (c) => c.userId === value || (c.username && c.username.toLowerCase() === value.toLowerCase())
    );
    if (alreadyAdded) {
      setCoauthorMsg({ type: "error", text: "এই লেখক ইতিমধ্যে সহ-লেখক হিসেবে যোগ আছেন।" });
      return;
    }

    setCoauthorBusy(true);
    setCoauthorMsg(null);
    try {
      const res = await fetch("/api/admin/story-coauthors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyUid: reviewStory.uid, userId: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCoauthorMsg({ type: "error", text: json.error || "সহ-লেখক যোগ ব্যর্থ।" });
        return;
      }
      setCoauthors((prev) => [...prev, json.coauthor]);
      setCoauthorInput("");
      setCoauthorMsg({ type: "success", text: "সহ-লেখক যোগ হয়েছে।" });
    } catch {
      setCoauthorMsg({ type: "error", text: "নেটওয়ার্ক সমস্যা।" });
    } finally {
      setCoauthorBusy(false);
    }
  };

  const removeCoauthor = async (coauthor: any) => {
    if (!reviewStory?.uid) return;
    const ok = confirm(`"${coauthor.name || coauthor.username || coauthor.userId}" কে সহ-লেখক থেকে সরিয়ে দিতে চান?`);
    if (!ok) return;
    setCoauthorBusy(true);
    setCoauthorMsg(null);
    try {
      const res = await fetch(
        `/api/admin/story-coauthors?storyUid=${encodeURIComponent(reviewStory.uid)}&userId=${encodeURIComponent(coauthor.userId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setCoauthorMsg({ type: "error", text: json.error || "মুছতে সমস্যা হয়েছে।" });
        return;
      }
      setCoauthors((prev) => prev.filter((c) => c.userId !== coauthor.userId));
      setCoauthorMsg({ type: "success", text: "সহ-লেখক সরিয়ে দেওয়া হয়েছে।" });
    } catch {
      setCoauthorMsg({ type: "error", text: "নেটওয়ার্ক সমস্যা।" });
    } finally {
      setCoauthorBusy(false);
    }
  };

  const addCrawlerSource = async () => {
    if (!newSourceUrl.trim()) return;
    setCrawlerMsg({ type: "", text: "" });
    try {
      const res = await fetch("/api/admin/crawler/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newSourceUrl.trim(), category: newSourceCategory, default_tags: newSourceTags }),
      });
      const json = await res.json();
      if (res.ok) {
        setCrawlerMsg({ type: "success", text: "সোর্স যোগ হয়েছে!" });
        setNewSourceUrl(""); setNewSourceTags("");
        fetchCrawlerSources();
      } else {
        setCrawlerMsg({ type: "error", text: json.error || "সোর্স যোগ ব্যর্থ।" });
      }
    } catch { setCrawlerMsg({ type: "error", text: "নেটওয়ার্ক সমস্যা।" }); }
  };

  const deleteCrawlerSource = async (id: string) => {
    if (!confirm("এই সোর্সটি সরাবেন?")) return;
    try {
      await fetch(`/api/admin/crawler/sources?id=${id}`, { method: "DELETE" });
      fetchCrawlerSources();
    } catch {}
  };

  const runCrawler = async () => {
    setCrawling(true);
    setCrawlerMsg({ type: "", text: "" });
    try {
      const res = await fetch("/api/admin/crawler/run", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setCrawlerMsg({ type: "success", text: json.message || `${json.posted}টি পোস্ট হয়েছে।` });
        fetchStats();
        fetchAllStoriesForReview();
        router.refresh();
      } else {
        setCrawlerMsg({ type: "error", text: json.error || "ক্রল ব্যর্থ।" });
      }
    } catch { setCrawlerMsg({ type: "error", text: "ক্রল করতে সমস্যা।" }); }
    finally { setCrawling(false); }
  };

  const handleAutoPost = async () => {
    if (!autoPostUrl.trim()) return;
    setAutoPostLoading(true);
    setAutoPostMsg({ type: "", text: "" });
    try {
      const res = await fetch("/api/admin/auto-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: autoPostUrl.trim(),
          category: autoPostCategory,
          tags: autoPostTags,
          scheduledAt: autoPostSchedule ? new Date(autoPostSchedule).toISOString() : undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setAutoPostMsg({ type: "success", text: json.message });
        setAutoPostUrl("");
        setAutoPostSchedule("");
        fetchStats();
        fetchAllStoriesForReview();
        router.refresh();
      } else {
        setAutoPostMsg({ type: "error", text: json.error || "অটো-পোস্ট ব্যর্থ।" });
      }
    } catch {
      setAutoPostMsg({ type: "error", text: "নেটওয়ার্ক সমস্যা হয়েছে।" });
    } finally {
      setAutoPostLoading(false);
    }
  };

  const handleBackfillCovers = async () => {
    setBackfilling(true);
    try {
      const res = await fetch("/api/admin/backfill-covers", { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success) {
        alert(json.message || "কভার ঠিক হয়েছে।");
        router.refresh();
      } else {
        alert(json.error || "কভার ঠিক করা যায়নি।");
      }
    } catch {
      alert("নেটওয়ার্ক সমস্যা হয়েছে।");
    } finally {
      setBackfilling(false);
    }
  };

  const handleBulkAction = async (bulkAction: "publish" | "delete" | "archive") => {
    if (selectedUids.size === 0) {
      alert("কোনো গল্প নির্বাচন করা হয়নি।");
      return;
    }
    if (bulkAction === "delete" && !confirm(`আপনি কি নিশ্চিত যে নির্বাচিত ${selectedUids.size}টি গল্প ডিলিট করতে চান?`)) return;
    if (bulkAction === "archive" && !confirm(`আপনি কি নিশ্চিত যে নির্বাচিত ${selectedUids.size}টি গল্প আর্কাইভ করতে চান?`)) return;

    setBulkActionLoading(true);
    try {
      const res = await fetch("/api/admin/posts/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk",
          bulkAction,
          uids: Array.from(selectedUids),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert(json.message || `${selectedUids.size}টি গল্প আপডেট হয়েছে।`);
        setSelectedUids(new Set());
        router.refresh();
        fetchAllStoriesForReview();
        fetchStats();
      } else {
        alert(json.error || "বাল্ক অ্যাকশন ব্যর্থ হয়েছে।");
      }
    } catch (e) {
      alert("নেটওয়ার্ক সমস্যা হয়েছে।");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleDeleteDraft = async (path: string, sha: string) => {
    if (!confirm("আপনি কি নিশ্চিত যে এই ড্রাফটটি ডিলিট করতে চান?")) return;
    try {
      const res = await fetch("/api/admin/posts/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", fileSlug: sha || path, reason: "ড্রাফট ডিলিট" }),
      });
      if (res.ok) {
        setDrafts(prev => prev.filter(d => d.path !== path));
      }
    } catch (err) {
      alert("Failed to delete draft");
    }
  };

  const filteredPosts = postsList.filter(post => 
    post.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.slug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.categoryName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const POSTS_PER_PAGE = 10;
  const totalPublishedPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE) || 1;
  const paginatedPosts = filteredPosts.slice((publishedPage - 1) * POSTS_PER_PAGE, publishedPage * POSTS_PER_PAGE);
  
  const filteredDrafts = drafts.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-surface flex flex-col md:flex-row">
      {/* Unified Admin Sidebar */}
      <AdminSidebar
        currentSection={activeSection}
        onSelectSection={(sec) => {
          setActiveSection(sec as any);
          if (sec === "messages") fetchContactMessages();
          if (sec === "notifications") fetchAdminNotifications();
          if (sec === "deletions") fetchDeletionRequests();
        }}
        badges={{
          pendingReviews: allStoriesQueue.filter((p) => p.status === "pending").length,
          unreadNotifications: adminNotifications.filter((n) => !n.isRead).length,
          unreadMessages: contactMessages.filter((m) => !m.isRead).length,
          pendingVerifications: verifyRequests.filter((r: any) => r.status === "pending").length,
          pendingApplications: 0,
        }}
      />

      {/* Main Content */}
      <main className="flex-1 md:h-screen md:overflow-y-auto p-4 md:p-6 lg:p-8 min-w-0">
        <div className="max-w-7xl mx-auto space-y-6 w-full">
          
          <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
            <div>
              <h2 className="text-xl md:text-2xl font-black tracking-tight text-fg">
                {activeSection === "dashboard" && "ড্যাশবোর্ড ওভারভিউ"}
                {activeSection === "review" && "স্টোরি রিভিউ সেন্টার (Review Center)"}
                {activeSection === "authors" && "নিবন্ধিত লেখকবৃন্দ (Registered Authors)"}
                {activeSection === "notifications" && "অ্যাডমিন নোটিফিকেশন সেন্টার"}
                {activeSection === "verify" && "লেখক ভেরিফিকেশন রিকোয়েস্ট"}
                {activeSection === "deletions" && "ডিলিট রিকোয়েস্ট (স্থায়ী মুছে ফেলা)"}
                {activeSection === "autopost" && "অটো পোস্ট ও স্মার্ট ক্রলার"}
                {activeSection === "similarity" && "ডুপ্লিকেট স্টোরি স্ক্যানার"}
                {activeSection === "messages" && "ব্যবহারকারীদের যোগাযোগ বার্তা"}
              </h2>
              <p className="text-xs md:text-sm text-fg-muted mt-0.5">
                {activeSection === "dashboard" && "আপনার প্রকাশিত গল্প, ড্রাফট এবং সার্বিক সাইট পরিসংখ্যান পরিচালিত করুন।"}
                {activeSection === "review" && "লেখক জমার রিভিউ, সংশোধন প্রস্তাব ও রিজেক্ট ফিডব্যাক প্রদান করুন।"}
                {activeSection === "authors" && "নিবন্ধিত লেখকদের সমস্ত গল্প ও প্রোফাইল আলাদাভাবে নিয়ন্ত্রণ করুন।"}
                {activeSection === "notifications" && "নতুন ইউজার নিবন্ধন, পাসওয়ার্ড রিসেট ও জরুরি সাইট নোটিফিকেশন।"}
                {activeSection === "verify" && "লেখকদের ব্লু ভেরিফাইড ব্যাজ আবেদন অনুমোদন বা প্রত্যাখ্যান করুন।"}
                {activeSection === "deletions" && "অ্যাডমিনদের পাঠানো স্থায়ী ডিলিট রিকোয়েস্ট অনুমোদন করুন।"}
                {activeSection === "autopost" && "বাহ্যিক ওয়েবসাইট থেকে স্বয়ংক্রিয়ভাবে গল্প সংগ্রহ ও ড্রাফট তৈরি করুন।"}
                {activeSection === "similarity" && "বিদ্যমান গল্পগুলোর মধ্যে মিল বা কপি হওয়া কন্টেন্ট স্বয়ংক্রিয়ভাবে শনাক্ত করুন।"}
                {activeSection === "messages" && "কন্টাক্ট ফর্ম থেকে পাঠানো সমস্ত বার্তা পর্যালোচনা ও উত্তর প্রদান করুন।"}
              </p>
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
              <Link 
                href="/admin/editor" 
                className="flex flex-1 sm:flex-initial items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-sm"
              >
                <Plus className="w-4 h-4" /> নতুন গল্প
              </Link>
            </div>
          </header>

          {/* Role Guide — what this role can / cannot do (visible on every section) */}
          <RoleGuide />

          {/* DASHBOARD SECTION */}
          {activeSection === "dashboard" && (
            <div className="space-y-8 animate-fade-in">
              {/* Role Welcome Banner */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                      {role === "superadmin" && <ShieldAlert className="w-6 h-6" />}
                      {role === "admin" && <LayoutDashboard className="w-6 h-6" />}
                      {role === "content_manager" && <FileCheck className="w-6 h-6" />}
                      {role === "moderator" && <MessageSquare className="w-6 h-6" />}
                    </span>
                    <div>
                      <p className="text-lg font-bold">
                        {role === "superadmin" && "সুপার অ্যাডমিন ড্যাশবোর্ড"}
                        {role === "admin" && "অ্যাডমিন ড্যাশবোর্ড"}
                        {role === "content_manager" && "কন্টেন্ট ম্যানেজার ড্যাশবোর্ড"}
                        {role === "moderator" && "মডারেটর ড্যাশবোর্ড"}
                      </p>
                      <p className="text-xs text-white/80 mt-0.5">
                        {role === "superadmin" && "সম্পূর্ণ অ্যাক্সেস — স্থায়ী ডিলিট, রোল ম্যানেজ, সব সেকশন।"}
                        {role === "admin" && "গল্প ও ইউজার ম্যানেজমেন্ট। স্থায়ী ডিলিটের জন্য সুপার অ্যাডমিনের অনুমোদন লাগবে।"}
                        {role === "content_manager" && "গল্প অ্যাপ্রুভ/রিজেক্ট/হাইড করুন, অ্যানালিটিক্স দেখুন।"}
                        {role === "moderator" && "কমেন্ট ও রিপোর্ট মডারেট করুন।"}
                      </p>
                    </div>
                  </div>
                  {role === "moderator" && (
                    <div className="flex gap-2 sm:ml-auto">
                      <Link href="/admin/comments" className="px-3.5 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold transition-colors">
                        কমেন্ট মডারেশন
                      </Link>
                      <Link href="/admin/reports" className="px-3.5 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold transition-colors">
                        রিপোর্ট সেন্টার
                      </Link>
                    </div>
                  )}
                  {role === "content_manager" && (
                    <div className="flex gap-2 sm:ml-auto">
                      <button onClick={() => setActiveSection("review")} className="px-3.5 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold transition-colors">
                        রিভিউ সেন্টারে যান
                      </button>
                      <Link href="/admin/editor" className="px-3.5 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold transition-colors">
                        নতুন গল্প
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {/* 0. Total Stories */}
                <div className="bg-surface-alt p-4 rounded-2xl border border-border shadow-xs flex flex-col justify-between min-h-[105px] transition-all hover:border-blue-500/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-fg-muted font-semibold truncate">মোট গল্প</span>
                    <span className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                      <FileText className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-2xl font-black tracking-tight text-fg">
                      {enToBnNumber(stats?.totalStories || 0)}
                    </p>
                    <p className="text-[10.5px] text-fg-subtle truncate mt-0.5">
                      {enToBnNumber(stats?.publishedStories || 0)} প্রকাশিত
                    </p>
                  </div>
                </div>

                {/* 1. Live Active Online Users */}
                <div className="bg-surface-alt p-4 rounded-2xl border border-emerald-500/30 dark:border-emerald-500/20 shadow-xs flex flex-col justify-between min-h-[105px] transition-all hover:border-emerald-500/40">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping shrink-0 inline-block" />
                      <span className="text-xs text-fg-muted font-semibold truncate">লাইভ অনলাইন</span>
                    </div>
                    <span className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
                      <Activity className="w-4 h-4 animate-pulse" />
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                      {enToBnNumber(stats?.activeOnlineUsers || 1)} জন
                    </p>
                    <p className="text-[10.5px] text-emerald-600/70 dark:text-emerald-400/70 truncate mt-0.5">
                      রিয়েল-টাইম সক্রিয়
                    </p>
                  </div>
                </div>

                {/* 2. Daily Count (Today) */}
                <div className="bg-surface-alt p-4 rounded-2xl border border-border shadow-xs flex flex-col justify-between min-h-[105px] transition-all hover:border-blue-500/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-fg-muted font-semibold truncate">আজকের ভিজিটর</span>
                    <span className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                      <Calendar className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-2xl font-black tracking-tight text-fg">
                      {enToBnNumber(stats?.dailyCount || 0)}
                    </p>
                    <p className="text-[10.5px] text-fg-subtle truncate mt-0.5">আজকের মোট হিট</p>
                  </div>
                </div>

                {/* 3. Unique Page Visitors */}
                <div className="bg-surface-alt p-4 rounded-2xl border border-border shadow-xs flex flex-col justify-between min-h-[105px] transition-all hover:border-indigo-500/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-fg-muted font-semibold truncate">ইউনিক ভিজিটর</span>
                    <span className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                      <Eye className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-2xl font-black tracking-tight text-indigo-600 dark:text-indigo-400">
                      {enToBnNumber(stats?.uniqueVisitorsCount || 0)}
                    </p>
                    <p className="text-[10.5px] text-fg-subtle truncate mt-0.5">ইউনিক আইপি ট্র্যাকিং</p>
                  </div>
                </div>

                {/* 4. Total Registered Users */}
                <div className="bg-surface-alt p-4 rounded-2xl border border-border shadow-xs flex flex-col justify-between min-h-[105px] transition-all hover:border-purple-500/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-fg-muted font-semibold truncate">রেজিস্টার্ড ইউজার</span>
                    <span className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl shrink-0">
                      <Users className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-2xl font-black tracking-tight text-fg">
                      {enToBnNumber(stats?.totalUsers || 0)} জন
                    </p>
                    <p className="text-[10.5px] text-fg-subtle truncate mt-0.5">মোট নিবন্ধিত সদস্য</p>
                  </div>
                </div>

                {/* 5. Total Page Views */}
                <div className="bg-surface-alt p-4 rounded-2xl border border-border shadow-xs flex flex-col justify-between min-h-[105px] transition-all hover:border-rose-500/30">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-fg-muted font-semibold truncate">মোট পেজ ভিউ</span>
                    <span className="p-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
                      <TrendingUp className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-2xl font-black tracking-tight text-fg">
                      {enToBnNumber(stats?.totalPageViews || 0)}
                    </p>
                    <p className="text-[10.5px] text-fg-subtle truncate mt-0.5">সর্বমোট গল্প দর্শন</p>
                  </div>
                </div>
              </div>

              {/* Visitor Analytics — only visible with analytics.view (admin / superadmin) */}
              {hasPerm(user?.role, "analytics.view") && (
              <div className="bg-surface-alt rounded-2xl border border-border shadow-sm p-5 space-y-5">
                <h3 className="font-bold text-lg text-fg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" /> ভিজিটর অ্যানালিটিক্স
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/40 to-surface-alt dark:from-emerald-950/10 dark:to-surface-alt">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"><Activity className="w-4 h-4" /></span>
                      <p className="text-xs text-fg-muted font-medium">আজ অ্যাক্টিভ ইউজার</p>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{enToBnNumber(analytics?.activeToday || 0)}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/40 to-surface-alt dark:from-blue-950/10 dark:to-surface-alt">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center"><Calendar className="w-4 h-4" /></span>
                      <p className="text-xs text-fg-muted font-medium">৭ দিনে অ্যাক্টিভ</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{enToBnNumber(analytics?.active7d || 0)}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-indigo-200/60 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/40 to-surface-alt dark:from-indigo-950/10 dark:to-surface-alt">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center"><Eye className="w-4 h-4" /></span>
                      <p className="text-xs text-fg-muted font-medium">মোট ইউনিক ভিজিটর</p>
                    </div>
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{enToBnNumber(analytics?.uniqueVisitors || 0)}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-rose-200/60 dark:border-rose-900/40 bg-gradient-to-br from-rose-50/40 to-surface-alt dark:from-rose-950/10 dark:to-surface-alt">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center"><TrendingUp className="w-4 h-4" /></span>
                      <p className="text-xs text-fg-muted font-medium">মোট ভিজিট</p>
                    </div>
                    <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{enToBnNumber(analytics?.totalVisits || 0)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Daily Stats */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-fg border-b border-border pb-2">ডেইলি ভিজিট (গত ১৪ দিন)</h4>
                    {analytics && analytics.dailyStats && analytics.dailyStats.length > 0 ? (
                      <div className="max-h-80 overflow-y-auto rounded-xl border border-border divide-y divide-zinc-200 dark:divide-zinc-800">
                        {analytics.dailyStats.map((d: any) => (
                          <div key={d.date} className="flex items-center justify-between px-4 py-2.5 text-sm">
                            <span className="text-zinc-600 dark:text-zinc-300">{d.date}</span>
                            <div className="flex items-center gap-4">
                              <span className="text-fg-muted"><span className="font-bold text-fg">{enToBnNumber(d.visits)}</span> ভিজিট</span>
                              <span className="text-fg-muted"><span className="font-bold text-indigo-600 dark:text-indigo-400">{enToBnNumber(d.uniqueVisitors)}</span> ইউনিক</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-fg-muted italic p-4 text-center border border-dashed border-border rounded-xl">
                        এখনো কোনো ভিজিট রেকর্ড নেই। ডাটাবেসে <code className="text-xs bg-surface-hover px-1.5 py-0.5 rounded">scripts/analytics-supabase.sql</code> চালান এবং গল্পের পেজ ভিজিট হলে এখানে দেখা যাবে।
                      </p>
                    )}
                  </div>

                  {/* Top Stories */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-fg border-b border-border pb-2">সর্বাধিক পঠিত গল্প (ইউনিক ভিজিটর)</h4>
                    {analytics && analytics.topStories && analytics.topStories.length > 0 ? (
                      <div className="max-h-80 overflow-y-auto rounded-xl border border-border divide-y divide-zinc-200 dark:divide-zinc-800">
                        {analytics.topStories.map((s: any, i: number) => {
                          const found = postsList.find((p) => p.slug === s.slug || p.fileSlug === s.slug || p.uid === s.slug);
                          return (
                            <div key={s.slug} className="flex items-center justify-between px-4 py-2.5 gap-3">
                              <span className="flex items-center gap-2.5 min-w-0">
                                <span className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-[11px] font-bold flex items-center justify-center shrink-0">{enToBnNumber(i + 1)}</span>
                                {found?.cover && (
                                  <div className="w-8 h-6 rounded overflow-hidden shrink-0 border border-border relative">
                                    <Image src={found.cover} alt="" fill sizes="32px" className="object-cover" />
                                  </div>
                                )}
                                <Link
                                  href={`/${found?.uid || found?.slug || s.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-zinc-800 dark:text-zinc-200 truncate hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                                  title={found?.title || s.slug}
                                >
                                  {found?.title || s.slug}
                                </Link>
                              </span>
                              <span className="text-xs text-fg-muted shrink-0">{enToBnNumber(s.uniqueVisitors)} জন</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-fg-muted italic p-4 text-center border border-dashed border-border rounded-xl">এখনো কোনো তথ্য নেই।</p>
                    )}
                  </div>
                </div>
              </div>
              )}

              {hasPerm(user?.role, "analytics.view") && (
                <section className="rounded-2xl border border-border bg-surface-alt p-5 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-lg font-bold text-fg">
                        <Megaphone className="h-5 w-5 text-amber-500" />
                        শেয়ার করার সাজেশন
                      </h3>
<p className="mt-1 text-sm text-fg-muted">
                        দিনে সর্বোচ্চ {enToBnNumber(shareSuggestionsMeta?.limit ?? 4)}টি প্রকাশিত লেখা সাজেস্ট করা হয়। ভিউ, ইনগেজমেন্ট, ফ্রেশনেস ও কুলডাউন অনুযায়ী সাজানো।
                      </p>
                      {shareSuggestionsMeta && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                            আজকের সাজেস্ট: {enToBnNumber(shareSuggestionsMeta.servedToday)} / {enToBnNumber(shareSuggestionsMeta.limit)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-fg-muted">
                            কুলডাউন: {enToBnNumber(shareSuggestionsMeta.cooldownDays)} দিন
                          </span>
                          {shareSuggestionsMeta.capActive && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300" title="আজকের ক্যাপ পূর্ণ — নতুন সাজেস্ট আগামীকাল দেখা যাবে">
                              আজকের ক্যাপ শেষ — নতুন সাজেস্ট আগামীকাল
                            </span>
                          )}
                          {shareSuggestionsMeta.remainingToday === 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                              আজকের ক্যাপ পূর্ণ
                            </span>
                          )}
                          {shareSuggestionsMeta.logTableAvailable === false && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300" title="Supabase SQL Editor-এ scripts/share-suggestions.sql চালান">
                              লগ টেবিল নেই — কুলডাউন কাজ করছে না
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={fetchShareSuggestions}
disabled={loadingShareSuggestions }
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-hover disabled:opacity-50"
                    >
                      {loadingShareSuggestions ? "লোড হচ্ছে..." : "রিফ্রেশ"}
                    </button>
                  </div>

                  {shareSuggestionsError ? (
                    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                      {shareSuggestionsError}
                    </p>
                  ) : loadingShareSuggestions && shareSuggestions.length === 0 ? (
                    <p className="py-5 text-center text-sm text-fg-muted">সাজেশন লোড হচ্ছে...</p>
                  ) : shareSuggestions.length === 0 ? (
                    <div className="py-5 text-center text-sm text-fg-muted">
                      <p>শেয়ার করার মতো কোনো প্রকাশিত লেখা পাওয়া যায়নি।</p>
                      {shareSuggestionsMeta?.funnel && (() => {
                        const f = shareSuggestionsMeta.funnel;
                        const steps: [string, number][] = [
                          ["প্রকাশিত লেখা", f.postsFetched],
                          ["slug আছে", f.postsWithSlug],
                          ["candidate তৈরি", f.candidates],
                          ["rank-পাস", f.ranked],
                        ];
                        return (
                          <p className="mt-2 text-[11px] text-fg-muted/80">
                            {steps.map((s, i) => (
                              <span key={s[0]}>
                                {i > 0 && " → "}
                                {s[0]} {enToBnNumber(s[1])}
                              </span>
                            ))}
                            {f.metadataRows === 0 && (
                              <span className="ml-2 text-amber-700 dark:text-amber-400">· post_metadata ফাঁকা</span>
                            )}
                            {f.viewRows === 0 && (
                              <span className="ml-2 text-amber-700 dark:text-amber-400">· ভিউ টেবিল ফাঁকা</span>
                            )}
                            {!f.logTableAvailable && (
                              <span className="ml-2 text-amber-700 dark:text-amber-400">· share_suggestion_log মিসিং</span>
                            )}
                          </p>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {shareSuggestions
                        .slice(0, shareSuggestionsMeta?.limit || 4)
                        .map((suggestion, index) => {
                        const base = getClientSiteUrl();
                        const storyUrl = `${base}/${suggestion.uid || suggestion.slug}`;
                        const encodedUrl = encodeURIComponent(storyUrl);
                        const encodedTitle = encodeURIComponent(suggestion.title);
                        return (
                          <article key={suggestion.slug} className="rounded-xl border border-border bg-surface p-3">
                            <div className="flex items-start gap-3">
                              {suggestion.cover && (
                                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border">
                                  <Image src={suggestion.cover} alt="" fill sizes="56px" className="object-cover" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <Link
                                  href={`/${suggestion.uid || suggestion.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="line-clamp-2 text-sm font-semibold text-fg hover:text-blue-500"
                                >
                                  {suggestion.title}
                                </Link>
                                <p className="mt-1 text-xs text-fg-muted">
                                  সাজেশন {enToBnNumber(index + 1)} · মোট {enToBnNumber(suggestion.viewCount)} ভিউ
<div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                                  <span>সাজেশন {enToBnNumber(index + 1)} · মোট {enToBnNumber(suggestion.viewCount)} ভিউ</span>
                                  {(suggestion.likeCount || 0) + (suggestion.commentCount || 0) > 0 && (
                                    <span>· {enToBnNumber((suggestion.likeCount || 0) + (suggestion.commentCount || 0))} ইনগেজমেন্ট</span>
                                  )}
                                  {typeof suggestion.score === "number" && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-100 px-2 py-0.5 text-[11px] font-medium text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300">
                                      স্কোর {Math.round(suggestion.score * 100)}
                                    </span>
                                  )}
                                </div>
                                {suggestion.reasons && suggestion.reasons.length > 0 && (
                                  <ul className="mt-2 space-y-1 text-[11px] text-fg-muted">
                                    {suggestion.reasons.slice(0, 3).map((reason, i) => (
                                      <li key={i} className="flex items-start gap-1.5">
                                        <span className="mt-1 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-fuchsia-500" />
                                        <span>{reason}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => copySuggestionLink(suggestion)}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                              >
                                {copiedSuggestion === suggestion.slug ? "কপি হয়েছে" : "লিংক কপি"}
                              </button>
                              <a
                                href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-hover"
                              >
                                Facebook
                              </a>
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(`${suggestion.title} ${storyUrl}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-hover"
                              >
                                WhatsApp
                              </a>
                              <a
                                href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-hover"
                              >
                                Telegram
                              </a>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-subtle" />
                <input
                  type="text"
                  placeholder="গল্পের শিরোনাম বা স্লাগ দিয়ে খুঁজুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-surface-alt border border-border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-fg text-sm"
                />
              </div>

              {/* Grid Section: Drafts & Published */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Drafts Column */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-fg">ড্রাফট ফাইল</h3>
                    <span className="bg-surface-hover text-fg-muted text-xs font-bold px-2.5 py-0.5 rounded-full">{filteredDrafts.length}</span>
                  </div>
                  
                  <div className="bg-surface-alt rounded-xl border border-border shadow-sm overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800">
                    {loadingDrafts ? (
                      <div className="p-6 text-center text-sm text-fg-muted animate-pulse">ড্রাফট লোড হচ্ছে...</div>
                    ) : filteredDrafts.length === 0 ? (
                      <div className="p-6 text-center text-sm text-fg-muted">কোনো ড্রাফট পাওয়া যায়নি।</div>
                    ) : (
                      filteredDrafts.map((draft) => (
                        <div key={draft.path} className="p-4 hover:bg-surface-hover transition-colors">
                          <p className="font-semibold text-fg truncate text-sm" title={draft.name}>{draft.name}</p>
                          <div className="flex items-center justify-between mt-3 gap-2">
                            <Link 
                              href={`/admin/editor?draft=${encodeURIComponent(draft.name)}`}
                              className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 py-1.5 rounded-lg font-medium transition-colors"
                            >
                              <Edit className="w-3.5 h-3.5" /> এডিট
                            </Link>
                            <button 
                              onClick={() => handleDeleteDraft(draft.path, draft.sha)}
                              className="p-1.5 text-fg-subtle hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Delete Draft"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Scheduled Posts — better design below drafts */}
                  {(() => {
                    const scheduled = allStoriesQueue
                      .filter((p: any) => p.scheduledAt && new Date(p.scheduledAt).getTime() > Date.now());
                    if (scheduled.length === 0) return null;
                    return (
                      <div className="pt-5">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-bold text-fg flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-blue-500" /> শিডিউলড পোস্ট
                          </h4>
                          <span className="text-[11px] text-fg-muted font-medium">{enToBnNumber(scheduled.length)}টি নির্ধারিত</span>
                        </div>
                        <div className="space-y-3">
                          {scheduled.slice(0, 8).map((p: any) => {
                            const pub = new Date(p.scheduledAt);
                            return (
                              <div key={p.uid || p.slug} className="p-4 rounded-2xl border border-blue-200/60 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/60 to-surface-alt dark:from-blue-950/20 dark:to-surface-alt shadow-sm">
                                <div className="flex items-start gap-3">
                                  {p.cover ? (
                                    <div className="w-14 h-12 rounded-lg overflow-hidden shrink-0 relative">
                                      <Image src={p.cover} alt={p.title} fill sizes="56px" className="object-cover" />
                                    </div>
                                  ) : (
                                    <span className="w-14 h-12 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                                      <Clock className="w-5 h-5" />
                                    </span>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-fg truncate">{p.title}</p>
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                      <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                                        {pub.toLocaleDateString("bn-BD")} {pub.toLocaleTimeString("bn-BD", { hour: "numeric", minute: "2-digit" })}
                                      </span>
                                      <CountdownTimer target={p.scheduledAt} />
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-blue-200/40 dark:border-blue-900/40">
                                  <button
                                    onClick={() => copyStoryLink(p.uid || p.slug, p.slug)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                                      copiedLinkUid === (p.uid || p.slug)
                                        ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                        : "bg-surface text-fg border border-border hover:bg-surface-hover"
                                    }`}
                                    title="লিংক কপি করুন"
                                  >
                                    {copiedLinkUid === (p.uid || p.slug) ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copiedLinkUid === (p.uid || p.slug) ? "কপি হয়েছে!" : "লিংক কপি"}
                                  </button>
                                  <Link
                                    href={`/admin/editor?uid=${p.uid}`}
                                    className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-surface text-fg border border-border hover:bg-surface-hover py-1.5 rounded-lg font-medium transition-colors"
                                  >
                                    <Edit className="w-3.5 h-3.5" /> এডিট
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </section>

                {/* Published Stories Column */}
                <section className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-fg">প্রকাশিত গল্পসমূহ</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { window.open("/api/admin/export-stories?format=json", "_blank"); }}
                        className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 px-3 py-1.5 rounded-lg font-medium transition-colors"
                        title="সব গল্প JSON ব্যাকআপ ডাউনলোড"
                      >
                        এক্সপোর্ট
                      </button>
                      <button
                        onClick={handleBackfillCovers}
                        disabled={backfilling}
                        className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        {backfilling ? "ঠিক হচ্ছে..." : "কভার ঠিক করুন"}
                      </button>
                      <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs font-bold px-2.5 py-0.5 rounded-full">{filteredPosts.length}</span>
                    </div>
                  </div>

                  {/* Bulk Actions Toolbar */}
                  <div className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${selectedUids.size > 0 ? "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800" : "bg-zinc-50 dark:bg-zinc-900 border-border"}`}>
                    <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 font-medium cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={paginatedPosts.length > 0 && selectedUids.size === paginatedPosts.filter(p => p.uid).length}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      />
                      সব নির্বাচন
                    </label>
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
                      {selectedUids.size > 0 && `${selectedUids.size}টি নির্বাচিত`}
                    </span>
                    <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                      {selectedUids.size > 0 && (
                        <>
                          <button
                            onClick={() => handleBulkAction("publish")}
                            disabled={bulkActionLoading}
                            className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> পাবলিশ
                          </button>
                          <button
                            onClick={() => handleBulkAction("archive")}
                            disabled={bulkActionLoading}
                            className="flex items-center gap-1 text-xs bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                          >
                            <EyeOff className="w-3.5 h-3.5" /> আর্কাইভ
                          </button>
                          <button
                            onClick={() => handleBulkAction("delete")}
                            disabled={bulkActionLoading}
                            className="flex items-center gap-1 text-xs bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> ডিলিট
                          </button>
                        </>
                      )}
                      {bulkActionLoading && <span className="text-xs text-fg-muted animate-pulse">প্রসেস হচ্ছে...</span>}
                    </div>
                  </div>
                  
                  <div className="bg-surface-alt rounded-xl border border-border shadow-sm overflow-hidden">
                    {filteredPosts.length === 0 ? (
                      <div className="p-8 text-center text-sm text-fg-muted">
                        কোনো প্রকাশিত গল্প পাওয়া যায়নি।
                      </div>
                    ) : (
                      <>
                        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {paginatedPosts.map((post) => (
                            <li key={post.uid} className={`p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 ${selectedUids.has(post.uid) ? "bg-blue-50/60 dark:bg-blue-950/20" : "hover:bg-surface-hover"}`}>
                              <div className="min-w-0 flex-1 flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={selectedUids.has(post.uid)}
                                  onChange={() => toggleSelect(post.uid)}
                                  className="mt-1 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 shrink-0"
                                  title="বাল্ক অ্যাকশনের জন্য নির্বাচন করুন"
                                />
                                {/* Cover thumbnail */}
                                {post.cover ? (
                                  <div className="w-14 h-12 rounded-lg overflow-hidden shrink-0 border border-border relative">
                                    <Image
                                      src={post.cover}
                                      alt={post.title}
                                      fill
                                      sizes="56px"
                                      className="object-cover"
                                    />
                                  </div>
                                ) : (
                                  <span className="w-14 h-12 rounded-lg bg-surface-hover text-fg-subtle flex items-center justify-center shrink-0">
                                    <FileText className="w-5 h-5" />
                                  </span>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-fg truncate" title={post.title}>{post.title || post.uid}</p>
                                    {(() => {
                                      const sim = similarityMap[post.uid || post.slug];
                                      if (!sim) return null;
                                      return (
                                        <span
                                          title={sim.matched ? `"${sim.matched.title}" গল্পের সাথে মিল` : ""}
                                          className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
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
                                    })()}
                                  </div>
                                  <p className="text-xs text-fg-muted mt-1 flex items-center flex-wrap gap-2">
                                    <span className="font-mono bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900/30">
                                      {post.slug}
                                    </span>
                                    <span>&bull;</span>
                                    <span suppressHydrationWarning>{bndSafe(post.publishedAt, "date")}</span>
                                    <span>&bull;</span>
                                    <span className="bg-surface-hover px-1.5 py-0.5 rounded text-fg-muted">{post.categoryName}</span>
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                                <button
                                  onClick={() => copyStoryLink(post.uid || post.slug, post.slug)}
                                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                                    copiedLinkUid === (post.uid || post.slug)
                                      ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                  }`}
                                  title="লিংক কপি করুন"
                                >
                                  {copiedLinkUid === (post.uid || post.slug) ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                  {copiedLinkUid === (post.uid || post.slug) ? "কপি!" : "লিংক"}
                                </button>
                                <Link 
                                  href={`/${post.uid || post.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                                  title="গল্পটি দেখুন"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" /> দেখুন
                                </Link>
                                <button
                                  onClick={() => setAnalyticsStory({ uid: post.uid || post.slug, title: post.title })}
                                  className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                                  title="গল্পের পরিসংখ্যান"
                                >
                                  <Activity className="w-3.5 h-3.5" /> পরিসংখ্যান
                                </button>
                                <Link 
                                  href={`/admin/editor?uid=${post.uid}`}
                                  className="flex items-center gap-1 text-xs bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                                >
                                  <Edit className="w-3.5 h-3.5" /> এডিট
                                </Link>
                                <button
                                  onClick={() => handleManagePost("unpublish", post.fileSlug || post.slug, post.title)}
                                  className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                                >
                                  <EyeOff className="w-3.5 h-3.5" /> আনপাবলিশ
                                </button>
                                <button
                                  onClick={() => handleManagePost("delete", post.fileSlug || post.slug, post.title)}
                                  className="p-1.5 text-fg-subtle hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>

                        {/* Pagination Bar */}
                        {totalPublishedPages > 1 && (
                          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border-t border-border flex items-center justify-between gap-2 text-xs">
                            <span className="text-fg-muted font-medium">
                              পেজ {publishedPage} / {totalPublishedPages} (মোট {filteredPosts.length}টি গল্প)
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                disabled={publishedPage === 1}
                                onClick={() => setPublishedPage(p => Math.max(1, p - 1))}
                                className="px-2.5 py-1 rounded bg-white dark:bg-zinc-800 border border-border disabled:opacity-40 font-medium"
                              >
                                আগেরটি
                              </button>
                              <button
                                disabled={publishedPage === totalPublishedPages}
                                onClick={() => setPublishedPage(p => Math.min(totalPublishedPages, p + 1))}
                                className="px-2.5 py-1 rounded bg-white dark:bg-zinc-800 border border-border disabled:opacity-40 font-medium"
                              >
                                পরবর্তী
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* STORY REVIEW CENTER */}
          {/* AUTO POST SECTION */}
          {activeSection === "autopost" && hasPerm(user?.role, "content.create") && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-surface-alt rounded-2xl border border-border shadow-sm p-6 max-w-2xl">
                <h3 className="text-lg font-bold text-fg flex items-center gap-2 mb-1">
                  <Globe className="w-5 h-5 text-blue-500" /> অটো পোস্ট
                </h3>
                <p className="text-sm text-fg-muted mb-5">
                  যেকোনো ওয়েবসাইটের গল্পের লিংক দিন — সিস্টেম অটো-ফেচ করে মূল লেখাটি আপনার সাইটে পোস্ট করবে।
                </p>

                {autoPostMsg.text && (
                  <div className={`p-3 mb-4 rounded-xl text-sm border ${autoPostMsg.type === "error" ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800" : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800"}`}>
                    {autoPostMsg.text}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1.5">গল্পের লিংক *</label>
                    <input
                      type="url"
                      value={autoPostUrl}
                      onChange={(e) => setAutoPostUrl(e.target.value)}
                      placeholder="https://example.com/story-link"
                      className="input-field"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1.5">ক্যাটাগরি</label>
                      <select value={autoPostCategory} onChange={(e) => setAutoPostCategory(e.target.value)} className="input-field">
                        {getAllCategoryConfigs().map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1.5">ট্যাগ (কমা দিয়ে)</label>
                      <input
                        type="text"
                        value={autoPostTags}
                        onChange={(e) => setAutoPostTags(e.target.value)}
                        placeholder="গরম, রোমান্স"
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1.5">
                      শিডিউল (ঐচ্ছিক — ফাঁকা রাখলে এখনই পোস্ট হবে)
                    </label>
                    <input
                      type="datetime-local"
                      value={autoPostSchedule}
                      onChange={(e) => setAutoPostSchedule(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  <button
                    onClick={handleAutoPost}
                    disabled={autoPostLoading || !autoPostUrl.trim()}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {autoPostLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                    {autoPostLoading ? "ফেচ ও পোস্ট হচ্ছে..." : "অটো পোস্ট করুন"}
                  </button>

                  <p className="text-[11px] text-fg-subtle">
                    নোট: সিস্টেম মূল গল্পের লেখা extract করে পোস্ট করবে। সঠিক ব্যবহারের দায়িত্ব আপনার — কপিরাইট/অনুমতি নিশ্চিত করুন।
                  </p>
                </div>
              </div>

              {/* ── Crawler Sources ── */}
              <div className="bg-surface-alt rounded-2xl border border-border shadow-sm p-6 max-w-2xl">
                <h3 className="text-lg font-bold text-fg flex items-center gap-2 mb-1">
                  <Globe className="w-5 h-5 text-emerald-500" /> অটো-ক্রলার সোর্স
                </h3>
                <p className="text-sm text-fg-muted mb-5">
                  ডোমেইন দিলে সিস্টেম সেগুলো পর্যবেক্ষণ করবে এবং নতুন গল্প পেলে অটো-পোস্ট করবে (নিজেই ক্যাটাগরি + ট্যাগ ঠিক করবে)।
                </p>

                {crawlerMsg.text && (
                  <div className={`p-3 mb-4 rounded-xl text-sm border ${crawlerMsg.type === "error" ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800" : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800"}`}>
                    {crawlerMsg.text}
                  </div>
                )}

                <div className="space-y-3 mb-5">
                  <input
                    type="url"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    placeholder="https://example-story-site.com"
                    className="input-field"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select value={newSourceCategory} onChange={(e) => setNewSourceCategory(e.target.value)} className="input-field">
                      {getAllCategoryConfigs().map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={newSourceTags}
                      onChange={(e) => setNewSourceTags(e.target.value)}
                      placeholder="ডিফল্ট ট্যাগ (ঐচ্ছিক)"
                      className="input-field"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addCrawlerSource}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors flex-1"
                    >
                      <Plus className="w-3.5 h-3.5 inline mr-1" /> সোর্স যোগ করুন
                    </button>
                    <button
                      onClick={runCrawler}
                      disabled={crawling || crawlerSources.length === 0}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 flex-1"
                    >
                      {crawling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                      {crawling ? "ক্রল হচ্ছে..." : "এখনই ক্রল করুন"}
                    </button>
                  </div>
                </div>

                {crawlerSources.length > 0 && (
                  <div className="space-y-2">
                    {crawlerSources.map((src) => (
                      <div key={src.id} className="flex items-center justify-between gap-3 p-3 bg-surface border border-border rounded-xl">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-fg truncate">{src.url}</p>
                          <p className="text-[11px] text-fg-muted">
                            {src.category} {src.default_tags ? `• ${src.default_tags}` : ""}
                            {src.last_crawled_at ? ` • সর্বশেষ: ${bndSafe(src.last_crawled_at, "datetime")}` : " • এখনো ক্রল হয়নি"}
                          </p>
                          {src.feed_url && (
                            <p className="text-[10px] text-blue-500 font-mono truncate mt-0.5" title={src.feed_url}>
                              <Rss className="w-3 h-3 inline mr-0.5" />{src.feed_url}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteCrawlerSource(src.id)}
                          className="p-1.5 text-fg-subtle hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Crawled Stories Review Queue ── */}
              <div className="bg-surface-alt rounded-2xl border border-border shadow-sm p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-fg flex items-center gap-2">
                      <Clock className="w-5 h-5 text-amber-500" /> ক্রলড গল্প (রিভিউ কিউ)
                    </h3>
                    <p className="text-sm text-fg-muted mt-0.5">{crawledStories.length}টি গল্প রিভিউর অপেক্ষায় — এডিট করে publish করুন বা interval সেট করুন।</p>
                  </div>
                  <button onClick={fetchCrawledStories} className="text-xs bg-surface text-fg border border-border hover:bg-surface-hover px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" /> রিফ্রেশ
                  </button>
                </div>
                {/* Interval auto-publish + bulk actions */}
                <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-surface border border-border rounded-xl">
                  <span className="text-xs text-fg-muted font-medium">প্রতি</span>
                  <input
                    type="number"
                    min={1}
                    value={publishInterval}
                    onChange={(e) => setPublishInterval(Number(e.target.value) || 60)}
                    className="w-16 input-field text-sm py-1 text-center"
                  />
                  <span className="text-xs text-fg-muted font-medium">মিনিটে ১টি করে পাবলিশ</span>
                  <button onClick={setScheduleInterval} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors">
                    শিডিউল সেট
                  </button>
                  <span className="mx-1 text-border">|</span>
                  <button
                    onClick={() => publishCrawled("one")}
                    disabled={publishing || crawledStories.length === 0}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    পরবর্তী পাবলিশ
                  </button>
                  <button
                    onClick={() => publishCrawled("all")}
                    disabled={publishing || crawledStories.length === 0}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    সব পাবলিশ
                  </button>
                  <button
                    onClick={() => publishCrawled("selected", Array.from(selectedCrawled))}
                    disabled={publishing || selectedCrawled.size === 0}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    নির্বাচিত ({selectedCrawled.size})
                  </button>
                </div>
                {crawledStories.length === 0 ? (
                  <p className="text-center text-fg-muted italic py-8 text-sm">কোনো ক্রলড গল্প রিভিউ কিউ-তে নেই।</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {crawledStories.map((story) => (
                      <div key={story.uid} className="p-3 bg-surface border border-border rounded-xl flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedCrawled.has(story.uid)}
                          onChange={() => toggleCrawled(story.uid)}
                          className="mt-1 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 shrink-0"
                        />
                        {story.cover ? (
                          <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-border relative">
                            <Image src={story.cover} alt="" fill sizes="56px" className="object-cover" />
                          </div>
                        ) : (
                          <span className="w-14 h-14 rounded-lg bg-surface-hover text-fg-subtle flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-fg truncate">{story.title}</p>
                            {story.scheduledAt && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold shrink-0 whitespace-nowrap">
                                <Clock className="w-3 h-3 inline mr-1" />শিডিউলড: {bndSafe(story.scheduledAt, "datetime")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                              {story.category}
                            </span>
                            {typeof story.similarity === "number" && (
                              <span
                                title={story.similarStory ? `"${story.similarStory}" গল্পের সাথে মিল` : ""}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  story.similarity >= 70
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                    : story.similarity >= 40
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                      : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                }`}
                              >
                                {story.similarity}% মিল
                              </span>
                            )}
                            {story.source && (
                              <span className="text-[10px] text-fg-subtle font-mono truncate max-w-[180px]">{story.source}</span>
                            )}
                          </div>
                          {/* Tags editing */}
                          <div className="mt-2">
                            {editingTagsFor === story.uid ? (
                              <div className="flex gap-1.5 items-center">
                                <input
                                  type="text"
                                  value={editTagsValue}
                                  onChange={(e) => setEditTagsValue(e.target.value)}
                                  placeholder="ট্যাগ, কমা দিয়ে"
                                  className="flex-1 input-field text-xs py-1"
                                />
                                <button onClick={() => saveCrawledEdit(story.uid, editTagsValue)} className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-md">সেভ</button>
                                <button onClick={() => setEditingTagsFor(null)} className="px-2 py-1 bg-surface border border-border text-fg text-[10px] font-bold rounded-md">বাতিল</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingTagsFor(story.uid); setEditTagsValue(Array.isArray(story.tags) ? story.tags.join(", ") : story.tags || ""); }}
                                className="text-[11px] text-fg-muted hover:text-accent"
                              >
                                ট্যাগ: {Array.isArray(story.tags) && story.tags.length > 0 ? story.tags.join(", ") : "—"} <PenLine className="w-3 h-3 inline" /> এডিট
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-col sm:flex-row">
                          <button
                            onClick={() => openStoryEdit(story)}
                            className="px-2.5 py-1.5 bg-surface text-fg border border-border hover:bg-surface-hover text-[11px] font-bold rounded-lg shrink-0 whitespace-nowrap"
                          >
                            <PenLine className="w-3 h-3" /> এডিট
                          </button>
                          {!story.scheduledAt && (
                            <button
                              onClick={() => { setSchedulingFor(story.uid); setScheduleTimeValue(""); }}
                              className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-[11px] font-bold rounded-lg shrink-0 whitespace-nowrap"
                            >
                              <Clock className="w-3.5 h-3.5 inline mr-1" /> শিডিউল
                            </button>
                          )}
                          {!story.scheduledAt && (
                            <button
                              onClick={() => publishCrawled("selected", [story.uid])}
                              disabled={publishing}
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg shrink-0"
                            >
                              পাবলিশ
                            </button>
                          )}
                          <button
                            onClick={() => deleteCrawledStory(story.uid, story.title)}
                            className="p-1.5 text-fg-subtle hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                            title="ডিলিট"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {schedulingFor === story.uid && (
                          <div className="col-span-full flex items-center gap-2">
                            <input
                              type="datetime-local"
                              value={scheduleTimeValue}
                              onChange={(e) => setScheduleTimeValue(e.target.value)}
                              className="flex-1 input-field text-xs py-1"
                            />
                            <button onClick={() => scheduleCrawledPost(story.uid)} className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-md">সেভ</button>
                            <button onClick={() => setSchedulingFor(null)} className="px-2 py-1 bg-surface border border-border text-fg text-[10px] font-bold rounded-md">বাতিল</button>
                          </div>
                         )}
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             </div>
           )}

          {/* CRAWLED STORY FULL EDIT MODAL */}
          {editingStory && (
            <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingStory(null)}>
              <div className="bg-surface border border-border rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-fg">গল্প সম্পাদনা</h3>
                  <button onClick={() => setEditingStory(null)} className="p-1.5 text-fg-subtle hover:text-fg rounded-lg hover:bg-surface-hover transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {editLoading && <p className="text-xs text-fg-muted animate-pulse">লেখা লোড হচ্ছে...</p>}

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1">শিরোনাম</label>
                    <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="input-field" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1">ক্যাটাগরি</label>
                      <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="input-field">
                        {getAllCategoryConfigs().map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1">লেখক</label>
                      <select value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} className="input-field">
                        <option value="">নির্বাচন করুন</option>
                        {authorsList.map((a: any) => (
                          <option key={a.id} value={a.id || a.username}>{a.name || a.username}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1">ট্যাগ (কমা দিয়ে)</label>
                    <input type="text" value={editTags} onChange={(e) => setEditTags(e.target.value)} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1">মূল লেখা</label>
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="input-field h-64 resize-y font-mono text-xs" />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                  <button onClick={() => setEditingStory(null)} className="px-4 py-2 text-xs font-medium text-fg-muted hover:bg-surface-hover rounded-xl transition-colors">
                    বাতিল
                  </button>
                  <button onClick={saveStoryEdit} className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors">
                    সংরক্ষণ করুন
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SIMILARITY / DUPLICATE CLUSTERS SECTION */}
          {activeSection === "similarity" && hasPerm(user?.role, "story.review") && (
            <div className="space-y-6 animate-fade-in">
              <SimilarityClusters />
            </div>
          )}

          {activeSection === "review" && hasPerm(user?.role, "story.review") && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {[
                    { key: "pending", label: `অপেক্ষমাণ (${allStoriesQueue.filter(p => p.status === "pending").length})` },
                    { key: "all", label: "সব গল্প" },
                    { key: "revision_requested", label: "সংশোধন প্রস্তাব" },
                    { key: "published", label: "প্রকাশিত" },
                    { key: "rejected", label: "প্রত্যাখ্যাত" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setReviewFilter(tab.key as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        reviewFilter === tab.key
                          ? "bg-blue-600 text-white"
                          : "bg-surface-alt text-fg-muted border border-border"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Author Dropdown Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-fg-subtle" />
                  <select
                    value={selectedAuthorFilter}
                    onChange={(e) => setSelectedAuthorFilter(e.target.value)}
                    className="text-xs bg-surface-alt border border-border p-2 rounded-lg text-fg outline-none"
                  >
                    <option value="">সকল লেখক</option>
                    {authors
                      .filter((a) => a && (a.username || a.id))
                      .map((a) => {
                        const value = a.username || a.id;
                        const handle = a.username ? `@${a.username}` : (a.name || a.id);
                        return (
                          <option key={a.id || value} value={value}>{handle}</option>
                        );
                      })}
                  </select>
                </div>
              </div>

              <div className="bg-surface-alt rounded-2xl border border-border overflow-hidden shadow-sm">
                {loadingStoriesQueue ? (
                  <div className="p-8 text-center text-sm text-fg-muted animate-pulse">রিভিউ তালিকা লোড হচ্ছে...</div>
                ) : allStoriesQueue
                    .filter((p) => reviewFilter === "all" ? true : (p.status || "published") === reviewFilter)
                    .filter((p) => !selectedAuthorFilter ? true : (p.author || "admin").toLowerCase() === selectedAuthorFilter.toLowerCase()).length === 0 ? (
                  <div className="p-8 text-center text-sm text-fg-muted italic">এই ক্যাটাগরিতে কোনো গল্প পাওয়া যায়নি।</div>
                ) : (
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {allStoriesQueue
                      .filter((p) => reviewFilter === "all" ? true : (p.status || "published") === reviewFilter)
                      .filter((p) => !selectedAuthorFilter ? true : (p.author || "admin").toLowerCase() === selectedAuthorFilter.toLowerCase())
                      .map((post) => (
                        <div key={post.uid || post.slug} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-fg text-base">{post.title}</h4>
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-hover text-fg-muted">
                                @{post.author || "admin"}
                              </span>
                              {(() => {
                                const sim = similarityMap[post.uid || post.slug];
                                if (sim) {
                                  return (
                                    <span
                                      title={sim.matched ? `"${sim.matched.title}" গল্পের সাথে মিল` : ""}
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
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
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                post.status === "published" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
                                post.status === "pending" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" :
                                post.status === "rejected" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
                                "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                              }`}>
                                {post.status === "published" ? "প্রকাশিত" :
                                 post.status === "pending" ? "অপেক্ষমাণ" :
                                 post.status === "rejected" ? "প্রত্যাখ্যাত" : "সংশোধন প্রস্তাব"}
                              </span>
                              {post.duplicateMatch && (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                  ডুপ্লিকেট কন্টেন্ট ({post.duplicateMatch.similarityPercent}% মিল)
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-fg-muted mt-1">
                              ক্যাটাগরি: {post.categoryName || post.category} &bull; তারিখ: {bndSafe(post.publishedAt, "date")}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setReviewStory(post)}
                              className="px-3.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                            >
                              <FileCheck className="w-3.5 h-3.5" /> রিভিউ করুন
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AUTHORS MANAGEMENT SECTION */}
          {activeSection === "authors" && hasPerm(user?.role, "authors.view") && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-surface-alt rounded-2xl border border-border overflow-hidden shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3 gap-2 flex-wrap">
                  <h3 className="font-bold text-lg text-fg flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" /> নিবন্ধিত লেখকবৃন্দ ({authors.length}জন)
                  </h3>
                  {hasPerm(user?.role, "authors.manage") && (
                    <button
                      onClick={() => setShowAddAuthor(true)}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> নতুন লেখক যোগ করুন
                    </button>
                  )}
                </div>

                {loadingAuthors ? (
                  <div className="p-8 text-center text-fg-muted animate-pulse">লেখকদের তথ্য লোড হচ্ছে...</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {authors.map((author) => (
                      <div key={author.id} className="p-4 rounded-xl border border-border bg-zinc-50/50 dark:bg-zinc-800/20 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              src={author.profilePic}
                              name={author.name || author.username}
                              userId={author.id}
                              size="md"
                              className="w-11 h-11 rounded-full border border-blue-200"
                            />
                            <div>
                              <p className="font-bold text-fg text-sm">{author.name || author.username}</p>
                              <p className="text-xs text-fg-muted">@{author.username} &bull; রোল: {author.role}</p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleOpenAuthorStories(author)}
                            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-sm"
                          >
                            লেখকের সব গল্প দেখুন
                          </button>
                        </div>

                        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border text-center text-[11px]">
                          <div className="bg-green-50 dark:bg-green-950/30 p-1.5 rounded-lg border border-green-200/60 dark:border-green-900/40">
                            <span className="block text-green-700 dark:text-green-300 font-bold">{author.stats?.published || 0}</span>
                            <span className="text-fg-muted text-[10px]">প্রকাশিত</span>
                          </div>
                          <div className="bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                            <span className="block text-amber-700 dark:text-amber-300 font-bold">{author.stats?.pending || 0}</span>
                            <span className="text-fg-muted text-[10px]">অপেক্ষমাণ</span>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-950/30 p-1.5 rounded-lg border border-blue-200/60 dark:border-blue-900/40">
                            <span className="block text-blue-700 dark:text-blue-300 font-bold">{author.stats?.revision || 0}</span>
                            <span className="text-fg-muted text-[10px]">সংশোধন</span>
                          </div>
                          <div className="bg-red-50 dark:bg-red-950/30 p-1.5 rounded-lg border border-red-200/60 dark:border-red-900/40">
                            <span className="block text-red-700 dark:text-red-300 font-bold">{author.stats?.rejected || 0}</span>
                            <span className="text-fg-muted text-[10px]">বাতিল</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CONTACT MESSAGES SECTION */}
          {activeSection === "messages" && hasPerm(user?.role, "notifications.manage") && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-alt p-6 rounded-2xl border border-border shadow-sm">
                <div>
                  <h3 className="text-xl font-bold text-fg flex items-center gap-2">
                    <Mail className="w-6 h-6 text-blue-500" /> যোগাযোগ বার্তাসমূহ
                  </h3>
                  <p className="text-xs text-fg-muted mt-1">
                    ওয়েবসাইটের কন্টাক্ট ফর্ম পূরণ করে পাঠানো ব্যবহারকারীদের বার্তা ও মতামত।
                  </p>
                </div>
                <button
                  onClick={fetchContactMessages}
                  className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium text-xs rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                  রিফ্রেশ করুন
                </button>
              </div>

              {hasPerm(user?.role, "notifications.manage") && (
                <section className="overflow-hidden rounded-2xl border border-border bg-surface-alt shadow-sm">
                  <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="flex items-center gap-2 text-base font-bold text-fg">
                        <UserPlus className="h-5 w-5" />
                        নতুন সদস্যদের স্বাগতম ইমেইল
                      </h4>
                      <p className="mt-1 text-xs text-fg-muted">
                        গত ৭ দিনে নিবন্ধিত সদস্যদের তালিকা। পাঠানোর পর checkbox টিক দিলে status ডাটাবেসে থাকবে।
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-fg">
                        বাকি: {enToBnNumber(welcomeRecipients.filter((recipient) => !recipient.sentAt).length)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowSentWelcomeEmails((value) => !value)}
                        className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-fg transition-colors hover:bg-surface-hover"
                      >
                        {showSentWelcomeEmails ? "শুধু বাকি" : "পাঠানো হয়েছে"}
                      </button>
                      <button
                        type="button"
                        onClick={fetchWelcomeRecipients}
                        disabled={loadingWelcomeRecipients}
                        className="rounded-xl bg-fg px-3 py-2 text-xs font-semibold text-surface transition-opacity hover:opacity-85 disabled:opacity-50"
                      >
                        {loadingWelcomeRecipients ? "লোড হচ্ছে..." : "রিফ্রেশ"}
                      </button>
                    </div>
                  </div>

                  {welcomeRecipientsError && (
                    <p role="alert" className="m-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                      {welcomeRecipientsError}
                    </p>
                  )}

                  {loadingWelcomeRecipients && welcomeRecipients.length === 0 ? (
                    <p className="p-8 text-center text-sm text-fg-muted">নতুন সদস্যদের তালিকা লোড হচ্ছে...</p>
                  ) : (
                    (() => {
                      const visibleRecipients = welcomeRecipients.filter((recipient) =>
                        showSentWelcomeEmails ? recipient.sentAt : !recipient.sentAt,
                      );
                      if (visibleRecipients.length === 0) {
                        return (
                          <div className="p-8 text-center">
                            <p className="font-semibold text-fg">
                              {showSentWelcomeEmails ? "এখনো কোনো স্বাগতম ইমেইল পাঠানো হয়নি।" : "সব নতুন সদস্যকে স্বাগতম জানানো হয়েছে।"}
                            </p>
                            <p className="mt-1 text-xs text-fg-muted">
                              গত ৭ দিনে নিবন্ধিত সদস্যদের status এখানেই দেখা যাবে।
                            </p>
                          </div>
                        );
                      }
                      return (
                        <div className="divide-y divide-border">
                          {visibleRecipients.map((recipient) => (
                            <article key={recipient.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-bold text-fg">{recipient.name}</p>
                                  <span className="rounded-md bg-surface px-2 py-0.5 text-xs text-fg-muted">
                                    @{recipient.username}
                                  </span>
                                  {recipient.sentAt && (
                                    <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white">
                                      পাঠানো হয়েছে
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-sm text-fg-muted">
                                  {recipient.email || "ইমেইল ঠিকানা নেই"}
                                  <span className="mx-2">·</span>
                                  নিবন্ধন: {bndSafe(recipient.createdAt, "datetime")}
                                </p>
                                <details className="mt-2">
                                  <summary className="w-fit cursor-pointer text-xs font-semibold text-fg-muted hover:text-fg">
                                    স্বাগতম বার্তার খসড়া দেখুন
                                  </summary>
                                  <p className="mt-2 whitespace-pre-line rounded-xl border border-border bg-surface p-3 text-xs leading-5 text-fg-muted">
                                    {recipient.welcomeMessage}
                                  </p>
                                </details>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => sendWelcomeEmail({ data: recipient, title: recipient.name })}
                                  disabled={!recipient.email}
                                  className="rounded-xl bg-fg px-4 py-2.5 text-xs font-bold text-surface transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  ইমেইল খসড়া খুলুন
                                </button>
                                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold text-fg">
                                  <input
                                    type="checkbox"
                                    checked={recipient.sentAt}
                                    disabled={savingWelcomeStatus === recipient.id || !recipient.email}
                                    onChange={(event) => updateWelcomeEmailStatus(recipient, event.target.checked)}
                                    className="h-4 w-4 accent-emerald-700"
                                  />
                                  {savingWelcomeStatus === recipient.id ? "সংরক্ষণ..." : "পাঠানো হয়েছে"}
                                </label>
                              </div>
                            </article>
                          ))}
                        </div>
                      );
                    })()
                  )}
                </section>
              )}

              <div className="bg-surface-alt rounded-2xl border border-border shadow-sm overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800">
                {loadingContactMessages ? (
                  <div className="p-12 text-center text-sm text-fg-muted animate-pulse">বার্তা লোড হচ্ছে...</div>
                ) : contactMessages.length === 0 ? (
                  <div className="p-12 text-center text-sm text-fg-muted">কোনো বার্তা পাওয়া যায়নি।</div>
                ) : (
                  contactMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-4 sm:p-5 hover:bg-surface-hover transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        !msg.isRead ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {!msg.isRead && (
                            <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" title="নতুন বার্তা" />
                          )}
                          <span className="font-bold text-fg text-base">
                            {msg.name}
                          </span>
                          {msg.email && (
                            <span className="text-xs font-mono bg-surface-hover text-fg-muted px-2 py-0.5 rounded-md">
                              {msg.email}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                          {msg.subject}
                        </p>
                        <p className="text-xs text-fg-muted dark:text-fg-subtle line-clamp-2">
                          {msg.message}
                        </p>
                        <p className="text-[11px] text-fg-subtle">
                          তারিখ: {bndSafe(msg.createdAt, "datetime")}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                        <button
                          onClick={() => {
                            setSelectedContactMessage(msg);
                            if (!msg.isRead) toggleContactReadStatus(msg.id, false);
                          }}
                          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
                        >
                          পড়ুন
                        </button>
                        <button
                          onClick={() => toggleContactReadStatus(msg.id, msg.isRead)}
                          className="px-3 py-1.5 text-xs bg-surface-hover text-fg font-medium rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                          {msg.isRead ? "পড়া হয়নি চিহ্নিত করুন" : "পড়া হয়েছে চিহ্নিত করুন"}
                        </button>
                        <button
                          onClick={() => deleteContactMessage(msg.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                          title="ডিলিট করুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ADMIN NOTIFICATIONS CENTER SECTION */}
          {activeSection === "notifications" && hasPerm(user?.role, "notifications.view") && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-alt p-6 rounded-2xl border border-border shadow-sm">
                <div>
                  <h3 className="text-xl font-bold text-fg flex items-center gap-2">
                    <Bell className="w-6 h-6 text-rose-500" /> অ্যাডমিন নোটিফিকেশন সেন্টার
                  </h3>
                  <p className="text-xs text-fg-muted mt-1">
                    নতুন ইউজার নিবন্ধন, কন্টাক্ট বার্তা ও গুরুত্বপূর্ণ সাইট আপডেট নোটিফিকেশন।
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hasPerm(user?.role, "notifications.manage") && (
                    <button
                      onClick={() => setActiveSection("messages")}
                      className="rounded-xl bg-fg px-3.5 py-2 text-xs font-semibold text-surface transition-opacity hover:opacity-85"
                    >
                      নতুন সদস্যদের স্বাগতম
                    </button>
                  )}
                  <button
                    onClick={markAllAdminNotificationsRead}
                    className="px-3.5 py-2 bg-surface-hover text-fg font-medium text-xs rounded-xl hover:bg-zinc-200 transition-colors"
                  >
                    সবগুলো পড়া হয়েছে
                  </button>
                  <button
                    onClick={fetchAdminNotifications}
                    className="px-3.5 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium text-xs rounded-xl hover:bg-blue-100 transition-colors"
                  >
                    রিফ্রেশ
                  </button>
                </div>
              </div>

              <div className="bg-surface-alt rounded-2xl border border-border shadow-sm overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800">
                {loadingAdminNotifications ? (
                  <div className="p-12 text-center text-sm text-fg-muted animate-pulse">নোটিফিকেশন লোড হচ্ছে...</div>
                ) : adminNotifications.length === 0 ? (
                  <div className="p-12 text-center text-sm text-fg-muted">কোনো নোটিফিকেশন পাওয়া যায়নি।</div>
                ) : (
                  adminNotifications.map((ntf) => (
                    <div
                      key={ntf.id}
                      className={`p-4 sm:p-5 hover:bg-surface-hover transition-colors flex items-start justify-between gap-4 ${
                        !ntf.isRead ? "bg-rose-50/30 dark:bg-rose-950/20 border-l-4 border-l-rose-500" : ""
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md uppercase bg-surface-hover text-fg">
                            {ntf.type === "new_user_registration" ? <UserPlus className="w-3 h-3" /> :
                             ntf.type === "forgot_password_request" || ntf.type === "password_reset_link_generated" ? <KeyRound className="w-3 h-3" /> :
                             ntf.type === "contact_message" ? <Mail className="w-3 h-3" /> :
                             ntf.type === "story_submission" || ntf.type === "author_application" ? <FileCheck className="w-3 h-3" /> :
                             ntf.type === "verification_request" || ntf.type === "verification_approved" ? <BadgeCheck className="w-3 h-3" /> :
                             ntf.type === "deletion_request" ? <Trash2 className="w-3 h-3" /> :
                             ntf.type === "duplicate_story_flag" ? <AlertCircle className="w-3 h-3" /> :
                             ntf.type === "report" ? <Flag className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                            {ntf.type === "new_user_registration" ? "নতুন ইউজার" :
                             ntf.type === "forgot_password_request" || ntf.type === "password_reset_link_generated" ? "পাসওয়ার্ড রিসেট" :
                             ntf.type === "contact_message" ? "কন্টাক্ট বার্তা" :
                             ntf.type === "story_submission" ? "গল্প রিভিউ" :
                             ntf.type === "author_application" ? "লেখক আবেদন" :
                             ntf.type === "verification_request" || ntf.type === "verification_approved" ? "ভেরিফিকেশন" :
                             ntf.type === "deletion_request" ? "ডিলিট রিকোয়েস্ট" :
                             ntf.type === "duplicate_story_flag" ? "ডুপ্লিকেট" :
                             ntf.type === "report" ? "রিপোর্ট" : "ঘোষণা/আপডেট"}
                          </span>
                          <span className="font-bold text-fg text-sm">
                            {ntf.title}
                          </span>
                        </div>
                        <p className="text-xs text-fg font-medium">
                          {ntf.message}
                        </p>
                        {ntf.type === "new_user_registration" && (
                          <div className="mt-2 rounded-xl border border-border bg-surface p-3">
                            <p className="text-[11px] font-semibold text-fg-muted">
                              স্বাগতম ইমেইলের খসড়া
                              {ntf.data?.email ? ` · ${ntf.data.email}` : " · ইমেইল পাওয়া যায়নি"}
                            </p>
                            <p className="mt-1 whitespace-pre-line text-xs leading-5 text-fg-muted">
                              {ntf.data?.welcomeMessage || "ইমেইল খসড়া তৈরি করা যাচ্ছে না।"}
                            </p>
                          </div>
                        )}
                        <p className="text-[11px] text-fg-subtle">
                          তারিখ: {bndSafe(ntf.createdAt, "datetime")}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {ntf.type === "new_user_registration" && (
                          <>
                            <Link
                              href="/admin/users"
                              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
                            >
                              ইউজার দেখুন
                            </Link>
                            <button
                              onClick={() => sendWelcomeEmail(ntf)}
                              disabled={!ntf.data?.email}
                              className="px-3 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                              title="আপনার ইমেইল অ্যাপে খসড়াটি খুলুন; সেখান থেকে পাঠান"
                            >
                              ইমেইলে পাঠান
                            </button>
                          </>
                        )}
                        {ntf.type === "forgot_password_request" && (
                          <button
                            onClick={() => handleGenerateResetLink(ntf)}
                            disabled={resetLoading === ntf.id}
                            className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                          >
                            {resetLoading === ntf.id ? "তৈরি হচ্ছে..." : "রিসেট লিঙ্ক তৈরি"}
                          </button>
                        )}
                        {ntf.type === "contact_message" && (
                          <button
                            onClick={() => { setActiveSection("messages"); fetchContactMessages(); }}
                            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
                          >
                            বার্তা দেখুন
                          </button>
                        )}
                        {ntf.type === "verification_request" && (
                          <button
                            onClick={() => setActiveSection("verify")}
                            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
                          >
                            আবেদন দেখুন
                          </button>
                        )}
                        {ntf.type === "author_application" && (
                          <Link
                            href="/admin/applications"
                            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
                          >
                            আবেদন দেখুন
                          </Link>
                        )}
                        {ntf.type === "deletion_request" && (
                          <button
                            onClick={() => { setActiveSection("deletions"); fetchDeletionRequests(); }}
                            className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors"
                          >
                            রিভিউ করুন
                          </button>
                        )}
                        {ntf.type === "duplicate_story_flag" && (
                          <button
                            onClick={() => setActiveSection("review")}
                            className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl transition-colors"
                          >
                            রিভিউ সেন্টার
                          </button>
                        )}
                        <button
                          onClick={() => deleteAdminNotification(ntf.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                          title="ডিলিট করুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* VERIFICATION REQUESTS SECTION */}
          {activeSection === "verify" && hasPerm(user?.role, "users.view") && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm text-fg-muted">লেখকদের ভেরিফিকেশন ব্যাজ আবেদনসমূহ। অনুমোদন করলে লেখকের প্রোফাইলে নীল চেক ব্যাজ দেখা যাবে।</p>
                <button
                  onClick={fetchVerifyRequests}
                  className="px-3.5 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium text-xs rounded-xl hover:bg-blue-100 transition-colors"
                >
                  রিফ্রেশ
                </button>
              </div>

              <div className="bg-surface-alt rounded-2xl border border-border shadow-sm overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800">
                {loadingVerifyRequests ? (
                  <div className="p-12 text-center text-sm text-fg-muted animate-pulse">লোড হচ্ছে...</div>
                ) : verifyRequests.length === 0 ? (
                  <div className="p-12 text-center text-sm text-fg-muted">কোনো ভেরিফিকেশন আবেদন নেই।</div>
                ) : (
                  verifyRequests.map((vr) => (
                    <div key={vr.id} className="p-4 sm:p-5 hover:bg-surface-hover transition-colors flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md uppercase bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                            <BadgeCheck className="w-3 h-3" /> ভেরিফিকেশন
                          </span>
                          <span className="font-bold text-fg text-sm">
                            {vr.name || vr.username} (@{vr.username})
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                            vr.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                            vr.status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}>
                            {vr.status === "pending" ? "অপেক্ষমাণ" : vr.status === "approved" ? "অনুমোদিত" : "প্রত্যাখ্যাত"}
                          </span>
                        </div>
                        <p className="text-xs text-fg bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-lg leading-relaxed">
                          &ldquo;{vr.reason || "কারণ উল্লেখ নেই"}&rdquo;
                        </p>
                        <p className="text-[11px] text-fg-subtle">
                          আবেদনের তারিখ: {bndSafe(vr.createdAt, "datetime")} • প্রকাশিত গল্প: {enToBnNumber(vr.storyCount || 0)}টি
                          {vr.email && <> • ইমেইল: <span className="font-mono">{vr.email}</span></>}
                        </p>
                      </div>

                      {vr.status === "pending" && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleVerifyDecision(vr.id, "approved")}
                            className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors"
                          >
                            অনুমোদন করুন
                          </button>
                          <button
                            onClick={() => handleVerifyDecision(vr.id, "rejected")}
                            className="px-3 py-1.5 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium rounded-xl hover:bg-red-100 transition-colors"
                          >
                            প্রত্যাখ্যান
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* DELETION REQUESTS SECTION (superadmin only) */}
          {activeSection === "deletions" && hasPerm(user?.role, "deletion_requests.view") && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm text-fg-muted">অ্যাডমিনদের স্থায়ী ডিলিটের অনুরোধ। অনুমোদন করলে আইটেমটি চিরতরে মুছে যাবে।</p>
                <button
                  onClick={fetchDeletionRequests}
                  className="px-3.5 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium text-xs rounded-xl hover:bg-red-100 transition-colors"
                >
                  রিফ্রেশ
                </button>
              </div>

              <div className="bg-surface-alt rounded-2xl border border-border shadow-sm overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800">
                {loadingDeletionRequests ? (
                  <div className="p-12 text-center text-sm text-fg-muted animate-pulse">লোড হচ্ছে...</div>
                ) : deletionRequests.length === 0 ? (
                  <div className="p-12 text-center text-sm text-fg-muted">কোনো ডিলিট অনুরোধ নেই।</div>
                ) : (
                  deletionRequests.map((dr) => (
                    <div key={dr.id} className="p-4 sm:p-5 hover:bg-surface-hover transition-colors flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md uppercase bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                            <Trash2 className="w-3 h-3" /> {dr.targetType === "story" ? "গল্প" : dr.targetType === "comment" ? "কমেন্ট" : "ইউজার"}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                            dr.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                            dr.status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                            "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-fg-subtle"
                          }`}>
                            {dr.status === "pending" ? "অপেক্ষমাণ" : dr.status === "approved" ? "অনুমোদিত" : "প্রত্যাখ্যাত"}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-fg">{dr.title}</p>
                        <p className="text-xs text-fg-muted">
                          <span className="font-semibold">#{dr.targetId}</span> • অনুরোধ করেছেন: <span className="font-mono">{dr.requestedBy}</span>
                        </p>
                        {dr.reason && (
                          <p className="text-xs text-fg bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg">
                            কারণ: &ldquo;{dr.reason}&rdquo;
                          </p>
                        )}
                        <p className="text-[11px] text-fg-subtle">
                          {bndSafe(dr.createdAt, "datetime")}
                        </p>
                      </div>

                      {dr.status === "pending" && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleDeletionDecision(dr.id, "approved")}
                            className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors"
                          >
                            স্থায়ী ডিলিট
                          </button>
                          <button
                            onClick={() => handleDeletionDecision(dr.id, "rejected")}
                            className="px-3 py-1.5 text-xs bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-fg font-medium rounded-xl transition-colors"
                          >
                            প্রত্যাখ্যান
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* AUTHOR STORIES MODAL FOR ADMIN */}
      {viewingAuthor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface-alt border border-border w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl shadow-2xl p-6 space-y-6 relative">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-bold text-lg text-fg flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" /> @{viewingAuthor.username}-এর সকল লিখিত গল্প
                </h3>
                <p className="text-xs text-fg-muted mt-0.5">নিবন্ধিত লেখকের মোট {viewingAuthorStories.length}টি গল্প পাওয়া গেছে।</p>
              </div>
              <button 
                onClick={() => setViewingAuthor(null)}
                className="p-1 rounded-lg text-fg-subtle hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingAuthorStories ? (
              <div className="p-8 text-center text-sm text-fg-muted animate-pulse">লেখকের গল্পসমূহ লোড হচ্ছে...</div>
            ) : viewingAuthorStories.length === 0 ? (
              <div className="p-8 text-center text-sm text-fg-muted italic">এই লেখকের কোনো গল্প পাওয়া যায়নি।</div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {viewingAuthorStories.map((story) => (
                  <div key={story.slug} className="py-4 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h5 className="font-bold text-fg text-base">{story.title}</h5>
                        <p className="text-xs text-fg-muted mt-0.5">
                          ক্যাটাগরি: {story.category} &bull; জমা: {bndSafe(story.publishedAt, "date")}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                          story.status === "published" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
                          story.status === "pending" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" :
                          story.status === "rejected" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
                          "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                        }`}>
                          {story.status === "published" ? "প্রকাশিত" :
                           story.status === "pending" ? "অপেক্ষমাণ" :
                           story.status === "rejected" ? "প্রত্যাখ্যাত" : "সংশোধন প্রস্তাব"}
                        </span>

                        <button
                          onClick={() => setReviewStory(story)}
                          className="px-2.5 py-1 text-xs bg-blue-600 text-white font-bold rounded-lg"
                        >
                          রিভিউ
                        </button>
                        <Link
                          href={`/${story.uid || story.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 text-xs bg-surface text-fg border border-border font-bold rounded-lg hover:bg-surface-hover transition-colors"
                          title="গল্পটি দেখুন"
                        >
                          দেখুন
                        </Link>
                      </div>
                    </div>

                    {story.rejectionReason && (
                      <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs rounded-xl border border-amber-200 dark:border-amber-800/50">
                        <strong>এডমিন ফিডব্যাক:</strong> &ldquo;{story.rejectionReason}&rdquo;
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STORY REVIEW MODAL DRAWER */}
      {reviewStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="bg-surface-alt border border-border w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl relative p-5 sm:p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-lg text-fg flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-blue-500" /> গল্প রিভিউ ও অনুমোদন
              </h3>
              <button 
                onClick={() => setReviewStory(null)}
                className="p-1 rounded-lg text-fg-subtle hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reviewMsg && (
              <div className={`p-3.5 rounded-xl text-xs sm:text-sm font-medium ${
                reviewMsg.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
              }`}>
                {reviewMsg.text}
              </div>
            )}

            {/* Split View Desktop Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Story Content Preview */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-border space-y-2">
                  {reviewActionType === "edit_publish" ? (
                    <input 
                      type="text" 
                      value={editedTitle} 
                      onChange={(e) => setEditedTitle(e.target.value)} 
                      className="w-full font-bold text-xl text-fg bg-surface-alt p-2 rounded-lg border border-border outline-none"
                      placeholder="গল্পের শিরোনাম"
                    />
                  ) : (
                    <h4 className="font-bold text-xl text-fg">{reviewStory.title}</h4>
                  )}
                  <p className="text-xs text-fg-muted">লেখক: @{reviewStory.author || "admin"} &bull; স্লাগ: {reviewStory.slug}</p>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-800/20 p-4 rounded-2xl border border-border max-h-[600px] overflow-y-auto font-serif text-sm leading-relaxed whitespace-pre-line text-zinc-800 dark:text-zinc-200 space-y-3">
                  {reviewActionType === "edit_publish" ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2 font-sans not-italic text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-fg-muted mb-1 uppercase tracking-wider">ক্যাটাগরি</label>
                          <select
                            value={editedCategory}
                            onChange={(e) => setEditedCategory(e.target.value)}
                            className="w-full p-2.5 bg-surface-alt rounded-xl border border-border outline-none text-fg"
                          >
                            <option value="bodhu">বউ-ভাবি</option>
                            <option value="hot">হট ও এডাল্ট</option>
                            <option value="tarona">প্রতারণা ও পরকীয়া</option>
                            <option value="poribar">পারিবারিক</option>
                            <option value="choti">ছোট গল্প</option>
                            <option value="romantic">রোমান্টিক</option>
                            <option value="golpo">সাধারণ গল্প</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-fg-muted mb-1 uppercase tracking-wider">লেখক (ইউজারনেম / ID)</label>
                          <input
                            type="text"
                            value={editedAuthor}
                            onChange={(e) => setEditedAuthor(e.target.value)}
                            placeholder="@username বা ID"
                            className="w-full p-2.5 bg-surface-alt rounded-xl border border-border outline-none text-fg"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-fg-muted mb-1 uppercase tracking-wider">ট্যাগ (কমা দিয়ে পৃথকীকৃত)</label>
                          <input
                            type="text"
                            value={editedTags}
                            onChange={(e) => setEditedTags(e.target.value)}
                            placeholder="ট্যাগ১, ট্যাগ২"
                            className="w-full p-2.5 bg-surface-alt rounded-xl border border-border outline-none text-fg"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-fg-muted mb-1 uppercase tracking-wider">সিরিজ / পূর্ববর্তী গল্প Slug</label>
                          <input
                            type="text"
                            value={editedPreviousPost}
                            onChange={(e) => setEditedPreviousPost(e.target.value)}
                            placeholder="সিরিজের আগের গল্পের slug"
                            className="w-full p-2.5 bg-surface-alt rounded-xl border border-border outline-none text-fg"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-fg-muted mb-1 uppercase tracking-wider">কভার ইমেজের URL (ঐচ্ছিক)</label>
                          <input
                            type="text"
                            value={editedCover}
                            onChange={(e) => setEditedCover(e.target.value)}
                            placeholder="https://..."
                            className="w-full p-2.5 bg-surface-alt rounded-xl border border-border outline-none text-fg"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-fg-muted mb-1 font-sans uppercase tracking-wider">সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)</label>
                        <textarea
                          value={editedDescription}
                          onChange={(e) => setEditedDescription(e.target.value)}
                          className="w-full mb-3 bg-surface-alt p-3 rounded-xl border border-border outline-none text-xs leading-relaxed font-sans"
                          placeholder="সংক্ষিপ্ত বিবরণ..."
                          rows={2}
                        />
                      </div>

                      {/* Co-authors — admins can attach additional authors to a
                          story. The chips show what's already saved, the input
                          adds a new one by username or id, the X removes it. */}
                      <div>
                        <label className="block text-[11px] font-bold text-fg-muted mb-1.5 font-sans uppercase tracking-wider">
                          সহ-লেখক (Co-authors)
                        </label>
                        <div className="flex flex-wrap items-center gap-1.5 mb-2 min-h-[2rem]">
                          {coauthors.length === 0 && (
                            <span className="text-[11px] text-fg-subtle italic">কোনো সহ-লেখক নেই</span>
                          )}
                          {coauthors.map((ca) => (
                            <span
                              key={ca.userId}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-fg"
                            >
                              <span className="max-w-[160px] truncate">
                                {ca.name || ca.username || ca.userId}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeCoauthor(ca)}
                                disabled={coauthorBusy}
                                className="text-fg-subtle hover:text-red-500 transition-colors disabled:opacity-50"
                                title="সরিয়ে দিন"
                                aria-label={`${ca.name || ca.username || ca.userId} কে সরিয়ে দিন`}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={coauthorInput}
                            onChange={(e) => setCoauthorInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addCoauthor();
                              }
                            }}
                            placeholder="@username বা user id"
                            disabled={coauthorBusy}
                            className="flex-1 p-2 bg-surface-alt rounded-xl border border-border outline-none text-xs text-fg"
                          />
                          <button
                            type="button"
                            onClick={addCoauthor}
                            disabled={coauthorBusy || !coauthorInput.trim()}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {coauthorBusy ? "যোগ হচ্ছে..." : "যোগ করুন"}
                          </button>
                        </div>
                        {coauthorMsg && (
                          <p className={`mt-1.5 text-[11px] font-medium ${
                            coauthorMsg.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          }`}>
                            {coauthorMsg.text}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-fg-muted mb-1 font-sans uppercase tracking-wider">গল্পের মূল লেখা (Content)</label>
                        <textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="w-full min-h-[350px] bg-surface-alt p-3 rounded-xl border border-border outline-none font-serif text-sm leading-relaxed whitespace-pre-wrap"
                          placeholder="গল্পের মূল অংশ এখানে লিখুন..."
                        />
                      </div>

                      <SimilarityCheck
                        content={editedContent}
                        title={editedTitle}
                        excludeRef={reviewStory.uid || reviewStory.slug || null}
                      />
                    </>
                  ) : (
                    <>
                      {reviewStory.content || reviewStory.description || "গল্পের মূল কন্টেন্ট দেখাচ্ছে..."}
                      <div className="mt-4">
                        <SimilarityCheck
                          content={reviewStory.content || reviewStory.description || ""}
                          title={reviewStory.title}
                          excludeRef={reviewStory.uid || reviewStory.slug || null}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right Column: Author Info & Review Action Buttons */}
              <div className="space-y-4">
                <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-border space-y-3">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-fg-muted">গল্পের বিস্তারিত তথ্য</h5>
                  <p className="text-sm font-bold text-fg">@{reviewStory.author || "admin"}</p>
                  <p className="text-xs text-fg-muted">জমা দেওয়ার সময়: {bndSafe(reviewStory.publishedAt, "datetime")}</p>
                  <p className="text-xs text-fg-muted">ক্যাটাগরি: {reviewStory.categoryName || reviewStory.category}</p>
                  {reviewStory.tags && reviewStory.tags.length > 0 && (
                    <p className="text-xs text-fg-muted">ট্যাগ: {Array.isArray(reviewStory.tags) ? reviewStory.tags.join(", ") : reviewStory.tags}</p>
                  )}
                  {reviewStory.description && (
                    <div className="text-xs text-fg-muted mt-2">
                      <span className="font-bold">সারাংশ:</span>
                      <p className="mt-1 p-2 bg-surface-hover rounded border border-border whitespace-pre-wrap">{reviewStory.description}</p>
                    </div>
                  )}
                  {reviewStory.previousPost && (
                    <p className="text-xs text-fg-muted">সিরিজ: {reviewStory.previousPost}</p>
                  )}
                  {reviewStory.cover && (
                    <p className="text-xs text-fg-muted truncate">কভার: {reviewStory.cover}</p>
                  )}
                  <p className="text-xs text-fg-muted">বর্তমান স্ট্যাটাস: <span className="font-bold uppercase text-blue-600">{reviewStory.status || "published"}</span></p>
                </div>

                {/* 70%-80%+ Duplicate Story Warning Card */}
                {(() => {
                  const dup = Array.isArray(reviewStory?.history)
                    ? reviewStory.history.find((h: any) => h.event === "duplicate_flagged" && h.duplicateMatch)?.duplicateMatch
                    : reviewStory?.duplicateMatch;
                  if (!dup) return null;
                  return (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 space-y-2.5">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                        <span>ডুপ্লিকেট কন্টেন্ট ফ্ল্যাগ ({dup.similarityPercent}% মিল)</span>
                      </div>
                      <p className="text-xs leading-relaxed opacity-90">
                        এই গল্পের সাথে <strong>&quot;{dup.matchedTitle}&quot;</strong> গল্পের <strong>{dup.similarityPercent}% কন্টেন্ট মিল রয়েছে।</strong> আপনি কি এটি রাখবেন নাকি রিমুভ করবেন?
                      </p>
                      <div className="pt-1 flex flex-wrap gap-2 text-xs font-semibold">
                        <a
                          href={`/${dup.matchedSlug || dup.matchedUid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 transition-colors inline-flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> মূল গল্প দেখুন
                        </a>
                      </div>
                    </div>
                  );
                })()}

                {/* Feedback Input Prompt */}
                {reviewActionType && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800/50 space-y-3">
                    <label className="block text-xs font-bold text-amber-900 dark:text-amber-200">
                      {reviewActionType === "revision" ? "সংশোধনের নির্দেশনাবলী (আবশ্যক):" : 
                       reviewActionType === "reject" ? "প্রত্যাখ্যানের কারণ (আবশ্যক):" : 
                       "লেখকের জন্য মেসেজ (ঐচ্ছিক):"}
                    </label>
                    <textarea
                      value={feedbackInput}
                      onChange={(e) => setFeedbackInput(e.target.value)}
                      placeholder={reviewActionType === "edit_publish" ? "আমি এটি এডিট করে পাবলিশ করেছি..." : "এখানে লেখকের জন্য স্পষ্ট ফিডব্যাক লিখুন..."}
                      rows={3}
                      className="w-full p-2.5 text-xs bg-surface-alt rounded-xl border border-amber-300 dark:border-amber-700 outline-none text-fg"
                    />
                  </div>
                )}

                {/* Review Action Buttons */}
                <div className="space-y-2 pt-2">
                  {!reviewActionType ? (
                    <>
                      <button
                        disabled={reviewSubmitting}
                        onClick={() => handleManagePost("approve_publish", reviewStory.fileSlug || reviewStory.slug, reviewStory.title)}
                        className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" /> অনুমোদন ও প্রকাশ করুন
                      </button>

                      <button
                        disabled={reviewSubmitting}
        onClick={() => {
          setEditedTitle(reviewStory.title || "");
          setEditedContent(reviewStory.content || reviewStory.description || "");
          setEditedDescription(reviewStory.description || "");
          setEditedCategory(reviewStory.category || "golpo");
          setEditedTags(Array.isArray(reviewStory.tags) ? reviewStory.tags.join(", ") : reviewStory.tags || "");
          setEditedAuthor(reviewStory.authorId || reviewStory.authorUsername || reviewStory.author || "");
          setEditedCover(reviewStory.cover || "");
          setEditedPreviousPost(reviewStory.previousPost || "");
          setReviewActionType("edit_publish");
        }}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                      >
                        <Edit className="w-4 h-4" /> এডিট ও প্রকাশ করুন
                      </button>

                      <button
                        disabled={reviewSubmitting}
                        onClick={() => setReviewActionType("revision")}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                      >
                        <RotateCcw className="w-4 h-4" /> সংশোধন প্রস্তাব দিন
                      </button>

                      <button
                        disabled={reviewSubmitting}
                        onClick={() => setReviewActionType("reject")}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" /> রিজেক্ট করুন
                      </button>
                    </>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        disabled={reviewSubmitting || (reviewActionType !== "edit_publish" && !feedbackInput.trim())}
                        onClick={() => {
                          if (reviewActionType === "revision") {
                            handleManagePost("request_revision", reviewStory.fileSlug || reviewStory.slug, reviewStory.title, { feedback: feedbackInput });
                          } else if (reviewActionType === "reject") {
                            handleManagePost("reject", reviewStory.fileSlug || reviewStory.slug, reviewStory.title, { reason: feedbackInput });
                          } else if (reviewActionType === "edit_publish") {
                            handleManagePost("edit_publish", reviewStory.fileSlug || reviewStory.slug, reviewStory.title, {
                              feedback: feedbackInput,
                              editedTitle,
                              editedContent,
                              editedDescription,
                              editedCategory,
                              editedTags,
                              editedAuthor,
                              editedCover,
                              editedPreviousPost,
                            });
                          }
                        }}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" /> সাবমিট করুন
                      </button>
                      <button
                        onClick={() => setReviewActionType(null)}
                        className="px-3 py-2.5 bg-zinc-200 dark:bg-zinc-800 text-fg font-bold rounded-xl text-xs"
                      >
                        বাতিল
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* CONTACT MESSAGE READER MODAL */}
      {selectedContactMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface-alt border border-border w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-5 relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-lg text-fg flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-500" /> যোগাযোগের বার্তা বিবরণ
              </h3>
              <button
                onClick={() => setSelectedContactMessage(null)}
                className="p-1 rounded-lg text-fg-subtle hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3.5 rounded-2xl space-y-1.5 border border-zinc-200/60 dark:border-zinc-800">
                <p className="text-xs text-fg-muted">প্রেরক:</p>
                <p className="font-bold text-fg">{selectedContactMessage.name}</p>
                {selectedContactMessage.email && (
                  <p className="text-xs font-mono text-blue-600 dark:text-blue-400">{selectedContactMessage.email}</p>
                )}
                <p className="text-[11px] text-fg-subtle">তারিখ: {bndSafe(selectedContactMessage.createdAt, "datetime")}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1">বিষয়</p>
                <p className="font-bold text-fg text-base">{selectedContactMessage.subject}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1">বার্তা কন্টেন্ট</p>
                <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-border text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed text-sm">
                  {selectedContactMessage.message}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border gap-2 flex-wrap sm:flex-nowrap">
              {selectedContactMessage.email && (
                <a
                  href={`mailto:${selectedContactMessage.email}?subject=${encodeURIComponent("Re: " + selectedContactMessage.subject)}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-xs transition-colors"
                >
                  <Send className="w-4 h-4" /> ইমেইলে রিপ্লাই দিন
                </a>
              )}
              <button
                onClick={() => toggleContactReadStatus(selectedContactMessage.id, selectedContactMessage.isRead)}
                className="px-4 py-2.5 bg-surface-hover text-fg font-medium text-xs rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {selectedContactMessage.isRead ? "পড়া হয়নি চিহ্নিত করুন" : "পড়া হয়েছে চিহ্নিত করুন"}
              </button>
              <button
                onClick={() => deleteContactMessage(selectedContactMessage.id)}
                className="px-3 py-2.5 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-xl transition-colors"
                title="ডিলিট করুন"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD AUTHOR MODAL */}
      {showAddAuthor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-alt border border-border rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => { setShowAddAuthor(false); setAddAuthorMsg({ type: "", text: "" }); }}
              className="absolute top-4 right-4 p-1.5 text-fg-subtle hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-fg">নতুন লেখক যোগ করুন</h3>
                <p className="text-xs text-fg-muted dark:text-fg-subtle">লেখকের তথ্য দিয়ে একটি অ্যাকাউন্ট তৈরি করুন</p>
              </div>
            </div>

            {addAuthorMsg.text && (
              <div className={`p-3 rounded-xl text-sm ${addAuthorMsg.type === "error" ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800" : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800"}`}>
                {addAuthorMsg.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-fg-muted dark:text-fg-subtle mb-1">লেখকের নাম *</label>
                <input type="text" value={addAuthorForm.name} onChange={(e) => setAddAuthorForm(p => ({ ...p, name: e.target.value }))} className="input-field" placeholder="যেমন: রহিম চৌধুরী" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-fg-muted dark:text-fg-subtle mb-1">ইউজারনেম *</label>
                <input type="text" value={addAuthorForm.username} onChange={(e) => setAddAuthorForm(p => ({ ...p, username: e.target.value }))} className="input-field" placeholder="rahim_chowdhury" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-fg-muted dark:text-fg-subtle mb-1">ইমেইল</label>
                <input type="email" value={addAuthorForm.email} onChange={(e) => setAddAuthorForm(p => ({ ...p, email: e.target.value }))} className="input-field" placeholder="rahim@email.com" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-fg-muted dark:text-fg-subtle mb-1">বায়ো / পরিচিতি</label>
                <textarea value={addAuthorForm.bio} onChange={(e) => setAddAuthorForm(p => ({ ...p, bio: e.target.value }))} className="input-field h-20 resize-none" placeholder="লেখক সম্পর্কে সংক্ষিপ্ত তথ্য..." />
              </div>
              <div className="sm:col-span-2">
                <AvatarPicker value={addAuthorForm.profilePic} onChange={(v) => setAddAuthorForm(p => ({ ...p, profilePic: v }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-fg-muted dark:text-fg-subtle mb-1">ওয়েবসাইট</label>
                <input type="text" value={addAuthorForm.website} onChange={(e) => setAddAuthorForm(p => ({ ...p, website: e.target.value }))} className="input-field" placeholder="https://rahim.me" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-fg-muted dark:text-fg-subtle mb-1">ফেসবুক</label>
                <input type="text" value={addAuthorForm.facebook} onChange={(e) => setAddAuthorForm(p => ({ ...p, facebook: e.target.value }))} className="input-field" placeholder="https://facebook.com/rahim" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-fg-muted dark:text-fg-subtle mb-1">পাসওয়ার্ড (ঐচ্ছিক — ফাঁকা রাখলে লেখক পাসওয়ার্ড রিসেটের মাধ্যমে লগইন করতে পারবেন)</label>
                <input type="password" value={addAuthorForm.password} onChange={(e) => setAddAuthorForm(p => ({ ...p, password: e.target.value }))} className="input-field" placeholder="কমপক্ষে ৬ অক্ষর" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => { setShowAddAuthor(false); setAddAuthorMsg({ type: "", text: "" }); }}
                className="px-4 py-2.5 text-xs font-medium text-fg-muted hover:bg-surface-hover rounded-xl transition-colors"
              >
                বাতিল
              </button>
              <button
                onClick={handleAddAuthor}
                disabled={addAuthorLoading || !addAuthorForm.name.trim() || !addAuthorForm.username.trim()}
                className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors flex items-center gap-1.5"
              >
                {addAuthorLoading ? "তৈরি হচ্ছে..." : <><UserPlus className="w-4 h-4" /> লেখক তৈরি করুন</>}
              </button>
            </div>
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

      {/* AUTO PASSWORD RESET LINK MODAL */}
      {resetModalData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-alt border border-border rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setResetModalData(null)}
              className="absolute top-4 right-4 p-1.5 text-fg-subtle hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-fg">অটো পাসওয়ার্ড রিসেট লিঙ্ক</h3>
                <p className="text-xs text-fg-muted dark:text-fg-subtle">@{resetModalData.username} ইউজারের জন্য অটো-জেনারেটেড তথ্য</p>
              </div>
            </div>

            <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-border text-xs font-mono">
              <div>
                <span className="text-fg-muted block mb-1">অস্থায়ী পাসওয়ার্ড:</span>
                <div className="bg-surface-alt p-2.5 rounded-lg border border-border font-bold text-amber-600 dark:text-amber-400 text-sm select-all">
                  {resetModalData.tempPassword}
                </div>
              </div>

              <div>
                <span className="text-fg-muted block mb-1">অটো-লগইন রিসেট লিঙ্ক:</span>
                <div className="bg-surface-alt p-2.5 rounded-lg border border-border text-blue-600 dark:text-blue-400 text-xs break-all select-all flex items-center justify-between gap-2">
                  <span>{resetModalData.resetUrl}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(resetModalData.resetUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="p-1 text-fg-subtle hover:text-blue-600 shrink-0"
                    title="লিঙ্ক কপি করুন"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              {resetModalData.email ? (
                <a
                  href={`mailto:${resetModalData.email}?subject=${encodeURIComponent(resetModalData.emailSubject)}&body=${encodeURIComponent(resetModalData.emailBody)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Mail className="w-4 h-4" /> ইমেইলে সরাসরি লিঙ্ক পাঠান
                </a>
              ) : (
                <div className="text-xs text-amber-500 bg-amber-50 dark:bg-amber-900/20 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 text-center flex-1">
                  ইউজারের কোনো ইমেইল সেট নেই। উপরের লিঙ্ক বা পাসওয়ার্ড কপি করে ইউজারকে পাঠান।
                </div>
              )}
              <button
                onClick={() => setResetModalData(null)}
                className="py-2.5 px-4 bg-zinc-200 dark:bg-zinc-800 text-fg rounded-xl font-semibold text-xs hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
