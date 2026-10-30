import type { CSSProperties } from "react";

interface PlaceholderCoverProps {
  title: string;
  categoryId?: string;
  categoryName?: string;
  className?: string;
  style?: CSSProperties;
}

// ─── Category-specific visual identity ──────────────────────────

interface CategoryStyle {
  /** Tailwind gradient from → via → to (applied as bg-gradient-to-br) */
  gradient: string;
  /** Accent hex for the top badge and accent bar */
  accent: string;
  /** Abstract SVG illustration element */
  Illustration: React.FC<React.SVGProps<SVGSVGElement>>;
  /** Which corner the illustration sits in */
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
}

/* ── Tiny abstract SVGs — each ≤ 6 paths, geometric, elegant ── */

const FlameSVG: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 120 140" fill="currentColor" {...props}>
    <path d="M60 10 C70 45 95 55 95 85 C95 110 75 130 60 130 C45 130 25 110 25 85 C25 55 50 45 60 10Z" opacity="0.5" />
    <path d="M60 30 C65 55 80 65 80 85 C80 102 70 115 60 115 C50 115 40 102 40 85 C40 65 55 55 60 30Z" opacity="0.3" />
  </svg>
);

const HouseSVG: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 120 120" fill="currentColor" {...props}>
    <path d="M60 12 L15 48 L15 105 L105 105 L105 48 Z" opacity="0.45" />
    <rect x="45" y="70" width="30" height="35" opacity="0.25" />
    <rect x="20" y="50" width="80" height="8" opacity="0.15" />
  </svg>
);

const HeartSVG: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 120 110" fill="currentColor" {...props}>
    <path d="M60 20 C60 20 40 -5 15 15 C-10 35 0 70 60 105 C120 70 130 35 105 15 C80 -5 60 20 60 20Z" opacity="0.4" />
    <path d="M60 35 C60 35 48 18 32 30 C16 42 22 65 60 88 C98 65 104 42 88 30 C72 18 60 35 60 35Z" opacity="0.2" />
  </svg>
);

const FlowerSVG: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 120 120" fill="currentColor" {...props}>
    <circle cx="60" cy="50" r="8" opacity="0.5" />
    <ellipse cx="60" cy="30" rx="8" ry="16" opacity="0.3" transform="rotate(0 60 50)" />
    <ellipse cx="60" cy="30" rx="8" ry="16" opacity="0.3" transform="rotate(60 60 50)" />
    <ellipse cx="60" cy="30" rx="8" ry="16" opacity="0.3" transform="rotate(120 60 50)" />
    <path d="M58 58 Q52 80 48 105 Q60 110 72 105 Q68 80 62 58" opacity="0.25" />
  </svg>
);

const MoonSVG: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 120 120" fill="currentColor" {...props}>
    <path d="M70 15 C95 25 105 55 95 80 C85 105 55 115 30 105 C50 112 75 102 85 82 C95 62 90 35 70 15Z" opacity="0.4" />
    <circle cx="20" cy="25" r="3" opacity="0.25" />
    <circle cx="35" cy="15" r="2" opacity="0.2" />
    <circle cx="15" cy="45" r="2" opacity="0.15" />
    <path d="M15 80 Q30 85 35 75" opacity="0.2" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

const BriefcaseSVG: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 120 100" fill="currentColor" {...props}>
    <rect x="25" y="30" width="70" height="55" rx="6" opacity="0.4" />
    <rect x="45" y="15" width="30" height="18" rx="4" opacity="0.25" />
    <rect x="50" y="48" width="20" height="20" rx="3" opacity="0.2" />
  </svg>
);

const FacesSVG: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 120 100" fill="currentColor" {...props}>
    <circle cx="35" cy="40" r="22" opacity="0.35" />
    <circle cx="85" cy="40" r="22" opacity="0.35" />
    <circle cx="35" cy="40" r="12" opacity="0.15" />
    <circle cx="85" cy="40" r="12" opacity="0.15" />
    <path d="M15 65 Q35 80 55 65" opacity="0.2" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M65 65 Q85 80 105 65" opacity="0.2" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const RainbowSVG: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 120 100" fill="none" stroke="currentColor" {...props}>
    <path d="M20 70 Q60 -10 100 70" strokeWidth="3" opacity="0.35" />
    <path d="M28 72 Q60 0 92 72" strokeWidth="3" opacity="0.25" />
    <path d="M36 74 Q60 10 84 74" strokeWidth="3" opacity="0.15" />
  </svg>
);

