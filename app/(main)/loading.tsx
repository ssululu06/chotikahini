export default function MainLoading() {
  return (
    <div className="article-layout py-8 sm:py-10">
      <div className="min-w-0 space-y-8">
        <div>
          <div className="h-7 w-48 rounded-lg bg-surface-alt animate-pulse" />
          <div className="mt-2 h-4 w-64 rounded-md bg-surface-alt animate-pulse" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-surface overflow-hidden"
            >
              <div className="aspect-[16/9] bg-surface-alt animate-pulse" />
              <div className="p-4 space-y-2.5">
                <div className="h-4 w-24 rounded-full bg-surface-alt animate-pulse" />
                <div className="h-5 w-11/12 rounded-md bg-surface-alt animate-pulse" />
                <div className="h-4 w-3/4 rounded-md bg-surface-alt animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="hidden lg:block space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2.5">
            <div className="h-4 w-24 rounded-md bg-surface-alt animate-pulse" />
            <div className="h-12 rounded-xl bg-surface-alt animate-pulse" />
            <div className="h-12 rounded-xl bg-surface-alt animate-pulse" />
            <div className="h-12 rounded-xl bg-surface-alt animate-pulse" />
          </div>
        ))}
      </aside>
    </div>
  );
}
