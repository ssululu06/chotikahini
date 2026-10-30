"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

interface Props {
  value: string;
  onChange: (avatar: string) => void;
}

export function AvatarPicker({ value, onChange }: Props) {
  const [avatars, setAvatars] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/avatars")
      .then((r) => (r.ok ? r.json() : { avatars: [] }))
      .then((d) => setAvatars(d.avatars || []))
      .catch(() => {});
  }, []);

  return (
    <div>
      <label className="block text-sm font-medium text-fg-muted mb-2">প্রোফাইল ছবি নির্বাচন করুন</label>
      <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-56 overflow-y-auto p-2 bg-surface border border-border rounded-xl">
        {avatars.map((a) => {
          const selected = value === a;
          return (
            <button
              key={a}
              type="button"
              onClick={() => onChange(a)}
              className={`relative aspect-square rounded-full overflow-hidden transition-all ${
                selected ? "ring-4 ring-blue-500 scale-105" : "ring-1 ring-border hover:ring-blue-400 hover:scale-105"
              }`}
              title="এই ছবিটি নির্বাচন করুন"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a} alt="Avatar" className="w-full h-full object-cover" />
              {selected && (
                <span className="absolute inset-0 bg-blue-500/30 flex items-center justify-center">
                  <Check className="w-5 h-5 text-white drop-shadow" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-fg-subtle mt-1.5">আপনার প্রোফাইলের জন্য একটি ছবি নির্বাচন করুন।</p>
    </div>
  );
}
