"use client";
import { bndSafe } from "@/lib/utils";

import { getClientSiteUrl, getClientSiteConfig } from "@/lib/client-config";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Send, Image as ImageIcon, Bold, Italic, Link as LinkIcon, Quote, FileText, Languages, Loader2, X, Import as ImportIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { extractTextFromFile } from "@/lib/file-import";
import { SimilarityCheck } from "./SimilarityCheck";

interface EditorProps {
  initialData: any;
  draftName?: string;
  categories: { id: string; name: string }[];
  authors: { id: string; name: string }[];
  suggestedTags?: string[];
  nextUid?: string;
  availableCovers?: string[];
}

export default function StoryEditor({ initialData, draftName, categories, authors, suggestedTags = [], nextUid, availableCovers = [] }: EditorProps) {
  const router = useRouter();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    uid: initialData?.uid || "",
    title: initialData?.title || "",
    description: initialData?.description || "",
    author: initialData?.author || "admin",
    category: initialData?.category || categories[0]?.id || "",
    tags: initialData?.tags || "",
    cover: initialData?.cover || "",
    content: initialData?.content || "",
    previousPost: initialData?.previousPost || "",
    featured: initialData?.featured || false,
    publishedAt: initialData?.publishedAt || "",
    scheduledAt: initialData?.scheduledAt || "",
    sha: "", // used for updates
  });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!draftName);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [hasRestored, setHasRestored] = useState(false);
  const [importingPrev, setImportingPrev] = useState(false);
  const [importingFile, setImportingFile] = useState(false);
  const [importingUrl, setImportingUrl] = useState(false);
  const [urlImportInput, setUrlImportInput] = useState("");
  const [urlImportError, setUrlImportError] = useState("");
  const [translating, setTranslating] = useState(false);
  const [authorStories, setAuthorStories] = useState<{ uid: string; slug: string; title: string }[]>([]);
  const [previousPostMsg, setPreviousPostMsg] = useState("");
  const [availableAuthors, setAvailableAuthors] = useState(authors);
  const [dynamicTags, setDynamicTags] = useState<string[]>(suggestedTags);

  // Fetch dynamic tag recommendations based on co-occurrence and current tags
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/tags/recommendations?tags=${encodeURIComponent(formData.tags)}&category=${encodeURIComponent(formData.category)}&content=${encodeURIComponent((formData.content || "").slice(0, 2000))}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
            setDynamicTags(data.recommendations);
          }
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [formData.tags, formData.category, formData.content]);

  const fetchDraft = useCallback(async (name: string) => {
    try {
      // Drafts are DB stories (status=draft) — load from the database, not GitHub.
      const res = await fetch(`/api/author/story-content?slug=${encodeURIComponent(name)}`);
      const json = await res.json();

      if (res.ok && json.story) {
        setFormData(prev => ({
          ...prev,
          title: json.story.title || "",
          category: json.story.category || "golpo",
          description: json.story.description || "",
          content: json.story.content || "",
          cover: json.story.cover || "",
          tags: json.story.tags || "",
          previousPost: json.story.previousPost || "",
          publishedAt: json.story.publishedAt || "",
          uid: json.story.uid || prev.uid,
        }));
      } else {
        setError("ড্রাফট লোড করা যায়নি।");
      }
    } catch (err) {
      setError("ড্রাফট লোড করতে সমস্যা হয়েছে।");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ 
        ...prev, 
        ...initialData,
        cover: initialData.cover || prev.cover
      }));
    } else if (draftName) {
      // Fetch draft from GitHub
      fetchDraft(draftName);
    } else {
      // It's a brand new post, set a random cover only on the client
      setFormData(prev => {
        if (!prev.cover) {
          let selected = "1.jpg"; // fallback
          if (availableCovers && availableCovers.length > 0) {
            let bag: string[] = [];
            try {
              const stored = localStorage.getItem("cover_bag");
              if (stored) bag = JSON.parse(stored);
            } catch (e) {}
            
            // If the bag is empty or doesn't match available covers, reshuffle
            if (!bag || bag.length === 0 || !bag.every(c => availableCovers.includes(c))) {
              bag = [...availableCovers];
              for (let i = bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [bag[i], bag[j]] = [bag[j], bag[i]];
              }
            }
            
            selected = bag.pop() || availableCovers[0];
            localStorage.setItem("cover_bag", JSON.stringify(bag));
          } else {
             // Fallback if availableCovers didn't load
             selected = `${Math.floor(Math.random() * 12) + 1}.jpg`;
          }
          const randomCover = `${getClientSiteConfig().coverFallbackDir || "/images/Cover_pic/"}${selected}`;
          return { ...prev, cover: randomCover };
        }
        return prev;
      });
    }
  }, [initialData, draftName, availableCovers, fetchDraft]);

  // Auto-save to localStorage
  useEffect(() => {
    if (!fetching && (formData.title || formData.content)) {
      const saveKey = draftName ? `draft_${draftName}` : initialData?.uid ? `post_${initialData.uid}` : "new_post";
      localStorage.setItem(saveKey, JSON.stringify(formData));
    }
  }, [formData, fetching, draftName, initialData]);

  // Load all stories for previous-post dropdown + auto-import
  useEffect(() => {
    fetch("/api/author/my-stories?all=true")
      .then(res => res.json())
      .then((json: any) => {
        if (json && Array.isArray(json.stories)) {
          setAuthorStories(json.stories.map((s: any) => ({
            uid: String(s.uid || s.slug),
            slug: s.slug,
            title: s.title
          })));
        }
      })
      .catch(() => {});
  }, []);

  const handleRestore = () => {
    const saveKey = draftName ? `draft_${draftName}` : initialData?.uid ? `post_${initialData.uid}` : "new_post";
    const saved = localStorage.getItem(saveKey);
    if (saved) {
      try {
        setFormData(JSON.parse(saved));
        setSuccess("Draft restored from browser storage.");
        setTimeout(() => setSuccess(""), 3000);
      } catch (e) {}
    }
    setHasRestored(true);
  };

  const handleTagClick = (tag: string) => {
    setFormData(prev => {
      const currentTags = prev.tags.split(",").map((t: string) => t.trim()).filter(Boolean);
      if (!currentTags.includes(tag)) {
        currentTags.push(tag);
        return { ...prev, tags: currentTags.join(", ") };
      }
      return prev;
    });
  };

  const removeTag = (tag: string) => {
    setFormData(prev => {
      const currentTags = prev.tags.split(",").map((t: string) => t.trim()).filter(Boolean);
      return { ...prev, tags: currentTags.filter((t: string) => t !== tag).join(", ") };
    });
  };

  const currentTags = formData.tags.split(",").map((t: string) => t.trim()).filter(Boolean);

  // Tracks the last auto-imported / initial previous-post value so auto-import
  // only fires when the user actually changes the field (not on editor open).
  const prevImportRef = useRef<string>(initialData?.previousPost || "");

  // Auto-import the previous post's title, tags, category, author & description
  // when a slug/link/uid is entered
  const importPreviousPost = useCallback(async (ref?: string) => {
    const prevRef = (ref ?? formData.previousPost).trim();
    if (!prevRef) return;
    setImportingPrev(true);
    setPreviousPostMsg("");
    try {
      const res = await fetch(`/api/posts/lookup?ref=${encodeURIComponent(prevRef)}`);
      const json = await res.json();
      if (res.ok && json && json.title) {
        const resolvedRef = json.uid || json.slug || prevRef;
        prevImportRef.current = resolvedRef;
        setFormData(prev => ({
          ...prev,
          previousPost: resolvedRef,
          title: json.title || prev.title,
          category: json.category || prev.category,
          tags: json.tags?.length ? json.tags.join(", ") : prev.tags,
          author: (json.authorId && authors.some(a => a.id === json.authorId)) ? json.authorId : prev.author,
          description: json.description || prev.description,
          cover: json.cover || prev.cover,
        }));
        if (json.authorId && !authors.some(a => a.id === json.authorId)) {
          setAvailableAuthors(prev => {
            if (prev.some(a => a.id === json.authorId)) return prev;
            return [...prev, { id: json.authorId, name: json.authorName || json.authorId }];
          });
          setFormData(prev => ({ ...prev, author: json.authorId }));
        }
        setPreviousPostMsg(`"${json.title}" থেকে ট্যাগ, ক্যাটাগরি, লেখক, কভার ও বিবরণ আমদানি হয়েছে।`);
      } else {
        setPreviousPostMsg(json.error || "লেখা পাওয়া যায়নি।");
      }
    } catch (err) {
      setPreviousPostMsg("আগের লেখা আমদানি করতে সমস্যা হয়েছে।");
    } finally {
      setImportingPrev(false);
    }
  }, [formData.previousPost, authors]);

  // Auto-import automatically when a complete-looking uid or link is typed/pasted
  useEffect(() => {
    const ref = (formData.previousPost || "").trim();
    if (!ref || !(ref.startsWith("http") || /^\d{10,}$/.test(ref))) return;
    if (ref === prevImportRef.current) return;
    const t = setTimeout(() => importPreviousPost(ref), 800);
    return () => clearTimeout(t);
  }, [formData.previousPost, importPreviousPost]);

  // Import story text from .txt / .docx / .pdf file
  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingFile(true);
    try {
      const text = await extractTextFromFile(file);
      if (text) {
        setFormData(prev => {
          const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
          return {
            ...prev,
            content: text,
            title: prev.title || fileNameWithoutExt || prev.title,
          };
        });
      }
    } catch (err) {
      setError("ফাইল থেকে লেখা আমদানি করা যায়নি।");
    } finally {
      setImportingFile(false);
      e.target.value = "";
    }
  }

  // Translate title + content to Bengali via /api/translate
  async function handleTranslate() {
    if (!formData.content.trim() && !formData.title.trim()) return;
    setTranslating(true);
    setError("");
    try {
      let newTitle = formData.title;
      if (formData.title.trim() && /[a-zA-Z]/.test(formData.title)) {
        const resTitle = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: formData.title }),
        });
        const dTitle = await resTitle.json();
        if (dTitle.translatedText) newTitle = dTitle.translatedText;
      }

      let newContent = formData.content;
      if (formData.content.trim()) {
        const resContent = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: formData.content }),
        });
        const dContent = await resContent.json();
        if (dContent.translatedText) newContent = dContent.translatedText;
      }

      setFormData(prev => ({ ...prev, title: newTitle, content: newContent }));
    } catch (err) {
      setError("অনুবাদ করতে সমস্যা হয়েছে।");
    } finally {
      setTranslating(false);
    }
  }

  const applyFormatting = (prefix: string, suffix: string = prefix) => {
    const textarea = document.getElementById('story-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.content;
    const selected = text.slice(start, end);
    
    const before = text.slice(0, start);
    const after = text.slice(end);
    
    const newContent = `${before}${prefix}${selected}${suffix}${after}`;
    
    setFormData(prev => ({ ...prev, content: newContent }));
    
    // Restore cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  // Simple frontmatter parser
  function parseFrontmatter(mdx: string) {
    const match = mdx.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { content: mdx };
    
    const [, fmStr, content] = match;
    const data: any = { content: content.trim() };
    
    fmStr.split("\n").forEach(line => {
      const [key, ...vals] = line.split(":");
      if (key && vals.length) {
        let val = vals.join(":").trim();
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (key.trim() === "tags") {
           // We'll skip complex array parsing here and leave it empty if format is complex, 
           // but normally it's an array block.
        } else {
          let parsedVal: any = val;
          if (parsedVal === "true") parsedVal = true;
          if (parsedVal === "false") parsedVal = false;
          if (parsedVal === "null") parsedVal = "";
          data[key.trim()] = parsedVal;
        }
      }
    });
    
    // Quick regex for tags list
    const tagsMatch = fmStr.match(/tags:\n((?:\s+- .*\n?)*)/);
    if (tagsMatch && tagsMatch[1]) {
      const tags = tagsMatch[1].split("\n").map(t => t.replace("- ", "").trim()).filter(Boolean);
      data.tags = tags.join(", ");
    }
    
    return data;
  }

  async function handleSave(isDraft: boolean, asNew: boolean = false) {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/author/submit-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          category: formData.category,
          description: formData.description,
          content: formData.content,
          tags: formData.tags,
          cover: formData.cover,
          previousPost: formData.previousPost,
          author: formData.author,
          slug: asNew ? undefined : (formData.uid || initialData?.slug),
          uid: asNew ? undefined : (formData.uid || initialData?.uid),
          publishedAt: formData.publishedAt,
          // null = explicitly clear the schedule, value = set/reschedule,
          // absent (undefined) = preserve the existing schedule on edit.
          scheduledAt: formData.scheduledAt ? formData.scheduledAt : null,
          featured: formData.featured
        })
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setSuccess(json.message || "গল্পটি সফলভাবে ওয়েবসাইটে প্রকাশিত হয়েছে!");
        if (json.uid) {
          setFormData(prev => ({ ...prev, uid: json.uid }));
        }
        setTimeout(() => router.push("/admin"), 1500);
      } else {
        setError(json.error || "গল্প সংরক্ষণ করতে সমস্যা হয়েছে।");
      }
    } catch (err) {
      setError("একটি অনাকাঙ্ক্ষিত সমস্যা ঘটেছে। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return <div className="p-8 text-center text-fg-muted animate-pulse">Loading editor...</div>;
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <header className="bg-surface-alt border-b border-border p-3 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <Link href="/admin" className="p-2 -ml-2 text-fg-muted hover:text-zinc-900 dark:hover:text-zinc-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex flex-wrap gap-2 items-center justify-end">
          <button 
            onClick={() => handleSave(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-fg bg-surface-hover hover:bg-surface-hover rounded-md transition-colors"
          >
            <Save className="w-4 h-4" /> <span className="hidden sm:inline">Save Draft</span>
          </button>
          <button 
            onClick={() => handleSave(false)}
            disabled={loading || !formData.title || !formData.content}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" /> {initialData ? "Update" : "Publish"}
          </button>
          
          {/* Show "Publish as New" button if we are editing an existing post or draft */}
          {(initialData || draftName) && (
            <button 
              onClick={() => handleSave(false, true)}
              disabled={loading || !formData.title || !formData.content}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 dark:text-blue-300 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-md transition-colors disabled:opacity-50"
              title="Publish this as a completely new story, without overwriting the original."
            >
              <Send className="w-4 h-4" /> Publish as New
            </button>
          )}
        </div>
      </header>

      {/* Admin nav strip */}
      <nav className="bg-surface-alt border-b border-border px-3 py-2 sticky top-[57px] z-10 overflow-x-auto">
        <div className="flex items-center gap-1.5 max-w-3xl mx-auto">
          {[
            { href: "/admin", label: "ড্যাশবোর্ড" },
            { href: "/admin?section=review", label: "রিভিউ সেন্টার" },
            { href: "/admin/editor", label: "নতুন গল্প" },
            { href: "/admin/comments", label: "মতামত" },
            { href: "/admin/reports", label: "রিপোর্ট" },
            { href: "/admin/users", label: "ইউজার" },
            { href: "/admin/settings", label: "সেটিংস" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-2.5 py-1 text-xs font-semibold text-fg-muted hover:text-fg rounded-lg hover:bg-surface-hover whitespace-nowrap transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
        {success && <div className="p-3 bg-green-100 text-green-700 rounded-lg text-sm">{success}</div>}
        {!hasRestored && (
          <div className="flex justify-end">
            <button 
              onClick={handleRestore}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Check for unsaved local changes?
            </button>
          </div>
        )}

        <div className="space-y-4 bg-surface-alt p-4 sm:p-6 rounded-2xl border border-border shadow-sm">
          <input
            type="text"
            placeholder="Story Title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className="w-full text-2xl font-bold bg-transparent border-0 border-b border-border focus:ring-0 focus:border-accent px-0 py-2 text-fg placeholder:text-fg-subtle"
          />

          {/* Live Story Link Preview Banner */}
          <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-amber-800 dark:text-amber-300 shrink-0">গল্পের লাইভ লিংক:</span>
              <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold truncate select-all">
                {`${typeof window !== "undefined" ? window.location.origin : getClientSiteUrl()}/${formData.uid || initialData?.slug || "১৪-সংখ্যার আইডি"}`}
              </span>
            </div>
            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-bold bg-surface-alt px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 shrink-0">
              অপ্রকাশিত (প্রকাশের পর অ্যাক্টিভ হবে)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">Author</label>
              <select 
                value={formData.author}
                onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                className="input-field"
              >
                {availableAuthors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">Category</label>
              <select 
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="input-field"
              >
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Tags (comma separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="e.g. romance, thriller"
              className="input-field"
            />
            {currentTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {currentTags.map((tag: string) => (
                  <span key={tag} className="inline-flex items-center gap-1 bg-surface-hover text-fg text-xs px-2.5 py-1 rounded-full">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {dynamicTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-xs text-fg-subtle py-1 mr-1">Suggestions:</span>
                {dynamicTags.filter((t: string) => !currentTags.includes(t)).map((tag: string) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagClick(tag)}
                    className="text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-fg-muted px-2.5 py-1 rounded-full transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">Previous Post Slug (Optional)</label>
              {authorStories.length > 0 && (
                <select
                  value={formData.previousPost}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, previousPost: e.target.value }));
                    if (e.target.value) importPreviousPost(e.target.value);
                  }}
                  className="input-field mb-2"
                >
                  <option value="">-- আগের লেখা থেকে সিলেক্ট করুন --</option>
                  {authorStories.map(s => (
                    <option key={s.uid} value={s.uid}>{s.title} ({s.uid})</option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.previousPost}
                  onChange={(e) => setFormData(prev => ({ ...prev, previousPost: e.target.value }))}
                  placeholder="Slug, link or 14-digit uid"
                  className="input-field flex-1"
                />
                <button
                  type="button"
                  onClick={() => importPreviousPost()}
                  disabled={importingPrev || !formData.previousPost.trim()}
                  className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 dark:text-blue-300 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0"
                  title="আগের লেখার ট্যাগ, ক্যাটাগরি ও লেখক আমদানি করুন"
                >
                  {importingPrev ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImportIcon className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Import</span>
                </button>
              </div>
              {previousPostMsg && (
                <p className={`text-xs mt-1 ${previousPostMsg.includes("আমদানি হয়েছে") ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                  {previousPostMsg}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                id="featured"
                checked={formData.featured}
                onChange={(e) => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
                className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="featured" className="text-sm font-medium text-fg">
                Featured Post
              </label>
            </div>

            {/* Scheduled Publishing (Admin only) */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-fg-muted mb-1">
                শিডিউল করা প্রকাশ (সামনে নির্দিষ্ট সময়ে অটো পাবলিশ) — ঐচ্ছিক
              </label>
              <input
                type="datetime-local"
                value={formData.scheduledAt ? new Date(formData.scheduledAt).toISOString().slice(0, 16) : ""}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : "" }))}
                className="input-field"
              />
              {formData.scheduledAt && new Date(formData.scheduledAt) > new Date() && (
                <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1.5 font-medium">
                  নির্ধারিত সময়: {bndSafe(formData.scheduledAt, "datetime")} — এই সময়ের আগে গল্পটি পাবলিকভাবে দেখা যাবে না।
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1 flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Cover Image URL / Path (public /images/Cover_pic/ or link)
            </label>
            <input
              type="text"
              value={formData.cover}
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith("data:image")) {
                  alert("Base64/ইমেজ ডেটা ডেটাবেসে রাখা যাবে না। শুধুমাত্র ছবির লিংক ব্যবহার করুন।");
                  return;
                }
                setFormData(prev => ({ ...prev, cover: val }));
              }}
              placeholder="/images/Cover_pic/10037699_014_41f9.jpg বা https://..."
              className="input-field"
            />
            <p className="text-[11px] text-fg-subtle mt-1">
              ডেটাবেসে কোনো ছবি সেভ হবে না। শুধুমাত্র <code>/images/Cover_pic/</code> বা পাবলিক লিংক সেভ হবে।
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Short Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief summary..."
              rows={2}
              className="input-field"
            />
          </div>
        </div>

        <div className="bg-surface-alt rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="p-3 bg-surface-hover/50 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => applyFormatting('**')} 
                className="p-1.5 text-fg-muted hover:text-zinc-800 hover:bg-zinc-200 dark:hover:text-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button 
                onClick={() => applyFormatting('*')} 
                className="p-1.5 text-fg-muted hover:text-zinc-800 hover:bg-zinc-200 dark:hover:text-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button 
                onClick={() => applyFormatting('> ', '')} 
                className="p-1.5 text-fg-muted hover:text-zinc-800 hover:bg-zinc-200 dark:hover:text-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
                title="Quote"
              >
                <Quote className="w-4 h-4" />
              </button>
              <label 
                className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                title=".txt / .docx / .pdf ফাইল আপলোড করে লেখা নিয়ে আসুন"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">{importingFile ? "আপলোড হচ্ছে..." : "ফাইল আপলোড"}</span>
                <input
                  type="file"
                  accept=".txt,.md,.docx,.pdf"
                  className="hidden"
                  onChange={handleFileImport}
                />
              </label>
              {/* URL Import toggle */}
              <button
                type="button"
                onClick={() => setUrlImportInput(prev => (prev ? "" : " "))}
                className="p-1.5 bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50 rounded-md transition-colors flex items-center gap-1 text-xs font-semibold"
                title="URL থেকে গল্প import করুন"
              >
                <ImportIcon className="w-4 h-4" />
                <span className="hidden sm:inline">URL থেকে</span>
              </button>
              {urlImportInput && (
                <div className="w-full p-3 bg-surface-alt border border-border rounded-xl space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={urlImportInput === " " ? "" : urlImportInput}
                      onChange={(e) => setUrlImportInput(e.target.value)}
                      placeholder="https://example.com/story-link"
                      className="flex-1 input-field text-sm"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const u = urlImportInput === " " ? "" : urlImportInput.trim();
                        if (!u) { setUrlImportError("URL দিন।"); return; }
                        setImportingUrl(true);
                        setUrlImportError("");
                        try {
                          const res = await fetch("/api/admin/import-url", {
                            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: u }),
                          });
                          const json = await res.json();
                          if (res.ok && json.success) {
                            setFormData(prev => ({
                              ...prev,
                              title: prev.title || json.title || "",
                              content: json.content || prev.content,
                            }));
                            setUrlImportInput("");
                          } else {
                            setUrlImportError(json.error || "Import ব্যর্থ।");
                          }
                        } catch { setUrlImportError("Import করতে সমস্যা হয়েছে।"); }
                        finally { setImportingUrl(false); }
                      }}
                      disabled={importingUrl}
                      className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 flex items-center gap-1"
                    >
                      <ImportIcon className="w-3.5 h-3.5" /> {importingUrl ? "আনছে..." : "Import"}
                    </button>
                  </div>
                  {urlImportError && <p className="text-xs text-red-600 dark:text-red-400">{urlImportError}</p>}
                  <p className="text-[10px] text-fg-subtle">লিংক পেস্ট করলে কনটেন্ট অটো-আনা হবে — এডিট করে সেভ করুন।</p>
                </div>
              )}
              <button 
                onClick={handleTranslate}
                disabled={translating || (!formData.content.trim() && !formData.title.trim())}
                className="p-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-md transition-colors flex items-center gap-1 text-xs font-semibold disabled:opacity-50"
                title="ইংরেজি লেখা বাংলায় অনুবাদ করুন"
              >
                {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
                <span className="hidden sm:inline">অনুবাদ</span>
              </button>
            </div>
            
            <div className="flex gap-2 bg-zinc-200/50 dark:bg-zinc-950 p-1 rounded-lg">
              <button
                onClick={() => setPreviewMode(false)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${!previewMode ? "bg-white dark:bg-zinc-800 shadow-sm text-fg" : "text-fg-muted hover:text-zinc-700 dark:hover:text-zinc-300"}`}
              >
                Write
              </button>
              <button
                onClick={() => setPreviewMode(true)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${previewMode ? "bg-white dark:bg-zinc-800 shadow-sm text-fg" : "text-fg-muted hover:text-zinc-700 dark:hover:text-zinc-300"}`}
              >
                Preview
              </button>
            </div>
          </div>
          
          {previewMode ? (
            <div className="flex-1 w-full p-4 overflow-y-auto prose dark:prose-invert max-w-none text-fg leading-relaxed bg-surface">
              {formData.content ? formData.content.split(/\n\n+/).map((paragraph: string, idx: number) => (
                <p key={idx} className="mb-4">{paragraph.trim()}</p>
              )) : <p className="text-fg-muted italic">No content to preview.</p>}
            </div>
          ) : (
            <textarea
              id="story-textarea"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Write your story here... Paragraphs are automatically formatted."
              className="flex-1 w-full p-4 text-base leading-relaxed bg-transparent border-0 focus:ring-0 resize-none dark:text-zinc-100 placeholder-zinc-400"
            />
          )}
        </div>
      </main>

      {/* Duplicate-content similarity check */}
      <div className="max-w-3xl mx-auto px-4 pb-6">
        <SimilarityCheck
          content={formData.content}
          title={formData.title}
          excludeRef={initialData?.uid || initialData?.slug || null}
        />
      </div>
    </div>
  );
}
