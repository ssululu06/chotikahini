"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, UserCog, Search, ShieldAlert, Edit2, CheckCircle, Trash2, KeyRound, Copy, Mail, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { UserAvatar } from "@/components/UserAvatar";

export default function UsersManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const { user: currentUser } = useAuth();
  
  // User edit modal state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("user");
  const [selectedVerified, setSelectedVerified] = useState<boolean>(false);
  const [selectedTrusted, setSelectedTrusted] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>("");
  const [updateLoading, setUpdateLoading] = useState(false);

  // Reset link modal state
  const [resetModalData, setResetModalData] = useState<any | null>(null);
  const [resetLoading, setResetLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        const data = await res.json();
        setMsg({ type: "error", text: data.error || "ব্যবহারকারী তালিকা লোড করতে সমস্যা হয়েছে।" });
      }
    } catch (e) {
      console.error(e);
      setMsg({ type: "error", text: "নেটওয়ার্ক সমস্যা হয়েছে।" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = (u: any) => {
    setEditingUser(u);
    setSelectedRole(u.role || "user");
    setSelectedVerified(u.isVerified === true);
    setSelectedTrusted(u.isTrusted === true);
    setNewPassword("");
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setUpdateLoading(true);
    setMsg({ type: "", text: "" });

    try {
      const res = await fetch(`/api/admin/users`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editingUser.id, role: selectedRole, newPassword, isVerified: selectedVerified, isTrusted: selectedTrusted })
      });
      
      if (res.ok) {
        setMsg({ type: "success", text: "ব্যবহারকারীর তথ্য সফলভাবে আপডেট হয়েছে।" });
        setEditingUser(null);
        setNewPassword("");
        fetchUsers();
      } else {
        const data = await res.json();
        setMsg({ type: "error", text: data.error || "আপডেট করতে ব্যর্থ হয়েছে।" });
      }
    } catch (e) {
      setMsg({ type: "error", text: "একটি সমস্যা হয়েছে।" });
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleGenerateResetLink = async (userId: string) => {
    setResetLoading(userId);
    setMsg({ type: "", text: "" });
    try {
      const res = await fetch("/api/admin/generate-reset-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetModalData(data.data);
      } else {
        setMsg({ type: "error", text: data.error || "রিসেট লিঙ্ক তৈরি করতে ব্যর্থ হয়েছে।" });
      }
    } catch (e) {
      setMsg({ type: "error", text: "পাসওয়ার্ড রিসেট লিঙ্ক তৈরি করতে সমস্যা হয়েছে।" });
    } finally {
      setResetLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`আপনি কি নিশ্চিত যে @${username} ইউজারকে স্থায়ীভাবে মুছে ফেলতে চান?`)) {
      return;
    }
    setMsg({ type: "", text: "" });
    try {
      const res = await fetch(`/api/admin/users?userId=${userId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "success", text: data.message || "ইউজার মুছে ফেলা হয়েছে।" });
        fetchUsers();
      } else {
        setMsg({ type: "error", text: data.error || "ইউজার মুছতে সমস্যা হয়েছে।" });
      }
    } catch (e) {
      setMsg({ type: "error", text: "একটি সমস্যা হয়েছে।" });
    }
  };

  const filteredUsers = users.filter(u => 
    (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Role filter tabs
  const roleFilters = [
    { key: "all", label: "সবাই" },
    { key: "user", label: "ইউজার" },
    { key: "author", label: "লেখক" },
    { key: "moderator", label: "মডারেটর" },
    { key: "content_manager", label: "কন্টেন্ট ম্যানেজার" },
    { key: "admin", label: "অ্যাডমিন" },
    { key: "superadmin", label: "সুপার অ্যাডমিন" },
  ];
  const [roleFilter, setRoleFilter] = useState("all");
  const roleFilteredUsers = roleFilter === "all" ? filteredUsers : filteredUsers.filter(u => (u.role || "user") === roleFilter);

  const roleLabels: Record<string, string> = {
    superadmin: "সুপার অ্যাডমিন",
    admin: "অ্যাডমিন",
    content_manager: "কন্টেন্ট ম্যানেজার",
    moderator: "মডারেটর",
    author: "লেখক",
    user: "ইউজার",
  };
  const roleLabel = (r?: string) => roleLabels[r || "user"] || r || "ইউজার";

  if (currentUser?.role !== "admin" && currentUser?.role !== "superadmin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-white p-4">
        <div className="text-center max-w-md">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">অ্যাক্সেস ডিনাইড</h1>
          <p className="text-fg-subtle">এই পেজটি দেখার জন্য আপনার অ্যাডমিন (admin) অ্যাক্সেস প্রয়োজন।</p>
          <Link href="/admin" className="inline-block mt-6 px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors">
            ফিরে যান
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-surface flex flex-col md:flex-row">
      <AdminSidebar />
      <main className="flex-1 md:h-screen md:overflow-y-auto p-4 md:p-6 lg:p-8 min-w-0">
        <div className="max-w-7xl mx-auto space-y-6 w-full">
          <header className="flex items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 text-fg-muted hover:text-fg rounded-xl bg-surface-alt border border-border transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-fg flex items-center gap-2">
                <UserCog className="w-6 h-6 text-blue-500" /> ইউজার ম্যানেজমেন্ট
              </h1>
              <p className="text-xs text-fg-muted mt-0.5">
                সিস্টেমের সমস্ত ব্যবহারকারী এবং লেখকদের রোল ও পারমিশন নিয়ন্ত্রণ করুন
              </p>
            </div>
          </div>
        </header>

        {msg.text && (
          <div className={`p-4 rounded-xl text-sm font-medium ${msg.type === "error" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
            {msg.text}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-subtle" />
          <input 
            type="text" 
            placeholder="নাম, ইউজারনেম বা ইমেইল দিয়ে খুঁজুন..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-surface-alt border border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-fg text-sm"
          />
        </div>

        {/* Role Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {roleFilters.map((rf) => (
            <button
              key={rf.key}
              onClick={() => setRoleFilter(rf.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                roleFilter === rf.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-surface-alt border border-border text-fg-muted hover:bg-surface-hover"
              }`}
            >
              {rf.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-fg-muted animate-pulse">ইউজারদের তালিকা লোড হচ্ছে...</div>
        ) : roleFilteredUsers.length === 0 ? (
          <div className="text-center py-20 bg-surface-alt rounded-2xl border border-border">
            <UserCog className="w-12 h-12 text-fg-subtle mx-auto mb-4" />
            <h2 className="text-xl font-medium text-fg">কোনো ব্যবহারকারী পাওয়া যায়নি</h2>
          </div>
        ) : (
          <div className="bg-surface-alt border border-border rounded-2xl overflow-hidden shadow-sm">
            {/* Mobile Card Layout */}
            <div className="md:hidden divide-y divide-zinc-200 dark:divide-zinc-800">
              {roleFilteredUsers.map(u => (
                <div key={u.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        src={u.profilePic}
                        name={u.name || u.username}
                        userId={u.id}
                        size="lg"
                        className="shrink-0 border border-blue-200"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-fg text-sm truncate">{u.name}</p>
                        <p className="text-xs text-fg-muted truncate">@{u.username}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shrink-0
                      ${u.role === 'superadmin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                        u.role === 'admin' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        u.role === 'content_manager' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' :
                        u.role === 'moderator' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                        u.role === 'author' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }
                    `}>
                      {roleLabel(u.role)}
                    </span>
                  </div>

                  {u.email && <p className="text-xs text-fg-muted dark:text-fg-subtle font-mono">ইমেইল: {u.email}</p>}

                  {u.role !== 'superadmin' && (
                    <div className="flex justify-end gap-2 pt-2 border-t border-border">
                      <button 
                        onClick={() => handleOpenEditModal(u)}
                        className="px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-xl font-medium inline-flex items-center gap-1 hover:bg-blue-100 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> সম্পাদনা করুন
                      </button>
                      <button
                        onClick={() => handleGenerateResetLink(u.id)}
                        disabled={resetLoading === u.id}
                        className="px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl font-medium inline-flex items-center gap-1 disabled:opacity-50 hover:bg-amber-100 transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        {resetLoading === u.id ? "তৈরি হচ্ছে..." : "রিসেট লিঙ্ক"}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.username || u.name)}
                        className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl font-medium inline-flex items-center gap-1 hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> মুছুন
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-fg-muted dark:text-fg-subtle border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-medium">ব্যবহারকারী</th>
                    <th className="px-6 py-4 font-medium">ইউজারনেম</th>
                    <th className="px-6 py-4 font-medium">ইমেইল</th>
                    <th className="px-6 py-4 font-medium">বর্তমান রোল</th>
                    <th className="px-6 py-4 font-medium text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {roleFilteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-fg flex items-center gap-3">
                        <UserAvatar
                          src={u.profilePic}
                          name={u.name || u.username}
                          userId={u.id}
                          size="md"
                          className="shrink-0 border border-blue-200"
                        />
                        {u.name}
                      </td>
                      <td className="px-6 py-4 text-fg-muted dark:text-fg-subtle font-mono">@{u.username}</td>
                      <td className="px-6 py-4 text-fg-muted dark:text-fg-subtle font-mono">{u.email || "—"}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                          ${u.role === 'superadmin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                            u.role === 'admin' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            u.role === 'content_manager' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' :
                            u.role === 'moderator' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                            u.role === 'author' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                          }
                        `}>
                          {roleLabel(u.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {u.role !== 'superadmin' && (
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleOpenEditModal(u)}
                              className="px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 rounded-xl font-medium inline-flex items-center gap-1 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> সম্পাদনা
                            </button>
                            <button
                              onClick={() => handleGenerateResetLink(u.id)}
                              disabled={resetLoading === u.id}
                              className="px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 rounded-xl font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>{resetLoading === u.id ? "তৈরি হচ্ছে..." : "রিসেট লিঙ্ক"}</span>
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username || u.name)}
                              className="p-2 text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-xl transition-colors inline-flex"
                              title="ইউজার মুছে ফেলুন"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* USER EDIT MODAL POPUP */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-alt border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-lg text-fg flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-500" /> ব্যবহারকারীর তথ্য সম্পাদনা
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-fg-subtle hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

<div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-3.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800">
                <UserAvatar
                  src={editingUser.profilePic}
                  name={editingUser.name || editingUser.username}
                  userId={editingUser.id}
                  size="md"
                  className="w-12 h-12 rounded-full border border-blue-200"
                />
              <div>
                <p className="font-bold text-fg text-base">{editingUser.name}</p>
                <p className="text-xs font-mono text-fg-muted">@{editingUser.username} {editingUser.email ? `• ${editingUser.email}` : ''}</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-fg mb-1.5">ব্যবহারকারীর রোল (User Role)</label>
                <select 
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-fg text-sm font-medium"
                >
                  <option value="user">User (সাধারণ ব্যবহারকারী)</option>
                  <option value="author">Author (গল্প লেখক)</option>
                  <option value="moderator">Moderator (মডারেটর)</option>
                  <option value="content_manager">Content Manager (কন্টেন্ট ম্যানেজার)</option>
                  <option value="admin" disabled={currentUser?.role !== "superadmin"}>
                    {currentUser?.role === "superadmin" ? "Admin (অ্যাডমিন)" : "Admin (শুধু সুপার অ্যাডমিন দিতে পারবেন)"}
                  </option>
                </select>
              </div>

              <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 border border-border rounded-xl px-3.5 py-3">
                <div>
                  <p className="font-semibold text-fg text-xs">যাচাইকৃত লেখক ব্যাজ</p>
                  <p className="text-[10px] text-fg-muted dark:text-fg-subtle mt-0.5">প্রোফাইলে নীল চেক ব্যাজ দেখাবে</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedVerified(!selectedVerified)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    selectedVerified ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"
                  }`}
                  role="switch"
                  aria-checked={selectedVerified}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${selectedVerified ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 border border-border rounded-xl px-3.5 py-3">
                <div>
                  <p className="font-semibold text-fg text-xs">বিশ্বস্ত লেখক (অটো-অ্যাপ্রুভ)</p>
                  <p className="text-[10px] text-fg-muted dark:text-fg-subtle mt-0.5">এই লেখকের গল্প জমা দিলেই সরাসরি পাবলিশ হবে (রিভিউ ছাড়া)</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTrusted(!selectedTrusted)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    selectedTrusted ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-700"
                  }`}
                  role="switch"
                  aria-checked={selectedTrusted}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${selectedTrusted ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              <div>
                <label className="block font-semibold text-fg mb-1.5">নতুন পাসওয়ার্ড (ঐচ্ছিক)</label>
                <input 
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="পাসওয়ার্ড পরিবর্তন না করতে ফাঁকা রাখুন"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-fg text-sm"
                />
              </div>

              {/* Role description helper */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-border rounded-xl text-[10px] leading-relaxed text-fg-muted dark:text-fg-subtle">
                <span className="font-bold block mb-0.5 text-fg">রোল পারমিশন:</span>
                {selectedRole === "user" && "শুধু পড়া, কমেন্ট ও রিঅ্যাকশন করতে পারবে।"}
                {selectedRole === "author" && "গল্প লিখে জমা দিতে পারবে, নিজের গল্প এডিট করতে পারবে।"}
                {selectedRole === "moderator" && "কমেন্ট ও রিপোর্ট ম্যানেজ করতে পারবে। কোনো কিছু ডিলিট করতে পারবে না।"}
                {selectedRole === "content_manager" && "গল্প অ্যাপ্রুভ/রিজেক্ট/হাইড করতে পারবে, অ্যানালিটিক্স দেখতে পারবে। স্থায়ী ডিলিট করতে পারবে না।"}
                {selectedRole === "admin" && "প্রায় সবকিছু করতে পারবে, কিন্তু স্থায়ী ডিলিটের জন্য সুপার অ্যাডমিনের অনুমোদন লাগবে।"}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2.5 bg-surface-hover text-fg rounded-xl font-semibold text-xs hover:bg-surface-hover transition-colors"
              >
                বাতিল
              </button>
              <button
                disabled={updateLoading}
                onClick={handleUpdateUser}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" /> {updateLoading ? "আপডেট হচ্ছে..." : "সংরক্ষণ করুন"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Reset Link Modal */}
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
                <h3 className="text-lg font-bold text-fg">অটো পাসওয়ার্ড রিসেট লিঙ্ক</h3>
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
                    {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
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
                  ইউজারের কোনো ইমেইল সেট করা নেই। উপরের লিঙ্ক বা পাসওয়ার্ড কপি করে ইউজারকে পাঠান।
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
      </main>
    </div>
  );
}
