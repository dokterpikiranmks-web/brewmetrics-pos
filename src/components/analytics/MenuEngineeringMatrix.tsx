"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Star,
  TrendingUp,
  HelpCircle,
  AlertCircle,
  Search,
  LayoutGrid,
  ListFilter,
  ArrowUpRight,
  Info,
  DollarSign,
  PackageCheck,
  Percent,
} from "lucide-react";
import type {
  MenuEngineeringSummary,
  MenuEngineeringItem,
  MenuQuadrant,
} from "@/lib/types";
import { formatIDR } from "@/lib/format";

interface MenuEngineeringMatrixProps {
  data?: MenuEngineeringSummary | null;
}

const QUADRANT_CONFIG: Record<
  MenuQuadrant,
  {
    label: string;
    sublabel: string;
    badgeLabel: string;
    icon: typeof Star;
    color: string;
    badgeBg: string;
    borderColor: string;
    cardBg: string;
    accentGlow: string;
    strategy: string;
    actionTag: string;
  }
> = {
  star: {
    label: "Stars (Bintang)",
    sublabel: "Margin Tinggi • Volume Tinggi",
    badgeLabel: "⭐ Stars",
    icon: Star,
    color: "text-amber-400",
    badgeBg: "bg-amber-400/10 text-amber-300 border-amber-400/30",
    borderColor: "border-amber-500/30",
    cardBg: "bg-gradient-to-br from-amber-950/20 to-panel",
    accentGlow: "shadow-[0_0_20px_-4px_rgba(245,158,11,0.2)]",
    strategy:
      "Pertahankan standar resep dan kualitas konsisten. Jadikan menu highlight di papan kasir & media sosial tanpa perlu diskon harga.",
    actionTag: "Pertahankan & Utamakan",
  },
  plowhorse: {
    label: "Plowhorses (Kuda Pekerja)",
    sublabel: "Margin Rendah • Volume Tinggi",
    badgeLabel: "🐎 Plowhorses",
    icon: TrendingUp,
    color: "text-sky-400",
    badgeBg: "bg-sky-400/10 text-sky-300 border-sky-400/30",
    borderColor: "border-sky-500/30",
    cardBg: "bg-gradient-to-br from-sky-950/20 to-panel",
    accentGlow: "shadow-[0_0_20px_-4px_rgba(56,189,248,0.2)]",
    strategy:
      "Tingkatkan margin secara cerdas: sesuaikan harga sedikit (Rp 1.000–2.000), tawarkan upgrade add-on (syrup/espresso shot), atau renegosiasi harga beli bahan baku.",
    actionTag: "Optimalisasi Margin / Harga",
  },
  puzzle: {
    label: "Puzzles (Teka-Teki)",
    sublabel: "Margin Tinggi • Volume Rendah",
    badgeLabel: "🧩 Puzzles",
    icon: HelpCircle,
    color: "text-purple-400",
    badgeBg: "bg-purple-400/10 text-purple-300 border-purple-400/30",
    borderColor: "border-purple-500/30",
    cardBg: "bg-gradient-to-br from-purple-950/20 to-panel",
    accentGlow: "shadow-[0_0_20px_-4px_rgba(168,85,247,0.2)]",
    strategy:
      "Dorong popularitas penjualan: edukasi staf barista untuk upsell/rekomendasi kasir, buat paket bundling dengan makanan/snack, atau ubah penamaan menu agar lebih menggoda.",
    actionTag: "Gencarkan Promosi & Upsell",
  },
  dog: {
    label: "Dogs (Beban / Anjing)",
    sublabel: "Margin Rendah • Volume Rendah",
    badgeLabel: "🐕 Dogs",
    icon: AlertCircle,
    color: "text-rose-400",
    badgeBg: "bg-rose-400/10 text-rose-300 border-rose-400/30",
    borderColor: "border-rose-500/30",
    cardBg: "bg-gradient-to-br from-rose-950/20 to-panel",
    accentGlow: "shadow-[0_0_20px_-4px_rgba(244,63,94,0.2)]",
    strategy:
      "Tinjau kelanjutan menu: evaluasi biaya resep (ganti bahan ke yang lebih hemat), re-branding konsep, atau pertimbangkan hapus dari daftar menu agar tidak mengikat modal stok.",
    actionTag: "Evaluasi Resep / Delist",
  },
};

