"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Wallet, ReceiptText, PiggyBank, BanknoteArrowDown,
  BanknoteArrowUp, TriangleAlert, MessageCircleWarning, RefreshCcw, X, Loader2,
  CircleDollarSign, Radio, RotateCcw, ArrowDownToLine, ArrowUpFromLine,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { RevenueChart, HourlyChart, TopProducts, PaymentDonut } from "@/components/analytics/Charts";
import type { AnalyticsSummary, ForecastItem } from "@/lib/types";
import { formatIDR, formatQty, formatTime } from "@/lib/format";

interface CashMovementDto {
  id: number; type: "in" | "out"; amount: number; note: string; userName: string; createdAt: string;
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [movements, setMovements] = useState<CashMovementDto[]>([]);
  const [cashOpen, setCashOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
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

  const resetDemo = async () => {
    if (!confirm("Reset seluruh data demo (transaksi, stok, kas) ke kondisi awal?")) return;
    setResetting(true);
    try {
      const res = await fetch("/api/admin/reseed", { method: "POST" });
      if (res.ok) {
        showToast("Data demo berhasil di-reset.");
        load();
      } else {
        showToast("Reset hanya bisa dilakukan oleh Owner.");
      }
    } finally {
      setResetting(false);
    }
  };

  return (
    <AppShell allowedRoles={["owner", "manager"]}>
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5 max-w-[1500px] w-full mx-auto">
        {/* ------------------------------ HEADER ------------------------------ */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-faint font-bold mb-1 flex items-center gap-2">
              Owner Cockpit
              <span className="inline-flex items-center gap-1.5 text-emerald-400 normal-case tracking-normal">
                <Radio className="size-3 animate-pulse-soft" /> Live sync
              </span>
            </p>
            <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">Analitik &amp; Arus Kas</h1>
            <p className="text-sm text-sand mt-1.5">
              {summary
                ? `Diperbarui ${lastSync ? formatTime(lastSync) : ""} — margin kotor hari ini ${summary.today.margin}%`
                : "Memuat angka real-time…"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="btn-press flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2.5 text-[13px] font-bold text-emerald-300 hover:bg-emerald-400/20"
              >
                <MessageCircleWarning className="size-4" />
                WA Alert ({summary?.forecast.length})
              </a>
            )}
            <button
              onClick={() => setCashOpen(true)}
              className="btn-press flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-bold text-coal shadow-[0_12px_30px_-12px] shadow-brand/70 hover:brightness-110"
            >
              <CircleDollarSign className="size-4" />
              Catat Kas
            </button>
            <button
              onClick={load}
              className="btn-press grid size-10 place-items-center rounded-xl border border-line bg-panel text-sand hover:text-cream"
              title="Muat ulang"
            >
              <RefreshCcw className="size-4" />
            </button>
            <button
              onClick={resetDemo}
              disabled={resetting}
              className="btn-press grid size-10 place-items-center rounded-xl border border-line bg-panel text-faint hover:text-red-400 hover:border-red-400/30 disabled:opacity-50"
              title="Reset data demo"
            >
              {resetting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            </button>
          </div>
        </div>

        {!summary ? (
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl border border-line bg-panel animate-pulse-soft" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        ) : (
          <>
            {/* ------------------------------- KPI ------------------------------- */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
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
          </>
        )}
      </div>

      <CashModal
        open={cashOpen}
        onClose={() => setCashOpen(false)}
        onSaved={() => {
          setCashOpen(false);
          showToast("Catatan kas tersimpan.");
          load();
        }}
        onError={(msg) => showToast(msg)}
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

/* -------------------------------- CASH MODAL -------------------------------- */

function CashModal({
  open, onClose, onSaved, onError,
}: {
  open: boolean; onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
  const [type, setType] = useState<"in" | "out">("out");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setType("out");
      setAmount("");
      setNote("");
    }
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/cash-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount: Number(amount), note }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? "Gagal menyimpan.");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-coal/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-line-2 bg-panel-2 shadow-ticket p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <p className="font-display text-lg font-bold">Catat Kas</p>
              <button onClick={onClose} className="btn-press grid size-8 place-items-center rounded-lg border border-line bg-coal text-faint hover:text-cream">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setType("in")}
                  className={`btn-press flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold ${
                    type === "in" ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300" : "border-line bg-coal text-sand"
                  }`}
                >
                  <ArrowDownToLine className="size-4" /> Kas Masuk
                </button>
                <button
                  onClick={() => setType("out")}
                  className={`btn-press flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold ${
                    type === "out" ? "border-red-400/60 bg-red-400/10 text-red-300" : "border-line bg-coal text-sand"
                  }`}
                >
                  <ArrowUpFromLine className="size-4" /> Kas Keluar
                </button>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-faint">Nominal (Rp)</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                  min={0}
                  autoFocus
                  placeholder="0"
                  className="input-dark tabular font-display text-lg font-bold"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-faint">Catatan</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="cth: Beli es batu & galon"
                  className="input-dark"
                />
              </label>
              <button
                onClick={save}
                disabled={saving || !amount}
                className="btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-display text-sm font-bold text-coal hover:brightness-110 disabled:opacity-50"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Simpan ke Buku Kas
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
