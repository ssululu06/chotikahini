import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabase";
import { extractIframeMetadata, extractSourceUrl, normalizeVideoUrl } from "@/lib/video-embed";
import { resolveEmbed } from "@/lib/embed-resolver";
import { validateEmbedUrl } from "@/lib/embed-validator";
import { extractUploaderFromDescription } from "@/lib/uploader-from-description";
import { announceVideoPublished } from "@/lib/chat-system";

/**
 * Last line of defence before an `embed_url` is written to the database.
 *
 * The admin form auto-fills the embed URL from the metadata endpoint, but
 * that only happens on the client and only after a 600 ms debounce. If an
 * admin pastes a provider's *watch* page into the iframe field and saves
 * quickly (or the metadata call is skipped/fails), the watch URL gets stored
 * verbatim. Watch pages almost always send `X-Frame-Options: SAMEORIGIN`, so
 * the resulting iframe shows "refused to connect" / a blank player — the
 * video looks published but won't play.
 *
 * `resolveEmbed` is a pure URL→URL rewrite with no network access, so it's
 * safe to run on every save: a watch URL becomes the provider's official
 * embed, and anything already correct (or an unrecognised host) passes
 * through untouched.
 */
function toEmbeddableUrl(rawUrl: string | null | undefined): string | null {
  const normalized = normalizeVideoUrl(rawUrl);
  if (!normalized) return null;
  return resolveEmbed(normalized)?.embedUrl ?? normalized;
}

/**
 * Returns a Bangla warning when the embed URL is going to be blocked in the
 * iframe. Returns null on success / unknown host.
 */
