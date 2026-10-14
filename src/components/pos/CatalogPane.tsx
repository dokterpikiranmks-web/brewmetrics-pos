"use client";

import { useMemo, useState, useCallback, useEffect, useTransition, memo } from "react";
import { Search, LayoutGrid, History, Sparkles } from "lucide-react";
import type { CatalogDto } from "@/lib/types";
import { formatIDR } from "@/lib/format";
import { productIcon, categoryIcon } from "./icons";

type Product = CatalogDto["products"][number];

/* -----------------------------------------------------------------------------
 * MEMOIZED PRODUCT CARD
 * - onPointerDown eliminates 100-300ms mobile touch delay
 * - React.memo avoids CPU re-rendering when cart lines change
 * - GPU-friendly styling (no costly blur-2xl or heavy multi-layered shadows)
 * -------------------------------------------------------------------------- */
interface ProductCardProps {
  product: Product;
  onPick: (product: Product) => void;
}

export const ProductCard = memo(function ProductCard({
  product,
  onPick,
}: ProductCardProps) {
  const Icon = productIcon(product.icon);

  // Hyper-Fast Touch Response via onPointerDown (0ms browser gesture delay)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 0) {
        onPick(product);
      }
    },
    [onPick, product]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPick(product);
      }
    },
    [onPick, product]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      className="product-card btn-press group relative overflow-hidden rounded-2xl border border-line bg-panel p-2.5 sm:p-3 text-left hover:border-brand/45 hover:bg-panel-2 cursor-pointer touch-manipulation select-none"
    >
      {/* Lightweight accent tint without expensive blur-2xl filter */}
      <div
        className="absolute -right-6 -top-8 size-28 rounded-full opacity-[0.08] transition-opacity group-hover:opacity-20 pointer-events-none"
        style={{ backgroundColor: product.color }}
      />

      {product.isBundle && (
        <span className="absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-md bg-brand/20 border border-brand/40 px-1.5 py-0.5 text-[8.5px] font-extrabold text-brand uppercase tracking-wider pointer-events-none">
          <Sparkles className="size-2.5 pointer-events-none" />
          <span>Paket</span>
        </span>
      )}

      {product.imageUrl ? (
        <div className="mb-2 sm:mb-3 size-10 sm:size-12 rounded-xl overflow-hidden border border-line-2/60 relative shrink-0 bg-coal pointer-events-none">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="size-full object-cover pointer-events-none"
            loading="lazy"
          />
          <span
            className="absolute -bottom-1 -right-1 size-2 rounded-full border border-coal pointer-events-none"
            style={{ backgroundColor: product.color }}
          />
        </div>
      ) : (
        <div className="mb-2 sm:mb-3 grid size-10 sm:size-12 place-items-center rounded-xl border border-line-2/50 bg-coal relative pointer-events-none">
          <Icon className="size-5 sm:size-6 pointer-events-none" strokeWidth={1.9} style={{ color: product.color }} />
          <span
            className="absolute -bottom-1 -right-1 size-2 rounded-full border border-coal pointer-events-none"
            style={{ backgroundColor: product.color }}
          />
        </div>
      )}

      <p className="text-xs sm:text-[13px] font-bold leading-tight text-cream line-clamp-2 min-h-[2.2em] pointer-events-none">
        {product.name}
      </p>
      <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-[10.5px] text-faint line-clamp-1 pointer-events-none">
        {product.tagline}
      </p>
      <p className="mt-2 sm:mt-2.5 font-display text-sm sm:text-[15px] font-bold tabular text-brand pointer-events-none">
        {formatIDR(product.price)}
      </p>
    </div>
  );
});

/* -----------------------------------------------------------------------------
 * MEMOIZED RAIL CATEGORY BUTTON
 * -------------------------------------------------------------------------- */
