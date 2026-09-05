"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Wallet, ReceiptText, PiggyBank, BanknoteArrowDown,
  BanknoteArrowUp, TriangleAlert, MessageCircleWarning, RefreshCcw, X, Loader2,
  CircleDollarSign, Radio, ArrowDownToLine, ArrowUpFromLine,
  Scale, CheckCircle2, ShieldAlert, FileSpreadsheet,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { RevenueChart, HourlyChart, TopProducts, PaymentDonut } from "@/components/analytics/Charts";
import ExportReportModal from "@/components/analytics/ExportReportModal";
import MenuEngineeringMatrix from "@/components/analytics/MenuEngineeringMatrix";
import CashMovementModal from "@/components/cash/CashMovementModal";
import type { AnalyticsSummary, ForecastItem } from "@/lib/types";
import { formatIDR, formatQty, formatTime } from "@/lib/format";

interface CashMovementDto {
  id: number; type: "in" | "out"; amount: number; note: string; userName: string; createdAt: string;
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [movements, setMovements] = useState<CashMovementDto[]>([]);
  const [cashOpen, setCashOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3800);
  };

  const load = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([
        fetch("/api/analytics/summary").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/cash-movements").then((r) => (r.ok ? r.json() : null)),
      ]);
      if (s) setSummary(s as AnalyticsSummary);
      if (m) setMovements((m as { movements: CashMovementDto[] }).movements);
      setLastSync(new Date());
    } catch {
      /* diam saat offline */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const waHref = useMemo(() => {
    if (!summary || summary.forecast.length === 0) return null;
    const lines = [
      "*BrewMetrics — Low-Stock AI Alert*", "",
      ...summary.forecast.slice(0, 6).map(
        (f) => `• ${f.name}: sisa *${formatQty(f.stockQty, f.unit)}* ≈ *${f.daysLeft} hari* (pakai ${formatQty(f.dailyUsage, f.unit)}/hari)`
      ),
      "", "Prediksi berbasis tren penjualan 14 hari terakhir.",
    ];
    return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
  }, [summary]);

  return (
    <AppShell allowedRoles={["owner", "manager"]}>
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 max-w-[1500px] w-full mx-auto">
        {/* ------------------------------ HEADER ------------------------------ */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-faint font-bold mb-1 flex items-center gap-2">
              Owner Cockpit
              <span className="inline-flex items-center gap-1.5 text-emerald-400 normal-case tracking-normal">
                <Radio className="size-3 animate-pulse-soft" /> Live sync
              </span>
            </p>
            <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">Analitik &amp; Arus Kas</h1>
            <p className="text-xs sm:text-sm text-sand mt-1">
              {summary
                ? `Diperbarui ${lastSync ? formatTime(lastSync) : ""} — margin kotor hari ini ${summary.today.margin}%`
                : "Memuat angka real-time…"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="btn-press flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-[13px] font-bold text-emerald-300 hover:bg-emerald-400/20"
              >
                <MessageCircleWarning className="size-4 shrink-0" />
                <span className="whitespace-nowrap">WA Alert ({summary?.forecast.length})</span>
              </a>
            )}
            <button
              onClick={() => setExportOpen(true)}
              className="btn-press flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-[13px] font-bold text-emerald-300 hover:bg-emerald-500/20"
            >
              <FileSpreadsheet className="size-4 shrink-0" />
              <span className="whitespace-nowrap">Ekspor Excel</span>
            </button>
            <button
              onClick={() => setCashOpen(true)}
              className="btn-press flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl bg-brand px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-[13px] font-bold text-coal shadow-[0_12px_30px_-12px] shadow-brand/70 hover:brightness-110"
            >
              <CircleDollarSign className="size-4 shrink-0" />
              <span className="whitespace-nowrap">Catat Kas</span>
            </button>
            <button
              onClick={load}
              className="btn-press grid size-9 sm:size-10 place-items-center rounded-xl border border-line bg-panel text-sand hover:text-cream shrink-0"
              title="Muat ulang"
            >
              <RefreshCcw className="size-4" />
            </button>
          </div>
        </div>

        {!summary ? (
          <div className="grid gap-2.5 sm:gap-3 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl border border-line bg-panel animate-pulse-soft" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        ) : (
          <>
            {/* ----------------- NOTIFIKASI SELISIH TUTUP SHIFT (VARIANCE) ----------------- */}
            {summary.latestShiftReport && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg ${
                  summary.latestShiftReport.variance === 0
                    ? "border-emerald-500/30 bg-emerald-950/25 text-emerald-300"
                    : summary.latestShiftReport.variance < 0
                      ? "border-red-500/40 bg-red-950/35 text-red-200 shadow-red-500/10"
                      : "border-amber-500/40 bg-amber-950/35 text-amber-200"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`grid size-10 place-items-center rounded-xl shrink-0 mt-0.5 ${
                      summary.latestShiftReport.variance === 0
                        ? "border border-emerald-400/40 bg-emerald-400/15 text-emerald-400"
                        : summary.latestShiftReport.variance < 0
                          ? "border border-red-400/40 bg-red-400/15 text-red-400 shadow-[0_0_16px_-2px] shadow-red-500/40 animate-pulse"
                          : "border border-amber-400/40 bg-amber-400/15 text-amber-400"
                    }`}
                  >
                    {summary.latestShiftReport.variance === 0 ? (
                      <CheckCircle2 className="size-5" />
                    ) : summary.latestShiftReport.variance < 0 ? (
                      <ShieldAlert className="size-5" />
                    ) : (
                      <TriangleAlert className="size-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          summary.latestShiftReport.variance === 0
                            ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                            : summary.latestShiftReport.variance < 0
                              ? "border-red-400/40 bg-red-400/10 text-red-300"
                              : "border-amber-400/40 bg-amber-400/10 text-amber-300"
                        }`}
                      >
                        {summary.latestShiftReport.variance === 0
                          ? "Tutup Shift: Kas Pas"
                          : summary.latestShiftReport.variance < 0
                            ? "Peringatan: Selisih Kurang (Shortage)"
                            : "Perhatian: Selisih Lebih (Overage)"}
                      </span>
                      <span className="text-xs text-faint">
                        {formatTime(summary.latestShiftReport.closedAt)} • Kasir:{" "}
                        <strong className="text-cream">{summary.latestShiftReport.cashierName}</strong>
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold mt-1">
                      {summary.latestShiftReport.variance === 0 ? (
                        <span>
                          Shift terakhir ditutup seimbang (Fisik laci = Hitungan sistem:{" "}
                          <strong>{formatIDR(summary.latestShiftReport.actualCash)}</strong>).
                        </span>
                      ) : summary.latestShiftReport.variance < 0 ? (
                        <span>
                          Terdapat kekurangan fisik sebesar{" "}
                          <strong className="text-red-300 font-display text-sm sm:text-base">
                            {formatIDR(Math.abs(summary.latestShiftReport.variance))}
                          </strong>{" "}
                          (Ekspektasi Sistem: {formatIDR(summary.latestShiftReport.expectedCash)}, Fisik di Laci:{" "}
                          {formatIDR(summary.latestShiftReport.actualCash)}).
                        </span>
                      ) : (
                        <span>
                          Terdapat kelebihan fisik sebesar{" "}
                          <strong className="text-amber-300 font-display text-sm sm:text-base">
                            +{formatIDR(summary.latestShiftReport.variance)}
                          </strong>{" "}
                          (Ekspektasi Sistem: {formatIDR(summary.latestShiftReport.expectedCash)}, Fisik di Laci:{" "}
                          {formatIDR(summary.latestShiftReport.actualCash)}).
                        </span>
                      )}
                    </p>
                    {summary.latestShiftReport.note && (
                      <p className="text-[11px] text-faint mt-0.5 italic">
                        Catatan kasir: &quot;{summary.latestShiftReport.note}&quot;
                      </p>
                    )}
                  </div>
                </div>

                <div className="sm:text-right shrink-0">
                  <span className="text-[10px] uppercase tracking-wider text-faint font-bold block">
                    Status Selisih
                  </span>
                  <span
                    className={`font-display text-lg font-bold tabular ${
                      summary.latestShiftReport.variance === 0
                        ? "text-emerald-400"
                        : summary.latestShiftReport.variance < 0
                          ? "text-red-400"
                          : "text-amber-300"
                    }`}
                  >
                    {summary.latestShiftReport.variance > 0 ? "+" : ""}
                    {formatIDR(summary.latestShiftReport.variance)}
                  </span>
                </div>
              </motion.div>
            )}

            {/* ------------------------------- KPI ------------------------------- */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3">
              <Kpi
                icon={Wallet}
                label="Pendapatan Hari Ini"
                value={formatIDR(summary.today.revenue)}
                accent="text-brand"
                badge={
                  summary.today.vsYesterdayPct !== 0
                    ? {
                        up: summary.today.vsYesterdayPct > 0,
                        text: `${summary.today.vsYesterdayPct > 0 ? "+" : ""}${summary.today.vsYesterdayPct}% vs kemarin`,
                      }
                    : undefined
                }
              />
              <Kpi
                icon={PiggyBank}
                label="Profit Kotor (setelah HPP)"
                value={formatIDR(summary.today.grossProfit)}
                accent="text-emerald-400"
                sub={`Margin ${summary.today.margin}% • HPP ${formatIDR(summary.today.hpp, true)}`}
              />
              <Kpi
                icon={ReceiptText}
                label="Transaksi"
                value={String(summary.today.orders)}
                accent="text-sky-300"
                sub={`Rata-rata struk ${formatIDR(summary.today.avgTicket)}`}
              />
              <Kpi
                icon={BanknoteArrowDown}
                label="Kas Masuk (non-penjualan)"
                value={formatIDR(summary.today.cashIn)}
                accent="text-emerald-300"
              />
              <Kpi
                icon={BanknoteArrowUp}
                label="Kas Keluar Operasional"
                value={formatIDR(summary.today.cashOut)}
                accent="text-red-300"
                sub={`Kas bersih ${formatIDR(summary.today.netCash)}`}
              />
            </div>

            {/* ---------------------------- CHART ROW ---------------------------- */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Card
                title="Pendapatan vs Profit — 30 Hari"
                subtitle="Tren bisnis dengan growth engine resep"
                className="xl:col-span-2"
              >
                <RevenueChart data={summary.daily} />
              </Card>

              <Card
                title="Low-Stock AI Alert"
                subtitle="Prediksi habis berdasarkan velocity"
                action={
                  <span className="rounded-full border border-red-400/40 bg-red-400/10 px-2.5 py-1 text-[10px] font-bold text-red-300">
                    {summary.forecast.filter((f) => f.severity === "critical").length} KRITIS
                  </span>
                }
              >
                <ForecastList items={summary.forecast} />
              </Card>
            </div>

            {/* ----------------- MENU ENGINEERING MATRIX (30 HARI) ----------------- */}
            <MenuEngineeringMatrix data={summary.menuEngineering} />

            {/* ----------------------------- GRID ROW ---------------------------- */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card title="Traffic Hari Ini" subtitle="Pendapatan per jam">
                <HourlyChart data={summary.hourly} />
              </Card>
              <Card title="Menu Terlaris" subtitle="14 hari terakhir">
                <TopProducts data={summary.topProducts} />
              </Card>
              <Card title="Metode Pembayaran" subtitle="Distribusi 30 hari">
                <PaymentDonut data={summary.paymentSplit} />
                <div className="mt-5 border-t border-line pt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-faint font-bold mb-3">Kesehatan Stok</p>
                  <div className="flex items-center gap-2">
                    <HealthPill count={summary.inventoryHealth.ok} cls="bg-emerald-400" label="aman" />
                    <HealthPill count={summary.inventoryHealth.low} cls="bg-amber-400" label="menipis" />
                    <HealthPill count={summary.inventoryHealth.out} cls="bg-red-400" label="habis" />
                  </div>
                  <p className="mt-3 text-[11px] text-faint">
                    Nilai bahan di gudang: <span className="text-brand font-bold tabular">{formatIDR(summary.inventoryHealth.totalValue)}</span>
                  </p>
                </div>
              </Card>
              <Card title="Transaksi Terbaru" subtitle="Real-time dari kasir">
                <div className="space-y-2 -mx-1">
                  {summary.recentOrders.slice(0, 6).map((o) => (
                    <div key={o.id} className="flex items-center gap-3 rounded-xl border border-line bg-coal px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold font-display tabular truncate">{o.orderNumber}</p>
                        <p className="text-[10.5px] text-faint">
                          {formatTime(o.createdAt)} • {o.itemCount} item • {o.cashierName.split(" ")[0]}
                        </p>
                      </div>
                      <p className="font-display text-[13px] font-bold tabular text-cream">{formatIDR(o.total)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* ---------------------------- CASH LEDGER ---------------------------- */}
            <Card title="Buku Kas Operasional" subtitle="Pemasukan & pengeluaran non-penjualan">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {movements.slice(0, 9).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl border border-line bg-coal px-3.5 py-3">
                    <div
                      className={`grid size-9 shrink-0 place-items-center rounded-lg border ${
                        m.type === "in"
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                          : "border-red-400/30 bg-red-400/10 text-red-400"
                      }`}
                    >
                      {m.type === "in" ? <ArrowDownToLine className="size-4" /> : <ArrowUpFromLine className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-cream truncate">{m.note}</p>
                      <p className="text-[10.5px] text-faint">
                        {formatTime(m.createdAt)} • {new Date(m.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} • {m.userName.split(" ")[0]}
                      </p>
                    </div>
                    <p className={`font-display text-[13px] font-bold tabular ${m.type === "in" ? "text-emerald-400" : "text-red-400"}`}>
                      {m.type === "in" ? "+" : "−"}{formatIDR(m.amount)}
                    </p>
                  </div>
                ))}
                {movements.length === 0 && (
                  <p className="text-sm text-faint py-6 md:col-span-2 xl:col-span-3 text-center">Belum ada catatan kas.</p>
                )}
              </div>
            </Card>

            {/* ------------------------- AUDIT TUTUP SHIFT ------------------------- */}
            <Card
              title="Audit Tutup Shift (Blind Z-Report)"
              subtitle="Rekap perbandingan uang fisik laci kasir vs hitungan sistem"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {(summary.recentShifts ?? []).map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col justify-between rounded-xl border border-line bg-coal p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Scale className="size-4 text-brand" />
                        <span className="font-semibold text-cream">Z-Report #{s.id}</span>
                      </div>
                      <span
                        className={`font-display font-bold px-2 py-0.5 rounded-md text-[11px] ${
                          s.variance === 0
                            ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/30"
                            : s.variance < 0
                              ? "bg-red-400/10 text-red-400 border border-red-400/30"
                              : "bg-amber-400/10 text-amber-400 border border-amber-400/30"
                        }`}
                      >
                        {s.variance > 0 ? "+" : ""}
                        {formatIDR(s.variance)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11.5px] border-y border-line/60 py-2">
                      <div>
                        <span className="text-faint block text-[10px]">Uang Fisik Kasir:</span>
                        <span className="font-semibold tabular text-cream">{formatIDR(s.actualCash)}</span>
                      </div>
                      <div>
                        <span className="text-faint block text-[10px]">Sistem (Expected):</span>
                        <span className="font-semibold tabular text-sand">{formatIDR(s.expectedCash)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-faint">
                      <span>
                        Kasir: <strong className="text-cream">{s.cashierName}</strong>
                      </span>
                      <span>
                        {new Date(s.closedAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        {formatTime(s.closedAt)}
                      </span>
                    </div>
                  </div>
                ))}
                {(!summary.recentShifts || summary.recentShifts.length === 0) && (
                  <p className="text-sm text-faint py-6 md:col-span-2 xl:col-span-3 text-center">
                    Belum ada riwayat tutup shift (Z-Report).
                  </p>
                )}
              </div>
            </Card>
          </>
        )}
      </div>

      <CashMovementModal
        open={cashOpen}
        onClose={() => setCashOpen(false)}
        onSaved={() => {
          setCashOpen(false);
          load();
        }}
        onSuccessToast={(msg) => showToast(msg)}
        onErrorToast={(msg) => showToast(msg)}
      />

      <ExportReportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onSuccessToast={(msg) => showToast(msg)}
        onErrorToast={(msg) => showToast(msg)}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border border-brand/40 bg-panel-2/90 backdrop-blur px-5 py-3 text-sm font-semibold text-cream shadow-ticket"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

/* -------------------------------- SUBVIEWS --------------------------------- */

function Kpi({
  icon: Icon, label, value, accent, sub, badge,
}: {
  icon: typeof Wallet; label: string; value: string; accent: string;
  sub?: string; badge?: { up: boolean; text: string };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-line bg-panel p-4 relative overflow-hidden group hover:border-line-2 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`grid size-10 place-items-center rounded-xl border border-line-2/50 bg-coal ${accent}`}>
          <Icon className="size-5" strokeWidth={1.9} />
        </div>
        {badge && (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
              badge.up
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                : "border-red-400/30 bg-red-400/10 text-red-400"
            }`}
          >
            {badge.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {badge.text}
          </span>
        )}
      </div>
      <p className="font-display text-xl lg:text-2xl font-bold tabular tracking-tight truncate">{value}</p>
      <p className="text-[10.5px] text-faint mt-1">{label}</p>
      {sub && <p className="text-[10.5px] text-sand mt-1 font-medium">{sub}</p>}
    </motion.div>
  );
}

function Card({
  title, subtitle, action, children, className = "",
}: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-panel p-5 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-display text-[15px] font-bold">{title}</h2>
          {subtitle && <p className="text-[11px] text-faint mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ForecastList({ items }: { items: ForecastItem[] }) {
  if (items.length === 0) {
    return (
      <div className="grid place-items-center py-12 text-center">
        <div className="grid size-14 place-items-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-400 mb-3">
          <PiggyBank className="size-6" />
        </div>
        <p className="text-sm font-semibold text-cream">Semua stok aman</p>
        <p className="text-xs text-faint mt-1">Tidak ada bahan yang diprediksi habis ≤ 5 hari.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 max-h-[290px] overflow-y-auto pr-1">
      {items.map((f, i) => {
        const critical = f.severity === "critical";
        const pct = Math.max(4, Math.min(100, (f.daysLeft / 5) * 100));
        return (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-xl border p-3.5 ${
              critical ? "border-red-400/40 bg-red-400/[0.07]" : "border-amber-400/30 bg-amber-400/[0.06]"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[12.5px] font-bold text-cream flex items-center gap-2 min-w-0">
                {critical && <TriangleAlert className="size-3.5 text-red-400 shrink-0" />}
                <span className="truncate">{f.name}</span>
              </p>
              <p className={`font-display text-lg font-bold tabular shrink-0 ${critical ? "text-red-300" : "text-amber-300"}`}>
                {f.daysLeft} <span className="text-[10px] font-semibold text-faint">hari</span>
              </p>
            </div>
            <div className="h-1.5 rounded-full bg-coal overflow-hidden mb-2">
              <div
                className={`h-full rounded-full ${critical ? "bg-red-400" : "bg-amber-400"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10.5px] text-faint">
              Sisa <span className="text-sand font-semibold">{formatQty(f.stockQty, f.unit)}</span> • velocity{" "}
              <span className="text-sand font-semibold">{formatQty(f.dailyUsage, f.unit)}/hari</span>
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

function HealthPill({ count, cls, label }: { count: number; cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-coal px-3 py-2">
      <span className={`size-2.5 rounded-full ${cls}`} />
      <span className="font-display text-sm font-bold tabular">{count}</span>
      <span className="text-[10px] text-faint">{label}</span>
    </span>
  );
}
