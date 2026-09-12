"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote,
  QrCode,
  CreditCard,
  Building2,
  Calendar,
  Layers,
  ShoppingBag,
  TrendingUp,
  Loader2,
  RefreshCw,
  Trophy,
  PieChart as PieIcon,
  Tag,
} from "lucide-react";
import { formatIDR } from "@/lib/format";
import type { SalesSummaryPeriodDto, PaymentChannelMetric, ProductSalesMetric } from "@/lib/types";
import { useBranch } from "@/context/BranchContext";

interface SalesSummarySectionProps {
  initialPeriod?: "today" | "last7days" | "thisMonth";
  compact?: boolean;
  className?: string;
}

export default function SalesSummarySection({
  initialPeriod = "today",
  compact = false,
  className = "",
}: SalesSummarySectionProps) {
  const { activeOutletId } = useBranch();
  const [period, setPeriod] = useState<"today" | "last7days" | "thisMonth">(initialPeriod);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SalesSummaryPeriodDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async (selectedPeriod: "today" | "last7days" | "thisMonth") => {
    setLoading(true);
    setError(null);
    try {
      const outletParam =
        activeOutletId && activeOutletId !== "all" ? `&outletId=${activeOutletId}` : "";
      const res = await fetch(`/api/reports/sales-summary?period=${selectedPeriod}${outletParam}`);
      if (!res.ok) throw new Error("Gagal mengambil ringkasan penjualan.");
      const data = await res.json();
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err: any) {
      console.error("fetch sales-summary error:", err);
      setError(err.message || "Gagal memuat ringkasan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(period);
  }, [period, activeOutletId]);

  const channelIcon = (ch: "cash" | "qris" | "debit" | "transfer") => {
    switch (ch) {
      case "cash":
        return <Banknote className="size-4 text-emerald-400" />;
      case "qris":
        return <QrCode className="size-4 text-sky-400" />;
      case "debit":
        return <CreditCard className="size-4 text-purple-400" />;
      case "transfer":
        return <Building2 className="size-4 text-amber-400" />;
    }
  };

  const channelBorder = (ch: "cash" | "qris" | "debit" | "transfer") => {
    switch (ch) {
      case "cash":
        return "border-emerald-500/30 hover:border-emerald-500/50 bg-emerald-950/20";
      case "qris":
        return "border-sky-500/30 hover:border-sky-500/50 bg-sky-950/20";
      case "debit":
        return "border-purple-500/30 hover:border-purple-500/50 bg-purple-950/20";
      case "transfer":
        return "border-amber-500/30 hover:border-amber-500/50 bg-amber-950/20";
    }
  };

  const channelBadgeColor = (ch: "cash" | "qris" | "debit" | "transfer") => {
    switch (ch) {
      case "cash":
        return "text-emerald-400 bg-emerald-500/15 border-emerald-500/30";
      case "qris":
        return "text-sky-400 bg-sky-500/15 border-sky-500/30";
      case "debit":
        return "text-purple-400 bg-purple-500/15 border-purple-500/30";
      case "transfer":
        return "text-amber-400 bg-amber-500/15 border-amber-500/30";
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* HEADER SECTION & FILTER RANGE BUTTONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border border-line bg-panel">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-brand/15 text-brand border border-brand/30">
            <TrendingUp className="size-4.5" />
          </div>
          <div>
            <h3 className="font-display text-sm sm:text-base font-bold text-cream">
              Ringkasan Penjualan &amp; Arus Kanal
            </h3>
            <p className="text-[11px] text-faint">
              Rekonsiliasi multi-kanal dan performa menu kopi &amp; makanan
            </p>
          </div>
        </div>

        {/* Filter Rentang Tanggal: Hari Ini, 7 Hari, Bulan Ini */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-coal border border-line">
          <button
            type="button"
            onClick={() => setPeriod("today")}
            className={`btn-press px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              period === "today"
                ? "bg-brand text-coal shadow-sm"
                : "text-sand hover:text-cream hover:bg-panel"
            }`}
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={() => setPeriod("last7days")}
            className={`btn-press px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              period === "last7days"
                ? "bg-brand text-coal shadow-sm"
                : "text-sand hover:text-cream hover:bg-panel"
            }`}
          >
            7 Hari
          </button>
          <button
            type="button"
            onClick={() => setPeriod("thisMonth")}
            className={`btn-press px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              period === "thisMonth"
                ? "bg-brand text-coal shadow-sm"
                : "text-sand hover:text-cream hover:bg-panel"
            }`}
          >
            Bulan Ini
          </button>

          <button
            type="button"
            onClick={() => fetchSummary(period)}
            disabled={loading}
            className="btn-press ml-1 p-1.5 rounded-lg text-faint hover:text-cream border border-line hover:bg-panel transition"
            title="Segarkan data ringkasan"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin text-brand" : ""}`} />
          </button>
        </div>
      </div>

      {loading && !summary ? (
        <div className="flex flex-col items-center justify-center py-12 text-faint">
          <Loader2 className="size-7 animate-spin text-brand mb-2" />
          <p className="text-xs font-medium">Memuat ringkasan kanal bayar &amp; menu...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-200">
          {error}
        </div>
      ) : summary ? (
        <>
          {/* =================================================================
              SEKSI 1: RINGKASAN METODE BAYAR (4 KARTU METRIK KANAL)
             ================================================================= */}
          <div>
            <div className="flex items-center justify-between mb-2.5 px-1">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-brand" />
                <h4 className="font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-cream">
                  Ringkasan Metode Bayar
                </h4>
              </div>
              <p className="text-[11px] text-faint">
                Total Masuk:{" "}
                <span className="font-display font-bold text-cream tabular">
                  {formatIDR(summary.channels.total)}
                </span>{" "}
                ({summary.totalOrders} Transaksi
                {summary.channels.counts.split > 0
                  ? `, ${summary.channels.counts.split} Split`
                  : ""}
                )
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {summary.metrics.map((m) => (
                <div
                  key={m.channel}
                  className={`rounded-2xl border p-3.5 sm:p-4 transition-all duration-200 flex flex-col justify-between ${channelBorder(
                    m.channel
                  )}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-bold text-sand uppercase tracking-wider flex items-center gap-1.5">
                      {channelIcon(m.channel)}
                      <span>{m.label}</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${channelBadgeColor(
                        m.channel
                      )}`}
                    >
                      {m.pctOfTotal}%
                    </span>
                  </div>

                  <div>
                    <p className="font-display text-lg sm:text-xl font-bold tabular text-cream tracking-tight">
                      {formatIDR(m.total)}
                    </p>
                    <p className="text-[10px] text-faint mt-1 flex items-center justify-between">
                      <span>{m.ordersCount}x pembayaran</span>
                      {m.channel === "cash" && (
                        <span className="text-emerald-400 font-semibold">Fisik Laci</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* =================================================================
              SEKSI 2: RINGKASAN PENJUALAN PRODUK (TABEL PERFORMA MENU)
             ================================================================= */}
          <div className="rounded-2xl border border-line bg-panel overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface/60">
              <div className="flex items-center gap-2">
                <ShoppingBag className="size-4 text-brand" />
                <h4 className="font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-cream">
                  Ringkasan Penjualan Produk
                </h4>
              </div>
              <span className="text-[11px] text-faint">
                {summary.products.length} Menu Terjual
              </span>
            </div>

            {summary.products.length === 0 ? (
              <div className="text-center py-8 text-faint text-xs">
                Belum ada transaksi menu pada periode ini.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto divide-y divide-line/60">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-coal/90 backdrop-blur-sm border-b border-line text-[10px] font-bold uppercase tracking-wider text-faint">
                    <tr>
                      <th className="py-2.5 px-3.5 w-12 text-center">Rank</th>
                      <th className="py-2.5 px-3.5">Nama Menu</th>
                      <th className="py-2.5 px-3.5 w-28">Kategori</th>
                      <th className="py-2.5 px-3.5 w-20 text-center">Qty</th>
                      <th className="py-2.5 px-3.5 text-right w-32">Total Omzet</th>
                      <th className="py-2.5 px-3.5 w-32 text-right">Kontribusi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40">
                    {summary.products.map((prod) => {
                      const isTop1 = prod.rank === 1;
                      const isTop2 = prod.rank === 2;
                      const isTop3 = prod.rank === 3;

                      return (
                        <tr
                          key={prod.name}
                          className="hover:bg-coal/50 transition-colors group"
                        >
                          {/* Peringkat */}
                          <td className="py-2.5 px-3.5 text-center font-display font-bold">
                            {isTop1 ? (
                              <span className="inline-flex size-6 items-center justify-center rounded-full bg-amber-400/20 text-amber-300 text-xs border border-amber-400/30">
                                🥇
                              </span>
                            ) : isTop2 ? (
                              <span className="inline-flex size-6 items-center justify-center rounded-full bg-zinc-400/20 text-zinc-300 text-xs border border-zinc-400/30">
                                🥈
                              </span>
                            ) : isTop3 ? (
                              <span className="inline-flex size-6 items-center justify-center rounded-full bg-amber-700/20 text-amber-600 text-xs border border-amber-700/30">
                                🥉
                              </span>
                            ) : (
                              <span className="text-faint tabular">#{prod.rank}</span>
                            )}
                          </td>

                          {/* Nama Menu */}
                          <td className="py-2.5 px-3.5 font-semibold text-cream group-hover:text-brand transition-colors">
                            {prod.name}
                          </td>

                          {/* Kategori */}
                          <td className="py-2.5 px-3.5">
                            <span className="inline-block rounded-md bg-surface px-2 py-0.5 text-[10px] text-sand border border-line">
                              {prod.category}
                            </span>
                          </td>

                          {/* Qty Terjual */}
                          <td className="py-2.5 px-3.5 text-center font-display font-bold tabular text-cream">
                            {prod.qty}
                          </td>

                          {/* Total Omzet Menu (Rp) */}
                          <td className="py-2.5 px-3.5 text-right font-display font-bold tabular text-amber-400">
                            {formatIDR(prod.revenue)}
                          </td>

                          {/* Persentase Kontribusi */}
                          <td className="py-2.5 px-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-14 h-1.5 rounded-full bg-coal overflow-hidden hidden sm:block">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-brand to-emerald-400"
                                  style={{ width: `${Math.min(100, prod.contributionPct * 2)}%` }}
                                />
                              </div>
                              <span className="font-display font-bold tabular text-sand text-[11px]">
                                {prod.contributionPct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
