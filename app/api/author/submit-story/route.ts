import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import readingTime from "reading-time";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getDhakaTimeISO } from "@/lib/story-formatter";
import { clearPostsCache } from "@/lib/posts";
import { getUnusedCover, normalizeCoverUrl } from "@/lib/cover";
import { getSiteConfig } from "@/lib/config";
import { checkStorySimilarity } from "@/lib/similarity";
import { notifyAdmins } from "@/lib/notify";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগিন করুন।" }, { status: 401 });
    }

    const { role } = session;
    if (role === "user") {
      return NextResponse.json({ error: "গল্প জমা দেওয়ার জন্য আপনাকে অনুমোদিত লেখক হতে হবে।" }, { status: 403 });
    }

    const { title, category, description, content, tags, cover, previousPost, slug, uid, history, version, author, scheduledAt, coAuthors, featured } = await req.json();

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "গল্পের শিরোনাম আবশ্যক।" }, { status: 400 });
    }
    if (!content || !content.trim()) {
      return NextResponse.json({ error: "গল্পের মূল লেখা আবশ্যক।" }, { status: 400 });
    }

    const safeTitle = title.trim();
    const safeDescription = (description || "").trim();
    const safeCategory = (category || "golpo").trim();
    const supabase = getSupabaseAdmin();

    let safeCover = (cover || "").trim();
    // Do not save raw image / base64 data on DB. Only image links allowed.
    if (safeCover.startsWith("data:image") || safeCover.length > 500) {
      safeCover = "";
    }
    if (safeCover) {
      safeCover = normalizeCoverUrl(safeCover);
    }
    if (!safeCover) {
      // Assign a picture from public Cover_pic that is NOT yet used by any other story
      safeCover = (await getUnusedCover(supabase)) || "";
    }
    const safePreviousPost = (previousPost || "").trim();
    const safeReadingTime = readingTime(content || "").text;

    // Parse tags
    const tagArray: string[] = Array.isArray(tags)
      ? tags
      : typeof tags === "string"
        ? tags.split(",").map((t: string) => t.trim()).filter(Boolean)
        : [];

    const isAdmin = ["admin", "superadmin"].includes(role || "");

    const timestamp = Date.now().toString(); // 13 digits
    const singleDigit = Math.floor(Math.random() * 10).toString();
    const generated14Uid = `${timestamp}${singleDigit}`;
    
    let cleanUid = uid ? uid.toString().replace(/\D/g, "") : "";

    // If author didn't pass an explicit UID, check if author already has a PENDING story with same title to update instead of duplicating
    if (!cleanUid && !isAdmin) {
      const { data: existingPending } = await supabase
        .from("stories")
        .select("uid")
        .eq("author_id", session.id)
        .eq("status", "pending")
        .eq("title", safeTitle)
        .limit(1)
        .maybeSingle();

      if (existingPending?.uid) {
        cleanUid = existingPending.uid;
      }
    }

    if (cleanUid.length !== 14) cleanUid = generated14Uid;

    const uniqueUid = cleanUid;
    const uniqueSlug = uniqueUid;

    // ── DUPLICATE CONTENT & TITLE SIMILARITY CHECK ──
    const duplicateRes = await checkStorySimilarity(content, safeTitle, uid, 0.70);

    const nowIso = getDhakaTimeISO();
    let updatedHistory = Array.isArray(history) ? [...history] : [];

    if (duplicateRes.isDuplicate && duplicateRes.matchedStory) {
      updatedHistory.push({
        event: "duplicate_flagged",
        at: nowIso,
        actor: session.username || session.id,
        duplicateMatch: {
          matchedUid: duplicateRes.matchedStory.uid,
          matchedSlug: duplicateRes.matchedStory.slug,
          matchedTitle: duplicateRes.matchedStory.title,
          similarityPercent: duplicateRes.matchedStory.similarityPercent,
        },
      });

      // Send immediate high-priority notice to Admins
      await notifyAdmins(
        {
          type: "duplicate_story_flag",
          actorId: session.id,
          actorName: session.name || session.username,
          postSlug: uniqueSlug,
          snippet: `ডুপ্লিকেট গল্প ফ্ল্যাগ! (@${session.username || session.id}) এর "${safeTitle}" গল্পের সাথে "${duplicateRes.matchedStory.title}" গল্পের ${duplicateRes.matchedStory.similarityPercent}% হুবহু মিল রয়েছে। আপনি কি গল্পটি রাখবেন নাকি রিমুভ করবেন?`,
        },
        supabase
      );
    }
    
    if (slug) {
      updatedHistory.push({
        event: "resubmitted",
        at: nowIso,
        actor: session.username || session.id
      });
    } else {
      updatedHistory.push({
        event: "created",
        at: nowIso,
        actor: session.username || session.id
      });
    }

    // Trusted authors get auto-approval: their submissions publish instantly.
    let authorIsTrusted = false;
    if (!isAdmin) {
      try {
        const { data: actorUser } = await supabase
          .from("users")
          .select("is_trusted")
          .eq("id", session.id)
          .maybeSingle();
        authorIsTrusted = actorUser?.is_trusted === true;
      } catch {}
    }
    const targetStatus = isAdmin || authorIsTrusted ? "published" : "pending";

    // ── SERVER-SIDE OWNERSHIP CHECK ──
    // If a non-admin author submits with an existing story id/slug, they must
    // own it (or be a co-author). Client-supplied ids are never trusted.
    if (!isAdmin) {
      const { data: existingStory } = await supabase
        .from("stories")
        .select("uid, author_id")
        .or(`slug.eq.${uniqueUid},uid.eq.${uniqueUid}`)
        .maybeSingle();

      if (existingStory) {
        const isOwner = existingStory.author_id === session.id;
        let isCoAuthor = false;
        if (!isOwner) {
          try {
            const { data: co } = await supabase
              .from("story_coauthors")
              .select("id")
              .eq("story_uid", existingStory.uid)
              .eq("user_id", session.id)
              .maybeSingle();
            isCoAuthor = !!co;
          } catch (e) {}
        }
        if (!isOwner && !isCoAuthor) {
          return NextResponse.json({ error: "এই গল্পটি সম্পাদনা করার অনুমতি আপনার নেই।" }, { status: 403 });
        }
      }
    }

    // Admins may assign a different author (e.g. imported from a previous post);
    // regular authors always submit as themselves for strict author isolation.
    // The admin editor dropdown may contain legacy/static author ids (e.g. "admin")
    // that don't exist in the users table, which would violate stories_author_id_fkey.
    // Resolve the selected author to a real users.id. The admin editor can
    // pass a user id, username, or display name — try all. If the value is
    // literally "admin" keep the admin's own id. Never silently publish
    // under the wrong author: if the target author isn't a real user, error.
    let effectiveAuthorId = session.id;
    if (isAdmin && author) {
      const candidate = String(author).trim();
      if (candidate && candidate.toLowerCase() !== "admin") {
        let found: any = await supabase
          .from("users")
          .select("id")
          .eq("id", candidate)
          .maybeSingle();
        if (found?.data) {
          effectiveAuthorId = found.data.id;
        } else {
          found = await supabase
            .from("users")
            .select("id")
            .ilike("username", candidate)
            .maybeSingle();
          if (found?.data) {
            effectiveAuthorId = found.data.id;
          } else {
            found = await supabase
              .from("users")
              .select("id")
              .ilike("name", candidate)
              .maybeSingle();
            if (found?.data) {
              effectiveAuthorId = found.data.id;
            } else {
              return NextResponse.json(
                { error: `লেখক "${candidate}" কোনো নিবন্ধিত ব্যবহারকারী নয়। সঠিক ইউজারনেম বা ID দিন (বড় হাতের-ছোট হাতের অক্ষরও মিলতে হবে)।` },
                { status: 400 }
              );
            }
          }
        }
      }
    }

    // Upsert story directly into Supabase stories table without creating any MDX file or GitHub commit
    const storyPayload: any = {
      uid: String(uniqueUid),
      slug: uniqueSlug,
      title: safeTitle,
      description: safeDescription,
      content,
      author_id: effectiveAuthorId,
      category: safeCategory,
      tags: tagArray,
      cover: safeCover,
      previous_post: safePreviousPost,
      status: targetStatus,
      featured: featured !== undefined ? Boolean(featured) : false,
      history: updatedHistory,
      reading_time: safeReadingTime,
      updated_at: new Date().toISOString()
    };

    if (isAdmin) {
      // Preserve the original publish date on edits; only stamp published_at
      // when this is a brand-new story so re-edits don't bump it to the top.
      const { data: existingStory } = await supabase
        .from("stories")
        .select("uid, published_at")
        .or(`slug.eq.${uniqueUid},uid.eq.${uniqueUid}`)
        .maybeSingle();
      if (!existingStory?.published_at) {
        storyPayload.published_at = nowIso;
      }

      // Scheduled Publishing — admin may set a future publish time.
      // The story is stored as published with a future published_at so it is
      // automatically hidden until that time (lib/posts.ts filters future posts),
      // then appears once the date passes (ISR revalidates every 60s).
      if (scheduledAt) {
        const sched = new Date(scheduledAt);
        if (!isNaN(sched.getTime())) {
          const iso = sched.toISOString();
          storyPayload.scheduled_at = iso;
          storyPayload.published_at = iso;
          storyPayload.status = "published";
          if (!updatedHistory.some((h: any) => h.event === "scheduled")) {
            updatedHistory.push({ event: "scheduled", at: nowIso, actor: session.username || session.id, scheduledFor: iso });
            storyPayload.history = updatedHistory;
          }
        }
      } else if (scheduledAt === null) {
        // Explicitly clearing the schedule — only when the client sends null.
        storyPayload.scheduled_at = null;
        // If the post was scheduled for the future, un-scheduling should
        // publish it immediately instead of leaving it hidden.
        if (existingStory?.published_at && new Date(existingStory.published_at).getTime() > Date.now()) {
          storyPayload.published_at = nowIso;
        }
      }
      // scheduledAt === undefined (field absent) → preserve the existing
      // schedule when editing, so a normal edit never wipes the publish time.
    }

    const { error: storyError } = await supabase.from("stories").upsert(storyPayload, { onConflict: "slug" });

    if (storyError) {
      console.error("Failed to save story in Supabase:", storyError);
      throw storyError;
    }

    // Also sync post_metadata so relational FK joins work seamlessly
    const { data: existingMeta } = await supabase
      .from("post_metadata")
      .select("slug, published_at")
      .eq("slug", uniqueSlug)
      .maybeSingle();
    await supabase.from("post_metadata").upsert({
      mdx_uid: String(uniqueUid),
      slug: uniqueSlug,
      author_id: effectiveAuthorId,
      status: targetStatus,
      category: safeCategory,
      published_at: existingMeta?.published_at || (isAdmin ? nowIso : null),
      updated_at: new Date().toISOString()
    }, { onConflict: "slug" });

    // Co-Author Support — store co-author links (usernames or user ids)
    if (Array.isArray(coAuthors) && coAuthors.length > 0) {
      try {
        await supabase.from("story_coauthors").delete().eq("story_uid", String(uniqueUid));

        for (const ca of coAuthors) {
          const raw = String(ca).trim();
          if (!raw || raw.toLowerCase() === (session.username || "").toLowerCase()) continue;
          const { data: byId } = await supabase
            .from("users")
            .select("id")
            .eq("id", raw)
            .maybeSingle();
          const coauthorId = byId?.id || (await supabase.from("users").select("id").eq("username", raw).maybeSingle())?.data?.id;
          if (!coauthorId) continue;
          await supabase.from("story_coauthors").upsert(
            { story_uid: String(uniqueUid), user_id: coauthorId },
            { onConflict: "story_uid,user_id" }
          );
        }
      } catch (e) {
        console.error("Failed to save co-authors:", e);
      }
    } else {
      try {
        await supabase.from("story_coauthors").delete().eq("story_uid", String(uniqueUid));
      } catch (e) {}
    }

    clearPostsCache();

    // Immediately refresh cached ISR pages so admin-published stories go live at once.
    // Revalidate by BOTH uid and slug (they can differ for imported/legacy posts),
    // plus the whole story-route pattern so a changed author name never stays
    // stale on the detail page while the homepage card already shows the new name.
    if (isAdmin) {
      try { revalidatePath("/"); } catch {}
      try { revalidatePath(`/${uniqueUid}`); } catch {}
      if (uniqueSlug !== uniqueUid) { try { revalidatePath(`/${uniqueSlug}`); } catch {} }
      try { revalidatePath("/[slug]", "page"); } catch {}
      try { revalidatePath("/(main)/[slug]/page", "page"); } catch {}
    }

    // Helper to post an automated announcement to Global Community Chat if published by admin
    if (isAdmin) {
      try {
        const siteUrl = getSiteConfig().url.replace(/\/$/, "");
        const fullUrl = `${siteUrl}/${uniqueUid}`;
        const messageText = `নতুন গল্প প্রকাশিত হয়েছে: "${safeTitle}"\nপড়তে ভিজিট করুন: ${fullUrl}`;

        await supabase.from("chat_messages").insert({
          user_id: session.id,
          username: session.username || "admin",
          name: session.name || "অ্যাডমিন",
          profile_pic: session.profilePic || null,
          message: messageText,
          role: role || "admin",
          created_at: new Date().toISOString()
        });
      } catch (e) {
        console.error("Failed to post global chat announcement:", e);
      }
    }

    return NextResponse.json({
      success: true,
      message: isAdmin
        ? "গল্পটি সফলভাবে প্রকাশিত হয়েছে এবং ওয়েবসাইটে লাইভ দেখা যাচ্ছে!"
        : "আপনার গল্পটি সফলভাবে জমা দেওয়া হয়েছে! এডমিন পর্যালোচনার পর এটি প্রকাশিত হবে।",
      slug: uniqueSlug,
      uid: uniqueUid
    });

  } catch (error: any) {
    console.error("Submit story error:", error);
    return NextResponse.json({ error: error.message || "গল্প জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।" }, { status: 500 });
  }
}
