export function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden animate-pulse">
      <div className="aspect-[16/9] bg-surface-alt" />
      <div className="p-4 space-y-2.5">
        <div className="h-3 bg-surface-alt rounded-full w-1/3" />
        <div className="h-4 bg-surface-alt rounded-full w-full" />
        <div className="h-4 bg-surface-alt rounded-full w-4/5" />
        <div className="h-3 bg-surface-alt rounded-full w-2/3" />
        <div className="flex gap-2 pt-1">
          <div className="h-3 bg-surface-alt rounded-full w-12" />
          <div className="h-3 bg-surface-alt rounded-full w-16" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 bg-surface border border-border rounded-xl animate-pulse">
          <div className="w-16 h-16 bg-surface-alt rounded-lg shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 bg-surface-alt rounded-full w-1/4" />
            <div className="h-4 bg-surface-alt rounded-full w-full" />
            <div className="h-3 bg-surface-alt rounded-full w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonProfile() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-surface-alt rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-surface-alt rounded-full w-32" />
          <div className="h-3 bg-surface-alt rounded-full w-24" />
        </div>
      </div>
      <div className="h-3 bg-surface-alt rounded-full w-full" />
      <div className="h-3 bg-surface-alt rounded-full w-4/5" />
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(i => (
          <div key={i} className="h-16 bg-surface-alt rounded-xl" />
        ))}
      </div>
    </div>
  );
}
