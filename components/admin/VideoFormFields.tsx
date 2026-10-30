"use client";

import { useEffect, useRef } from "react";
import { Loader2, RefreshCw, User } from "lucide-react";
import {
  extractIframeMetadata,
  extractSourceUrl,
} from "@/lib/video-embed";
import { extractUploaderFromDescription } from "@/lib/uploader-from-description";

/**
 * Shared field set for both the "create" and "edit" video forms.
 *
 * Auto-extract strategy:
 *
 *   1. On every keystroke in the embed textarea, a cheap client-side pass
 *      (`extractIframeMetadata`) picks up `title=` / `poster=` attributes
 *      when a raw `<iframe>` snippet is pasted.
 *
 *   2. After a 600 ms settle period we also call `/api/video-metadata`,
 *      which fetches the page server-side and returns og:title, og:image,
 *      og:description — plus, for providers we know, the official embed URL
 *      derived straight from the watch-page slug. That's what makes pasting
 *      `faphouse2.com/videos/<slug>` (rather than an iframe snippet) fill
 *      the whole form.
 *
 *   3. Fields the admin has typed into are locked against overwrite so the
 *      form never fights the admin. "মেটাডেটা আবার আনুন" forces a refresh.
 */

export interface VideoFormValues {
  title: string;
  description: string;
  sourceUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
  uploaderName: string;
}

interface Props {
  values: VideoFormValues;
  onChange: (patch: Partial<VideoFormValues>) => void;
  metaBusy?: boolean;
  idPrefix: string;
}

const META_DEBOUNCE_MS = 600;

