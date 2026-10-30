"use client";
import { bndSafe } from "@/lib/utils";

import { useState, useEffect } from "react";
import { X, Clock } from "lucide-react";

interface HistoryEntry {
  id: number;
  content: string;
  editedByName: string;
  editedByUsername: string;
  createdAt: string;
}

interface Props {
  postId: number;
  currentContent: string;
  onClose: () => void;
}

export function PostHistoryModal({ postId, currentContent, onClose }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/community/posts/${postId}/history`);
        const json = await res.json();
        if (res.ok) setHistory(json.history || []);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    })();
  }, [postId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-bold text-fg flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" /> এডিট ইতিহাস
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-fg-muted hover:bg-surface-hover hover:text-fg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Current version */}
          <div className="p-3 bg-surface-alt rounded-xl border border-border">
            <div className="flex items-center gap-2 text-xs text-fg-muted mb-2">
              <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-semibold">বর্তমান</span>
            </div>
            <p className="text-sm text-fg whitespace-pre-wrap break-words">{currentContent}</p>
          </div>

          {loading && <div className="text-center py-6 text-sm text-fg-muted animate-pulse">লোড হচ্ছে...</div>}

          {!loading && history.length === 0 && (
            <div className="text-center py-6 text-sm text-fg-muted">কোনো এডিট ইতিহাস নেই।</div>
          )}

          {history.map((entry) => (
            <div
              key={entry.id}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                selected?.id === entry.id
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                  : "border-border bg-surface-alt hover:border-accent/50"
              }`}
              onClick={() => setSelected(selected?.id === entry.id ? null : entry)}
            >
              <div className="flex items-center justify-between gap-2 text-xs text-fg-muted mb-2">
                <span className="font-medium">@{entry.editedByUsername}</span>
                <span>{bndSafe(entry.createdAt, "datetime")}</span>
              </div>
              <p className="text-sm text-fg whitespace-pre-wrap break-words line-clamp-3">{entry.content}</p>
              {selected?.id === entry.id && (
                <div className="mt-2 pt-2 border-t border-border/60">
                  <p className="text-sm text-fg whitespace-pre-wrap break-words">{entry.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}