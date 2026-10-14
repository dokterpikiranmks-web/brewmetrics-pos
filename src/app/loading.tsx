export default function GlobalLoading() {
  return (
    <div className="min-h-screen min-h-dvh flex flex-col bg-coal text-cream overflow-hidden">
      {/* Top Header Placeholder */}
      <div className="h-[58px] sm:h-[68px] border-b border-line bg-coal-2/90 flex items-center justify-between px-4 sm:px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-xl bg-panel border border-line animate-pulse" />
          <div className="h-5 w-24 rounded-lg bg-panel animate-pulse hidden sm:block" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 rounded-xl bg-panel border border-line animate-pulse" />
        </div>
      </div>

      {/* Main Content Area Skeleton */}
      <div className="flex-1 p-4 sm:p-6 space-y-4 max-w-7xl mx-auto w-full animate-pulse">
        <div className="h-8 w-48 rounded-xl bg-panel border border-line" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl border border-line bg-panel p-4 space-y-2">
              <div className="h-4 w-20 rounded bg-coal" />
              <div className="h-6 w-32 rounded bg-coal" />
            </div>
          ))}
        </div>
        <div className="h-64 rounded-2xl border border-line bg-panel" />
      </div>
    </div>
  );
}