interface RailButtonProps {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const RailButton = memo(function RailButton({
  active,
  label,
  icon,
  onClick,
}: RailButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn-press relative shrink-0 flex flex-row md:flex-col items-center gap-1.5 rounded-xl md:rounded-2xl px-3 py-1.5 md:py-3 md:px-1 md:w-[62px] lg:md:w-[74px] transition-colors ${
        active ? "text-coal font-bold" : "text-faint hover:text-sand hover:bg-panel-2"
      }`}
    >
      {active && (
        <span
          className="absolute inset-0 rounded-xl md:rounded-2xl bg-brand shadow-[0_10px_26px_-10px] shadow-brand/60"
        />
      )}
      <span className="relative z-10">{icon}</span>
      <span className="relative z-10 text-xs md:text-[9.5px] font-bold whitespace-nowrap md:whitespace-normal md:leading-tight text-center md:px-1 md:line-clamp-2">
        {label}
      </span>
    </button>
  );
});

/* -----------------------------------------------------------------------------
 * MAIN CATALOG PANE (MEMOIZED WITH GPU ACCELERATION & LOCAL CACHE SWR)
 * -------------------------------------------------------------------------- */
interface CatalogPaneProps {
  catalog?: CatalogDto | null;
  branchId?: string;
  onPick: (product: Product) => void;
  onOpenHistory?: () => void;
  onOpenMoodScanner?: () => void;
  onCatalogUpdate?: (catalog: CatalogDto) => void;
}

const CatalogPane = memo(function CatalogPane({
  catalog,
  branchId,
  onPick,
  onOpenHistory,
  onOpenMoodScanner,
  onCatalogUpdate,
}: CatalogPaneProps) {
  // Stale-While-Revalidate: render langsung dari cache lokal (0ms) jika props catalog belum siap
  const [activeCatalog, setActiveCatalog] = useState<CatalogDto | null>(() => {
    if (catalog) return catalog;
    if (typeof window !== "undefined" && branchId) {
      try {
        const cached = localStorage.getItem(`doita_catalog_${branchId}`);
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  });

  const [activeCat, setActiveCat] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  // Sinkronisasi prop catalog ke activeCatalog & simpan ke localStorage
  useEffect(() => {
    if (catalog) {
      setActiveCatalog(catalog);
      if (typeof window !== "undefined" && branchId) {
        try {
          localStorage.setItem(`doita_catalog_${branchId}`, JSON.stringify(catalog));
        } catch {}
      }
    }
  }, [catalog, branchId]);

  // Sinkronisasi data API di background secara mandiri jika catalog belum di-pass atau cabang berubah
  useEffect(() => {
    if (!branchId) return;

    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`doita_catalog_${branchId}`);
        if (cached && !activeCatalog) {
          setActiveCatalog(JSON.parse(cached));
        }
      } catch {}
    }

    let isMounted = true;
    fetch(`/api/catalog?branch_id=${branchId}`, {
      headers: { "x-branch-id": branchId },
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Gagal mengambil katalog");
      })
      .then((d: CatalogDto) => {
        if (!isMounted) return;
        setActiveCatalog(d);
        onCatalogUpdate?.(d);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`doita_catalog_${branchId}`, JSON.stringify(d));
          } catch {}
        }
      })
      .catch(() => {
        /* Abaikan saat offline */
      });

    return () => {
      isMounted = false;
    };
  }, [branchId, onCatalogUpdate]);

  const handleSelectCat = useCallback((catId: number | "all") => {
    startTransition(() => {
      setActiveCat(catId);
    });
  }, []);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    startTransition(() => {
      setQuery(val);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!activeCatalog) return [];
    let list = activeCatalog.products;
    if (activeCat !== "all") list = list.filter((p) => p.categoryId === activeCat);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.tagline.toLowerCase().includes(q));
    }
    return list;
  }, [activeCatalog, activeCat, query]);

  // Skeleton UI instan jika belum ada data sama sekali (baik di memori maupun cache lokal)
  if (!activeCatalog) {
    return (
      <div className="flex flex-col md:flex-row min-h-0 min-w-0 flex-1 h-full overflow-hidden">
        <aside className="w-full shrink-0 border-b border-line bg-coal-2/60 flex flex-row items-center gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar md:w-[76px] lg:w-[92px] md:border-b-0 md:border-r md:flex-col md:px-0 md:py-3 md:overflow-y-auto md:h-full">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="size-12 rounded-2xl bg-panel animate-pulse-soft" />
          ))}
        </aside>
        <div className="flex-1 min-h-0 p-3 sm:p-5 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 content-start overflow-y-auto pos-catalog-scroll">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-[148px] rounded-2xl border border-line bg-panel animate-pulse-soft" style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-0 min-w-0 flex-1 h-full overflow-hidden">
      {/* --------------------------- CATEGORY RAIL --------------------------- */}
      <aside
        className="w-full shrink-0 border-b border-line bg-coal-2/60 flex flex-row items-center gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar md:w-[76px] lg:w-[92px] md:border-b-0 md:border-r md:flex-col md:px-0 md:py-3 md:overflow-y-auto md:h-full gpu-scroll"
        style={{
          transform: "translate3d(0, 0, 0)",
          willChange: "transform, scroll-position",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          contain: "content",
        }}
      >
        <RailButton
          active={activeCat === "all"}
          label="Semua"
          icon={<LayoutGrid className="size-4 md:size-5" strokeWidth={2.1} />}
          onClick={() => handleSelectCat("all")}
        />
        {activeCatalog.categories.map((c) => {
          const Icon = categoryIcon(c.icon);
          return (
            <RailButton
              key={c.id}
              active={activeCat === c.id}
              label={c.name}
              icon={<Icon className="size-4 md:size-5" strokeWidth={2.1} />}
              onClick={() => handleSelectCat(c.id)}
            />
          );
        })}
      </aside>

      {/* ---------------------------- PRODUCT GRID ---------------------------- */}
      <section className="flex-1 min-w-0 flex flex-col min-h-0 h-full overflow-hidden">
        <div className="shrink-0 px-3 sm:px-4 lg:px-5 pt-3 md:pt-4 pb-2.5 md:pb-3 flex items-center justify-between gap-2 sm:gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-faint pointer-events-none" />
            <input
              value={query}
              onChange={handleQueryChange}
              placeholder="Cari menu…"
              className="w-full rounded-xl border border-line bg-panel py-2 pl-9 pr-3.5 text-xs sm:text-sm text-cream placeholder:text-faint outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/15 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs text-faint hidden lg:block">
              <span className="font-display font-semibold text-sand tabular">{filtered.length}</span> menu aktif
            </p>

            {onOpenMoodScanner && (
              <button
                type="button"
                onClick={onOpenMoodScanner}
                className="btn-press flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:text-emerald-200 hover:border-emerald-400 hover:bg-emerald-500/20 transition shrink-0 shadow-sm"
                title="Pindai ekspresi wajah untuk rekomendasi menu AI"
              >
                <Sparkles className="size-4 text-emerald-400 animate-pulse pointer-events-none" />
                <span className="hidden sm:inline">AI Mood Scanner</span>
                <span className="sm:hidden">AI Scan</span>
              </button>
            )}

            {onOpenHistory && (
              <button
                type="button"
                onClick={onOpenHistory}
                className="btn-press flex items-center gap-1.5 rounded-xl border border-line bg-panel px-3 py-2 text-xs font-bold text-sand hover:text-cream hover:border-brand/40 hover:bg-coal transition shrink-0"
                title="Lihat riwayat pesanan hari ini"
              >
                <History className="size-4 text-brand pointer-events-none" />
                <span className="hidden sm:inline">Riwayat Pesanan</span>
              </button>
            )}
          </div>
        </div>

        {/* Hardware-Accelerated Native Scroll pada kontainer menu produk */}
        <div
          className="flex-1 min-h-0 px-3 sm:px-4 lg:px-5 pb-48 md:pb-8 pos-catalog-scroll gpu-scroll"
          style={{
            overflowY: "scroll",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            contain: "content",
            transform: "translate3d(0, 0, 0)",
            willChange: "transform, scroll-position",
          }}
        >
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onPick={onPick}
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-faint text-xs sm:text-sm px-4">
              {query.trim()
                ? `Menu tidak ditemukan untuk “${query}”.`
                : activeCatalog.products.length === 0
                  ? "Belum ada produk aktif di katalog database. Tambahkan menu baru di halaman Master Produk."
                  : "Belum ada produk yang terdaftar untuk kategori ini."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
});

export default CatalogPane;
