import { BadgeCheck } from "lucide-react";

export function VerifiedBadge({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "w-5 h-5" : size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
  return (
    <span className="inline-flex items-center justify-center" title="যাচাইকৃত লেখক">
      <BadgeCheck className={`${sizeClass} text-blue-500 fill-blue-500/20`} />
    </span>
  );
}