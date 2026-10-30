"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/lib/supabase";
import { safeFormatTime } from "@/lib/utils";
import { deriveEmbedFromUrl } from "@/lib/embed-meta";
import { Trash2, Send, ChevronLeft, Search, MessageCircle, Users, Play, Megaphone } from "lucide-react";

export interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  name: string;
  profile_pic: string | null;
  message: string;
  role?: string;
  is_system?: boolean;
  created_at: string;
}

/**
 * Matches the sender's own message on the RIGHT side of the bubble.
 *
 * AuthContext hydrates asynchronously, and the session id is sometimes the
 * username for legacy rows, so a strict `user.id === msg.user_id` compare
 * rendered the sender's own message on the LEFT (with avatar + name) while
 * `user` was still loading — which looked like a stray "left side" bubble.
 */
function isOwnMessage(msgUserId: string | null | undefined, uid: string | null | undefined, username: string | null | undefined) {
  if (!msgUserId) return false;
  if (uid && msgUserId === uid) return true;
  if (username && msgUserId === username) return true;
  return false;
}

interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

/**
 * Fetches OpenGraph metadata for a single link and renders a preview card,
 * the way WhatsApp / Facebook surface links in chat. Skips internal-looking
 * URLs and anything that fails to resolve metadata.
 */
function LinkPreviewCard({ url }: { url: string }) {
  const [data, setData] = useState<LinkPreviewData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        // A payload without a title AND without an image isn't worth a card.
        if (!d || (!d.title && !d.image)) setFailed(true);
        else setData(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url]);

  if (failed) return null;

  if (!data) {
    // Skeleton keeps the bubble from jumping when metadata lands.
    return (
      <div className="mt-2 w-full max-w-[280px] rounded-xl border border-black/10 dark:border-white/10 overflow-hidden bg-white/70 dark:bg-zinc-900/70">
        <div className="h-40 w-full bg-black/5 dark:bg-white/5 animate-pulse" />
      </div>
    );
  }

return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block w-full max-w-[280px] overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 hover:opacity-95 transition-opacity shadow-sm"
    >
      {data.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxyImageUrl(data.image)}
          alt={data.title || data.siteName || "link preview"}
          className="h-40 w-full object-cover bg-black/5 dark:bg-white/5"
          loading="eager"
        />
      ) : null}
      <div className="p-2.5 space-y-0.5">
        {data.siteName ? (
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 truncate">
            {data.siteName}
          </p>
        ) : null}
        {data.title ? (
          <p className="text-[13px] font-semibold leading-snug line-clamp-2 text-zinc-900 dark:text-zinc-100">
            {data.title}
          </p>
        ) : null}
        {data.description ? (
          <p className="text-[11px] leading-snug line-clamp-2 text-zinc-600 dark:text-zinc-300">
            {data.description}
          </p>
        ) : null}
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate pt-0.5">
          {data.url}
        </p>
      </div>
    </a>
  );
}

/**
 * Hot-link protected image URLs (e.g. GitHub's ctfassets CDN, Cloudflare
 * protected images) render blank in a browser <img>. Proxy them through our
 * own origin so cross-origin / referrer restrictions don't kill the card.
 */
function proxyImageUrl(raw: string): string {
  if (!raw) return raw;
  if (raw.startsWith("/")) return raw;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return raw;
  } catch {
    return raw;
  }
  return `/api/link-image?url=${encodeURIComponent(raw)}`;
}

interface VideoEmbedData {
  provider: string;
  url: string;
  embedUrl?: string;
  title?: string | null;
  description?: string | null;
  thumbnail?: string | null;
  siteName?: string | null;
  author?: string | null;
}

/**
 * Rich card for video links (YouTube / Facebook / Instagram / TikTok /
 * Vimeo / Dailymotion / Twitter). Shows the OG thumbnail immediately, then
 * swaps to a real inline iframe player when the user clicks, so we don't
 * autoplay anything unexpectedly.
 */
