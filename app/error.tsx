"use client";

// ─────────────────────────────────────────────────────────────
// Top-level client error boundary — runs in the browser when a
// runtime error bubbles up from anywhere in the tree.
//
// Common source: Chrome browser extensions (Grammarly, ad-blockers,
// password managers) attach executors that read internal React/Next
// properties. With Next.js 14 the stream uses an internal key (e.g.
// `M_ID`) that some extensions trip over, throwing
//   TypeError: Cannot read properties of undefined (reading 'M_ID')
// Even though we don't ship that property name ourselves, the runtime
// error still lands on the user's screen. We catch it here so the UI
// degrades gracefully instead of going blank — and so the message
// matches the user's language rather than the raw React stack.
// ─────────────────────────────────────────────────────────────

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the dev console so the actual stack still helps in
    // debugging, but never let it break the page.
    // (Avoid console.error in production to keep browser tooling clean.)
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[app error boundary]", error);
    }
  }, [error]);

  const looksLikeExtension =
    typeof error?.message === "string" &&
    /(M_ID|chrome-extension|extension context)/i.test(error.message);

  return (
    <div
      role="alert"
      className="min-h-screen flex items-center justify-center px-6 py-12 bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
    >
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-semibold">কিছু ভুল হয়েছে</h1>
        {looksLikeExtension ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            এই ত্রুটিটি আপনার ব্রাউজারে থাকা একটি এক্সটেনশন (যেমন Grammarly অথবা
            ad-blocker) থেকে আসছে। অ্যাডমিন প্যানেল এক্সটেনশন অফ করে আবার
            চেষ্টা করুন অথবা Incognito Mode-এ লগইন করুন।
          </p>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            পেজটি আবার লোড করুন। সমস্যা থাকলে আমাদের জানান।
          </p>
        )}
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            আবার চেষ্টা করুন
          </button>
          <a
            href="/"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            হোম পেজে যান
          </a>
        </div>
      </div>
    </div>
  );
}