export function VideoFormFields({ values, onChange, metaBusy, idPrefix }: Props) {
  // Fields the admin has personally typed in are locked against auto-fill.
  const touched = useRef({
    title: false,
    thumbnailUrl: false,
    sourceUrl: false,
    description: false,
    uploaderName: false,
  });

  // Server-side metadata fetch, debounced on the embed field only.
  useEffect(() => {
    const url = values.embedUrl.trim();
    if (!url) return;

    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/video-metadata?url=${encodeURIComponent(url)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!data || typeof data !== "object") return;

        const patch: Partial<VideoFormValues> = {};

        if (typeof data.title === "string" && data.title && !touched.current.title) {
          patch.title = data.title;
        }
        if (
          typeof data.thumbnail === "string" &&
          data.thumbnail &&
          !touched.current.thumbnailUrl
        ) {
          patch.thumbnailUrl = data.thumbnail;
        }
        if (
          typeof data.sourceUrl === "string" &&
          data.sourceUrl &&
          !touched.current.sourceUrl
        ) {
          patch.sourceUrl = data.sourceUrl;
        }
        if (
          typeof data.description === "string" &&
          data.description &&
          !touched.current.description
        ) {
          patch.description = data.description;
        }
        // Uploader preference order:
        //   1. Whatever the metadata endpoint declared explicitly.
        //   2. The trailing segment of the description (often "Title — Author").
        //      This is the case where the page lacks an `author` meta but still
        //      ships the channel name at the end of the blurb.
        let inferredUploader: string | null = null;
        if (
          typeof data.uploaderName === "string" &&
          data.uploaderName &&
          !touched.current.uploaderName
        ) {
          inferredUploader = data.uploaderName;
        } else if (
          !touched.current.uploaderName &&
          (patch.description || values.description)
        ) {
          inferredUploader = extractUploaderFromDescription(
            patch.description || values.description,
          );
        }
        if (inferredUploader) {
          patch.uploaderName = inferredUploader;
        }
        // When the resolver found a provider-official embed URL that differs
        // from what was pasted, swap it in. Identical values are skipped so
        // a pasted iframe snippet is never clobbered by itself.
        if (
          typeof data.embedUrl === "string" &&
          data.embedUrl &&
          data.embedUrl !== url
        ) {
          patch.embedUrl = data.embedUrl;
        }

        // Only push a patch when at least one field would actually change.
        const dirty = (Object.keys(patch) as (keyof VideoFormValues)[]).some(
          (key) => {
            const next = patch[key];
            return typeof next === "string" && next !== values[key];
          },
        );
        if (dirty) onChange(patch);
      } catch {
        // Network blip — the manual button below is the escape hatch.
      }
    }, META_DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.embedUrl]);

  const runManualExtract = () => {
    const value = values.embedUrl;

    // Pass 1 — local iframe attribute parsing (instant, no network).
    const patch: Partial<VideoFormValues> = {};
    const metadata = extractIframeMetadata(value);
    if (metadata.title) {
      patch.title = metadata.title;
      touched.current.title = false;
    }
    if (metadata.thumbnailUrl) {
      patch.thumbnailUrl = metadata.thumbnailUrl;
      touched.current.thumbnailUrl = false;
    }
    const recovered = extractSourceUrl(value);
    if (recovered) {
      patch.sourceUrl = recovered;
      touched.current.sourceUrl = false;
    }
    if (Object.keys(patch).length > 0) onChange(patch);

    // Pass 2 — server scrape / resolver, overrides whatever pass 1 found.
    if (!value.trim()) return;
    fetch(`/api/video-metadata?url=${encodeURIComponent(value.trim())}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || typeof data !== "object") return;
        const server: Partial<VideoFormValues> = {};
        if (data.title) {
          server.title = data.title;
          touched.current.title = false;
        }
        if (data.thumbnail) {
          server.thumbnailUrl = data.thumbnail;
          touched.current.thumbnailUrl = false;
        }
        if (data.sourceUrl) {
          server.sourceUrl = data.sourceUrl;
          touched.current.sourceUrl = false;
        }
        if (data.description) {
          server.description = data.description;
          touched.current.description = false;
        }
        if (data.uploaderName) {
          server.uploaderName = data.uploaderName;
          touched.current.uploaderName = false;
        }
        if (data.embedUrl && data.embedUrl !== value.trim()) {
          server.embedUrl = data.embedUrl;
        }
        if (Object.keys(server).length > 0) onChange(server);
      })
      .catch(() => {});
  };

  return (
    <>
      <label
        className="block space-y-1.5 text-sm font-medium text-fg"
        htmlFor={`${idPrefix}-title`}
      >
        ভিডিওর শিরোনাম
        <input
          id={`${idPrefix}-title`}
          value={values.title}
          onChange={(e) => {
            touched.current.title = true;
            onChange({ title: e.target.value });
          }}
          maxLength={160}
          className="input-field w-full font-latin"
          placeholder="লিংক দিলে auto-fill হবে; না থাকলে লিখুন"
        />
      </label>

      <label
        className="block space-y-1.5 text-sm font-medium text-fg"
        htmlFor={`${idPrefix}-source`}
      >
        মূল ভিডিও পেজের লিংক
        <input
          id={`${idPrefix}-source`}
          type="url"
          inputMode="url"
          value={values.sourceUrl}
          onChange={(e) => {
            touched.current.sourceUrl = true;
            onChange({ sourceUrl: e.target.value });
          }}
          maxLength={2048}
          required
          className="input-field w-full"
          placeholder="https://example.com/video/..."
        />
      </label>

      <label
        className="block space-y-1.5 text-sm font-medium text-fg"
        htmlFor={`${idPrefix}-uploader`}
      >
        আপলোডার / চ্যানেল নাম
        <span className="block text-xs font-normal leading-5 text-fg-muted">
          ভিডিও কার, তা যেন সবাই বুঝতে পারে।
        </span>
        <input
          id={`${idPrefix}-uploader`}
          value={values.uploaderName}
          onChange={(e) => {
            touched.current.uploaderName = true;
            onChange({ uploaderName: e.target.value });
          }}
          maxLength={120}
          className="input-field w-full font-latin"
          placeholder="যেমন: NatashaRecords"
        />
      </label>

      <label
        className="block space-y-1.5 text-sm font-medium text-fg"
        htmlFor={`${idPrefix}-embed`}
      >
        ভিডিও লিংক বা iframe code
        {metaBusy ? (
          <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-normal text-fg-muted">
            <Loader2 className="h-3 w-3 animate-spin" />
            তথ্য আনা হচ্ছে…
          </span>
        ) : null}
        <textarea
          id={`${idPrefix}-embed`}
          inputMode="url"
          value={values.embedUrl}
          onChange={(e) => {
            const value = e.target.value;
            const patch: Partial<VideoFormValues> = { embedUrl: value };

            // Immediate client-side pass for the iframe-attribute case.
            const metadata = extractIframeMetadata(value);
            const recovered = extractSourceUrl(value);
            if (metadata.title && !touched.current.title) {
              patch.title = metadata.title;
            }
            if (metadata.thumbnailUrl && !touched.current.thumbnailUrl) {
              patch.thumbnailUrl = metadata.thumbnailUrl;
            }
            if (recovered && !touched.current.sourceUrl) {
              patch.sourceUrl = recovered;
            }

            onChange(patch);
          }}
          maxLength={8192}
          required
          rows={3}
          className="input-field w-full resize-y"
          placeholder={
            'https://provider.com/videos/abc-123  অথবা  <iframe src="..." title="..." poster="..."></iframe>'
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!values.embedUrl.trim()}
            onClick={runManualExtract}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-fg-muted transition hover:bg-surface-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            তথ্য আবার আনুন
          </button>
          <span className="text-[11px] text-fg-muted">
            শুধু watch-page লিংক দিলেই embed URL, শিরোনাম, ছবি ও বিবরণ নিজে থেকে বসে যাবে।
          </span>
        </div>
        <span className="block text-xs font-normal leading-5 text-fg-muted">
          YouTube, Vimeo, Xvideos, Xhamster, XNXX, Pornhub, Faphouse, SpankBang,
          Redtube, YouPorn, Dailymotion সহ প্রায় সব provider-এর watch-page থেকে
          official embed URL বের করা হয়।
        </span>
      </label>

      <label
        className="block space-y-1.5 text-sm font-medium text-fg"
        htmlFor={`${idPrefix}-thumb`}
      >
        Preview / Open Graph ছবির HTTPS URL
        <input
          id={`${idPrefix}-thumb`}
          type="url"
          inputMode="url"
          value={values.thumbnailUrl}
          onChange={(e) => {
            touched.current.thumbnailUrl = true;
            onChange({ thumbnailUrl: e.target.value });
          }}
          maxLength={2048}
          required
          className="input-field w-full"
          placeholder="https://provider.com/thumbnail.jpg"
        />
        <span className="block text-xs font-normal leading-5 text-fg-muted">
          ভিডিও শেয়ার করলে preview ছবি দেখানোর জন্য এটি প্রয়োজন।
        </span>
      </label>

      <label
        className="block space-y-1.5 text-sm font-medium text-fg"
        htmlFor={`${idPrefix}-desc`}
      >
        সংক্ষিপ্ত বিবরণ <span className="font-normal text-fg-muted">(ঐচ্ছিক)</span>
        <textarea
          id={`${idPrefix}-desc`}
          value={values.description}
          onChange={(e) => {
            touched.current.description = true;
            onChange({ description: e.target.value });
          }}
          maxLength={500}
          rows={3}
          className="input-field w-full resize-y"
          placeholder="ভিডিও সম্পর্কে লিখুন"
        />
      </label>
    </>
  );
}