export default function MenuEngineeringMatrix({ data }: MenuEngineeringMatrixProps) {
  const [viewMode, setViewMode] = useState<"matrix" | "list">("matrix");
  const [selectedQuadrant, setSelectedQuadrant] = useState<MenuQuadrant | "all">("all");
  const [search, setSearch] = useState("");

  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-6 text-center text-faint">
        <Sparkles className="mx-auto size-8 text-brand/50 mb-2 animate-pulse-soft" />
        <p className="font-display font-semibold text-cream">Data Menu Engineering Belum Cukup</p>
        <p className="text-xs text-faint mt-1">
          Membutuhkan transaksi minimal dalam 30 hari terakhir untuk menghitung benchmark kuadran menu.
        </p>
      </div>
    );
  }

  const { avgVolume, avgMargin, avgMarginPct, counts, items } = data;

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchQuadrant =
        selectedQuadrant === "all" ? true : item.quadrant === selectedQuadrant;
      const matchSearch =
        !search.trim() ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.categoryName.toLowerCase().includes(search.toLowerCase());
      return matchQuadrant && matchSearch;
    });
  }, [items, selectedQuadrant, search]);

  const quadrantItems = useMemo(() => {
    return {
      star: items.filter((i) => i.quadrant === "star"),
      plowhorse: items.filter((i) => i.quadrant === "plowhorse"),
      puzzle: items.filter((i) => i.quadrant === "puzzle"),
      dog: items.filter((i) => i.quadrant === "dog"),
    };
  }, [items]);

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5 lg:p-6 space-y-5">
      {/* ----------------- TITLE & CONTROLS ----------------- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-line/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-brand/10 border border-brand/30 text-brand">
              <Sparkles className="size-4" />
            </span>
            <h2 className="font-display text-lg sm:text-xl font-bold text-cream tracking-tight">
              Menu Engineering Matrix (30 Hari)
            </h2>
          </div>
          <p className="text-xs text-sand mt-1 max-w-2xl leading-relaxed">
            Klasifikasi portofolio menu kafe berdasarkan perpaduan{" "}
            <strong className="text-cream">Volume Penjualan</strong> dan{" "}
            <strong className="text-cream">Gross Margin (Keuntungan Kotor)</strong> untuk merumuskan strategi harga &amp; promosi.
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1.5 self-start lg:self-auto bg-coal p-1 rounded-xl border border-line">
          <button
            onClick={() => setViewMode("matrix")}
            className={`btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === "matrix"
                ? "bg-brand text-coal shadow-sm"
                : "text-sand hover:text-cream"
            }`}
          >
            <LayoutGrid className="size-3.5" />
            <span>Matriks 2x2</span>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === "list"
                ? "bg-brand text-coal shadow-sm"
                : "text-sand hover:text-cream"
            }`}
          >
            <ListFilter className="size-3.5" />
            <span>Daftar Menu ({items.length})</span>
          </button>
        </div>
      </div>

      {/* ----------------- BENCHMARK CARDS ----------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-line bg-coal/70 p-3.5 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg border border-brand/30 bg-brand/10 text-brand shrink-0">
            <PackageCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] uppercase tracking-wider text-faint font-bold truncate">
              Ambang Rata-rata Volume
            </p>
            <p className="font-display text-lg font-bold text-cream tabular">
              {avgVolume}{" "}
              <span className="text-xs font-normal text-sand">porsi / 30 hari</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-coal/70 p-3.5 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-400 shrink-0">
            <DollarSign className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] uppercase tracking-wider text-faint font-bold truncate">
              Ambang Rata-rata Margin
            </p>
            <p className="font-display text-lg font-bold text-emerald-400 tabular">
              {formatIDR(avgMargin)}{" "}
              <span className="text-xs font-normal text-sand">/ unit</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-coal/70 p-3.5 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg border border-sky-400/30 bg-sky-400/10 text-sky-400 shrink-0">
            <Percent className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] uppercase tracking-wider text-faint font-bold truncate">
              Rata-rata Margin %
            </p>
            <p className="font-display text-lg font-bold text-sky-400 tabular">
              {avgMarginPct}%{" "}
              <span className="text-xs font-normal text-sand">dari harga jual</span>
            </p>
          </div>
        </div>
      </div>

      {/* ----------------- 2X2 VISUAL MATRIX VIEW ----------------- */}
      {viewMode === "matrix" && (
        <div className="space-y-4">
          {/* Axis indicators */}
          <div className="flex items-center justify-between text-[11px] font-bold text-faint uppercase tracking-wider px-1">
            <div className="flex items-center gap-1.5">
              <span>Sumbu Vertikal: Gross Margin (Keuntungan)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Sumbu Horizontal: Volume Terjual (Popularitas)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* TOP-RIGHT: STARS */}
            <QuadrantBox
              quadrant="star"
              items={quadrantItems.star}
            />

            {/* TOP-LEFT: PUZZLES */}
            <QuadrantBox
              quadrant="puzzle"
              items={quadrantItems.puzzle}
            />

            {/* BOTTOM-RIGHT: PLOWHORSES */}
            <QuadrantBox
              quadrant="plowhorse"
              items={quadrantItems.plowhorse}
            />

            {/* BOTTOM-LEFT: DOGS */}
            <QuadrantBox
              quadrant="dog"
              items={quadrantItems.dog}
            />
          </div>
        </div>
      )}

      {/* ----------------- LIST / CARD FILTER VIEW ----------------- */}
      {viewMode === "list" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setSelectedQuadrant("all")}
                className={`btn-press whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                  selectedQuadrant === "all"
                    ? "bg-brand text-coal"
                    : "border border-line bg-coal text-sand hover:text-cream"
                }`}
              >
                Semua ({items.length})
              </button>
              {(["star", "plowhorse", "puzzle", "dog"] as MenuQuadrant[]).map((q) => {
                const conf = QUADRANT_CONFIG[q];
                const active = selectedQuadrant === q;
                return (
                  <button
                    key={q}
                    onClick={() => setSelectedQuadrant(q)}
                    className={`btn-press whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition-colors flex items-center gap-1.5 ${
                      active
                        ? "bg-panel-2 border " + conf.borderColor + " " + conf.color
                        : "border border-line bg-coal text-sand hover:text-cream"
                    }`}
                  >
                    <span>{conf.badgeLabel}</span>
                    <span className="text-[10px] opacity-75 font-mono">({counts[q]})</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-faint" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama menu..."
                className="input-dark pl-8 py-1.5 text-xs w-full"
              />
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredItems.map((item) => (
              <MenuItemCard key={item.id} item={item} />
            ))}
            {filteredItems.length === 0 && (
              <div className="col-span-full py-12 text-center text-faint">
                Tidak ada menu yang sesuai dengan filter.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* -------------------------------- QUADRANT BOX -------------------------------- */

function QuadrantBox({
  quadrant,
  items,
}: {
  quadrant: MenuQuadrant;
  items: MenuEngineeringItem[];
}) {
  const conf = QUADRANT_CONFIG[quadrant];
  const Icon = conf.icon;

  return (
    <div
      className={`rounded-2xl border ${conf.borderColor} ${conf.cardBg} ${conf.accentGlow} p-4 sm:p-5 flex flex-col justify-between space-y-4`}
    >
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span
              className={`grid size-8 place-items-center rounded-lg border ${conf.borderColor} bg-coal/70 ${conf.color}`}
            >
              <Icon className="size-4" />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-cream">
                {conf.label}
              </h3>
              <p className="text-[10.5px] text-faint">{conf.sublabel}</p>
            </div>
          </div>
          <span
            className={`font-display text-xs font-bold px-2.5 py-1 rounded-full border ${conf.badgeBg}`}
          >
            {items.length} Menu
          </span>
        </div>

        {/* Action Callout */}
        <div className="mt-3 rounded-xl border border-line/70 bg-coal/80 p-2.5 text-[11.5px] leading-relaxed">
          <span className={`font-bold block mb-0.5 ${conf.color}`}>
            💡 Rekomendasi Aksi:
          </span>
          <span className="text-sand">{conf.strategy}</span>
        </div>
      </div>

      {/* Menu items inside this quadrant */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="text-xs text-faint italic py-4 text-center">
            Belum ada menu di kuadran ini.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-line/60 bg-panel/80 hover:bg-panel transition-colors p-2.5 flex items-center justify-between gap-3 text-xs"
            >
              <div className="min-w-0 flex-1">
                <p className="font-bold text-cream truncate">{item.name}</p>
                <p className="text-[10.5px] text-faint truncate">
                  {item.categoryName} • Jual {formatIDR(item.price)} • HPP {formatIDR(item.hpp)}
                </p>
              </div>

              <div className="text-right shrink-0">
                <p className="font-display font-bold tabular text-cream">
                  {item.totalQty}{" "}
                  <span className="text-[10px] font-normal text-faint">terjual</span>
                </p>
                <p className={`font-display font-semibold tabular text-[11px] ${conf.color}`}>
                  +{formatIDR(item.unitMargin)}{" "}
                  <span className="text-[10px] text-faint">({item.marginPct}%)</span>
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Metrics */}
      <div className="pt-2 border-t border-line/50 flex items-center justify-between text-[11px] text-faint">
        <span>
          Omzet:{" "}
          <strong className="text-sand font-display tabular">
            {formatIDR(items.reduce((s, i) => s + i.totalRevenue, 0))}
          </strong>
        </span>
        <span>
          Profit:{" "}
          <strong className={`font-display tabular ${conf.color}`}>
            {formatIDR(items.reduce((s, i) => s + i.totalProfit, 0))}
          </strong>
        </span>
      </div>
    </div>
  );
}

/* -------------------------------- MENU ITEM CARD -------------------------------- */

function MenuItemCard({ item }: { item: MenuEngineeringItem }) {
  const conf = QUADRANT_CONFIG[item.quadrant];
  const Icon = conf.icon;

  return (
    <div className="rounded-xl border border-line bg-panel-2 p-3.5 flex flex-col justify-between space-y-3 hover:border-line-2 transition-colors">
      <div>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div>
            <h4 className="font-display font-bold text-sm text-cream truncate max-w-[190px]">
              {item.name}
            </h4>
            <span className="text-[10px] text-faint uppercase tracking-wider font-semibold">
              {item.categoryName}
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md border ${conf.badgeBg}`}
          >
            <Icon className="size-3" />
            {conf.badgeLabel}
          </span>
        </div>

        {/* Pricing breakdown */}
        <div className="grid grid-cols-3 gap-1.5 py-2 border-y border-line/60 text-center my-2">
          <div>
            <span className="text-[9.5px] text-faint uppercase font-semibold block">
              Harga Jual
            </span>
            <span className="font-display font-bold text-xs text-cream tabular">
              {formatIDR(item.price)}
            </span>
          </div>
          <div>
            <span className="text-[9.5px] text-faint uppercase font-semibold block">
              HPP
            </span>
            <span className="font-display font-bold text-xs text-sand tabular">
              {formatIDR(item.hpp)}
            </span>
          </div>
          <div>
            <span className="text-[9.5px] text-faint uppercase font-semibold block">
              Margin / Unit
            </span>
            <span className={`font-display font-bold text-xs tabular ${conf.color}`}>
              {formatIDR(item.unitMargin)}
            </span>
          </div>
        </div>

        {/* Sales Performance */}
        <div className="flex items-center justify-between text-xs text-sand">
          <span>
            Volume 30 Hari:{" "}
            <strong className="text-cream tabular">{item.totalQty} cup</strong>
          </span>
          <span>
            Margin %:{" "}
            <strong className={`tabular ${conf.color}`}>{item.marginPct}%</strong>
          </span>
        </div>
      </div>

      {/* Strategic action recommendation */}
      <div className="rounded-lg bg-coal p-2 text-[11px] border border-line/70">
        <span className="text-faint block text-[9.5px] uppercase font-bold tracking-wider mb-0.5">
          Saran Strategis:
        </span>
        <span className="text-cream/90 line-clamp-2">{conf.strategy}</span>
      </div>
    </div>
  );
}
