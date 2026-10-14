export default function InventoryLoading() {
  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="h-7 w-48 rounded-xl bg-panel border border-line animate-pulse" />
          <div className="h-4 w-64 rounded-lg bg-panel/70 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-36 rounded-xl bg-brand/30 animate-pulse" />
        </div>
      </div>

      {/* Summary KPI Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-2xl border border-line bg-panel p-3.5 space-y-2 animate-pulse"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="h-3 w-20 rounded bg-coal" />
            <div className="h-6 w-28 rounded bg-coal" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="rounded-2xl border border-line bg-panel overflow-hidden">
        <div className="h-12 border-b border-line bg-coal px-4 flex items-center justify-between">
          <div className="h-4 w-32 rounded bg-panel animate-pulse" />
          <div className="h-8 w-48 rounded-xl bg-panel animate-pulse" />
        </div>
        <div className="divide-y divide-line/40">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 px-4 flex items-center justify-between animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="h-4 w-40 rounded bg-coal" />
              <div className="h-4 w-20 rounded bg-coal" />
              <div className="h-4 w-24 rounded bg-coal hidden sm:block" />
              <div className="h-6 w-16 rounded-full bg-coal" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
