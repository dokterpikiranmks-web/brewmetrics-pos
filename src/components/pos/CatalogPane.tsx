"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, LayoutGrid } from "lucide-react";
import type { CatalogDto } from "@/lib/types";
import { formatIDR } from "@/lib/format";
import { productIcon, categoryIcon } from "./icons";

type Product = CatalogDto["products"][number];

export default function CatalogPane({
  catalog,
  onPick,
}: {
  catalog: CatalogDto;
  onPick: (product: Product) => void;
}) {
  const [activeCat, setActiveCat] = useState<number | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let list = catalog.products;
    if (activeCat !== "all") list = list.filter((p) => p.categoryId === activeCat);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.tagline.toLowerCase().includes(q));
    }
    return list;
  }, [catalog.products, activeCat, query]);

  return (
    <div className="flex flex-col md:flex-row min-h-0 min-w-0 flex-1">
      {/* --------------------------- CATEGORY RAIL --------------------------- */}
      {/* Mobile-first: flex-row horizontal scroll pada layar HP, md:flex-col di layar tablet/desktop */}
      <aside className="w-full shrink-0 border-b border-line bg-coal-2/60 flex flex-row items-center gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar md:w-[76px] lg:w-[92px] md:border-b-0 md:border-r md:flex-col md:px-0 md:py-3 md:overflow-y-auto">
        <RailButton
          active={activeCat === "all"}
          label="Semua"
          icon={<LayoutGrid className="size-4 md:size-5" strokeWidth={2.1} />}
          onClick={() => setActiveCat("all")}
        />
        {catalog.categories.map((c) => {
          const Icon = categoryIcon(c.icon);
          return (
            <RailButton
              key={c.id}
              active={activeCat === c.id}
              label={c.name}
              icon={<Icon className="size-4 md:size-5" strokeWidth={2.1} />}
              onClick={() => setActiveCat(c.id)}
            />
          );
        })}
      </aside>

      {/* ---------------------------- PRODUCT GRID ---------------------------- */}
      <section className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="px-3 sm:px-4 lg:px-5 pt-3 md:pt-4 pb-2.5 md:pb-3 flex items-center gap-2 sm:gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari menu…"
              className="w-full rounded-xl border border-line bg-panel py-2 pl-9 pr-3.5 text-xs sm:text-sm text-cream placeholder:text-faint outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/15 transition"
            />
          </div>
          <p className="text-xs text-faint hidden sm:block">
            <span className="font-display font-semibold text-sand tabular">{filtered.length}</span> menu aktif
          </p>
        </div>

        {/* pb-28 pada layar HP agar produk paling bawah tidak tertutup Bottom Bar struk */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 lg:px-5 pb-28 md:pb-5">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
            {filtered.map((p, i) => {
              const Icon = productIcon(p.icon);
              return (
                <motion.button
                  layout
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.25), duration: 0.22 }}
                  onClick={() => onPick(p)}
                  className="btn-press group relative overflow-hidden rounded-2xl border border-line bg-panel p-2.5 sm:p-3 text-left hover:border-brand/45 hover:bg-panel-2"
                >
                  <div
                    className="absolute -right-6 -top-8 size-28 rounded-full blur-2xl opacity-[0.13] transition-opacity group-hover:opacity-30"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.imageUrl ? (
                    <div className="mb-2 sm:mb-3 size-10 sm:size-12 rounded-xl overflow-hidden border border-line-2/60 relative shrink-0 bg-coal">
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="size-full object-cover"
                      />
                      <span
                        className="absolute -bottom-1 -right-1 size-2 rounded-full border border-coal"
                        style={{ backgroundColor: p.color }}
                      />
                    </div>
                  ) : (
                    <div
                      className="mb-2 sm:mb-3 grid size-10 sm:size-12 place-items-center rounded-xl border border-line-2/50 bg-coal relative"
                      style={{ boxShadow: `inset 0 0 24px -12px ${p.color}` }}
                    >
                      <Icon className="size-5 sm:size-6" strokeWidth={1.9} style={{ color: p.color }} />
                      <span
                        className="absolute -bottom-1 -right-1 size-2 rounded-full border border-coal"
                        style={{ backgroundColor: p.color }}
                      />
                    </div>
                  )}
                  <p className="text-xs sm:text-[13px] font-bold leading-tight text-cream line-clamp-2 min-h-[2.2em]">
                    {p.name}
                  </p>
                  <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-[10.5px] text-faint line-clamp-1">{p.tagline}</p>
                  <p className="mt-2 sm:mt-2.5 font-display text-sm sm:text-[15px] font-bold tabular text-brand">
                    {formatIDR(p.price)}
                  </p>
                </motion.button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-faint text-xs sm:text-sm px-4">
              {query.trim()
                ? `Menu tidak ditemukan untuk “${query}”.`
                : catalog.products.length === 0
                  ? "Belum ada produk aktif di katalog database. Tambahkan menu baru di halaman Master Produk."
                  : "Belum ada produk yang terdaftar untuk kategori ini."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function RailButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`btn-press relative shrink-0 flex flex-row md:flex-col items-center gap-1.5 rounded-xl md:rounded-2xl px-3 py-1.5 md:py-3 md:px-1 md:w-[62px] lg:md:w-[74px] transition-colors ${
        active ? "text-coal font-bold" : "text-faint hover:text-sand hover:bg-panel-2"
      }`}
    >
      {active && (
        <motion.span
          layoutId="cat-pill"
          className="absolute inset-0 rounded-xl md:rounded-2xl bg-brand shadow-[0_10px_26px_-10px] shadow-brand/60"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      <span className="relative z-10">{icon}</span>
      <span className="relative z-10 text-xs md:text-[9.5px] font-bold whitespace-nowrap md:whitespace-normal md:leading-tight text-center md:px-1 md:line-clamp-2">
        {label}
      </span>
    </button>
  );
}
