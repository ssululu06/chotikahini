"use client";

import { useAuth } from "@/contexts/AuthContext";
import { getRoleLabel, getRoleDescription, type Role } from "@/lib/permissions";
import { Check, X, ChevronDown } from "lucide-react";
import { useState } from "react";

interface Ability {
  label: string;
  allowed: boolean;
}

// What each role CAN do (allowed: true) and CANNOT do (allowed: false)
const ROLE_ABILITIES: Record<Role, Ability[]> = {
  superadmin: [
    { label: "সম্পূর্ণ অ্যাডমিন প্যানেল অ্যাক্সেস", allowed: true },
    { label: "গল্প প্রকাশ / আনপাবলিশ / হাইড / রিস্টোর", allowed: true },
    { label: "যেকোনো কন্টেন্ট স্থায়ী ডিলিট", allowed: true },
    { label: "ইউজার ও অ্যাডমিন ম্যানেজ", allowed: true },
    { label: "রোল পরিবর্তন (admin সহ)", allowed: true },
    { label: "ডিলিট রিকোয়েস্ট অনুমোদন", allowed: true },
    { label: "সিকিউরিটি সেটিংস পরিবর্তন", allowed: true },
    { label: "ভেরিফিকেশন, রিপোর্ট, কমেন্ট ম্যানেজ", allowed: true },
    { label: "অডিট লগ ও অ্যানালিটিক্স", allowed: true },
  ],
  admin: [
    { label: "অ্যাডমিন প্যানেল অ্যাক্সেস", allowed: true },
    { label: "গল্প review / approve / reject / edit / hide", allowed: true },
    { label: "ইউজার ও ভেরিফিকেশন ম্যানেজ", allowed: true },
    { label: "কমেন্ট ও রিপোর্ট ম্যানেজ", allowed: true },
    { label: "ঘোষণা ও সাধারণ সেটিংস", allowed: true },
    { label: "স্থায়ী ডিলিট", allowed: false },
    { label: "admin / superadmin রোল দেওয়া বা পরিবর্তন", allowed: false },
    { label: "ডিলিট রিকোয়েস্ট অনুমোদন", allowed: false },
    { label: "সিকিউরিটি সেটিংস", allowed: false },
  ],
  content_manager: [
    { label: "রিভিউ সেন্টার অ্যাক্সেস", allowed: true },
    { label: "গল্প approve / publish / reject / revision", allowed: true },
    { label: "গল্প edit / hide", allowed: true },
    { label: "গল্পের কন্টেন্ট অ্যানালিটিক্স", allowed: true },
    { label: "নিজের গল্প লেখা ও জমা দেওয়া", allowed: true },
    { label: "ইউজার ম্যানেজ", allowed: false },
    { label: "রোল পরিবর্তন", allowed: false },
    { label: "ভিজিটর/ইউজার অ্যানালিটিক্স", allowed: false },
    { label: "কমেন্ট মডারেশন / রিপোর্ট", allowed: false },
    { label: "স্থায়ী ডিলিট", allowed: false },
  ],
  moderator: [
    { label: "কমেন্ট মডারেশন (hide / approve)", allowed: true },
    { label: "রিপোর্ট রিভিউ / ডিসমিস", allowed: true },
    { label: "মডারেশন-সম্পর্কিত অ্যানালিটিক্স", allowed: true },
    { label: "নিজের গল্প লেখা ও জমা দেওয়া", allowed: true },
    { label: "গল্প publish / approve", allowed: false },
    { label: "গল্প review / reject", allowed: false },
    { label: "ইউজার ম্যানেজ", allowed: false },
    { label: "রোল পরিবর্তন", allowed: false },
    { label: "স্থায়ী ডিলিট", allowed: false },
  ],
  author: [
    { label: "নিজের গল্প লিখা / এডিট / সাবমিট", allowed: true },
    { label: "গল্পের স্ট্যাটাস ও ফিডব্যাক দেখা", allowed: true },
    { label: "নিজের গল্পের অ্যানালিটিক্স", allowed: true },
    { label: "ভেরিফিকেশন ব্যাজের আবেদন", allowed: true },
    { label: "অন্য লেখকের গল্প এডিট", allowed: false },
    { label: "অ্যাডমিন প্যানেল অ্যাক্সেস", allowed: false },
    { label: "গল্প publish / approve", allowed: false },
  ],
  user: [
    { label: "গল্প পড়া", allowed: true },
    { label: "কমেন্ট / রিপ্লাই / রিঅ্যাকশন", allowed: true },
    { label: "লাইক / সেভ / ফলো", allowed: true },
    { label: "লেখক হওয়ার আবেদন", allowed: true },
    { label: "গল্প জমা দেওয়া", allowed: false },
    { label: "অ্যাডমিন প্যানেল অ্যাক্সেস", allowed: false },
  ],
};

export function RoleGuide() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const role = (user?.role || "user") as Role;
  const abilities = ROLE_ABILITIES[role] || [];

  return (
    <div className="bg-surface-alt rounded-2xl border border-border shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
            <ShieldIcon />
          </span>
          <div>
            <p className="text-sm font-bold text-fg">
              আপনার রোল: <span className="text-blue-600 dark:text-blue-400">{getRoleLabel(role)}</span>
            </p>
            <p className="text-xs text-fg-muted dark:text-fg-subtle mt-0.5">{getRoleDescription(role)}</p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-fg-subtle shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 border-t border-border">
          {abilities.map((a, i) => (
            <div key={i} className="flex items-center gap-2.5 py-1.5">
              {a.allowed ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                  <Check className="w-3 h-3" />
                </span>
              ) : (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-500">
                  <X className="w-3 h-3" />
                </span>
              )}
              <span className={`text-xs ${a.allowed ? "text-fg" : "text-fg-subtle dark:text-fg-muted line-through"}`}>
                {a.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}
