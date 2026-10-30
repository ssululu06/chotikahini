import { MessageCircle } from "lucide-react";
import { UserAvatar } from "./UserAvatar";

interface Comment {
  name: string;
  date: string;
  comment: string;
}

export function CommentList({ comments }: { comments: Comment[] }) {
  if (!comments || comments.length === 0) return null;

  return (
    <section className="mt-10 pt-8 border-t border-border">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-fg mb-6">
        <MessageCircle className="h-5 w-5" />
        মন্তব্য
      </h2>

      <div className="space-y-4">
        {comments.map((c, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface-alt p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <UserAvatar src={null} name={c.name} size="md" className="w-7 h-7" />
              <span className="text-sm font-medium text-fg">{c.name}</span>
              <span className="text-xs text-fg-subtle ml-auto">{c.date}</span>
            </div>
            <p className="text-sm text-fg-muted leading-relaxed">{c.comment}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
