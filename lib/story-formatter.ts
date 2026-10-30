/**
 * Story Formatter Utility
 * Handles exact Dhaka timestamp generation, story stats, history timelines, and standard MDX content formatting.
 */

export function getDhakaTimeISO(dateInput?: Date | string): string {
  const date = dateInput ? new Date(dateInput) : new Date();
  
  if (isNaN(date.getTime())) {
    return getDhakaTimeISO(new Date());
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "00";

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  let hour = getPart("hour");
  if (hour === "24") hour = "00";
  const minute = getPart("minute");
  const second = getPart("second");

  return `${year}-${month}-${day}T${hour}:${minute}:${second}+06:00`;
}

/**
 * Calculates word count and estimated reading time for story content.
 */
export function calculateStoryStats(content: string) {
  if (!content || !content.trim()) {
    return { wordCount: 0, readingTimeMinutes: 1 };
  }

  const words = content.trim().split(/\s+/).length;
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 180));
  return { wordCount: words, readingTimeMinutes };
}

/**
 * Cleans and formats raw story body text into standard MDX paragraphs.
 */
export function formatStoryContent(rawContent: string): string {
  if (!rawContent) return "";

  let text = rawContent
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\\\s*$/gm, "");

  text = text.replace(/\r\n/g, "\n");
  const lines = text.split("\n").map((line) => line.trim());

  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];

  for (const line of lines) {
    if (line === "") {
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join(" "));
        currentParagraph = [];
      }
    } else {
      currentParagraph.push(line);
    }
  }

  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(" "));
  }

  return paragraphs.join("\n\n");
}

export interface HistoryItem {
  event: "created" | "submitted" | "revision_requested" | "resubmitted" | "approved" | "published" | "rejected" | "edited_and_published";
  at: string;
  feedback?: string;
  actor?: string;
}

export interface StoryMDXParams {
  uid?: string;
  title: string;
  description?: string;
  author: string;
  category: string;
  tags?: string | string[];
  cover?: string;
  previousPost?: string | null;
  featured?: boolean;
  publishedAt?: string;
  updatedAt?: string;
  status?: string; // draft, pending, revision_requested, published, rejected
  rejectionReason?: string | null;
  feedbackDate?: string | null;
  version?: number;
  history?: HistoryItem[];
  content: string;
}

/**
 * Generates a standard, valid MDX string with frontmatter and formatted body content.
 */
export function formatStoryMDX(params: StoryMDXParams): { mdx: string; uid: string } {
  const uid = params.uid || Math.floor(Math.random() * 90000000000000 + 10000000000000).toString();
  const nowIso = getDhakaTimeISO();
  const publishedAt = params.publishedAt ? getDhakaTimeISO(params.publishedAt) : nowIso;
  const updatedAt = nowIso;
  const version = params.version || 1;

  const safeTitle = (params.title || "").trim().replace(/'/g, "''");
  const safeDescription = (params.description || "").trim().replace(/\n/g, " ");

  const tagArray: string[] = Array.isArray(params.tags)
    ? params.tags.map((t) => t.trim()).filter(Boolean)
    : typeof params.tags === "string"
      ? params.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

  const tagsYaml = tagArray.length
    ? `\ntags:\n${tagArray.map((t) => `  - ${t}`).join("\n")}`
    : "\ntags: []";

  // Rejection / Revision feedback YAML
  const rejectionYaml = params.rejectionReason
    ? `\nrejectionReason: '${params.rejectionReason.replace(/'/g, "''")}'`
    : "";

  const feedbackDateYaml = params.feedbackDate
    ? `\nfeedbackDate: '${params.feedbackDate}'`
    : "";

  // History Timeline YAML
  const historyList = params.history || [
    { event: params.status === "draft" ? "created" : "submitted", at: nowIso, actor: params.author }
  ];
  
  const historyYaml = historyList.length
    ? `\nhistory:\n${historyList.map(h => `  - event: ${h.event}\n    at: '${h.at}'${h.feedback ? `\n    feedback: '${h.feedback.replace(/'/g, "''")}'` : ""}${h.actor ? `\n    actor: '${h.actor}'` : ""}`).join("\n")}`
    : "";

  const formattedContent = formatStoryContent(params.content);

  const mdx = `---
title: '${safeTitle}'
description: >-
  ${safeDescription}
author: ${params.author || "admin"}
category: ${params.category || "hot"}${tagsYaml}
cover: '${params.cover || ""}'
previousPost: ${params.previousPost ? `'${params.previousPost}'` : "null"}
featured: ${Boolean(params.featured)}
uid: '${uid}'
publishedAt: '${publishedAt}'
updatedAt: '${updatedAt}'
status: '${params.status || "published"}'
version: ${version}${rejectionYaml}${feedbackDateYaml}${historyYaml}
---

${formattedContent}
`;

  return { mdx, uid };
}
