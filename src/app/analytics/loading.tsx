export default function AnalyticsLoading() {
  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="h-7 w-48 rounded-xl bg-panel border border-line animate-pulse" />
          <div className="h-4 w-60 rounded-lg bg-panel/70 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-44 rounded-xl bg-panel border border-line animate-pulse" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl border border-line bg-panel p-4 space-y-2 animate-pulse"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="h-3.5 w-24 rounded bg-coal" />
            <div className="h-7 w-36 rounded bg-brand/20" />
            <div className="h-3 w-16 rounded bg-coal/70" />
          </div>
        ))}
      </div>

      {/* Charts Section Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 rounded-2xl border border-line bg-panel p-4 space-y-3 animate-pulse">
          <div className="h-5 w-40 rounded bg-coal" />
          <div className="h-52 w-full rounded-xl bg-coal/50" />
        </div>
        <div className="h-72 rounded-2xl border border-line bg-panel p-4 space-y-3 animate-pulse">
          <div className="h-5 w-32 rounded bg-coal" />
          <div className="h-52 w-full rounded-xl bg-coal/50" />
        </div>
      </div>
    </div>
  );
}
