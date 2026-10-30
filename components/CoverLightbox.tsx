"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { X, ZoomIn } from "lucide-react";

interface Props {
  src: string;
  alt: string;
}

export function CoverLightbox({ src, alt }: Props) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      {/* Visible hero image — click to open full-size */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full cursor-zoom-in focus:outline-none group"
        aria-label="বড় করে দেখুন"
      >
        <div className="relative overflow-hidden rounded-none sm:rounded-2xl shadow-lg shadow-black/10 dark:shadow-black/40 ring-1 ring-black/5 dark:ring-white/5 bg-surface-alt flex items-center justify-center">
          <Image
            src={src}
            alt={alt}
            width={1200}
            height={675}
            sizes="(min-width: 1024px) 768px, 100vw"
            className="w-full h-auto object-contain post-hero-cover"
            style={{ maxHeight: "520px" }}
            priority
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors duration-300">
            <span className="p-2 rounded-full bg-white/80 text-black opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="w-5 h-5" />
            </span>
          </div>
        </div>
      </button>

      {/* Full-screen lightbox overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={close}
          onKeyDown={(e) => e.key === "Escape" && close()}
          tabIndex={0}
          role="dialog"
          aria-modal="true"
          aria-label="পূর্ণ স্ক্রিন কভার ইমেজ"
        >
          <button
            onClick={close}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
            aria-label="বন্ধ করুন"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="relative max-w-[95vw] max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <Image
              src={src}
              alt={alt}
              width={1600}
              height={1200}
              className="w-auto h-auto max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              sizes="(min-width: 1200px) 80vw, 95vw"
              priority
            />
          </div>
        </div>
      )}
    </>
  );
}