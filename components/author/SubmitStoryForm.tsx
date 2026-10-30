"use client";
import { getClientSiteUrl } from "@/lib/client-config";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  PenTool, CheckCircle, AlertCircle, Bold, Italic, Quote,
  Link as LinkIcon, Send, Eye, Image as ImageIcon, Tag, X, FileText, Languages, Loader2, Import as ImportIcon, Sparkles
} from "lucide-react";
import { extractTextFromFile } from "@/lib/file-import";
import { UserAvatar } from "@/components/UserAvatar";

interface Category {
  id: string;
  name: string;
}

export function SubmitStoryForm({ initialStoryData }: { initialStoryData?: any }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [cover, setCover] = useState("");
  const [previousPost, setPreviousPost] = useState("");
  const [previewMode, setPreviewMode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | ""; text: string }>({ type: "", text: "" });
  const [submittedLink, setSubmittedLink] = useState<string | null>(null);

  useEffect(() => {
    if (initialStoryData) {
      setTitle(initialStoryData.title || "");
      setCategory(initialStoryData.category || "");
      setDescription(initialStoryData.description || "");
      setContent(initialStoryData.content || "");
      setTags(initialStoryData.tags || "");
      setCover(initialStoryData.cover || "");
      setPreviousPost(initialStoryData.previousPost || "");
    }
  }, [initialStoryData]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [authorStories, setAuthorStories] = useState<{ uid: string; slug: string; title: string }[]>([]);
  const [coAuthors, setCoAuthors] = useState<string[]>([]);
  const [coAuthorQuery, setCoAuthorQuery] = useState("");
  const [coAuthorResults, setCoAuthorResults] = useState<any[]>([]);
  const [coAuthorSearching, setCoAuthorSearching] = useState(false);

  // Search users for co-author suggestions
  useEffect(() => {
    if (coAuthorQuery.trim().length < 2) {
      setCoAuthorResults([]);
      return;
    }
    const t = setTimeout(() => {
      setCoAuthorSearching(true);
      fetch(`/api/users/search?q=${encodeURIComponent(coAuthorQuery.trim())}`)
        .then(r => r.ok ? r.json() : { users: [] })
        .then(d => setCoAuthorResults(d.users || []))
        .catch(() => setCoAuthorResults([]))
        .finally(() => setCoAuthorSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [coAuthorQuery]);

  const addCoAuthor = (username: string) => {
    setCoAuthors(prev => prev.includes(username) ? prev : [...prev, username]);
    setCoAuthorQuery("");
    setCoAuthorResults([]);
  };

  const removeCoAuthor = (username: string) => {
    setCoAuthors(prev => prev.filter(u => u !== username));
  };

  const DRAFT_KEY = "author_story_draft";

  // Fetch author stories for previousPost dropdown selection
  useEffect(() => {
    fetch("/api/author/my-stories?brief=1")
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.stories || []);
        setAuthorStories(list.map((s: any) => ({
          uid: String(s.uid || s.slug),
          slug: s.slug,
          title: s.title
        })));
      })
      .catch(() => {});
  }, []);

  // Load categories and tags
  useEffect(() => {
    fetch("/api/posts")
      .then(res => res.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          // Categories
          const catMap = new Map<string, string>();
          const tagSet = new Set<string>();
          data.forEach(p => {
            if (p.categoryId && p.categoryName) catMap.set(p.categoryId, p.categoryName);
            if (Array.isArray(p.tags)) p.tags.forEach((t: string) => tagSet.add(t));
          });
          const catList = Array.from(catMap.entries()).map(([id, name]) => ({ id, name }));
          if (catList.length > 0) {
            setCategories(catList);
            setCategory(catList[0].id);
          }
          setSuggestedTags(Array.from(tagSet).slice(0, 30));
        }
      })
      .catch(() => {});
  }, []);

  // Fetch dynamic tag recommendations based on co-occurrence and current tags
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/tags/recommendations?tags=${encodeURIComponent(tags)}&category=${encodeURIComponent(category)}&content=${encodeURIComponent(content.slice(0, 2000))}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
            setSuggestedTags(data.recommendations);
          }
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [tags, category, content]);

  // Load draft from localStorage
  useEffect(() => {
    if (initialStoryData) return; // Do not overwrite edit data with local draft
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.title || d.content) {
          setTitle(d.title || "");
          setCategory(d.category || "");
          setDescription(d.description || "");
          setContent(d.content || "");
          setTags(d.tags || "");
          setCover(d.cover || "");
          setPreviousPost(d.previousPost || "");
        }
      }
    } catch {}
  }, [initialStoryData]);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (!initialStoryData && (title || content)) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, category, description, content, tags, cover, previousPost }));
      } catch {}
    }
  }, [title, category, description, content, tags, cover, previousPost, initialStoryData]);

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  };

  const [translating, setTranslating] = useState(false);
  const [importingPrev, setImportingPrev] = useState(false);
  const [importingFile, setImportingFile] = useState(false);
  const [previousPostMsg, setPreviousPostMsg] = useState("");

  // Tracks the last auto-imported / initial previous-post value so auto-import
  // only fires when the user actually changes the field (not on form open).
  const prevImportRef = useRef<string>(initialStoryData?.previousPost || "");

  // Auto-import the previous post's title, tags, category & description when a slug/link/uid is entered
  const handleImportPrevious = useCallback(async (ref?: string) => {
    const prevRef = (ref ?? previousPost).trim();
    if (!prevRef) return;
    setImportingPrev(true);
    setPreviousPostMsg("");
    try {
      const res = await fetch(`/api/posts/lookup?ref=${encodeURIComponent(prevRef)}`);
      const json = await res.json();
      if (res.ok && json && json.title) {
        const resolvedRef = json.uid || json.slug || prevRef;
        prevImportRef.current = resolvedRef;
        setPreviousPost(resolvedRef);
        setCategory(json.category || category);
        setTags(json.tags?.length ? json.tags.join(", ") : tags);
        if (json.title) setTitle(json.title);
        if (json.description) setDescription(json.description);
        if (json.cover) setCover(json.cover);
        setPreviousPostMsg(`"${json.title}" থেকে ট্যাগ, ক্যাটাগরি, শিরোনাম, কভার ও বিবরণ আমদানি হয়েছে।`);
      } else {
        setPreviousPostMsg(json.error || "লেখা পাওয়া যায়নি।");
      }
    } catch {
      setPreviousPostMsg("আগের লেখা আমদানি করতে সমস্যা হয়েছে।");
    } finally {
      setImportingPrev(false);
    }
  }, [previousPost, category, tags]);

  // Auto-import automatically when a complete-looking uid or link is typed/pasted
  useEffect(() => {
    const ref = (previousPost || "").trim();
    if (!ref || !(ref.startsWith("http") || /^\d{10,}$/.test(ref))) return;
    if (ref === prevImportRef.current) return;
    const t = setTimeout(() => handleImportPrevious(ref), 800);
    return () => clearTimeout(t);
  }, [previousPost, handleImportPrevious]);

  // Import story text from .txt / .docx / .pdf file
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingFile(true);
    try {
      const text = await extractTextFromFile(file);
      if (text) {
        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        if (!title.trim() && fileNameWithoutExt) {
          setTitle(fileNameWithoutExt);
        }
        setContent(text);
      }
    } catch {
      setStatus({ type: "error", text: "ফাইল থেকে লেখা আমদানি করা যায়নি।" });
    } finally {
      setImportingFile(false);
      e.target.value = "";
    }
  };

  const handleTranslate = async () => {
    if (!content.trim() && !title.trim()) {
      setStatus({ type: "error", text: "অনুবাদ করার জন্য কিছু লেখা বা শিরোনাম দিন।" });
      return;
    }

    setTranslating(true);
    setStatus({ type: "", text: "" });

    try {
      // Translate title if present and contains English
      let newTitle = title;
      if (title.trim() && /[a-zA-Z]/.test(title)) {
        const resTitle = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: title }),
        });
        const dTitle = await resTitle.json();
        if (dTitle.translatedText) newTitle = dTitle.translatedText;
      }

      // Translate content body
      let newContent = content;
      if (content.trim()) {
        const resContent = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: content }),
        });
        const dContent = await resContent.json();
        if (dContent.translatedText) newContent = dContent.translatedText;
      }

      setTitle(newTitle);
      setContent(newContent);
      setStatus({ type: "success", text: "লেখা সফলভাবে বাংলায় অনূদিত হয়েছে!" });
    } catch {
      setStatus({ type: "error", text: "অনুবাদ করতে সমস্যা হয়েছে।" });
    } finally {
      setTranslating(false);
    }
  };

  const applyFormatting = (prefix: string, suffix: string = prefix) => {
    const textarea = document.getElementById("author-story-textarea") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);
    const before = content.slice(0, start);
    const after = content.slice(end);
    const newContent = `${before}${prefix}${selected}${suffix}${after}`;
    setContent(newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const handleTagClick = (tag: string) => {
    const current = tags.split(",").map(t => t.trim()).filter(Boolean);
    if (!current.includes(tag)) {
      setTags([...current, tag].join(", "));
    }
  };

  const removeTag = (tag: string) => {
    const current = tags.split(",").map(t => t.trim()).filter(Boolean);
    setTags(current.filter(t => t !== tag).join(", "));
  };

  const currentTags = tags.split(",").map(t => t.trim()).filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setStatus({ type: "error", text: "গল্পের শিরোনাম এবং মূল লেখা আবশ্যক।" });
      return;
    }

    setLoading(true);
    setStatus({ type: "", text: "" });

    try {
      const res = await fetch("/api/author/submit-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title, category, description, content, tags: currentTags, cover, previousPost,
          slug: initialStoryData?.slug || undefined,
          uid: initialStoryData?.uid || undefined,
          publishedAt: initialStoryData?.publishedAt || undefined,
          history: initialStoryData?.history || undefined,
          version: initialStoryData?.version || undefined,
          coAuthors
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const base = typeof window !== "undefined" ? window.location.origin : getClientSiteUrl();
        setSubmittedLink(`${base}/${data.uid || data.slug || ""}`);
        setStatus({ type: "success", text: "আপনার গল্পটি সফলভাবে জমা হয়েছে! অ্যাডমিন পর্যালোচনার পরই এটি সঙ্গে সঙ্গে প্রকাশিত হবে।" });
        clearDraft();
        setTitle(""); setDescription(""); setContent(""); setTags(""); setCover(""); setPreviousPost("");
        setCoAuthors([]);
      } else {
        setStatus({ type: "error", text: data.error || "গল্প জমা দিতে সমস্যা হয়েছে।" });
      }
    } catch {
      setStatus({ type: "error", text: "একটি অনাকাঙ্ক্ষিত সমস্যা ঘটেছে। আবার চেষ্টা করুন।" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-fg">
            {initialStoryData ? "গল্পটি সম্পাদনা করুন" : "নতুন গল্প লিখুন"}
          </h2>
          <p className="text-xs text-fg-muted">
            {initialStoryData
              ? "আপনার গল্পের ভুলত্রুটি সংশোধন করে পুনরায় জমা দিন"
              : "আপনার লেখা চটি গল্প সরাসরি পোস্ট করুন এবং পাঠকদের সাথে শেয়ার করুন"}
          </p>
        </div>
      </div>

      {status.text && (
        <div className={`p-4 rounded-2xl text-sm font-medium ${
          status.type === "error"
            ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800"
            : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800"
        }`}>
          <div className="flex items-center gap-3">
            {status.type === "error" ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
            <span>{status.text}</span>
          </div>
          {submittedLink && status.type === "success" && (
            <div className="mt-3 flex items-center gap-2 text-xs font-mono bg-green-100 dark:bg-green-900/30 p-2.5 rounded-xl border border-green-200 dark:border-green-800">
              <span className="font-bold text-green-800 dark:text-green-300 shrink-0">গল্পের লিংক:</span>
              <a href={submittedLink} target="_blank" rel="noopener noreferrer" className="text-blue-700 dark:text-blue-300 font-semibold truncate hover:underline select-all">
                {submittedLink}
              </a>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title & Live UID Link Preview */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-3">
          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full text-2xl font-bold bg-transparent border-0 border-b border-border focus:ring-0 focus:border-accent px-0 py-2 text-fg placeholder:text-fg-subtle outline-none"
            placeholder="গল্পের শিরোনাম লিখুন..."
          />

          {/* Live Story Link Preview Banner */}
          <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-amber-800 dark:text-amber-300 shrink-0">গল্পের লাইভ লিংক:</span>
              <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold truncate select-all">
                {`${typeof window !== "undefined" ? window.location.origin : getClientSiteUrl()}/${initialStoryData?.uid || initialStoryData?.slug || submittedLink?.split("/").pop() || `${Date.now()}${Math.floor(Math.random() * 10)}`}`}
              </span>
            </div>
            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-bold bg-white dark:bg-zinc-900 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 shrink-0">
              অপ্রকাশিত (প্রকাশের পর অ্যাক্টিভ হবে)
            </span>
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1.5">ক্যাটাগরি</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="input-field"
              >
                {categories.length > 0 ? (
                  categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))
                ) : (
                  <>
                    <option value="golpo">গল্প</option>
                    <option value="hot">গরম গল্প</option>
                    <option value="prem">প্রেম</option>
                  </>
                )}
              </select>
            </div>

            {/* Previous Post (Series) */}
            <div>
              <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1.5">
                পূর্ববর্তী গল্প / পর্ব (সিরিজের জন্য)
              </label>
              {authorStories.length > 0 && (
                <select
                  value={previousPost}
                  onChange={e => {
                    setPreviousPost(e.target.value);
                    if (e.target.value) handleImportPrevious(e.target.value);
                  }}
                  className="input-field mb-2"
                >
                  <option value="">-- পূর্বে প্রকাশিত গল্প থেকে সিলেক্ট করুন (ঐচ্ছিক) --</option>
                  {authorStories.map(s => (
                    <option key={s.uid} value={s.uid}>
                      {s.title} ({s.uid})
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={previousPost}
                  onChange={e => setPreviousPost(e.target.value)}
                  className="input-field flex-1"
                  placeholder="অথবা আগের গল্পের লিংক/UID টাইপ করুন (যেমন: 36018122306690)"
                />
                <button
                  type="button"
                  onClick={() => handleImportPrevious()}
                  disabled={importingPrev || !previousPost.trim()}
                  className="px-2.5 py-1.5 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 border border-border rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0"
                  title="আগের লেখার ট্যাগ, ক্যাটাগরি ও শিরোনাম আমদানি করুন"
                >
                  {importingPrev ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImportIcon className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">আমদানি</span>
                </button>
              </div>
              {previousPostMsg && (
                <p className={`text-xs mt-1.5 ${previousPostMsg.includes("আমদানি হয়েছে") ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                  {previousPostMsg}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1.5">
              সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="input-field resize-none"
              placeholder="গল্পের এক বা দুই লাইনের সারাংশ..."
            />
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> কভার ছবির লিংক বা পাথ (ঐচ্ছিক)
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={cover}
                onChange={e => {
                  const val = e.target.value;
                  if (val.startsWith("data:image")) {
                    alert("ছবি ডেটাবেসে আপলোড করা যায় না। শুধুমাত্র পাবলিক ফোল্ডারের ছবির লিংক (যেমন: /images/Cover_pic/...) বা অনলাইন ছবির লিংক ব্যবহার করুন।");
                    return;
                  }
                  setCover(val);
                }}
                className="input-field flex-1"
                placeholder="/images/Cover_pic/cover.jpg বা https://example.com/image.jpg"
              />
              {cover && (
                <button
                  type="button"
                  onClick={() => setCover("")}
                  className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 rounded-xl text-xs font-semibold transition-colors shrink-0 flex items-center gap-1"
                  title="কভার ছবি রিমুভ করুন"
                >
                  <X className="w-3 h-3" /> ছবি রিমুভ
                </button>
              )}
            </div>
            <p className="text-[11px] text-fg-muted mt-1">
              ইমেজ ফাইল ডেটাবেসে সেভ হবে না। শুধুমাত্র পাবলিক ফোল্ডার <code>/images/Cover_pic/</code>-এর লিংক বা ওয়েব লিংক ব্যবহার করুন। ফাঁকা রাখলে স্বয়ংক্রিয়ভাবে একটি ছবি নিযুক্ত হবে।
            </p>
            {cover && (
              <div className="mt-2 w-24 h-16 rounded-lg overflow-hidden border border-border relative">
                <Image src={cover} alt="cover preview" fill sizes="96px" className="object-cover rounded-lg" unoptimized />
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Tag className="w-3 h-3" /> ট্যাগ (কমা দিয়ে আলাদা করুন)
            </label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="input-field"
              placeholder="যেমন: রোমান্স, থ্রিলার, রহস্য"
            />
            {/* Current tags pills */}
            {currentTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {currentTags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 bg-fg/10 text-fg text-xs px-2.5 py-1 rounded-full">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Smart Dynamic Related Suggested Tags */}
            {suggestedTags.length > 0 && (
              <div className="mt-3">
                <span className="text-[11px] text-accent font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> ডাইনামিক সম্পর্কিত ট্যাগ সাজেশন:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedTags
                    .filter(t => !currentTags.includes(t.trim()))
                    .slice(0, 12)
                    .map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleTagClick(tag)}
                        className="text-xs bg-accent/10 hover:bg-accent/20 text-accent font-semibold px-3 py-1 rounded-full border border-accent/20 transition-all shadow-sm hover:scale-105 active:scale-95"
                      >
                        + {tag}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Co-Authors */}
          <div>
            <label className="block text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1.5">
              সহ-লেখক (Co-Authors) — ঐচ্ছিক
            </label>
            <div className="relative">
              <input
                type="text"
                value={coAuthorQuery}
                onChange={e => setCoAuthorQuery(e.target.value)}
                className="input-field"
                placeholder="অন্য লেখকের ইউজারনেম লিখে সার্চ করুন..."
              />
              {coAuthorQuery.trim().length >= 2 && (
                <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-surface border border-border rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {coAuthorSearching ? (
                    <div className="p-2.5 text-xs text-fg-muted text-center">খুঁজছে...</div>
                  ) : coAuthorResults.length === 0 ? (
                    <div className="p-2.5 text-xs text-fg-muted text-center">কোনো ব্যবহারকারী পাওয়া যায়নি</div>
                  ) : (
                    coAuthorResults.map((u: any) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => addCoAuthor(u.username)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left hover:bg-surface-hover transition-colors"
                      >
                        <div className="w-6 h-6 rounded-full shrink-0 overflow-hidden">
                          <UserAvatar
                            src={u.profilePic}
                            name={u.name || u.username}
                            userId={u.id}
                            size="sm"
                            className="w-6 h-6"
                          />
                        </div>
                        <span className="font-medium text-fg">{u.name || u.username}</span>
                        <span className="text-fg-subtle">@{u.username}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {coAuthors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {coAuthors.map(u => (
                  <span key={u} className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                    @{u}
                    <button type="button" onClick={() => removeCoAuthor(u)} className="hover:text-red-500 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-2.5 bg-surface-alt border-b border-border flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => applyFormatting("**")}
                className="p-1.5 text-fg-muted hover:text-fg hover:bg-surface-hover rounded-lg transition-colors"
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("*")}
                className="p-1.5 text-fg-muted hover:text-fg hover:bg-surface-hover rounded-lg transition-colors"
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("> ", "")}
                className="p-1.5 text-fg-muted hover:text-fg hover:bg-surface-hover rounded-lg transition-colors"
                title="Quote"
              >
                <Quote className="w-4 h-4" />
              </button>

              <label 
                className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                title=".txt / .docx / .pdf ফাইল থেকে লেখা আপলোড করুন"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-xs">{importingFile ? "আপলোড হচ্ছে..." : "ফাইল আপলোড"}</span>
                <input
                  type="file"
                  accept=".txt,.md,.docx,.pdf"
                  className="hidden"
                  onChange={handleFileImport}
                />
              </label>
              <button
                type="button"
                disabled={translating}
                onClick={handleTranslate}
                className="p-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                title="ইংরেজি লেখা বাংলায় অটোমেটিক অনুবাদ করুন"
              >
                {translating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                    <span className="text-xs">অনুবাদ হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Languages className="w-4 h-4 text-purple-600" />
                    <span className="text-xs">বাংলা অনুবাদ (Auto)</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => applyFormatting("[", "](url)")}
                className="p-1.5 text-fg-muted hover:text-fg hover:bg-surface-hover rounded-lg transition-colors"
                title="Link"
              >
                <LinkIcon className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-border mx-1" />
              <span className="text-[10px] text-fg-subtle">
                {content.length.toLocaleString("bn-BD")} অক্ষর
              </span>
            </div>

            {/* Write / Preview toggle */}
            <div className="flex items-center gap-1 bg-surface p-0.5 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setPreviewMode(false)}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  !previewMode ? "bg-fg text-surface shadow-sm" : "text-fg-muted hover:text-fg"
                }`}
              >
                লিখুন
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode(true)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  previewMode ? "bg-fg text-surface shadow-sm" : "text-fg-muted hover:text-fg"
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> প্রিভিউ
              </button>
            </div>
          </div>

          {/* Editor / Preview body */}
          {previewMode ? (
            <div className="min-h-[400px] p-5 overflow-y-auto text-fg leading-relaxed">
              {content ? (
                content.split(/\n\n+/).map((paragraph, idx) => (
                  <p key={idx} className="mb-5 text-base leading-[1.85]">{paragraph.trim()}</p>
                ))
              ) : (
                <p className="text-fg-subtle italic">প্রিভিউ করার কিছু নেই।</p>
              )}
            </div>
          ) : (
            <textarea
              id="author-story-textarea"
              required
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="এখানে আপনার সম্পূর্ণ গল্পটি লিখুন...&#10;&#10;প্যারাগ্রাফের মাঝে একটি ফাঁকা লাইন দিন।"
              className="w-full min-h-[400px] p-5 text-base leading-relaxed bg-transparent border-0 focus:ring-0 resize-y text-fg placeholder:text-fg-subtle outline-none font-bengali"
              style={{ lineHeight: "1.85" }}
            />
          )}
        </div>

        {/* Submit Row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-fg-subtle">
            গল্পটি স্বয়ংক্রিয়ভাবে ড্রাফট সংরক্ষিত হচ্ছে
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={clearDraft}
              className="text-xs text-fg-muted hover:text-red-500 transition-colors"
            >
              ড্রাফট মুছুন
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !content.trim()}
              className="btn-primary px-6 py-2.5 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-pulse">জমা হচ্ছে...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  গল্প জমা দিন
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
