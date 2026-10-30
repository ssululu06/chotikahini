"use client";

import { useRef, useState, useLayoutEffect, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type PostMeta } from "@/lib/posts";
import { PostCard } from "./PostCard";

interface FeaturedCarouselProps {
  posts: PostMeta[];
}

const AUTOPLAY_MS = 5000;
const TRANSITION_MS = 400;

export function FeaturedCarousel({ posts }: FeaturedCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [slidesPerView, setSlidesPerView] = useState(4);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef(0);

  // Keep ref in sync
  useEffect(() => { currentRef.current = current; }, [current]);

  // Responsive — useLayoutEffect so the first paint already has correct sizing
  useLayoutEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 640) setSlidesPerView(1);
      else if (w < 1024) setSlidesPerView(2);
      else setSlidesPerView(3);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const total = posts.length;
  const clones = [...posts, ...posts, ...posts];
  const realOffset = total;
  const [offset, setOffset] = useState(realOffset);
  const [transitioning, setTransitioning] = useState(true);
  const offsetRef = useRef(offset);
  useEffect(() => { offsetRef.current = offset; }, [offset]);

  // ── Navigation ──
  const slide = useCallback((dir: 1 | -1) => {
    setTransitioning(true);
    setOffset((o) => o + dir);
  }, []);

  const goToIndex = useCallback((index: number) => {
    setTransitioning(true);
    setOffset(realOffset + index);
    setCurrent(index);
  }, [realOffset]);

  const next = useCallback(() => slide(1), [slide]);
  const prev = useCallback(() => slide(-1), [slide]);

  // Auto-play
  useEffect(() => {
    if (isHovered || isDragging) return;
    const id = setInterval(() => slide(1), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [isHovered, isDragging, slide]);

  // Infinite loop — snap back at clone boundaries
  const handleTransitionEnd = useCallback(() => {
    const cur = offsetRef.current;
    if (cur >= realOffset * 2) {
      setTransitioning(false);
      setOffset(realOffset);
      setCurrent(0);
    } else if (cur < 0) {
      setTransitioning(false);
      setOffset(realOffset * 2 - 1);
      setCurrent(total - 1);
    }
  }, [realOffset, total]);

  // ── Drag refs ──
  const dragStartX = useRef(0);
  const dragXRef = useRef(0);
  const cleanUpDrag = useRef<(() => void) | null>(null);

  const isScrollable = total > slidesPerView;

  // Clean up document-level listeners when unmounting
  useEffect(() => {
    return () => cleanUpDrag.current?.();
  }, []);

  const endDrag = useCallback(() => {
    setIsDragging(false);
    if (dragXRef.current < -50) slide(1);
    else if (dragXRef.current > 50) slide(-1);
    setDragX(0);
    dragXRef.current = 0;
    cleanUpDrag.current = null;
  }, [slide]);

  // If not scrollable, render a static grid
  if (!isScrollable) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    );
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    // If a drag is already in progress, end it first
    if (isDragging) endDrag();

    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragXRef.current = 0;
    setDragX(0);

    // Attach move/up to document so pointer capture doesn't swallow clicks on the Link
    const onMove = (ev: PointerEvent) => {
      if (ev.clientX === dragStartX.current && ev.clientY === e.clientY) return;
      const delta = ev.clientX - dragStartX.current;
      dragXRef.current = delta;
      setDragX(delta);
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      endDrag();
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    cleanUpDrag.current = onUp;
  };

  const handlePointerMove = () => {
    /* no-op — move is handled on document */
  };

  const handlePointerUp = () => {
    /* no-op — up is handled on document */
  };

  // Sizing — translateX uses the reactive slidesPerView state
  const slidePercent = 100 / slidesPerView;
  const baseOffset = -offset * slidePercent;
  const dragOffset = isDragging
    ? (dragX / (containerRef.current?.offsetWidth || 1)) * 100
    : 0;
  const translateX = baseOffset + dragOffset;

  return (
    <div
      ref={containerRef}
      className="relative select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="overflow-hidden h-[360px] sm:h-[380px] md:h-[400px]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="flex h-full"
          style={{
            transform: `translateX(${translateX}%)`,
            transition: isDragging || !transitioning
              ? "none"
              : `transform ${TRANSITION_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1)`,
            touchAction: "pan-y",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {clones.map((post, i) => (
            <div
              key={`${post.slug}-${i}`}
              className="shrink-0 px-2 w-full sm:w-1/2 lg:w-1/4 h-full"
            >
              <PostCard post={post} />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={prev}
        className="carousel-btn left-1 hidden sm:flex"
        aria-label="পূর্ববর্তী"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={next}
        className="carousel-btn right-1 hidden sm:flex"
        aria-label="পরবর্তী"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {total > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-4 sm:hidden">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              onClick={() => goToIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current
                  ? "w-6 bg-fg"
                  : "w-1.5 bg-border hover:bg-fg-muted"
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
