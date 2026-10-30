import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/supabase";
import { clearPostsCache } from "@/lib/posts";
import { preprocessForSimilarity, scorePreprocessed } from "@/lib/similarity";

export const dynamic = "force-dynamic";

const CONFIG_KEY = "crawler_config";

// GET /api/admin/crawler/publish — list pending + scheduled crawled stories (review queue)
export async function GET() {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "content.create")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    // Crawler config (interval + last publish)
    const { data: cfgRows } = await supabase.from("site_settings").select("value").eq("key", CONFIG_KEY);
    let cfg: any = {};
    if (cfgRows && cfgRows[0]) {
      try { cfg = cfgRows[0].value; } catch {}
    }

    // ── INTERVAL AUTO-PROCESS: if interval is set & time elapsed → publish ONE ──
    let autoPublished: string | null = null;
    if (cfg.intervalMinutes) {
      const last = cfg.lastPublishAt ? new Date(cfg.lastPublishAt).getTime() : 0;
      const intervalMs = Number(cfg.intervalMinutes) * 60 * 1000;
      if (Date.now() - last >= intervalMs) {
        const { data: next } = await supabase
          .from("stories")
          .select("uid, slug, title")
          .eq("status", "pending")
          .contains("history", [{ event: "crawled" }])
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (next) {
          const { data: full } = await supabase.from("stories").select("uid, slug, title, history").eq("uid", next.uid).maybeSingle();
          const history = Array.isArray(full?.history) ? full.history : [];
          history.push({ event: "published", at: nowIso, actor: "auto-interval" });
          await supabase
            .from("stories")
            .update({ status: "published", published_at: nowIso, updated_at: nowIso, history })
            .eq("uid", next.uid);
          try {
            await supabase.from("post_metadata").upsert({ mdx_uid: next.uid, slug: next.slug, author_id: session.id, status: "published", published_at: nowIso, updated_at: nowIso }, { onConflict: "slug" });
          } catch {}
          cfg.lastPublishAt = nowIso;
          try { await supabase.from("site_settings").upsert({ key: CONFIG_KEY, value: cfg }, { onConflict: "key" }); } catch {}
          autoPublished = next.title;
        }
      }
    }

    // Pending (awaiting review) + scheduled (published but future) crawled stories
    const { data: pending } = await supabase
      .from("stories")
      .select("uid, slug, title, category, description, content, cover, tags, author_id, status, published_at, created_at, history")
      .or(`status.eq.pending,published_at.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(200);

    const crawled = (pending || []).filter((s: any) =>
      Array.isArray(s.history) && s.history.some((h: any) => h.event === "crawled" || h.event === "auto_posted")
    ).map((s: any) => ({
      uid: s.uid, slug: s.slug, title: s.title, category: s.category,
      description: s.description, content: s.content || "", cover: s.cover || "", tags: s.tags, authorId: s.author_id,
      status: s.status, scheduledAt: s.published_at && new Date(s.published_at) > new Date(nowIso) ? s.published_at : null,
      createdAt: s.created_at, source: (s.history || []).find((h: any) => h.event === "crawled")?.source || "",
      history: s.history || [],
      similarity: 0,
      similarStory: null as string | null,
    }));

    // ── Similarity %: how much each crawled story matches existing published stories ──
    let existingPool: { text: ReturnType<typeof preprocessForSimilarity>; title: string }[] = [];
    try {
      const { data: published } = await supabase
        .from("stories")
        .select("title, content")
        .eq("status", "published")
        .limit(2000);
      existingPool = (published || [])
        .filter((s: any) => s.content && s.content.length > 200)
        .map((s: any) => ({ text: preprocessForSimilarity(s.content.slice(0, 6000) || ""), title: s.title || "" }));
    } catch {}

    for (const story of crawled) {
      // Prefer the similarity computed at crawl time (stored in history)…
      const simEntry = (story.history || []).find((h: any) => h.event === "similarity");
      if (simEntry && typeof simEntry.similarityPercent === "number") {
        story.similarity = simEntry.similarityPercent;
        story.similarStory = simEntry.similarStory || null;
        continue;
      }

      // …otherwise compare the full body against the published pool.
      let best = 0;
      let bestTitle = "";
      const body = `${story.title || ""} ${story.description || ""} ${(story.content || "").slice(0, 5000)}`;
      const thisText = preprocessForSimilarity(body);
      for (const ex of existingPool) {
        const score = scorePreprocessed(thisText, ex.text);
        if (score > best) { best = score; bestTitle = ex.title; }
      }
      story.similarity = Math.round(best * 100);
      story.similarStory = bestTitle || null;
    }

    return NextResponse.json({ stories: crawled, config: cfg, autoPublished });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/admin/crawler/publish
// body: { mode: "all" | "selected" | "one" | "schedule", uids?: string[], intervalMinutes?: number }
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "content.create")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { mode, uids, intervalMinutes } = await req.json();
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();
    const results = { published: 0 };

    // ── Set interval schedule: publish one every X minutes (auto, on queue open) ──
    if (mode === "schedule" && intervalMinutes && intervalMinutes > 0) {
      const cfg = { intervalMinutes: Number(intervalMinutes), lastPublishAt: nowIso };
      await supabase.from("site_settings").upsert({ key: CONFIG_KEY, value: cfg }, { onConflict: "key" });
      return NextResponse.json({ success: true, message: `শিডিউল সেট: প্রতি ${intervalMinutes} মিনিটে ১টি গল্প প্রকাশ হবে।` });
    }

    // ── Publish "one" — publishes the OLDEST pending crawled story ──
    if (mode === "one") {
      const { data: next } = await supabase
        .from("stories")
        .select("uid, slug, title")
        .eq("status", "pending")
        .contains("history", [{ event: "crawled" }])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!next) return NextResponse.json({ success: true, published: 0, message: "কিউ খালি — পাবলিশ করার মতো কিছু নেই।" });

      const { data: full } = await supabase.from("stories").select("uid, slug, title, history").eq("uid", next.uid).maybeSingle();
      const history = Array.isArray(full?.history) ? full.history : [];
      history.push({ event: "published", at: nowIso, actor: session.username || session.id });
      const { error: updateError } = await supabase.from("stories").update({ status: "published", published_at: nowIso, updated_at: nowIso, history }).eq("uid", next.uid);
      if (updateError) throw updateError;
      await supabase.from("post_metadata").upsert({ mdx_uid: next.uid, slug: next.slug, author_id: session.id, status: "published", published_at: nowIso, updated_at: nowIso }, { onConflict: "slug" });
      clearPostsCache();
      results.published = 1;

      return NextResponse.json({ success: true, published: 1, message: `"${next.title}" প্রকাশিত হয়েছে।` });
    }

    // ── Publish all / selected ──
    let refs: string[];
    if (mode === "all") {
      const { data: allPending } = await supabase
        .from("stories")
        .select("uid")
        .eq("status", "pending")
        .contains("history", [{ event: "crawled" }]);
      refs = (allPending || []).map((s: any) => s.uid);
    } else if (mode === "selected" && Array.isArray(uids) && uids.length > 0) {
      refs = uids;
    } else {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    if (refs.length > 0) {
      const { data: toPublish } = await supabase.from("stories").select("uid, slug, title").in("uid", refs);
      const { error: updateError } = await supabase.from("stories").update({ status: "published", published_at: nowIso, updated_at: nowIso }).in("uid", refs);
      if (updateError) throw updateError;
      for (const s of toPublish || []) {
        await supabase.from("post_metadata").upsert({ mdx_uid: s.uid, slug: s.slug, author_id: session.id, status: "published", published_at: nowIso, updated_at: nowIso }, { onConflict: "slug" });
      }
      results.published = refs.length;
      clearPostsCache();
    }

    return NextResponse.json({ success: true, ...results, message: `${results.published}টি গল্প প্রকাশিত হয়েছে।` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH — full edit of a pending/scheduled crawled story (title, category, tags, author, content)
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "content.create")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { uid, title, category, tags, authorId, content, scheduledAt } = await req.json();
    if (!uid) return NextResponse.json({ error: "UID আবশ্যক।" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    // Load existing to merge (we never clear fields we didn't touch)
    const { data: existing } = await supabase.from("stories").select("*").eq("uid", uid).maybeSingle();
    if (!existing) return NextResponse.json({ error: "গল্পটি পাওয়া যায়নি।" }, { status: 404 });

    const updates: any = { updated_at: new Date().toISOString() };

    if (title !== undefined) updates.title = String(title).trim() || existing.title;
    if (category !== undefined) updates.category = String(category).trim() || existing.category;
    if (authorId !== undefined) {
      // Resolve to a real user id
      const resolved = await resolveAuthor(supabase, authorId);
      if (resolved) updates.author_id = resolved;
    }
    if (tags !== undefined) {
      updates.tags = typeof tags === "string" ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : (Array.isArray(tags) ? tags : existing.tags);
    }
    if (content !== undefined && String(content).trim()) {
      const c = String(content).trim();
      updates.content = c;
      if (!updates.description) updates.description = c.slice(0, 300).replace(/\n/g, " ");
    }

    // Schedule: set a future publish time — hidden until then, then auto-appears.
    if (scheduledAt) {
      const t = new Date(scheduledAt);
      if (!isNaN(t.getTime())) {
        const iso = t.toISOString();
        updates.published_at = iso;
        updates.scheduled_at = iso;
        updates.status = "published";
      }
    }

    const { error: updateError } = await supabase.from("stories").update(updates).eq("uid", uid);
    if (updateError) throw updateError;
    clearPostsCache();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** Resolve an author value (id / username / display name) to a real users.id. */
async function resolveAuthor(supabase: any, value: string): Promise<string | null> {
  const candidate = String(value).trim();
  if (!candidate || candidate.toLowerCase() === "admin") return null;
  try {
    const byId = await supabase.from("users").select("id").eq("id", candidate).maybeSingle();
    if (byId.data) return byId.data.id;
    const byUser = await supabase.from("users").select("id").ilike("username", candidate).maybeSingle();
    if (byUser.data) return byUser.data.id;
    const byName = await supabase.from("users").select("id").ilike("name", candidate).maybeSingle();
    if (byName.data) return byName.data.id;
  } catch {}
  return null;
}

// DELETE — delete a crawled story from the queue
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "content.create")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");
    if (!uid) return NextResponse.json({ error: "UID আবশ্যক।" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { error: deleteError } = await supabase.from("stories").delete().eq("uid", uid);
    if (deleteError) throw deleteError;
    clearPostsCache();
    try { await supabase.from("post_metadata").delete().eq("slug", uid); } catch {}
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
