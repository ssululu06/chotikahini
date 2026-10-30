"use client";

import { Globe, ExternalLink } from "lucide-react";

// NOTE: Email is intentionally NOT rendered here for privacy — author
// emails must never be exposed publicly on the site.
export function AuthorSocialIcons({
  website,
  facebook,
}: {
  website?: string | null;
  facebook?: string | null;
}) {
  return (
    <div className="flex items-center gap-2 mt-1.5">
      {website && (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-hover transition-colors"
          aria-label="ওয়েবসাইট"
          onClick={(e) => e.stopPropagation()}
        >
          <Globe className="h-3.5 w-3.5" />
        </a>
      )}
      {facebook && (
        <a
          href={facebook}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-hover transition-colors"
          aria-label="ফেসবুক"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