async function buildEmbedWarning(embedUrl: string) {
  try {
    const verdict = await validateEmbedUrl(embedUrl);
    if (verdict.status === "ok") return null;
    return { status: verdict.status, message: verdict.message, suggestion: verdict.suggestion, host: verdict.host ?? null };
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

async function authorize(permission: "media.upload" | "media.delete") {
  const session = await getSession();
  return session && hasPermission(session.role, permission) ? session : null;
}

export async function GET(request: Request) {
  const session = await authorize("media.upload");
  if (!session) return NextResponse.json({ error: "অননুমোদিত অ্যাক্সেস।" }, { status: 403 });

  // Server-side pagination + status filter. The admin list can hold
  // hundreds of rows, so we page instead of shipping everything; `status`
  // filters at the query level (not in JS) so the counts stay truthful.
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1) || 1);
  const statusFilter = searchParams.get("status"); // "published" | "draft" | null(=all)
  const pageSize = 15;
  const offset = (page - 1) * pageSize;

  const supabase = getSupabaseAdmin();
  // `uploader_name` is technically nullable for legacy rows; selecting it
  // lets the admin card show the same "channel" identity that the public
  // page uses. Kept in the base set so the view-count fallback below
  // doesn't silently drop it.
  const baseColumns =
    "id, title, description, source_url, embed_url, thumbnail_url, uploader_name, status, created_at, published_at";

  // Base filter shared by the page query and the total count.
  const applyFilter = (q: any) => {
    let out = q.neq("status", "deleted").not("embed_url", "is", null);
    if (statusFilter === "published" || statusFilter === "draft") {
      out = out.eq("status", statusFilter);
    }
    return out;
  };

  // `view_count` is an optional column (scripts/video-views.sql). If the
  // migration hasn't been run, PostgREST rejects the whole select — so fall
  // back to the column set we know exists.
  let rows: any[] | null = null;
  let total = 0;
  let error: any = null;
  {
    const res = await applyFilter(
      supabase
        .from("video_posts")
        .select(`${baseColumns}, view_count`, { count: "exact" }),
    )
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    rows = res.data as any[] | null;
    total = res.count ?? 0;
    error = res.error;
  }

  if (error) {
    const fallback = await applyFilter(
      supabase.from("video_posts").select(baseColumns, { count: "exact" }),
    )
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    rows = fallback.data as any[] | null;
    total = fallback.count ?? 0;
    error = fallback.error;
  }

  if (error) {
    console.error("[admin/videos] list failed:", error);
    return NextResponse.json({ error: "ভিডিও তালিকা লোড করা যায়নি।" }, { status: 500 });
  }

  // Global counts for the stat strip (independent of the active filter and
  // page) — total videos, published count, and summed views. Run in
  // parallel; each is a cheap head-count.
  const [totalRes, publishedRes, viewsRes] = await Promise.all([
    supabase
      .from("video_posts")
      .select("id", { count: "exact", head: true })
      .neq("status", "deleted")
      .not("embed_url", "is", null),
    supabase
      .from("video_posts")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .neq("status", "deleted")
      .not("embed_url", "is", null),
    (async () => {
      const vr = await supabase
        .from("video_posts")
        .select("view_count")
        .neq("status", "deleted")
        .not("embed_url", "is", null);
      if (vr.error || !Array.isArray(vr.data)) return null;
      return (vr.data as any[]).reduce(
        (sum, r) => sum + (Number(r.view_count) || 0),
        0,
      );
    })(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    videos: rows || [],
    total,
    totalPages,
    page,
    stats: {
      totalVideos: totalRes.count ?? 0,
      publishedVideos: publishedRes.count ?? 0,
      totalViews: viewsRes ?? null,
    },
  });
}

export async function POST(request: Request) {
  const session = await authorize("media.upload");
  if (!session) return NextResponse.json({ error: "অননুমোদিত অ্যাক্সেস।" }, { status: 403 });

  try {
    const body = await request.json();
    const iframeMetadata = extractIframeMetadata(body.embedUrl);
    const title = (typeof body.title === "string" ? body.title.trim() : "") || iframeMetadata.title || "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const credit = typeof body.credit === "string" ? body.credit.trim() : "";
    // Uploader from the form, OR — when the admin left it blank — inferred
    // from the description's tail (e.g. "Title — NatashaRecords"). Keeps the
    // channel name visible on the public page even when the scrape step
    // didn't find a dedicated `author` meta tag.
    const uploaderName =
      (typeof body.uploaderName === "string" ? body.uploaderName.trim() : "") ||
      extractUploaderFromDescription(description) ||
      "";
    const sourceUrl = normalizeVideoUrl(body.sourceUrl);
    // See `toEmbeddableUrl` below — a watch-URL paste becomes the official
    // embed before it reaches the DB.
    const embedUrl = toEmbeddableUrl(body.embedUrl);
    const thumbnailUrl = normalizeVideoUrl(body.thumbnailUrl) || iframeMetadata.thumbnailUrl;

    if (title.length > 160 || description.length > 500 || credit.length > 160 || uploaderName.length > 120) {
      return NextResponse.json({ error: "শিরোনাম সর্বোচ্চ ১৬০, বিবরণ ৫০০, ক্রেডিট ১৬০ ও আপলোডার ১২০ অক্ষরের মধ্যে দিন।" }, { status: 400 });
    }
    if (!sourceUrl || !embedUrl || !title || !thumbnailUrl) {
      return NextResponse.json({ error: "শিরোনাম (বা iframe-এর title), মূল লিংক, official embed URL ও HTTPS thumbnail image দিন।" }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from("video_posts")
      .insert({
        title,
        description: description || null,
        source_url: sourceUrl,
        embed_url: embedUrl,
        thumbnail_url: thumbnailUrl,
        credit: credit || null,
        uploader_name: uploaderName || null,
        status: "published",
        created_by: session.id,
        published_at: new Date().toISOString(),
      })
      .select("id, title, description, source_url, embed_url, thumbnail_url, credit, uploader_name, status, created_at, published_at")
      .single();

    if (error) throw error;

    // Surface a non-fatal warning when the saved embed URL is going to be
    // blocked in the iframe. The save still succeeds — the admin gets the
    // verdict in the response and decides what to do.
    const warning = await buildEmbedWarning(embedUrl);

    // Announce the new video in the global chat. Never blocks the response:
    // `announceVideoPublished` swallows its own failures.
    await announceVideoPublished(data.id, title);

    return NextResponse.json({ video: data, warning });
  } catch (error) {
    console.error("[admin/videos] create failed:", error);
    return NextResponse.json({ error: "ভিডিও পোস্ট সংরক্ষণ করা যায়নি।" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await authorize("media.upload");
  if (!session) return NextResponse.json({ error: "অননুমোদিত অ্যাক্সেস।" }, { status: 403 });

  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "ভিডিও আইডি পাওয়া যায়নি।" }, { status: 400 });
    }

    // Two kinds of patch:
    //   1) Status-only toggle — { id, status }
    //   2) Full edit           — { id, title, description, sourceUrl, embedUrl, thumbnailUrl, uploaderName, status }
    // If anything beyond id+status is present, we run a metadata re-extract.
    const editFields = ["title", "description", "sourceUrl", "embedUrl", "thumbnailUrl", "uploaderName"];
    const isFullEdit = editFields.some((k) => typeof body[k] === "string");

    // Read the CURRENT status before mutating. The chat announcement must
    // fire only on a real draft→published transition: re-announcing every
    // time an admin fixes a typo in a live video's title would spam the
    // global room.
    const desiredStatusHint =
      body.status === "draft" || body.status === "published" ? body.status : null;
    let wasPublished = false;
    if (desiredStatusHint === "published") {
      const { data: current } = await getSupabaseAdmin()
        .from("video_posts")
        .select("status")
        .eq("id", id)
        .neq("status", "deleted")
        .maybeSingle();
      wasPublished = current?.status === "published";
    }

    if (isFullEdit) {
      const iframeMetadata = extractIframeMetadata(body.embedUrl);
      const title =
        (typeof body.title === "string" ? body.title.trim() : "") ||
        iframeMetadata.title ||
        "";
      const description =
        typeof body.description === "string" ? body.description.trim() : "";
      const sourceUrl = normalizeVideoUrl(body.sourceUrl);
      // Watch-URL pastes get rewritten to the provider's embed at save time
      // so we never store a frame-blocked watch page as `embed_url`.
      const embedUrl = toEmbeddableUrl(body.embedUrl);
      const thumbnailUrl =
        normalizeVideoUrl(body.thumbnailUrl) || iframeMetadata.thumbnailUrl;
      // Same fallback as POST: if the admin didn't fill `uploaderName`,
      // pull it from the trailing segment of the description.
      const uploaderName =
        (typeof body.uploaderName === "string" ? body.uploaderName.trim() : "") ||
        extractUploaderFromDescription(description) ||
        "";

      if (!title || !embedUrl) {
        return NextResponse.json(
          { error: "ভিডিওর শিরোনাম ও iframe কোড দুটোই প্রয়োজন।" },
          { status: 400 },
        );
      }

      // Allow the user to toggle status during an edit; otherwise keep the
      // existing row's status (don't clobber).
      const desiredStatus =
        body.status === "draft" || body.status === "published" ? body.status : undefined;

      const update: Record<string, any> = {
        title,
        description: description || null,
        source_url: sourceUrl || extractSourceUrl(body.embedUrl) || null,
        embed_url: embedUrl,
        thumbnail_url: thumbnailUrl || null,
        uploader_name: uploaderName || null,
        updated_at: new Date().toISOString(),
      };
      if (desiredStatus) {
        update.status = desiredStatus;
        update.published_at =
          desiredStatus === "published" ? new Date().toISOString() : null;
      }

      const { error } = await getSupabaseAdmin()
        .from("video_posts")
        .update(update)
        .eq("id", id)
        .neq("status", "deleted");
      if (error) throw error;

      const warning = update.embed_url
        ? await buildEmbedWarning(update.embed_url)
        : null;

      // Announce only when this PATCH was the thing that flipped the row
      // from draft → published; a metadata-only edit of an already-live
      // video is not news.
      if (
        desiredStatus === "published" &&
        !wasPublished &&
        update.title
      ) {
        await announceVideoPublished(id, String(update.title));
      }

      return NextResponse.json({ success: true, warning });
    }

    // Status-only toggle (legacy behaviour).
    const { status } = body;
    if (!["draft", "published"].includes(status)) {
      return NextResponse.json({ error: "ভিডিওর তথ্য সঠিক নয়।" }, { status: 400 });
    }

    // Capture the title before mutating so the chat announcement, if we
    // send one, can include the correct headline.
    let titleForAnnounce: string | null = null;
    if (status === "published") {
      const { data: existing } = await getSupabaseAdmin()
        .from("video_posts")
        .select("title, status")
        .eq("id", id)
        .neq("status", "deleted")
        .maybeSingle();
      // Only announce on draft → published. Re-publishing an already-live
      // row, or un-publishing to draft, is not a publish event.
      if (existing && existing.status !== "published") {
        titleForAnnounce = existing.title;
      }
    }

    const { error } = await getSupabaseAdmin()
      .from("video_posts")
      .update({
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .neq("status", "deleted");
    if (error) throw error;

    if (titleForAnnounce) {
      await announceVideoPublished(id, titleForAnnounce);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/videos] status update failed:", error);
    return NextResponse.json({ error: "ভিডিওর অবস্থা পরিবর্তন করা যায়নি।" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await authorize("media.delete");
  if (!session) return NextResponse.json({ error: "অননুমোদিত অ্যাক্সেস।" }, { status: 403 });

  try {
    const { id } = await request.json();
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "ভিডিও আইডি পাওয়া যায়নি।" }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin()
      .from("video_posts")
      .update({ status: "deleted", updated_at: new Date().toISOString() })
      .eq("id", id)
      .neq("status", "deleted");
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/videos] delete failed:", error);
    return NextResponse.json({ error: "ভিডিও পোস্ট ডিলিট করা যায়নি।" }, { status: 500 });
  }
}
