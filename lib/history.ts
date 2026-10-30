"use client";

const HISTORY_KEY = "cittakkho_read_history";
const MAX_HISTORY = 12;

export interface HistoryItem {
  slug: string;
  title: string;
  cover: string;
  readAt: string;
}

export function addToHistory(item: Omit<HistoryItem, "readAt">) {
  if (typeof window === "undefined") return;

  try {
    const current = getHistory();
    // Remove if already exists so we can bump it to the top
    const filtered = current.filter((i) => i.slug !== item.slug);
    
    filtered.unshift({
      ...item,
      readAt: new Date().toISOString()
    });

    // Keep only the latest MAX_HISTORY items
    const limited = filtered.slice(0, MAX_HISTORY);
    
    localStorage.setItem(HISTORY_KEY, JSON.stringify(limited));
  } catch (e) {
    console.error("Failed to save history", e);
  }
}

export function getHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to read history", e);
    return [];
  }
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_KEY);
}
