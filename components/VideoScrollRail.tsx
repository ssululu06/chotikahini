"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VideoCard, type VideoCardData } from "@/components/VideoCard";

/**
 * Horizontal scroll rail for video cards.
 *
 * One row, cards keep their exact size, and the visitor scrolls with any of:
 *   • touch / trackpad swipe (native `overflow-x-auto` scroll)
 *   • the ← → arrow buttons (calls `scrollBy` one "page" at a time)
 *   • automatic advance (`autoPlay`), so the shelf keeps moving if the
 *     visitor just watches — the homepage teaser never reads as static.
 *
 * Auto-advance is deliberately conservative. It pauses on hover, on touch,
 * while the tab is in the background, and entirely for visitors who asked
 * for reduced motion (`prefers-reduced-motion`), because a rail that keeps
 * sliding while you're trying to read a title is hostile. When the rail
 * reaches the end it wraps back to the start.
 *
 * Arrows are hidden when there's nothing to scroll in that direction, so the
 * control only appears once it can actually do something — no dead buttons.
 * On first load we jump to the start so a restored scroll position (Safari
 * bfcache / back-navigation) doesn't leave the rail mid-scroll.
 *
 * No carousel library — `scrollBy` with smooth behaviour plus one interval
 * is all a modern browser needs.
 */
export function VideoScrollRail({
  videos,
  sizes = "(max-width: 640px) 70vw, (max-width: 1024px) 40vw, 25vw",
  priorityFirst = false,
  autoPlay = false,
  autoPlayIntervalMs = 6000,
}: {
  videos: VideoCardData[];
  sizes?: string;
  priorityFirst?: boolean;
  /** Advance one "page" every `autoPlayIntervalMs` while idle. */
  autoPlay?: boolean;
  autoPlayIntervalMs?: number;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  // Pointer down anywhere on the rail counts as "the visitor is busy" —
  // covers touch scrolling, dragging, and clicking a card.
  const [paused, setPaused] = useState(false);

  // Recompute arrow state on scroll + resize.
  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    // 4px tolerance: fractional scroll widths otherwise leave a 1px
    // sliver that keeps the right arrow lit when we're fully at the end.
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateArrows();
    // Reset to the start on mount (back-nav can restore an offset).
    el.scrollLeft = 0;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, videos.length]);

  const scrollBy = useCallback((dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // Advance by exactly one card + the gap, so the rail creeps card by
    // card instead of jumping a whole viewport at a time. We measure the
    // live first-child width because the cards are viewport-relative
    // (70vw on mobile, 42vw on tablet), so a hardcoded pixel step would
    // misalign at every breakpoint.
    const first = el.firstElementChild as HTMLElement | null;
    const cardStep = first ? first.offsetWidth : Math.round(el.clientWidth * 0.8);
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    const step = cardStep + gap;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const next = el.scrollLeft + dir * step;

    if (dir > 0 && next >= maxScroll - 4) {
      // Wrap to the top so auto-play loops instead of stalling at the end.
      el.scrollTo({ left: 0, behavior: "smooth" });
    } else if (dir < 0 && next <= 4) {
      el.scrollTo({ left: maxScroll, behavior: "smooth" });
    } else {
      el.scrollBy({ left: dir * step, behavior: "smooth" });
    }
  }, []);

  // ---- Auto-advance ------------------------------------------------
  useEffect(() => {
    if (!autoPlay) return;
    if (videos.length === 0) return;
    if (paused) return;

    // Respect the OS-level motion preference outright — no auto-scroll at
    // all, rather than a faster/slower variant.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const tick = () => {
      // Don't move the rail while the tab is in the background.
      if (document.visibilityState !== "visible") return;
      scrollBy(1);
    };
    const id = window.setInterval(tick, autoPlayIntervalMs);
    return () => window.clearInterval(id);
  }, [autoPlay, autoPlayIntervalMs, paused, scrollBy, videos.length]);

  if (videos.length === 0) return null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // Touch: pause while the finger is down, resume when it's lifted —
      // otherwise one swipe would park the carousel forever.
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerCancel={() => setPaused(false)}
    >
      {/* ---- Scroller: one row, snap for a tidy stop on mobile ---- */}
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden"
      >
        {videos.map((video, i) => (
          <div
            key={video.id}
            className="w-[70vw] shrink-0 snap-start sm:w-[42vw] lg:w-[26vw] xl:w-[calc((100%-3rem)/4)]"
          >
            <VideoCard
              video={video}
              sizes={sizes}
              priority={priorityFirst && i === 0}
            />
          </div>
        ))}
        {/* Trailing spacer so the last card can snap flush to the left edge. */}
        <div aria-hidden className="w-1 shrink-0" />
      </div>

      {/* ---- Arrows: absolutely positioned over the rail edges ---- */}
      {canLeft ? (
        <RailArrow side="left" onClick={() => scrollBy(-1)} />
      ) : null}
      {canRight ? (
        <RailArrow side="right" onClick={() => scrollBy(1)} />
      ) : null}
    </div>
  );
}

function RailArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const isLeft = side === "left";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isLeft ? "আগের ভিডিওগুলো দেখুন" : "পরের ভিডিওগুলো দেখুন"}
      className={
        "absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full " +
        "border border-border bg-surface/95 text-fg shadow-md backdrop-blur transition " +
        "hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 " +
        "md:flex " +
        (isLeft ? "left-1" : "right-1")
      }
    >
      {isLeft ? (
        <ChevronLeft className="h-5 w-5" />
      ) : (
        <ChevronRight className="h-5 w-5" />
      )}
    </button>
  );
}