function VideoEmbedCard({ url }: { url: string }) {
  const [data, setData] = useState<VideoEmbedData | null>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch(`/api/video-info?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (!d || !d.title) setFailed(true);
        else setData(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url]);

  if (failed) return null;

  if (!data) {
    return (
      <div className="mt-2 w-full max-w-[320px] rounded-xl border border-black/10 dark:border-white/10 overflow-hidden bg-white/70 dark:bg-zinc-900/70">
        <div className="aspect-video w-full bg-black/5 dark:bg-white/5 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mt-2 w-full max-w-[320px] overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 shadow-sm">
      {playing && data.embedUrl ? (
        <div className="aspect-video w-full bg-black">
          <iframe
            src={data.embedUrl}
            title={data.title || "video player"}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block group"
        >
          {data.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proxyImageUrl(data.thumbnail)}
              alt={data.title || data.siteName || "video preview"}
              className="aspect-video w-full object-cover bg-black/5 dark:bg-white/5"
              loading="lazy"
            />
          ) : (
            <div className="aspect-video w-full flex items-center justify-center bg-black/90">
              <Play className="w-10 h-10 text-white/80" />
            </div>
          )}
        </a>
      )}
      <div className="p-2.5 space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 truncate">
          {data.siteName || data.provider}
          {data.author ? ` • ${data.author}` : ""}
        </p>
        <p className="text-[13px] font-semibold leading-snug line-clamp-2 text-zinc-900 dark:text-zinc-100">
          {data.title}
        </p>
        {data.embedUrl && (
          <button
            onClick={() => setPlaying(true)}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 transition-opacity"
          >
            <Play className="w-3 h-3" />
            ভিডিও দেখুন
          </button>
        )}
      </div>
    </div>
  );
}

interface Conversation {
  id: string;
  otherUser?: {
    id: string;
    name: string;
    username: string;
    profilePic: string | null;
  };
  lastMessage: string;
  lastMessageAt: string;
  isGroup?: boolean;
}

function FormattedChatMessage({
  text,
  isMe,
}: {
  text?: string | null;
  isMe: boolean;
}) {
  // Defensive: backend rows can land as `null` / `undefined` for the
  // text column (system messages, optimistic rows, schema drift).
  // Without this, a single bad message used to crash the whole chat
  // room with `Cannot read properties of undefined (reading 'split')`.
  const safeText = typeof text === "string" ? text : "";
  const urlRegex = /(https?:\/\/[^\s]+|\/[0-9]{8,16})/g;
  const parts = safeText.split(urlRegex);

  // Show a preview card for the FIRST external link in the message, the way
  // WhatsApp / Facebook do. Internal `/{uid}` links don't get a card.
  const firstExternalLink = (() => {
    const m = safeText.match(/https?:\/\/[^\s]+/);
    return m ? m[0] : null;
  })();

  // Video platforms get the rich player card instead of the plain OG card.
  const isVideoLink = (() => {
    if (!firstExternalLink) return false;
    return deriveEmbedFromUrl(firstExternalLink) !== null;
  })();

  return (
    <div className="space-y-0.5">
      <p className="whitespace-pre-wrap break-words">
        {parts.map((part, index) => {
          if (part.match(/^https?:\/\//i)) {
            return (
              <a
                key={index}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className={`underline font-bold transition-opacity hover:opacity-80 ${isMe ? "text-white" : "text-blue-600 dark:text-blue-400"}`}
              >
                {part}
              </a>
            );
          } else if (part.match(/^\/[0-9]{8,16}$/)) {
            return (
              <Link
                key={index}
                href={part}
                className={`underline font-bold transition-opacity hover:opacity-80 ${isMe ? "text-white" : "text-blue-600 dark:text-blue-400"}`}
              >
                {part}
              </Link>
            );
          }
          return part;
        })}
      </p>
      {firstExternalLink ? (
        isVideoLink ? (
          <VideoEmbedCard url={firstExternalLink} />
        ) : (
          <LinkPreviewCard url={firstExternalLink} />
        )
      ) : null}
    </div>
  );
}

export function ChatRoom() {
  const { user, openAuthModal } = useAuth();
  const searchParams = useSearchParams();
  const directUserId = searchParams.get("userId") || searchParams.get("user");

  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: "global",
      isGroup: true,
      lastMessage: "কমিউনিটি আড্ডা",
      lastMessageAt: new Date().toISOString()
    }
  ]);
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  
  // States
  const [loading, setLoading] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const loadingOlderRef = useRef(false);
  const pendingScrollHeightRef = useRef<number | null>(null);
  const pendingInitialScrollRef = useRef(false);
  const pendingBottomScrollRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const channelRef = useRef<any>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle direct message URL parameter e.g. /chat?userId=xyz
  useEffect(() => {
    if (directUserId) {
      const existing = conversations.find(c => !c.isGroup && (c.otherUser?.id === directUserId || c.otherUser?.username === directUserId));
      if (existing) {
        setActiveChat(existing);
      } else {
        const initialTemp: Conversation = {
          id: `temp_${directUserId}`,
          otherUser: {
            id: directUserId,
            name: directUserId,
            username: directUserId,
            profilePic: null
          },
          lastMessage: "",
          lastMessageAt: new Date().toISOString()
        };
        setActiveChat(initialTemp);
        setConversations(prev => [initialTemp, ...prev.filter(c => c.id !== initialTemp.id)]);

        fetch(`/api/users/search?q=${encodeURIComponent(directUserId)}`)
          .then(r => r.json())
          .then(data => {
            const found = (data.users || []).find((u: any) => u.id === directUserId || u.username === directUserId) || (data.users || [])[0];
            if (found) {
              const enriched: Conversation = {
                id: `temp_${found.id}`,
                otherUser: {
                  id: found.id,
                  name: found.name,
                  username: found.username,
                  profilePic: found.profile_pic
                },
                lastMessage: "",
                lastMessageAt: new Date().toISOString()
              };
              setActiveChat(enriched);
              setConversations(prev => [enriched, ...prev.filter(c => c.id !== enriched.id && c.id !== initialTemp.id)]);
            }
          })
          .catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directUserId, conversationsLoading]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      setIsSearching(true);
      searchTimeout.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data.users || []);
          }
        } catch (e) {
          console.error("Search error", e);
        } finally {
          setIsSearching(false);
        }
      }, 500);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (activeChat) {
      setHasOlderMessages(false);
      setLoadingOlderMessages(false);
      loadingOlderRef.current = false;
      pendingScrollHeightRef.current = null;
      pendingInitialScrollRef.current = true;
      isNearBottomRef.current = true;
      fetchMessages(activeChat);
      subscribeToMessages(activeChat);
    }
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat]);

  useLayoutEffect(() => {
    messagesRef.current = messages;
    const container = messagesContainerRef.current;
    if (!container) return;

    if (pendingScrollHeightRef.current !== null) {
      const previousHeight = pendingScrollHeightRef.current;
      pendingScrollHeightRef.current = null;
      container.scrollTop += container.scrollHeight - previousHeight;
      return;
    }

    if (pendingInitialScrollRef.current && !loading) {
      pendingInitialScrollRef.current = false;
      container.scrollTop = container.scrollHeight;
      isNearBottomRef.current = true;
      return;
    }

    if (pendingBottomScrollRef.current) {
      pendingBottomScrollRef.current = false;
      container.scrollTop = container.scrollHeight;
      isNearBottomRef.current = true;
    }
  }, [messages, loading]);

  const fetchConversations = async () => {
    try {
      setConversationsLoading(true);
      const res = await fetch("/api/chat/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations([
          {
            id: "global",
            isGroup: true,
            lastMessage: "কমিউনিটি আড্ডা",
            lastMessageAt: new Date().toISOString()
          },
          ...(data.conversations || [])
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConversationsLoading(false);
    }
  };

  const fetchMessages = async (chat: Conversation, silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setMessages([]);
      }

      if (chat.isGroup) {
        const res = await fetch("/api/chat/messages?limit=10", { cache: "no-store" });
        if (!res.ok) throw new Error("group_feed_failed");
        const payload = await res.json();
        const rows: ChatMessage[] = payload.messages || [];
        const ordered = [...rows].reverse();
        if (silent) {
          setMessages((prev) => {
            const byId = new Map(prev.map((message) => [message.id, message]));
            ordered.forEach((message) => {
              byId.set(message.id, { ...byId.get(message.id), ...message });
            });
            return [...byId.values()].sort(
              (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
            );
          });
        } else {
          setMessages(ordered);
          setHasOlderMessages(Boolean(payload.hasMore));
        }
      } else {
        const targetId = chat.otherUser?.id || chat.otherUser?.username;
        if (!targetId) return;

        const res = await fetch(`/api/chat/private?userId=${encodeURIComponent(targetId)}&limit=10`);
        if (!res.ok) throw new Error("private_messages_failed");
        const data = await res.json();
        if (silent) {
          setMessages((prev) => {
            const byId = new Map(prev.map((message) => [message.id, message]));
            (data.messages || []).forEach((message: ChatMessage) => {
              byId.set(message.id, { ...byId.get(message.id), ...message });
            });
            return [...byId.values()].sort(
              (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
            );
          });
        } else {
          setMessages(data.messages || []);
          setHasOlderMessages(Boolean(data.hasMore));
        }
        if (data.conversationId && chat.id !== data.conversationId) {
          setActiveChat((prev) => (prev ? { ...prev, id: data.conversationId } : prev));
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadOlderMessages = async () => {
    const chat = activeChat;
    const oldest = messages[0];
    if (!chat || !oldest || !hasOlderMessages || loadingOlderRef.current) return;

    loadingOlderRef.current = true;
    setLoadingOlderMessages(true);
    const container = messagesContainerRef.current;
    const previousHeight = container?.scrollHeight ?? 0;

    try {
      const query = new URLSearchParams({
        limit: "15",
        before: oldest.created_at,
        beforeId: oldest.id,
      });
      let endpoint: string;
      if (chat.isGroup) {
        endpoint = `/api/chat/messages?${query.toString()}`;
      } else {
        const targetId = chat.otherUser?.id || chat.otherUser?.username;
        if (!targetId) return;
        query.set("userId", targetId);
        endpoint = `/api/chat/private?${query.toString()}`;
      }

      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "পুরোনো মেসেজ লোড করা যায়নি।");
      }
      const olderMessages = chat.isGroup
        ? [...(data.messages || [])].reverse() as ChatMessage[]
        : data.messages as ChatMessage[];
      if (olderMessages.length > 0) {
        pendingScrollHeightRef.current = previousHeight;
        setMessages((current) => {
          const existingIds = new Set(current.map((message) => message.id));
          return [...olderMessages.filter((message) => !existingIds.has(message.id)), ...current]
            .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
        });
      }
      setHasOlderMessages(Boolean(data.hasMore));
    } catch (error) {
      console.error("[chat] older messages load error:", error);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlderMessages(false);
    }
  };

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 100;
  };

  const subscribeToMessages = (chat: Conversation) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    if (chat.isGroup) {
      channelRef.current = supabase
        .channel("public:chat_messages")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
          const raw = payload.new as any;
          // `chat_messages` only stores (user_id, message). Realtime echoes the
          // raw row, so profile fields are attached from the AuthContext user
          // when it matches, otherwise a refetch fills the rest in.
          const isOwn = raw.user_id === user?.id;
          const incoming = {
            ...raw,
            username: isOwn ? (user?.username ?? raw.user_id) : raw.user_id,
            name: isOwn ? (user?.name ?? user?.username ?? raw.user_id) : raw.user_id,
            profile_pic: isOwn ? (user?.profilePic ?? null) : null,
            role: isOwn ? (user?.role ?? "user") : "user",
          } as ChatMessage;
          if (messagesRef.current.some((message) => message.id === incoming.id)) return;
          const shouldStickToBottom = isNearBottomRef.current;
          if (shouldStickToBottom) pendingBottomScrollRef.current = true;
          setMessages((prev) =>
            prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming],
          );
          if (!isOwn) {
            // Hydrate the other user's profile + re-sort in one pass.
            fetchMessages(chat, true);
          }
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        })
        .subscribe();
    } else {
      channelRef.current = supabase
        .channel(`public:private_messages:conv_${chat.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "private_messages" }, (payload) => {
          if (payload.new.sender_id !== user?.id) {
            const shouldStickToBottom = isNearBottomRef.current;
            const incomingId = String(payload.new.id);
            if (shouldStickToBottom && !messagesRef.current.some((message) => message.id === incomingId)) {
              pendingBottomScrollRef.current = true;
            }
            fetchMessages(chat, true);
          }
        })
        .subscribe();
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || sending || !activeChat) return;

    if (!user) {
      openAuthModal();
      return;
    }

    const currentInput = inputValue;
    setSending(true);

    // Optimistic message: render instantly so the sender sees their own text
    // before the round-trip completes. Replaced with the server row on
    // success; removed on failure so a stale row never lingers on screen.
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      user_id: user.id,
      username: user.username || user.id,
      name: user.name || user.username || user.id,
      profile_pic: user.profilePic ?? null,
      message: currentInput,
      role: user.role || "user",
      created_at: new Date().toISOString(),
    } as ChatMessage;

    setMessages((prev) => [...prev, optimistic]);
    pendingBottomScrollRef.current = true;

    const removeOptimistic = () =>
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));

    try {
      if (activeChat.isGroup) {
        const res = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: currentInput }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          removeOptimistic();
          if (res.status === 401) openAuthModal();
          else throw new Error(data?.error || "send_failed");
        }
        // Clear the input only after the server accepted the message, so a
        // fast double-enter cannot drop the second one.
        setInputValue("");
        if (data?.message) {
          const inserted = data.message as ChatMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === inserted.id)
              ? prev
              : [...prev.filter((m) => m.id !== optimisticId), inserted],
          );
        } else {
          removeOptimistic();
        }
      } else {
        const targetId = activeChat.otherUser?.id || activeChat.otherUser?.username;
        if (!targetId) {
          removeOptimistic();
          return;
        }

        const res = await fetch("/api/chat/private", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiverId: targetId, message: currentInput }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data.message) {
          setInputValue("");
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== optimisticId),
            data.message,
          ]);
          if (data.conversationId && activeChat.id !== data.conversationId) {
            setActiveChat((prev) => (prev ? { ...prev, id: data.conversationId } : prev));
          }
          fetchConversations();
        } else {
          removeOptimistic();
          if (res.status === 401) {
            openAuthModal();
          } else {
            const why = data?.reason ? ` (${data.reason})` : "";
            alert(`${data?.error || "মেসেজ পাঠানো যায়নি। আবার চেষ্টা করুন।"}${why}`);
          }
        }
      }
    } catch (e) {
      removeOptimistic();
      console.error("[chat] send error:", e);
      alert("মেসেজ পাঠানো যায়নি। আবার চেষ্টা করুন।");
      setInputValue(currentInput);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("আপনি কি এই মেসেজটি ডিলিট করতে চান?")) return;
    try {
      const res = await fetch(`/api/chat/messages?id=${id}`, { method: "DELETE" });
      if (!res.ok) alert("মেসেজ ডিলিট করা যায়নি।");
    } catch (e) {
      alert("মেসেজ ডিলিট করা যায়নি।");
    }
  };

  // UI helpers
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return true;
    if (c.isGroup) return "গ্লোবাল চ্যাট".includes(searchQuery);
    return (c.otherUser?.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || 
           (c.otherUser?.username?.toLowerCase() || "").includes(searchQuery.toLowerCase());
  });

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      
      {/* Sidebar (Conversations) */}
      <div className={`w-full md:w-80 flex-shrink-0 flex flex-col border-r border-border bg-zinc-50 dark:bg-zinc-950/20 absolute inset-y-0 left-0 transform transition-transform duration-300 md:relative md:translate-x-0 z-10 ${activeChat ? "-translate-x-full" : "translate-x-0"}`}>
        <div className="p-4 border-b border-border bg-surface">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
            <input 
              type="text" 
              placeholder="ইউজার খুঁজুন..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-200/80 dark:bg-zinc-800/90 border border-zinc-300 dark:border-zinc-700 focus:border-blue-500 rounded-lg py-2 pl-9 pr-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {searchQuery.trim().length >= 2 ? (
            <div className="p-2">
              <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 px-2 uppercase tracking-wider">সার্চ রেজাল্ট</h4>
              {isSearching ? (
                <div className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-400 animate-pulse">খুঁজছে...</div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-400 italic">কাউকে পাওয়া যায়নি।</div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {searchResults.map(userResult => (
                    <li key={userResult.id}>
                      <button 
                        onClick={() => {
                          const existingConv = conversations.find(c => !c.isGroup && c.otherUser?.id === userResult.id);
                          if (existingConv) {
                            setActiveChat(existingConv);
                          } else {
                            // Create a temporary conversation object
                            const newConv: Conversation = {
                              id: `temp_${userResult.id}`,
                              otherUser: {
                                id: userResult.id,
                                name: userResult.name,
                                username: userResult.username,
                                profilePic: userResult.profile_pic
                              },
                              lastMessage: "",
                              lastMessageAt: new Date().toISOString()
                            };
                            setConversations(prev => [newConv, ...prev]);
                            setActiveChat(newConv);
                          }
                          setSearchQuery("");
                        }}
                        className={`w-full text-left p-3 flex items-center gap-3 transition-colors hover:bg-surface-hover`}
                      >
                        <UserAvatar src={userResult.profile_pic} name={userResult.name} userId={userResult.id} size="lg" className="w-full h-full rounded-full" />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm truncate">{userResult.name}</div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">@{userResult.username}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : conversationsLoading ? (
            <div className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-400 animate-pulse">লোড হচ্ছে...</div>
          ) : (
            <ul className="divide-y divide-border/50">
              {filteredConversations.map(conv => (
                <li key={conv.id}>
                  <button 
                    onClick={() => setActiveChat(conv)}
                    className={`w-full text-left p-3 flex items-center gap-3 transition-colors ${activeChat?.id === conv.id ? 'bg-blue-500/10 dark:bg-blue-500/20 border-l-4 border-blue-600' : 'hover:bg-surface-hover'}`}
                  >
                    <div className="w-12 h-12 rounded-full aspect-square overflow-hidden flex-shrink-0 bg-zinc-800 dark:bg-zinc-700 text-white flex items-center justify-center font-bold text-lg relative">
                      {conv.isGroup ? (
                        <Users className="w-6 h-6" />
                      ) : (
                        <UserAvatar
                          src={conv.otherUser?.profilePic}
                          name={conv.otherUser?.name || conv.otherUser?.username}
                          userId={conv.otherUser?.id}
                          size="lg"
                          className="w-full h-full rounded-full"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm truncate">
                          {conv.isGroup ? "গ্লোবাল চ্যাট" : conv.otherUser?.name}
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium truncate">
                        {conv.lastMessage || (conv.isGroup ? "কমিউনিটির সাথে যুক্ত হোন!" : "নতুন মেসেজ")}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col bg-surface transition-transform duration-300 md:relative md:inset-auto md:flex-1 md:translate-x-0 ${!activeChat ? "translate-x-full" : "translate-x-0"}`}>
        
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="h-14 flex items-center px-4 border-b border-border bg-surface flex-shrink-0">
              <button 
                onClick={() => setActiveChat(null)}
                className="md:hidden mr-2 p-1.5 -ml-1.5 rounded-lg text-fg hover:bg-surface-hover"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3">
                {activeChat.isGroup ? (
                  <div className="w-8 h-8 rounded-full aspect-square overflow-hidden flex-shrink-0 bg-zinc-800 dark:bg-zinc-700 text-white flex items-center justify-center font-bold text-xs">
                    <Users className="w-4 h-4" />
                  </div>
                ) : (
                  <Link 
                    href={`/authors/${activeChat.otherUser?.username || activeChat.otherUser?.id}`}
                    title={`${activeChat.otherUser?.name}-এর প্রোফাইল দেখুন`}
                    className="w-8 h-8 rounded-full aspect-square overflow-hidden flex-shrink-0 bg-zinc-800 dark:bg-zinc-700 text-white flex items-center justify-center font-bold text-xs hover:opacity-80 transition-opacity"
                  >
                    <UserAvatar
                      src={activeChat.otherUser?.profilePic}
                      name={activeChat.otherUser?.name || activeChat.otherUser?.username}
                      userId={activeChat.otherUser?.id}
                      size="md"
                      className="w-full h-full rounded-full"
                    />
                  </Link>
                )}
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm leading-tight">
                    {activeChat.isGroup ? (
                      "গ্লোবাল চ্যাট"
                    ) : (
                      <Link 
                        href={`/authors/${activeChat.otherUser?.username || activeChat.otherUser?.id}`} 
                        className="hover:text-blue-500 transition-colors"
                      >
                        {activeChat.otherUser?.name}
                      </Link>
                    )}
                  </h3>
                  {!activeChat.isGroup && (
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">@{activeChat.otherUser?.username}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
              className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-zinc-100/70 p-4 dark:bg-zinc-950"
            >
              {hasOlderMessages && (
                <div className="mb-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void loadOlderMessages()}
                    disabled={loadingOlderMessages}
                    className="min-h-9 rounded-full border border-border bg-surface px-4 py-2 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg disabled:cursor-wait disabled:opacity-60"
                  >
                    {loadingOlderMessages ? "লোড হচ্ছে..." : "আরও মেসেজ দেখুন"}
                  </button>
                </div>
              )}
              {loadingOlderMessages && (
                <div className="pointer-events-none absolute inset-x-0 top-2 z-10 text-center text-xs text-fg-muted" role="status">
                  আগের মেসেজ লোড হচ্ছে...
                </div>
              )}
              {loading ? (
                <div className="flex min-h-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-400 animate-pulse">
                  লোড হচ্ছে...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex min-h-full items-center justify-center text-sm italic text-zinc-500 dark:text-zinc-400">
                  এখনো কোনো মেসেজ নেই।
                </div>
              ) : (
                <div className="space-y-4">
                {messages.map((msg) => {
                  const isMe = isOwnMessage(msg.user_id, user?.id, user?.username);
                  const canDelete = isMe || (isAdmin && activeChat.isGroup);

                  // System announcements (new-video posts, etc.) have no
                  // author — `user_id` is null, so they'd otherwise render as
                  // a normal left bubble with a dangling /authors/undefined
                  // profile link. They get a centered, avatar-less pill that
                  // is never deletable and never aligns to a side.
                  if (msg.is_system) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <div className="flex max-w-[92%] flex-col items-center gap-1">
                          <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 px-4 py-2.5 text-center">
                            <span className="mb-1 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                              <Megaphone className="h-3 w-3" />
                              সিস্টেম
                            </span>
                            <FormattedChatMessage text={msg.message} isMe={false} />
                          </div>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                            {safeFormatTime(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} group`}>
                      <div className={`flex items-end gap-2 max-w-[85%] md:max-w-[70%] ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                        
                        {/* Avatar with Link to profile */}
                        {!isMe && (
                          <Link 
                            href={`/authors/${msg.username || msg.user_id}`}
                            className="w-7 h-7 rounded-full aspect-square overflow-hidden bg-zinc-800 text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0 hidden sm:flex hover:opacity-80 transition-opacity"
                            title={`${msg.name || msg.username}-এর প্রোফাইল দেখুন`}
                          >
                            <UserAvatar
                              src={msg.profile_pic}
                              name={msg.name || msg.username}
                              userId={msg.user_id}
                              size="sm"
                              className="w-full h-full rounded-full"
                            />
                          </Link>
                        )}

                        {/* Message Bubble */}
                        <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                          {!isMe && activeChat.isGroup && (
                            <Link 
                              href={`/authors/${msg.username || msg.user_id}`} 
                              className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-0.5 ml-1 hover:text-blue-500 hover:underline transition-colors"
                            >
                              {msg.name || msg.username}
                            </Link>
                          )}
                          
                          <div className={`relative px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-sm ${
                            isMe 
                              ? "bg-blue-600 text-white font-medium rounded-br-sm border border-blue-500" 
                              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium rounded-bl-sm border border-zinc-300 dark:border-zinc-700"
                          }`}>
                            <FormattedChatMessage text={msg.message} isMe={isMe} />
                          </div>
                          
                          <div className={`flex items-center gap-1.5 mt-1 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              {safeFormatTime(msg.created_at)}
                            </span>
                            {canDelete && activeChat.isGroup && (
                              <button 
                                onClick={() => handleDelete(msg.id)}
                                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 transition-opacity p-1"
                                title="মেসেজ ডিলিট করুন"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="z-30 shrink-0 border-t border-border bg-surface p-3">
              <form onSubmit={handleSend} className="flex items-end gap-2">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="মেসেজ লিখুন..."
                  className="flex-1 input-field py-2.5 px-4 resize-none min-h-[44px] max-h-[120px] rounded-3xl bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-sm shadow-inner"
                  rows={1}
                  maxLength={1000}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                />
                <button 
                  type="submit" 
                  disabled={!inputValue.trim() || sending}
                  onPointerDown={(e) => {
                    if (inputValue.trim() && !sending) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                  className="flex items-center justify-center w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-md touch-manipulation"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 bg-zinc-100/50 dark:bg-zinc-950">
            <div className="w-16 h-16 rounded-full bg-surface-alt flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-zinc-500 dark:text-zinc-400" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">কমিউনিটি বার্তা</h3>
            <p className="text-sm">বাঁ দিকের তালিকা থেকে কোনো চ্যাট নির্বাচন করুন।</p>
          </div>
        )}
      </div>
    </div>
  );
}
