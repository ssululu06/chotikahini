"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, Plus, Users, LayoutList, Edit2, X, UserPlus } from "lucide-react";
import { Category } from "@/lib/config";
import { AvatarPicker } from "@/components/AvatarPicker";
import { UserAvatar } from "@/components/UserAvatar";

interface SettingsProps {
  initialAuthors: any[];
  initialCategories: Category[];
}

export default function AdminSettings({ initialAuthors, initialCategories }: SettingsProps) {
  const [authors, setAuthors] = useState<any[]>(initialAuthors);
  const [categories, setCategories] = useState<Category[]>(initialCategories);

  const [authorForm, setAuthorForm] = useState({
    name: "", username: "", email: "", bio: "", profilePic: "", website: "", facebook: "", password: "",
  });
  const [categoryForm, setCategoryForm] = useState<Partial<Category>>({});

  const [editingAuthorId, setEditingAuthorId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const [loadingAuth, setLoadingAuth] = useState(false);
  const [loadingCat, setLoadingCat] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  // Load real DB authors
  const fetchAuthors = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/authors");
      if (res.ok) {
        const json = await res.json();
        if (json.authors) setAuthors(json.authors);
      }
    } catch (e) {}
  }, []);

  // Load categories from DB
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories");
      if (res.ok) {
        const json = await res.json();
        if (json.categories) {
          setCategories(json.categories.map((c: any) => ({ id: c.id, name: c.name, icon: c.icon, description: c.description })));
        }
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchAuthors();
    fetchCategories();
  }, [fetchAuthors, fetchCategories]);

  // Create a REAL author (DB user with a public profile) — never errors on GitHub
  const handleSaveAuthor = async () => {
    if (!authorForm.name.trim() || !authorForm.username.trim()) {
      setMsg({ type: "error", text: "লেখকের নাম ও ইউজারনেম আবশ্যক।" });
      return;
    }
    setLoadingAuth(true);
    setMsg({ type: "", text: "" });

    try {
      const res = await fetch("/api/admin/authors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authorForm),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setMsg({ type: "success", text: json.message });
        setAuthorForm({ name: "", username: "", email: "", bio: "", profilePic: "", website: "", facebook: "", password: "" });
        setEditingAuthorId(null);
        fetchAuthors();
      } else {
        setMsg({ type: "error", text: json.error || "লেখক যোগ করা যায়নি।" });
      }
    } catch (err) {
      setMsg({ type: "error", text: "লেখক যোগ করতে সমস্যা হয়েছে।" });
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.id || !categoryForm.name) {
      setMsg({ type: "error", text: "Category ID and Name are required." });
      return;
    }

    setLoadingCat(true);
    setMsg({ type: "", text: "" });

    try {
      const url = "/api/admin/categories";
      const method = editingCategoryId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setMsg({ type: "success", text: `Category ${editingCategoryId ? "updated" : "added"} successfully!` });
        setCategoryForm({});
        setEditingCategoryId(null);
        fetchCategories();
      } else {
        setMsg({ type: "error", text: json.error || "Failed to save category." });
      }
    } catch (err) {
      setMsg({ type: "error", text: "Error saving category." });
    } finally {
      setLoadingCat(false);
    }
  };

  const cancelEditAuthor = () => {
    setAuthorForm({ name: "", username: "", email: "", bio: "", profilePic: "", website: "", facebook: "", password: "" });
    setEditingAuthorId(null);
  };

  const cancelEditCategory = () => {
    setCategoryForm({});
    setEditingCategoryId(null);
  };

  return (
    <div className="space-y-8">
      {msg.text && (
        <div className={`p-4 rounded-xl text-sm font-medium ${msg.type === "error" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800"}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Authors Panel — creates REAL DB users with public profiles */}
        <section className="bg-surface-alt p-6 rounded-2xl border border-border shadow-sm flex flex-col">
          <h2 className="text-xl font-bold flex items-center gap-2 text-fg mb-2">
            <Users className="w-5 h-5 text-blue-500" />
            লেখকবৃন্দ
          </h2>
          <p className="text-xs text-fg-muted mb-6">
            এখানে লেখক যোগ করলে একটি <b>রিয়েল অ্যাকাউন্ট</b> তৈরি হবে — লেখক লগইন করে নিজের প্রোফাইল ও গল্প পরিচালনা করতে পারবেন।
          </p>

          <div className="space-y-4 mb-8 flex-1 overflow-y-auto max-h-80 pr-2">
            {authors.length === 0 && (
              <p className="text-sm text-fg-muted italic">কোনো লেখক নেই।</p>
            )}
            {authors.map(author => (
              <div key={author.id} className="p-3 bg-surface rounded-lg border border-border flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden">
                  <UserAvatar
                    src={author.profilePic}
                    name={author.name || author.username}
                    userId={author.id}
                    size="md"
                    className="w-9 h-9"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-fg truncate">{author.name || author.username}</p>
                  <p className="text-xs text-fg-muted truncate">@{author.username} {author.email && author.email !== "—" ? ` • ${author.email}` : ""}</p>
                  {author.stats && (
                    <p className="text-[10px] text-fg-subtle mt-0.5">
                      {author.stats.published || 0} প্রকাশিত • {author.stats.pending || 0} অপেক্ষমাণ
                    </p>
                  )}
                </div>
                <Link href={`/authors/${author.username}`} className="p-2 text-fg-subtle hover:text-blue-500 transition-colors shrink-0" title="প্রোফাইল দেখুন">
                  <Edit2 className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-border">
            <h3 className="text-sm font-semibold text-fg mb-4 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-500" /> নতুন লেখক যোগ করুন
            </h3>
            {editingAuthorId && (
              <button onClick={cancelEditAuthor} className="text-xs text-red-500 flex items-center gap-1 hover:underline mb-2">
                <X className="w-3 h-3" /> Cancel
              </button>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="নাম *"
                  value={authorForm.name}
                  onChange={e => setAuthorForm(p => ({ ...p, name: e.target.value }))}
                  className="input-field text-sm"
                />
                <input
                  type="text"
                  placeholder="ইউজারনেম *"
                  value={authorForm.username}
                  onChange={e => setAuthorForm(p => ({ ...p, username: e.target.value }))}
                  className="input-field text-sm"
                />
              </div>
              <input
                type="email"
                placeholder="ইমেইল (ঐচ্ছিক)"
                value={authorForm.email}
                onChange={e => setAuthorForm(p => ({ ...p, email: e.target.value }))}
                className="input-field text-sm"
              />
              <textarea
                placeholder="বায়ো / পরিচিতি (ঐচ্ছিক)"
                value={authorForm.bio}
                onChange={e => setAuthorForm(p => ({ ...p, bio: e.target.value }))}
                className="input-field text-sm h-20 resize-none"
              />
              <AvatarPicker value={authorForm.profilePic} onChange={(v) => setAuthorForm(p => ({ ...p, profilePic: v }))} />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="ওয়েবসাইট (ঐচ্ছিক)"
                  value={authorForm.website}
                  onChange={e => setAuthorForm(p => ({ ...p, website: e.target.value }))}
                  className="input-field text-sm"
                />
                <input
                  type="text"
                  placeholder="ফেসবুক (ঐচ্ছিক)"
                  value={authorForm.facebook}
                  onChange={e => setAuthorForm(p => ({ ...p, facebook: e.target.value }))}
                  className="input-field text-sm"
                />
              </div>
              <input
                type="password"
                placeholder="পাসওয়ার্ড (ঐচ্ছিক — ফাঁকা রাখলে লেখক রিসেট দিয়ে লগইন করবে)"
                value={authorForm.password}
                onChange={e => setAuthorForm(p => ({ ...p, password: e.target.value }))}
                className="input-field text-sm"
              />
              <button
                onClick={handleSaveAuthor}
                disabled={loadingAuth || !authorForm.name.trim() || !authorForm.username.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loadingAuth ? "তৈরি হচ্ছে..." : <><Plus className="w-4 h-4" /> লেখক তৈরি করুন</>}
              </button>
            </div>
          </div>
        </section>

        {/* Categories Panel */}
        <section className="bg-surface-alt p-6 rounded-2xl border border-border shadow-sm flex flex-col">
          <h2 className="text-xl font-bold flex items-center gap-2 text-fg mb-6">
            <LayoutList className="w-5 h-5 text-amber-500" />
            Categories
          </h2>

          <div className="space-y-4 mb-8 flex-1 overflow-y-auto max-h-80 pr-2">
            {categories.map(cat => (
              <div key={cat.id} className="p-3 bg-surface rounded-lg border border-border flex items-center justify-between">
                <div>
                  <p className="font-semibold text-fg">{cat.name}</p>
                  <p className="text-xs text-fg-muted">ID: {cat.id}</p>
                </div>
                <button onClick={() => { setCategoryForm(cat); setEditingCategoryId(cat.id); }} className="p-2 text-fg-subtle hover:text-amber-500 transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-fg">
                {editingCategoryId ? "Edit Category" : "Add New Category"}
              </h3>
              {editingCategoryId && (
                <button onClick={cancelEditCategory} className="text-xs text-red-500 flex items-center gap-1 hover:underline">
                  <X className="w-3 h-3" /> Cancel
                </button>
              )}
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="ID (e.g. kobita)"
                value={categoryForm.id || ""}
                disabled={!!editingCategoryId}
                onChange={e => setCategoryForm(p => ({ ...p, id: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                className="input-field text-sm"
              />
              <input
                type="text"
                placeholder="Display Name (e.g. Kobita / কবিতা)"
                value={categoryForm.name || ""}
                onChange={e => setCategoryForm(p => ({ ...p, name: e.target.value }))}
                className="input-field text-sm"
              />
              <button
                onClick={handleSaveCategory}
                disabled={loadingCat}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50"
              >
                {loadingCat ? "Saving..." : editingCategoryId ? <><Save className="w-4 h-4" /> Save Changes</> : <><Plus className="w-4 h-4" /> Add Category</>}
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

import Link from "next/link";
