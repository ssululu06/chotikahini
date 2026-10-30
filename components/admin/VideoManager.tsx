"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
  User,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import { enToBnNumber, formatDateTime } from "@/lib/utils";
import { VideoFormFields, type VideoFormValues } from "./VideoFormFields";
import { AdminPagination } from "./AdminPagination";

interface VideoPost {
  id: string;
  title: string;
  description: string | null;
  source_url: string;
  embed_url: string;
  thumbnail_url: string | null;
  uploader_name: string | null;
  status: "draft" | "published";
  created_at: string;
  published_at: string | null;
  // Optional — only present once scripts/video-views.sql has been run.
  view_count?: number | null;
}

/** Server-paged list metadata returned alongside the rows. */
interface ListMeta {
  total: number;
  totalPages: number;
  page: number;
  stats: {
    totalVideos: number;
    publishedVideos: number;
    /** null when the view_count migration hasn't been run. */
    totalViews: number | null;
  };
}

const EMPTY_FORM: VideoFormValues = {
  title: "",
  description: "",
  sourceUrl: "",
  embedUrl: "",
  thumbnailUrl: "",
  uploaderName: "",
};

export type VideoManagerView = "publish" | "list";

export function VideoManager({ view = "publish" }: { view?: VideoManagerView }) {
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<VideoFormValues>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">(
    "all",
  );
  // When set, the create form becomes an edit form for this video id.
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadVideos = useCallback(
    async (opts?: { page?: number; status?: string }) => {
      const targetPage = opts?.page ?? page;
      const targetStatus = opts?.status ?? (statusFilter === "all" ? "" : statusFilter);
      setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams();
        qs.set("page", String(targetPage));
        if (targetStatus) qs.set("status", targetStatus);
        const response = await fetch(`/api/admin/videos?${qs.toString()}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "ভিডিও তালিকা লোড করা যায়নি।");
        }
        setVideos(data.videos || []);
        setMeta({
          total: data.total ?? (data.videos || []).length,
          totalPages: data.totalPages ?? 1,
          page: data.page ?? targetPage,
          stats: data.stats || {
            totalVideos: (data.videos || []).length,
            publishedVideos: (data.videos || []).filter(
              (v: VideoPost) => v.status === "published",
            ).length,
            totalViews: null,
          },
        });
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "ভিডিও তালিকা লোড করা যায়নি।",
        );
      } finally {
        setLoading(false);
      }
    },
    [page, statusFilter],
  );

  // Initial load + whenever page/status filter changes.
  useEffect(() => {
    void loadVideos({ page, status: statusFilter === "all" ? "" : statusFilter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  const visibleVideos = videos;

  const totalCount = meta?.stats.totalVideos ?? videos.length;
  const publishedCount = meta?.stats.publishedVideos ?? 0;
  // Draft count isn't in stats; derive it from the totals we have.
  const draftCount = Math.max(0, totalCount - publishedCount);
  const totalViews = meta?.stats.totalViews ?? null;
  const viewsAvailable = totalViews !== null;

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
    setNotice("");
  };

  const startEdit = (video: VideoPost) => {
    setEditingId(video.id);
    setForm({
      title: video.title,
      description: video.description || "",
      sourceUrl: video.source_url || "",
      embedUrl: video.embed_url || "",
      thumbnailUrl: video.thumbnail_url || "",
      uploaderName: video.uploader_name || "",
    });
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const isEdit = !!editingId;
    setBusy(isEdit ? `edit:${editingId}` : "create");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/videos", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
body: JSON.stringify(
          isEdit
            ? { id: editingId, ...form }
            : {
                title: form.title.trim(),
                description: form.description.trim(),
                sourceUrl: form.sourceUrl.trim(),
                embedUrl: form.embedUrl.trim(),
                thumbnailUrl: form.thumbnailUrl.trim(),
                uploaderName: form.uploaderName.trim(),
              },
        ),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "ভিডিও পোস্ট সংরক্ষণ করা যায়নি।");
      }

      // Surface server-side embed-block warning (X-Frame-Options / CSP).
      // Save still succeeded — admin decides whether to publish as-is.
      if (data.warning?.message) {
        setError(
          `⚠️ ${data.warning.message}${data.warning.suggestion ? ` — ${data.warning.suggestion}` : ""}`,
        );
      }

      setNotice(
        isEdit
          ? data.warning?.message
            ? "ভিডিওর তথ্য হালনাগাদ হয়েছে — তবে embed এ সমস্যা আছে।"
            : "ভিডিওর তথ্য হালনাগাদ হয়েছে।"
          : data.warning?.message
            ? "ভিডিও embed পোস্ট প্রকাশ হয়েছে — তবে embed এ সমস্যা আছে।"
            : "ভিডিও embed পোস্ট প্রকাশ হয়েছে।",
      );
      setForm(EMPTY_FORM);
      setEditingId(null);
      await loadVideos({ page, status: statusFilter === "all" ? "" : statusFilter });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "ভিডিও পোস্ট সংরক্ষণ করা যায়নি।",
      );
    } finally {
      setBusy("");
    }
  };

  const updateStatus = async (video: VideoPost) => {
    setBusy(video.id);
    setError("");
    try {
      const status = video.status === "published" ? "draft" : "published";
      const response = await fetch("/api/admin/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: video.id, status }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "ভিডিওর অবস্থা বদলানো যায়নি।");
      }
      await loadVideos({ page, status: statusFilter === "all" ? "" : statusFilter });
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "ভিডিওর অবস্থা বদলানো যায়নি।",
      );
    } finally {
      setBusy("");
    }
  };

  const deleteVideo = async (video: VideoPost) => {
    if (!window.confirm(`“${video.title}” ভিডিও পোস্টটি ডিলিট করবেন?`)) return;
    setBusy(video.id);
    setError("");
    try {
      const response = await fetch("/api/admin/videos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: video.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "ভিডিও পোস্ট ডিলিট করা যায়নি।");
      }
      // Deleting the only row on the last page would leave the admin staring
      // at an empty page — step back one page instead.
      const nextPage = videos.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage !== page) {
        setPage(nextPage);
      } else {
        await loadVideos({ page, status: statusFilter === "all" ? "" : statusFilter });
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "ভিডিও পোস্ট ডিলিট করা যায়নি।",
      );
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">
          {view === "publish" ? "ভিডিও পাবলিশ" : "ভিডিও লিস্ট"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">
          কোনো ভিডিও ফাইল upload হবে না। মূল ভিডিও পেজের লিংক ও provider-এর official embed URL দিলে
          ভিডিওটি provider-এর player-এ চলবে।
        </p>
      </header>

      {/* ---- Stat strip: global counts, independent of the active page/filter ---- */}
      <dl className="grid grid-cols-3 gap-3">
        <StatTile label="মোট ভিডিও" value={enToBnNumber(totalCount)} />
        <StatTile label="প্রকাশিত" value={enToBnNumber(publishedCount)} />
        <StatTile
          label="মোট ভিউ"
          value={totalViews === null ? "—" : enToBnNumber(totalViews)}
          hint={viewsAvailable ? undefined : "মাইগ্রেশন দরকার"}
        />
      </dl>

      {/* ---- Create / edit form ------------------------------------------ */}
      {/* Shown on the publish tab, and also on the list tab whenever an
          edit is in progress — clicking "edit" in the list must surface
          the form there, or the edit would have nowhere to render. */}
      {view === "publish" || editingId ? (
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold text-fg">
            {editingId ? (
              <>
                <Pencil className="h-4 w-4" />ভিডিও এডিট করুন
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />নতুন ভিডিও পোস্ট
              </>
            )}
          </h2>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-fg-muted transition hover:bg-surface-hover hover:text-fg"
            >
              <X className="h-3.5 w-3.5" />
              বাতিল
            </button>
          ) : null}
        </div>

        <VideoFormFields
          idPrefix={editingId ? "video-edit" : "video-new"}
          values={form}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        />

        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
          >
            {notice}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={!!busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />সংরক্ষণ হচ্ছে...
              </>
            ) : editingId ? (
              "পরিবর্তন সংরক্ষণ করুন"
            ) : (
              "ভিডিও প্রকাশ করুন"
            )}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-fg transition hover:bg-surface-hover"
            >
              বাতিল
            </button>
          ) : null}
        </div>
      </form>
      ) : null}

      {/* ---- Video list --------------------------------------------------- */}
      {view === "list" ? (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-fg">
            <Video className="h-5 w-5" />
            ভিডিও পোস্ট ({enToBnNumber(meta?.total ?? visibleVideos.length)})
          </h2>
          <div
            className="flex items-center gap-1.5"
            role="group"
            aria-label="অবস্থা অনুযায়ী ফিল্টার"
          >
            {(
              [
                { key: "all", label: "সব" },
                { key: "published", label: "প্রকাশিত" },
                { key: "draft", label: "ড্রাফট" },
              ] as const
            ).map((chip) => {
              // Counts come from the server's global stats (not the current
              // page), so the chips stay truthful no matter which page or
              // filter you're on.
              const count =
                chip.key === "all"
                  ? totalCount
                  : chip.key === "published"
                    ? publishedCount
                    : draftCount;
              const active = statusFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  // Reset to page 1 whenever the filter changes — staying on
                  // page 7 of a 2-page filtered result would show "empty".
                  onClick={() => {
                    setStatusFilter(chip.key);
                    setPage(1);
                  }}
                  aria-pressed={active}
                  className={
                    active
                      ? "inline-flex items-center gap-1.5 rounded-full bg-fg px-3 py-1.5 text-xs font-semibold text-bg"
                      : "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-surface-hover hover:text-fg"
                  }
                >
                  {chip.label}
                  <span className="tabular-nums opacity-70">{enToBnNumber(count)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-fg-muted">ভিডিও লোড হচ্ছে...</p>
        ) : visibleVideos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-fg-muted">
            {statusFilter === "all"
              ? "এখনো কোনো ভিডিও পোস্ট করা হয়নি।"
              : "এই ফিল্টারে কোনো ভিডিও নেই।"}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <ul role="list" className="divide-y divide-border">
              {visibleVideos.map((video) => (
                <AdminVideoRow
                  key={video.id}
                  video={video}
                  busy={busy === video.id}
                  isEditing={editingId === video.id}
                  onEdit={() => startEdit(video)}
                  onToggleStatus={() => void updateStatus(video)}
                  onDelete={() => void deleteVideo(video)}
                />
              ))}
            </ul>
          </div>
        )}

        {/* ---- Pager: only when there's more than one page ---- */}
        {!loading && meta && meta.totalPages > 1 ? (
          <>
            <AdminPagination
              page={meta.page}
              totalPages={meta.totalPages}
              onPageChange={setPage}
            />
            <p className="text-center text-xs text-fg-subtle">
              পৃষ্ঠা {enToBnNumber(meta.page)} / {enToBnNumber(meta.totalPages)}
            </p>
          </>
        ) : null}
      </section>
      ) : null}
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <dt className="text-xs font-medium text-fg-muted">{label}</dt>
      <dd className="mt-1 text-xl font-bold tabular-nums text-fg">{value}</dd>
      {hint ? <p className="mt-0.5 text-[10px] text-amber-600">{hint}</p> : null}
    </div>
  );
}

/**
 * Admin video row — YouTube/Studio-style compact list.
 *
 * Small thumb on the left, title + uploader + status + date in the middle,
 * action chips on the right. Designed to scan many rows fast: thumbnail
 * stays the same height as the metadata block, the entire row is clickable
 * inline-style to the public video page, while individual buttons (edit,
 * status, delete) remain reachable without page reloads.
 *
 * The earlier card grid buried the title under a full-width thumbnail and
 * used a 2-up on most screens — a format meant for browsing, not auditing.
 */
function AdminVideoRow({
  video,
  busy,
  isEditing,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  video: VideoPost;
  busy: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const isPublished = video.status === "published";
  const views = Number(video.view_count) || 0;
  const ago = video.published_at
    ? formatDateTime(video.published_at)
    : `তৈরি ${formatDateTime(video.created_at)}`;

  return (
    <li
      className={
        isEditing
          ? "flex gap-3 bg-blue-500/[0.04] px-3 py-3 sm:gap-4 sm:px-4"
          : "flex gap-3 px-3 py-3 transition-colors hover:bg-surface-alt sm:gap-4 sm:px-4"
      }
    >
      {/* ---- Thumbnail: 16:9, fixed width so rows stay aligned ---- */}
      <a
        href={`/videos/${video.id}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${video.title} পাবলিক পেজে খুলুন`}
        className="group relative block aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-surface-alt sm:w-44"
      >
        {video.thumbnail_url ? (
          <Image
            src={video.thumbnail_url}
            alt=""
            fill
            sizes="176px"
            unoptimized
            className="object-cover transition-opacity group-hover:opacity-80"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-fg-subtle">
            <Video className="h-6 w-6" />
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-blue-700 shadow">
            <Play className="h-3.5 w-3.5 translate-x-px fill-current" />
          </span>
        </span>
      </a>

      {/* ---- Middle: title + uploader + meta, fills available space ---- */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 className="line-clamp-2 font-latin text-[14px] font-semibold leading-snug text-fg sm:text-[15px]">
            {video.title}
          </h3>
          <span
            className={
              isPublished
                ? "inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
                : "inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300"
            }
          >
            {isPublished ? "প্রকাশিত" : "ড্রাফট"}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-fg-muted">
          <span className="inline-flex items-center gap-1 truncate font-latin font-semibold text-fg">
            <User className="h-3 w-3 shrink-0 text-fg-subtle" />
            <span className="truncate">{video.uploader_name || "আপলোডার অজানা"}</span>
          </span>
          {views > 0 ? (
            <>
              <span aria-hidden className="text-border/80">·</span>
              <span className="tabular-nums text-fg-subtle">
                {enToBnNumber(views)} ভিউ
              </span>
            </>
          ) : null}
          <span aria-hidden className="text-border/80">·</span>
          <span className="truncate">{ago}</span>
        </div>

        {video.description ? (
          <p className="mt-1 line-clamp-2 font-latin text-[12px] leading-snug text-fg-muted sm:text-[13px]">
            {video.description}
          </p>
        ) : null}

        {/* On mobile the action row drops below the description; on desktop
            it sits inline with the title block via the outer grid below. */}
        <div className="mt-2 flex flex-wrap gap-1.5 sm:hidden">
          <ActionButtons
            busy={busy}
            isPublished={isPublished}
            video={video}
            onEdit={onEdit}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
          />
        </div>
      </div>

      {/* ---- Right: actions, hidden on mobile (move below description) ---- */}
      <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
        <ActionButtons
          busy={busy}
          isPublished={isPublished}
          video={video}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
        />
      </div>
    </li>
  );
}

/** Shared action chips — extracted so mobile (below-description) and desktop
 *  (right-side) renders stay identical. */
function ActionButtons({
  busy,
  isPublished,
  video,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  busy: boolean;
  isPublished: boolean;
  video: VideoPost;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <a
        href={video.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 font-latin text-[11px] font-semibold text-fg transition hover:bg-surface-hover"
        title="প্রোভাইডারের মূল পেজ নতুন ট্যাবে খুলুন"
      >
        <ExternalLink className="h-3 w-3" />
        মূল লিংক
      </a>
      <CopySiteLink videoId={video.id} />
      <button
        type="button"
        disabled={busy}
        onClick={onEdit}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 font-latin text-[11px] font-semibold text-fg transition hover:bg-surface-hover disabled:opacity-50"
      >
        <Pencil className="h-3 w-3" />
        এডিট
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onToggleStatus}
        className="inline-flex h-7 items-center justify-center rounded-md border border-border px-2 font-latin text-[11px] font-semibold text-fg transition hover:bg-surface-hover disabled:opacity-50"
      >
        {busy ? "..." : isPublished ? "ড্রাফট করুন" : "প্রকাশ করুন"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onDelete}
        className="inline-flex h-7 items-center justify-center rounded-md border border-red-500/30 px-2 font-latin text-[11px] font-semibold text-red-600 transition hover:bg-red-500/10 disabled:opacity-50"
        aria-label={`${video.title} ডিলিট করুন`}
        title="ডিলিট"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </>
  );
}

/**
 * Copies this video's public page URL on our own site (not the provider's),
 * so an admin can drop it straight into a story — the story renderer turns
 * any `/videos/<id>` link into an inline player automatically.
 *
 * Uses `window.location.origin` so it stays correct on localhost, staging and
 * production without a hardcoded domain.
 */
function CopySiteLink({ videoId }: { videoId: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = `${window.location.origin}/videos/${videoId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API is unavailable on insecure origins — fall back to a
      // hidden textarea + execCommand so the button still works in dev.
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* nothing else to try — the label will revert */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 font-latin text-[11px] font-semibold text-fg transition hover:bg-surface-hover"
      title="সাইটের ভিডিও পেজের লিংক কপি করুন (গল্পে বসালে ভিডিও অটো এমবেড হবে)"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-600" />
          কপি হয়েছে
        </>
      ) : (
        <>
          <Link2 className="h-3 w-3" />
          লিংক কপি
        </>
      )}
    </button>
  );
}