export default function PosLoading() {
  return (
    <div className="flex flex-col h-screen w-full bg-coal text-cream overflow-hidden">
      {/* Top Header Bar Placeholder */}
      <div className="h-[58px] sm:h-[68px] border-b border-line bg-coal-2/90 flex items-center justify-between px-3 sm:px-4 lg:px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-8 sm:size-9 rounded-xl bg-panel border border-line animate-pulse" />
          <div className="h-5 w-24 rounded-lg bg-panel animate-pulse hidden sm:block" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 rounded-xl bg-panel border border-line animate-pulse" />
          <div className="h-8 w-8 rounded-xl bg-panel border border-line animate-pulse" />
        </div>
      </div>

      {/* POS Terminal Body */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row pos-container-height overflow-hidden">
        {/* Left Category Rail Skeleton */}
        <aside className="w-full shrink-0 border-b border-line bg-coal-2/60 flex flex-row items-center gap-1.5 px-3 py-2 overflow-x-hidden md:w-[76px] lg:w-[92px] md:border-b-0 md:border-r md:flex-col md:px-0 md:py-3 md:h-full">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-9 md:h-16 w-20 md:w-16 rounded-xl md:rounded-2xl bg-panel border border-line/60 animate-pulse shrink-0"
              style={{ animationDelay: `${i * 70}ms` }}
            />
          ))}
        </aside>

        {/* Center Product Catalog Grid Skeleton */}
        <section className="flex-1 min-w-0 flex flex-col min-h-0 h-full overflow-hidden p-3 sm:p-4 lg:p-5">
          <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
            <div className="h-9 w-64 max-w-full rounded-xl bg-panel border border-line animate-pulse" />
            <div className="h-9 w-32 rounded-xl bg-panel border border-line animate-pulse hidden sm:block" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3 flex-1 overflow-hidden">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-[148px] rounded-2xl border border-line bg-panel p-3 flex flex-col justify-between animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="size-11 rounded-xl bg-coal border border-line-2/40" />
                <div className="space-y-1.5 mt-2">
                  <div className="h-3.5 w-3/4 rounded bg-coal" />
                  <div className="h-2.5 w-1/2 rounded bg-coal/70" />
                </div>
                <div className="h-4 w-20 rounded bg-brand/20 mt-2" />
              </div>
            ))}
          </div>
        </section>

        {/* Right Ticket Pane Skeleton */}
        <aside className="hidden md:flex md:w-[370px] xl:w-[410px] shrink-0 border-l border-line bg-coal-2/70 flex-col min-h-0 h-full p-4 justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="h-5 w-28 rounded bg-panel animate-pulse" />
              <div className="h-8 w-8 rounded-xl bg-panel animate-pulse" />
            </div>
            <div className="h-10 w-full rounded-xl bg-panel border border-line animate-pulse" />
            <div className="space-y-2 pt-2">
              <div className="h-16 w-full rounded-xl bg-panel border border-line/60 animate-pulse" />
              <div className="h-16 w-full rounded-xl bg-panel border border-line/60 animate-pulse" />
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-line">
            <div className="flex justify-between">
              <div className="h-4 w-20 rounded bg-panel animate-pulse" />
              <div className="h-4 w-24 rounded bg-panel animate-pulse" />
            </div>
            <div className="flex justify-between">
              <div className="h-6 w-24 rounded bg-panel animate-pulse" />
              <div className="h-6 w-32 rounded bg-brand/20 animate-pulse" />
            </div>
            <div className="h-12 w-full rounded-2xl bg-brand/30 animate-pulse" />
          </div>
        </aside>
      </div>
    </div>
  );
}
