"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, ExternalLink, Video } from "lucide-react";
import type { ResolvedVideo } from "@/lib/video-link-resolver";

/**
 * Inline video embed for story bodies.
 *
 * Facebook-style: a poster frame with the title and a centred play button;
 * the iframe is only mounted once the visitor actually asks for it. That
 * matters here because a single story can carry several of these — mounting
 * every third-party player up front would pull megabytes of player JS and
 * start tracking before the reader expressed any intent.
 *
 * Also honours the site-wide video kill switch: when the video section is
 * off we render nothing at all rather than a frame pointing at a dead page.
 */
export function PostVideoEmbed({ video }: { video: ResolvedVideo }) {
  const [playing, setPlaying] = useState(false);

  if (!video.embedUrl) return null;

  return (
    <figure className="not-prose my-6 w-full">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-black/10">
        {playing ? (
          <iframe
            src={video.embedUrl}
            title={video.title || "ভিডিও"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 block h-full w-full"
            aria-label={`ভিডিও চালু করুন${video.title ? `: ${video.title}` : ""}`}
          >
            {video.thumbnail ? (
              <Image
                src={video.thumbnail}
                alt=""
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 680px"
                className="object-cover transition-opacity group-hover:opacity-90"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-neutral-900 text-white/25">
                <Video className="h-14 w-14" />
              </span>
            )}

            {/* Scrim so the play button stays legible on a bright poster. */}
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-blue-700 shadow-lg ring-1 ring-black/10 transition group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white sm:h-16 sm:w-16">
                <Play className="ml-0.5 h-6 w-6 fill-current sm:h-7 sm:w-7" />
              </span>
            </span>

            {video.title ? (
              <span className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                <span className="block text-left font-latin text-sm font-semibold leading-snug text-white drop-shadow sm:text-base">
                  {video.title}
                </span>
              </span>
            ) : null}
          </button>
        )}
      </div>

      {/* ---- Caption: "মূল পেজে যান" for external links; an internal link
              for our own videos so the reader can read the description,
              comments and related rail. ---- */}
      {video.isOwn ? (
        <figcaption className="mt-2 flex items-center gap-2 text-xs text-fg-subtle">
          <Video className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate">
            {video.title ? "ভিডিও পেজে বিস্তারিত দেখুন" : "ভিডিও"}
          </span>
          <Link
            href={video.sourceUrl}
            className="ml-auto shrink-0 font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            বিস্তারিত
          </Link>
        </figcaption>
      ) : (
        <figcaption className="mt-2 flex items-center justify-end">
          <a
            href={video.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            মূল সাইটে দেখুন
            <ExternalLink className="h-3 w-3 opacity-70" />
          </a>
        </figcaption>
      )}
    </figure>
  );
}