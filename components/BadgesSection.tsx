"use client";

import {
  Trophy, Lock, Sparkles, BookOpen, BookHeart, Flame, Crown,
  Footprints, GraduationCap, PenTool, Star, Bookmark, type LucideIcon,
} from "lucide-react";
import { getUserLevelAndBadges } from "@/lib/badges";

const iconMap: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  "book-heart": BookHeart,
  sparkles: Sparkles,
  flame: Flame,
  crown: Crown,
  footprints: Footprints,
  trophy: Trophy,
  "graduation-cap": GraduationCap,
  "pen-tool": PenTool,
  star: Star,
  bookmark: Bookmark,
};

interface Props {
  readCount: number;
  publishedCount: number;
  savedCount: number;
}

export function BadgesSection({ readCount, publishedCount, savedCount }: Props) {
  const { xp, level, levelTitle, levelIcon, badges } = getUserLevelAndBadges(readCount, publishedCount, savedCount);
  const LevelIcon = iconMap[levelIcon] || Sparkles;
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  // XP progress toward next level (max at 500)
  const xpProgress = Math.min(100, Math.round((xp / 500) * 100));

  return (
    <section className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden text-left">
      <div className="p-4 border-b border-border bg-surface-alt flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-500" />
        <h3 className="font-bold text-sm text-fg">অর্জন ব্যাজ ও লেভেল</h3>
        <span className="ml-auto text-[11px] text-fg-muted font-medium">
          {unlockedCount}/{badges.length}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Level card */}
        <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/60 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
              <LevelIcon className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-fg truncate">{levelTitle}</p>
                <span className="shrink-0 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[10px] font-black rounded-full">
                  লেভেল {level}
                </span>
              </div>
              <p className="text-[11px] text-fg-muted mt-0.5">{xp} XP</p>
            </div>
          </div>

          <div className="mt-3 h-1.5 bg-amber-100 dark:bg-amber-900/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-700"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
          <p className="text-[10px] text-fg-muted mt-1.5 leading-relaxed">
            গল্প পড়ে ১০ XP • গল্প প্রকাশে ৫০ XP • সংরক্ষণে ৫ XP
          </p>
        </div>

        {/* Badges grid */}
        <div className="grid grid-cols-3 gap-2">
          {badges.map((badge) => {
            const BadgeIcon = iconMap[badge.icon] || Sparkles;
            return (
              <div
                key={badge.id}
                className={`relative flex flex-col items-center rounded-xl border p-3 text-center transition-all ${
                  badge.unlocked
                    ? "bg-surface-alt border-accent/30"
                    : "bg-surface-alt/50 border-border opacity-45"
                }`}
                title={`${badge.description}${badge.unlocked ? "" : " (আনলক করা হয়নি)"}`}
              >
                <span className={`mb-1.5 ${badge.unlocked ? "text-accent" : "text-fg-subtle"}`}>
                  <BadgeIcon className="w-5 h-5" />
                </span>
                <p className={`text-[10px] font-bold leading-tight line-clamp-2 ${badge.unlocked ? "text-fg" : "text-fg-muted"}`}>
                  {badge.title}
                </p>
                {!badge.unlocked && (
                  <span className="absolute top-1.5 right-1.5 text-fg-subtle">
                    <Lock className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
