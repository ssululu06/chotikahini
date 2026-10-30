"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

/**
 * Feature switches backed by `site_settings.features`.
 *
 * Each switch PATCHes with a *partial* patch (`featuresPatch`), so adding a
 * new flag in code never requires preserving unknown keys — the API merges
 * server-side over the defaults. A switch takes effect immediately because
 * the API invalidates the settings cache tags.
 *
 * Exported surface:
 *   • `VideoSectionToggle` — the video on/off row, rendered by the video
 *     hub's settings tab.
 */

export function useFeatureToggle(flag: "videoSection") {
  const [value, setValue] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/site-settings", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        // Missing flag ⇒ default-on, matching the server default.
        if (json.features) setValue(json.features[flag] !== false);
      }
    } catch {
      /* keep the optimistic default on a network blip */
    } finally {
      setLoaded(true);
    }
  }, [flag]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async () => {
    const next = !value;
    // Optimistic — the switch should feel instant.
    setValue(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featuresPatch: { [flag]: next } }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "সেভ করা যায়নি");
    } catch (e: any) {
      // Roll back to the server's truth on failure.
      setValue(!next);
      setError(e?.message || "সেভ করা যায়নি।");
    } finally {
      setBusy(false);
    }
  };

  return { enabled: value, loaded, busy, error, toggle };
}

export function VideoSectionToggle() {
  const { enabled, loaded, busy, error, toggle } = useFeatureToggle("videoSection");

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-100 px-4 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <FeatureRow
        title="ভিডিও সেকশন"
        description={
          enabled
            ? "ON — হোমপেজে ভিডিও কার্ড, /videos লিস্ট ও ভিডিও ডিটেইল পেজ সবাই দেখতে ও শেয়ার করতে পারবে।"
            : "OFF — হোমপেজে ভিডিও কার্ড লুকানো, /videos ও ভিডিও পেজ 404, মেনু থেকে লিংক সরানো। ভিডিওগুলো DB-তে থাকবে, পরে ON করলেই ফিরে আসবে।"
        }
        enabled={enabled}
        busy={busy}
        loaded={loaded}
        onToggle={() => void toggle()}
      />
    </div>
  );
}

function FeatureRow({
  title,
  description,
  enabled,
  busy,
  loaded,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  busy: boolean;
  loaded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface p-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-fg">{title}</p>
        <p className="mt-1 text-sm leading-6 text-fg-muted">{description}</p>
      </div>

      <button
        type="button"
        onClick={onToggle}
        disabled={!loaded || busy}
        aria-pressed={enabled}
        aria-label={`${title} — ${enabled ? "বন্ধ করুন" : "চালু করুন"}`}
        className={
          "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition disabled:opacity-60 " +
          (enabled
            ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300"
            : "bg-neutral-500/15 text-fg-muted hover:bg-neutral-500/25")
        }
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : enabled ? (
          <>
            <Eye className="h-4 w-4" /> ON
          </>
        ) : (
          <>
            <EyeOff className="h-4 w-4" /> OFF
          </>
        )}
      </button>
    </div>
  );
}