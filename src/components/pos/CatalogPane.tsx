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
    <div className="flex min-h-0 min-w-0 flex-1">
      {/* --------------------------- CATEGORY RAIL --------------------------- */}
      <aside className="w-[76px] lg:w-[92px] shrink-0 border-r border-line bg-coal-2/60 flex flex-col items-center gap-2 py-3 overflow-y-auto no-scrollbar">
        <RailButton
          active={activeCat === "all"}
          label="Semua"
          icon={<LayoutGrid className="size-5" strokeWidth={2.1} />}
          onClick={() => setActiveCat("all")}
        />
        {catalog.categories.map((c) => {
          const Icon = categoryIcon(c.icon);
          return (
            <RailButton
              key={c.id}
              active={activeCat === c.id}
              label={c.name}
              icon={<Icon className="size-5" strokeWidth={2.1} />}
              onClick={() => setActiveCat(c.id)}
            />
          );
        })}
      </aside>

      {/* ---------------------------- PRODUCT GRID ---------------------------- */}
      <section className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="px-4 lg:px-5 pt-4 pb-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari menu…"
              className="w-full rounded-xl border border-line bg-panel py-2.5 pl-10 pr-4 text-sm text-cream placeholder:text-faint outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/15 transition"
            />
          </div>
          <p className="text-xs text-faint hidden md:block">
            <span className="font-display font-semibold text-sand tabular">{filtered.length}</span> menu aktif
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 lg:px-5 pb-5">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {filtered.map((p, i) => {
              const Icon = productIcon(p.icon);
              return (
                <motion.button
                  layout
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.024, 0.3), duration: 0.25 }}
                  onClick={() => onPick(p)}
                  className="btn-press group relative overflow-hidden rounded-2xl border border-line bg-panel p-3 text-left hover:border-brand/45 hover:bg-panel-2"
                >
                  <div
                    className="absolute -right-6 -top-8 size-28 rounded-full blur-2xl opacity-[0.13] transition-opacity group-hover:opacity-30"
                    style={{ backgroundColor: p.color }}
                  />
                  <div
                    className="mb-3 grid size-12 place-items-center rounded-xl border border-line-2/50 bg-coal relative"
                    style={{ boxShadow: `inset 0 0 24px -12px ${p.color}` }}
                  >
                    <Icon className="size-6" strokeWidth={1.9} style={{ color: p.color }} />
                    <span
                      className="absolute -bottom-1 -right-1 size-2 rounded-full border border-coal"
                      style={{ backgroundColor: p.color }}
                    />
                  </div>
                  <p className="text-[13px] font-bold leading-tight text-cream line-clamp-2 min-h-[2.2em]">{p.name}</p>
                  <p className="mt-1 text-[10.5px] text-faint line-clamp-1">{p.tagline}</p>
                  <p className="mt-2.5 font-display text-[15px] font-bold tabular text-brand">{formatIDR(p.price)}</p>
                </motion.button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="py-20 text-center text-faint text-sm">Menu tidak ditemukan untuk “{query}”.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function RailButton({
  active, label, icon, onClick,
}: {
  active: boolean; label: string; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`btn-press relative flex w-[62px] lg:w-[74px] flex-col items-center gap-1.5 rounded-2xl py-3 transition-colors ${
        active ? "text-coal" : "text-faint hover:text-sand hover:bg-panel-2"
      }`}
    >
      {active && (
        <motion.span
          layoutId="cat-pill"
          className="absolute inset-0 rounded-2xl bg-brand shadow-[0_10px_26px_-10px] shadow-brand/60"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      <span className="relative z-10">{icon}</span>
      <span className="relative z-10 text-[9.5px] font-bold leading-tight text-center px-1 line-clamp-2">{label}</span>
    </button>
  );
}
