"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Layers, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { formatDate, enToBnNumber } from "@/lib/utils";
import { AdSlot } from "@/components/AdSlot";

import { AD_300x250_HTML } from "@/lib/ad-config";

const SERIES_AD_HTML = AD_300x250_HTML;

interface SeriesEpisode {
  slug: string;
  uid: string;
  title: string;
  publishedAt: string;
  authorName: string;
}

interface SeriesItem {
  id: string;
  title: string;
  cover: string;
  episodes: SeriesEpisode[];
}

export default function SeriesPage() {
  const [seriesList, setSeriesList] = useState<SeriesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copiedSeriesId, setCopiedSeriesId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [siteOrigin, setSiteOrigin] = useState("");

  useEffect(() => {
    setSiteOrigin(window.location.origin);
    async function fetchSeries() {
      try {
        const res = await fetch("/api/series");
        if (res.ok) {
          const data = await res.json();
          setSeriesList(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchSeries();
  }, []);

  const toggleAccordion = (idx: number) => {
    if (expandedIndex === idx) setExpandedIndex(null);
    else setExpandedIndex(idx);
  };

  const copySeriesLink = async (seriesId: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/series/${seriesId}`);
      setCopiedSeriesId(seriesId);
      setCopyError(null);
    } catch (error) {
      console.error("Failed to copy series link", error);
      setCopyError("লিংক কপি করা যায়নি।");
    }
  };

  return (
    <div className="container-page py-10 sm:py-16 min-h-[60vh]">
      <header className="mb-12 max-w-2xl">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-fg mb-4 flex items-center gap-3">
          <Layers className="w-8 h-8 text-accent" />
          গল্পের সিরিজ
        </h1>
        <p className="text-fg-muted text-lg">
          আমাদের ওয়েবসাইটের সকল ধারাবাহিক গল্প এবং সিরিজগুলো এখানে একসাথে পাওয়া যাবে।
        </p>
      </header>

      <AdSlot id="series-page-ad" html={SERIES_AD_HTML} className="mb-8" />

      {loading ? (
        <div className="text-center py-20 text-fg-muted animate-pulse">লোড হচ্ছে...</div>
      ) : seriesList.length === 0 ? (
        <div className="text-center py-20 bg-surface-alt rounded-2xl border border-border">
          <Layers className="w-12 h-12 text-fg-subtle mx-auto mb-4" />
          <h2 className="text-xl font-medium text-fg">কোনো সিরিজ পাওয়া যায়নি</h2>
          <p className="text-fg-muted mt-2">বর্তমানে ওয়েবসাইটে কোনো ধারাবাহিক গল্প নেই।</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {seriesList.map((series, idx) => {
            const firstPost = series.episodes[0];
            const isExpanded = expandedIndex === idx;
            const shareUrl = `${siteOrigin}/series/${series.id}`;

            return (
              <div 
                key={series.id}
                className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm transition-all"
              >
                <div className="flex items-center gap-3 p-5">
                  {series.cover && (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-alt">
                      <Image src={series.cover} alt="" fill sizes="64px" className="object-cover" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleAccordion(idx)}
                      className="w-full text-left group"
                      aria-expanded={isExpanded}
                    >
                      <h2 className="text-lg font-bold text-fg group-hover:text-accent transition-colors line-clamp-1">
                        {series.title || firstPost.title}
                      </h2>
                      <p className="text-sm text-fg-muted mt-1.5 flex items-center gap-1.5">
                        <span className="font-semibold text-fg bg-surface-alt px-2 py-0.5 rounded">
                          {enToBnNumber(series.episodes.length)} পর্ব
                        </span>
                        <span>•</span>
                        <span className="truncate">লেখক: {firstPost.authorName}</span>
                      </p>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleAccordion(idx)}
                    className="shrink-0 rounded-lg border border-border bg-surface-alt p-2 text-fg transition-colors hover:bg-surface-hover"
                    aria-label={isExpanded ? "পর্বের তালিকা বন্ধ করুন" : "পর্বের তালিকা দেখুন"}
                  >
                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
                  <Link
                    href={`/series/${series.id}`}
                    className="rounded-lg bg-fg px-3.5 py-2 text-xs font-semibold text-surface shadow-sm transition hover:opacity-85"
                  >
                    পুরো সিরিজ
                  </Link>
                  <button
                    type="button"
                    onClick={() => copySeriesLink(series.id)}
                    className="rounded-lg border border-border bg-surface-alt px-3.5 py-2 text-xs font-semibold text-fg transition hover:bg-surface-hover"
                  >
                    {copiedSeriesId === series.id ? "কপি হয়েছে" : "লিংক কপি"}
                  </button>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-border bg-surface-alt px-3.5 py-2 text-xs font-semibold text-fg transition hover:bg-surface-hover"
                  >
                    Facebook
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${series.title} ${shareUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-border bg-surface-alt px-3.5 py-2 text-xs font-semibold text-fg transition hover:bg-surface-hover"
                  >
                    WhatsApp
                  </a>
                  {copyError && <span role="alert" className="text-xs text-red-600">{copyError}</span>}
                </div>

                {isExpanded && (
                  <div className="p-6 pt-0 border-t border-border mt-2 bg-surface-alt/30 animate-in fade-in slide-in-from-top-2">
                    <div className="relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-accent/50 before:via-border before:to-transparent mt-6">
                      <ul className="relative space-y-4">
                        {series.episodes.map((post) => (
                          <li key={post.slug} className="relative flex items-start gap-4">
                            <div className="absolute left-0 -ml-0.5 mt-1.5 h-3 w-3 rounded-full border-2 border-surface bg-accent shadow"></div>
                            <div className="pl-6 w-full">
                              <Link href={`/${post.uid || post.slug}`} className="block group/link bg-surface border border-border p-3 rounded-xl hover:border-accent/50 transition-all">
                                <h3 className="text-sm font-semibold text-fg group-hover/link:text-accent transition-colors line-clamp-1">
                                  {post.title}
                                </h3>
                                <p className="text-xs text-fg-muted mt-1 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(post.publishedAt)}
                                </p>
                              </Link>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
