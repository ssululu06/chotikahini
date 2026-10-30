export interface Badge {
  id: string;
  title: string;
  icon: string;
  description: string;
  unlocked: boolean;
}

// Level thresholds (XP-based)
const LEVELS = [
  { min: 0, title: "নতুন পাঠক", icon: "book-open" },
  { min: 30, title: "গল্পপ্রেমী", icon: "book-heart" },
  { min: 100, title: "নিয়মিত পাঠক", icon: "sparkles" },
  { min: 250, title: "অনুরাগী পাঠক", icon: "flame" },
  { min: 500, title: "গল্পের সম্রাট", icon: "crown" },
] as const;

export function getUserLevelAndBadges(readCount: number, publishedCount: number, savedCount: number) {
  // XP calculation
  const xp = (readCount * 10) + (publishedCount * 50) + (savedCount * 5);

  let levelTitle = "নতুন পাঠক";
  let levelIcon = "book-open";
  let level = 1;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) {
      levelTitle = LEVELS[i].title;
      levelIcon = LEVELS[i].icon;
      level = i + 1;
      break;
    }
  }

  const badges: Badge[] = [
    {
      id: "first_read",
      title: "প্রথম পদচারণা",
      icon: "footprints",
      description: "প্রথম গল্প পড়েছেন",
      unlocked: readCount >= 1,
    },
    {
      id: "bookworm_10",
      title: "বইপোকা",
      icon: "trophy",
      description: "১০টি গল্প পাঠ সম্পন্ন করেছেন",
      unlocked: readCount >= 10,
    },
    {
      id: "master_reader_50",
      title: "বিজ্ঞ পাঠক",
      icon: "graduation-cap",
      description: "৫০টি গল্প পাঠ সম্পন্ন করেছেন",
      unlocked: readCount >= 50,
    },
    {
      id: "author_first",
      title: "নতুন লেখক",
      icon: "pen-tool",
      description: "নিজের প্রথম গল্প প্রকাশ করেছেন",
      unlocked: publishedCount >= 1,
    },
    {
      id: "author_pro_5",
      title: "জনপ্রিয় কথাসাহিত্যিক",
      icon: "star",
      description: "৫টি মানসম্মত গল্প প্রকাশ করেছেন",
      unlocked: publishedCount >= 5,
    },
    {
      id: "collector",
      title: "সংগ্রাহক",
      icon: "bookmark",
      description: "৫টি গল্প লাইব্রেরিতে সংরক্ষণ করেছেন",
      unlocked: savedCount >= 5,
    },
  ];

  return { xp, level, levelTitle, levelIcon, badges };
}
