"use client";

import { useState } from "react";
import { Flag, Check, AlertTriangle, X } from "lucide-react";

interface Props {
  targetType: "story" | "comment";
  targetId: string;
}

export function ReportButton({ targetType, targetId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => setIsOpen(false), 2000);
      } else {
        setError(data.error || "রিপোর্ট জমা দিতে সমস্যা হয়েছে।");
      }
    } catch {
      setError("অনাকাঙ্ক্ষিত সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-red-500 transition-colors"
        title="রিপোর্ট করুন"
      >
        <Flag className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">রিপোর্ট</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 relative">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h4 className="font-bold text-sm text-fg flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> কন্টেন্ট রিপোর্ট করুন
              </h4>
              <button
                onClick={() => setIsOpen(false)}
                className="text-fg-subtle hover:text-fg text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submitted ? (
              <div className="py-6 text-center text-xs text-emerald-600 font-semibold flex flex-col items-center gap-2">
                <Check className="w-8 h-8 p-1.5 bg-emerald-100 dark:bg-emerald-950/40 rounded-full" />
                রিপোর্ট জমা হয়েছে! এডমিন শীঘ্রই পর্যালোচনা করবেন।
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <p className="text-xs text-fg-muted">
                  আপত্তিজনক, স্প্যাম বা নীতিমালা লঙ্ঘনকারী বিষয়বস্তুর কারণ ব্যাখ্যা করুন:
                </p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="যেমন: স্প্যাম লিংক, অশ্লীল ভাষা, বা অনুলিপি কন্টেন্ট..."
                  className="w-full h-24 p-2.5 text-xs bg-surface-alt border border-border rounded-xl focus:outline-none focus:border-accent resize-none"
                  required
                />

                {error && <p className="text-xs text-red-500">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-3 py-1.5 text-xs text-fg-muted hover:bg-surface-hover rounded-lg"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    {loading ? "জমা হচ্ছে..." : "জমা দিন"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
