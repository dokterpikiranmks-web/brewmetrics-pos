export default function ProductsLoading() {
  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Action Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="h-7 w-44 rounded-xl bg-panel border border-line animate-pulse" />
          <div className="h-4 w-60 rounded-lg bg-panel/70 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-32 rounded-xl bg-panel border border-line animate-pulse" />
          <div className="h-10 w-36 rounded-xl bg-brand/30 animate-pulse" />
        </div>
      </div>

      {/* Category Filter Pills Skeleton */}
      <div className="flex items-center gap-2 overflow-x-hidden py-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-24 rounded-xl bg-panel border border-line animate-pulse shrink-0"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>

      {/* Products Grid / Table Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-2xl border border-line bg-panel p-4 flex flex-col justify-between animate-pulse"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="size-12 rounded-xl bg-coal" />
            <div className="space-y-2">
              <div className="h-4 w-3/4 rounded bg-coal" />
              <div className="h-3 w-1/2 rounded bg-coal/70" />
            </div>
            <div className="h-5 w-24 rounded bg-brand/20" />
          </div>
        ))}
      </div>
    </div>
  );
}
