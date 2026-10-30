"use client";

import { useEffect } from "react";
import { addToHistory } from "@/lib/history";

interface RecordHistoryProps {
  slug: string;
  title: string;
  cover: string;
}

export function RecordHistory({ slug, title, cover }: RecordHistoryProps) {
  useEffect(() => {
    addToHistory({ slug, title, cover });
  }, [slug, title, cover]);

  return null;
}
