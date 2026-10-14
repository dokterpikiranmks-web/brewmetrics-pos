export default function SettingsLoading() {
  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto w-full">
      {/* Top Header Skeleton */}
      <div className="space-y-1">
        <div className="h-7 w-40 rounded-xl bg-panel border border-line animate-pulse" />
        <div className="h-4 w-64 rounded-lg bg-panel/70 animate-pulse" />
      </div>

      {/* Tabs Skeleton */}
      <div className="flex items-center gap-2 overflow-x-hidden border-b border-line pb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-28 rounded-xl bg-panel border border-line animate-pulse shrink-0"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>

      {/* Content Form Blocks */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-line bg-panel p-5 space-y-3 animate-pulse"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="h-5 w-44 rounded bg-coal" />
            <div className="h-4 w-72 rounded bg-coal/70" />
            <div className="h-10 w-full rounded-xl bg-coal mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
