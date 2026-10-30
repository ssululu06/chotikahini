"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

export function SeriesShareActions({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setError("");
      window.setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      console.error("Failed to copy series URL", copyError);
      setError("লিংক কপি করা যায়নি।");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-2 rounded-xl bg-fg px-4 py-2.5 text-sm font-semibold text-surface shadow-sm transition hover:opacity-85"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "লিংক কপি হয়েছে" : "সিরিজ লিংক কপি"}
      </button>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-alt px-4 py-2.5 text-sm font-semibold text-fg transition hover:bg-surface-hover"
      >
        <Share2 className="h-4 w-4" />
        Facebook
      </a>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl border border-border bg-surface-alt px-4 py-2.5 text-sm font-semibold text-fg transition hover:bg-surface-hover"
      >
        WhatsApp
      </a>
      <a
        href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl border border-border bg-surface-alt px-4 py-2.5 text-sm font-semibold text-fg transition hover:bg-surface-hover"
      >
        Telegram
      </a>
      {error && <span role="alert" className="w-full text-xs text-red-600">{error}</span>}
    </div>
  );
}
