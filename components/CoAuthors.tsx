"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, BadgeCheck } from "lucide-react";
import { UserAvatar } from "./UserAvatar";

interface CoAuthor {
  userId: string;
  username: string;
  name: string;
  profilePic: string | null;
  isVerified: boolean;
}

export function CoAuthors({ storyUid }: { storyUid: string }) {
  const [coauthors, setCoauthors] = useState<CoAuthor[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!storyUid) {
      setLoaded(true);
      return;
    }
    fetch(`/api/story/coauthors?storyUid=${encodeURIComponent(storyUid)}`)
      .then((r) => (r.ok ? r.json() : { coauthors: [] }))
      .then((d) => setCoauthors(d.coauthors || []))
      .catch(() => setCoauthors([]))
      .finally(() => setLoaded(true));
  }, [storyUid]);

  if (!loaded) return null;
  if (coauthors.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface-alt/60 p-4">
      <div className="flex items-center gap-2 text-xs font-bold text-fg-muted uppercase tracking-wider mb-3">
        <Users className="w-4 h-4 text-accent" />
        সহ-লেখকগণ
      </div>
      <div className="flex flex-wrap gap-2.5">
        {coauthors.map((ca) => (
          <Link
            key={ca.userId}
            href={`/authors/${ca.username || ca.userId}`}
            className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-fg hover:border-accent/40 hover:bg-surface-hover transition-colors"
          >
            <UserAvatar src={ca.profilePic} name={ca.name || ca.username} userId={ca.userId} size="sm" />
            <span className="flex items-center gap-1">
              {ca.name || ca.username}
              {ca.isVerified && <BadgeCheck className="w-3 h-3 text-blue-500 fill-blue-500/20" />}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
