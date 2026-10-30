"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

const FALLBACK = "/images/avatars/1.jpg";

interface Props {
  src?: string | null;
  name?: string | null;
  userId?: string | null;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  className?: string;
}

const dims: Record<string, string> = {
  sm: "w-6 h-6", md: "w-8 h-8", lg: "w-10 h-10", xl: "w-12 h-12",
  "2xl": "w-14 h-14", "3xl": "w-24 h-24",
};

/** Deterministic hash from a string → number 0…N-1. */
function stableIndex(input: string, poolSize: number): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h % poolSize;
}

/** Cached avatar pool (fetched once per page load). */
let cachedPool: string[] | null = null;
let poolLoading: boolean = false;
let poolPromise: Promise<string[]> = Promise.resolve([]);

function fetchAvatarPool(): Promise<string[]> {
  if (cachedPool) return Promise.resolve(cachedPool);
  if (poolLoading) return poolPromise;
  poolLoading = true;
  poolPromise = fetch("/api/avatars")
    .then((r) => (r.ok ? r.json() : { avatars: [] }))
    .then((d: any) => {
      const list: string[] = d.avatars || [];
      cachedPool = list;
      return list;
    })
    .catch((): string[] => {
      cachedPool = [];
      return [];
    });
  return poolPromise;
}

export function UserAvatar({ src, name, userId, size = "md", className = "" }: Props) {
  const [pool, setPool] = useState<string[]>([]);

  useEffect(() => {
    fetchAvatarPool().then(setPool);
  }, []);

  const dim = dims[size] || dims.md;

  // Resolve final image source:
  // 1. Explicit src (non-empty, non-fallback) → use it
  // 2. No src → deterministic pick from the avatar pool
  // 3. Pool not loaded yet → fallback to 1.jpg
  const key = (name || userId || "").trim();
  let finalSrc = (src && src !== FALLBACK) ? src : "";
  if (!finalSrc && pool.length > 0 && key) {
    finalSrc = `${pool[stableIndex(key, pool.length)]}`;
  }
  if (!finalSrc) finalSrc = FALLBACK;

  return (
    <Image
      src={finalSrc}
      alt={key || ""}
      width={48}
      height={48}
      className={`${dim} rounded-full object-cover aspect-square shrink-0 safe-blur-exempt ${className}`}
      onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK; }}
    />
  );
}