const PulseSVG: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 120 80" fill="none" stroke="currentColor" {...props}>
    <path d="M5 40 L30 40 L40 10 L50 70 L60 30 L70 50 L80 20 L95 40 L115 40"
      strokeWidth="2.5" opacity="0.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 40 L30 40 L40 10 L50 70 L60 30 L70 50 L80 20 L95 40 L115 40"
      strokeWidth="6" opacity="0.1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ── Category config registry ── */

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  hot: {
    gradient: "from-red-950 via-rose-900 to-amber-950",
    accent: "#f43f5e",
    Illustration: FlameSVG,
    corner: "bottom-right",
  },
  bodhu: {
    gradient: "from-pink-950 via-rose-900 to-fuchsia-950",
    accent: "#ec4899",
    Illustration: HouseSVG,
    corner: "top-left",
  },
  tarona: {
    gradient: "from-purple-950 via-violet-900 to-fuchsia-950",
    accent: "#a855f7",
    Illustration: PulseSVG,
    corner: "center",
  },
  porokiya: {
    gradient: "from-rose-950 via-red-900 to-pink-950",
    accent: "#e11d48",
    Illustration: FacesSVG,
    corner: "top-right",
  },
  kumari: {
    gradient: "from-pink-950 via-purple-900 to-rose-950",
    accent: "#f472b6",
    Illustration: FlowerSVG,
    corner: "bottom-left",
  },
  prem: {
    gradient: "from-red-950 via-pink-900 to-rose-950",
    accent: "#f43f5e",
    Illustration: HeartSVG,
    corner: "center",
  },
  pesha: {
    gradient: "from-sky-950 via-blue-900 to-indigo-950",
    accent: "#3b82f6",
    Illustration: BriefcaseSVG,
    corner: "bottom-right",
  },
  somokami: {
    gradient: "from-purple-950 via-fuchsia-900 to-cyan-950",
    accent: "#c084fc",
    Illustration: RainbowSVG,
    corner: "top-left",
  },
  aloukik: {
    gradient: "from-indigo-950 via-purple-900 to-slate-950",
    accent: "#8b5cf6",
    Illustration: MoonSVG,
    corner: "top-right",
  },
};

const DEFAULT_STYLE: CategoryStyle = {
  gradient: "from-zinc-900 via-stone-900 to-neutral-950",
  accent: "#e4e4e7",
  Illustration: HeartSVG,
  corner: "center",
};

function getCategoryStyle(id?: string): CategoryStyle {
  if (!id) return DEFAULT_STYLE;
  return CATEGORY_STYLES[id] ?? DEFAULT_STYLE;
}

// ─── Corner-positioned illustration wrapper ──

function PositionedIllustration({
  Illustration,
  corner,
}: {
  Illustration: React.FC<React.SVGProps<SVGSVGElement>>;
  corner: CategoryStyle["corner"];
}) {
  const positionClasses: Record<string, string> = {
    "top-left": "top-0 left-0 -translate-x-1/4 -translate-y-1/4",
    "top-right": "top-0 right-0 translate-x-1/4 -translate-y-1/4",
    "bottom-left": "bottom-0 left-0 -translate-x-1/4 translate-y-1/4",
    "bottom-right": "bottom-0 right-0 translate-x-1/4 translate-y-1/4",
    center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  };

  const sizeClasses: Record<string, string> = {
    "top-left": "w-2/5 h-2/5",
    "top-right": "w-2/5 h-2/5",
    "bottom-left": "w-2/5 h-2/5",
    "bottom-right": "w-2/5 h-2/5",
    center: "w-3/5 h-3/5",
  };

  return (
    <div
      className={`absolute ${positionClasses[corner]} ${sizeClasses[corner]} pointer-events-none select-none opacity-20 text-white`}
      aria-hidden="true"
    >
      <Illustration className="w-full h-full" />
    </div>
  );
}

// ─── Responsive font size ──

function titleFontSize(length: number): string {
  if (length <= 15) return "clamp(1.1rem, 4.5vw, 1.45rem)";
  if (length <= 30) return "clamp(0.95rem, 3.8vw, 1.25rem)";
  if (length <= 50) return "clamp(0.85rem, 3.2vw, 1.1rem)";
  return "clamp(0.78rem, 2.8vw, 0.95rem)";
}

// ─── Main component ──

export function PlaceholderCover({
  title,
  categoryId,
  categoryName,
  className = "",
  style,
}: PlaceholderCoverProps) {
  const fontSize = titleFontSize(title.length);
  const { gradient, accent, Illustration, corner } = getCategoryStyle(categoryId);

  return (
    <div className={`relative overflow-hidden rounded-2xl shadow-inner ${className}`} style={style}>
      {/* Layer 1 — Deep rich gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />

      {/* Layer 2 — Dark contrast overlay for 100% crisp text readability */}
      <div className="absolute inset-0 bg-black/40 backdrop-brightness-95" />

      {/* Layer 3 — Abstract illustration */}
      <PositionedIllustration Illustration={Illustration} corner={corner} />

      {/* Layer 4 — Category badge at top left */}
      {categoryName && (
        <div className="absolute top-2.5 left-2.5 z-10">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase border border-white/10 shadow-sm"
            style={{
              background: "rgba(0, 0, 0, 0.4)",
              color: "#ffffff",
              backdropFilter: "blur(6px)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ background: accent }}></span>
            <span>{categoryName}</span>
          </span>
        </div>
      )}

      {/* Layer 5 — Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] z-10"
        style={{ background: accent, opacity: 0.8 }}
      />

      {/* Layer 6 — Centered high-contrast Bengali Title */}
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6 z-10">
        <h3
          className="text-center font-bengali font-bold text-white leading-snug line-clamp-3 select-none"
          style={{
            fontSize,
            color: "#ffffff",
            textShadow: "0 2px 8px rgba(0, 0, 0, 0.85), 0 1px 3px rgba(0, 0, 0, 0.9)",
          }}
        >
          {title}
        </h3>
      </div>
    </div>
  );
}
