"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale, X, Loader2, CheckCircle2, AlertTriangle, AlertCircle, Printer,
  LogOut, ArrowRight, Banknote, FileSpreadsheet, RotateCcw, ChevronDown,
} from "lucide-react";
import { formatIDR, formatTime } from "@/lib/format";
import type { ShiftReportDto } from "@/lib/types";
import SalesSummarySection from "@/components/analytics/SalesSummarySection";

export default function CloseShiftModal({
  open,
  cashierName = "Kasir",
  onClose,
  onShiftClosed,
}: {
  open: boolean;
  cashierName?: string;
  onClose: () => void;
  onShiftClosed: (report: ShiftReportDto) => void;
}) {
  const [phase, setPhase] = useState<"input" | "loading" | "result">("input");
  const [actualCash, setActualCash] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [report, setReport] = useState<ShiftReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPhase("input");
      setActualCash("");
      setNote("");
      setReport(null);
      setError(null);
    }
  }, [open]);

  // Tombol pecahan uang cepat untuk mempermudah hitungan laci
  const addDenom = (amount: number) => {
    setActualCash((prev) => {
      const current = Number(prev) || 0;
      return String(current + amount);
    });
  };

  const handleSubmit = async () => {
    if (actualCash === "" || isNaN(Number(actualCash))) {
      setError("Masukkan total uang tunai fisik yang ada di laci kasir.");
      return;
    }

    setPhase("loading");
    setError(null);

    try {
      const res = await fetch("/api/shifts/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualCash: Number(actualCash),
          note: note.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal memproses tutup shift.");
        setPhase("input");
        return;
      }

      setReport(data.report);
      setPhase("result");
      onShiftClosed(data.report);
    } catch {
      setError("Terjadi kendala jaringan saat menghubungi server.");
      setPhase("input");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  const handlePrintZReport = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-coal/80 backdrop-blur-md p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="w-full max-w-xl sm:max-w-2xl rounded-3xl border border-line-2 bg-panel-2 p-5 sm:p-7 shadow-[0_24px_54px_rgba(0,0,0,0.85)] max-h-[92dvh] overflow-y-auto"
          >
            {/* ===================================================================
                FASE 1: BLIND INPUT KAS FISIK DI LACI
               =================================================================== */}
            {phase !== "result" ? (
              <div>
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="grid size-12 place-items-center rounded-2xl border border-amber-400/40 bg-amber-400/15 text-brand shadow-[0_0_24px_-4px] shadow-brand/40">
                      <Scale className="size-6" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg sm:text-xl font-bold text-cream">
                        Tutup Shift (Blind Z-Report)
                      </h2>
                      <p className="text-xs text-faint mt-0.5">
                        Kasir: <span className="text-sand font-semibold">{cashierName}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="btn-press grid size-8 place-items-center rounded-xl border border-line bg-coal text-faint hover:text-cream"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* Banner Edukasi Blind Count */}
                <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3.5 mb-5 flex items-start gap-3 text-xs text-amber-200/90 leading-relaxed">
                  <AlertCircle className="size-4 text-brand shrink-0 mt-0.5" />
                  <p>
                    <strong>Sistem Anti-Kecurangan Blind Z-Report:</strong> Hitung seluruh uang tunai
                    fisik di laci kasir dan input nilainya. Angka sistem sengaja disembunyikan sampai Anda
                    mengirimkan laporan ini untuk mencegah manipulasi.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-400/40 bg-red-400/15 p-3 text-xs font-semibold text-red-200">
                    <AlertTriangle className="size-4 shrink-0 text-red-400" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Input Utama Uang Fisik */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-2">
                      Total Uang Tunai Fisik di Laci
                    </label>
                    <div className="flex items-center gap-3 rounded-2xl border border-line-2 bg-coal px-4 py-3.5 focus-within:border-brand/50 focus-within:ring-2 focus-within:ring-brand/20 transition">
                      <span className="font-display text-lg font-bold text-faint">Rp</span>
                      <input
                        type="number"
                        min={0}
                        value={actualCash}
                        onChange={(e) => setActualCash(e.target.value)}
                        placeholder="0"
                        autoFocus
                        className="w-full bg-transparent font-display text-2xl font-bold tabular outline-none text-cream placeholder:text-line-2"
                      />
                      {actualCash && (
                        <button
                          type="button"
                          onClick={() => setActualCash("")}
                          className="text-xs text-faint hover:text-red-400 font-bold px-2 py-1"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tombol Cepat Pecahan Uang Rupiah */}
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-faint mb-2">
                      + Tambah Pecahan Cepat
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[100000, 50000, 20000, 10000, 5000, 2000, 1000].map((denom) => (
                        <button
                          key={denom}
                          type="button"
                          onClick={() => addDenom(denom)}
                          className="btn-press rounded-xl border border-line bg-panel py-2 text-center text-xs font-bold text-sand hover:text-cream hover:border-brand/40"
                        >
                          +{denom >= 1000 ? `${denom / 1000}rb` : denom}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setActualCash("")}
                        className="btn-press rounded-xl border border-line bg-panel py-2 text-center text-xs font-bold text-red-400 hover:bg-red-400/10"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>

                  {/* Catatan Shift */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-2">
                      Catatan Serah Terima / Kasir (Opsional)
                    </label>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="cth: Serah terima laci shift pagi ke Rizky, modal awal Rp 200rb"
                      className="input-dark text-xs sm:text-sm"
                    />
                  </div>

                  {/* Tombol Submit */}
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={phase === "loading" || actualCash === ""}
                    className="btn-press flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand py-4 font-display text-sm font-bold text-coal shadow-[0_16px_40px_-12px] shadow-brand/70 hover:brightness-110 disabled:opacity-40 disabled:shadow-none mt-2"
                  >
                    {phase === "loading" ? (
                      <>
                        <Loader2 className="size-5 animate-spin" />
                        <span>Menganalisis &amp; Membandingkan Kas Sistem…</span>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="size-4.5" />
                        <span>Kunci &amp; Terbitkan Blind Z-Report</span>
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* ===================================================================
                  FASE 2: HASIL Z-REPORT DENGAN PERHITUNGAN VARIANCE
                 =================================================================== */
              report && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-4 border-b border-line">
                    <div>
                      <span className="inline-block rounded-full border border-brand/40 bg-brand/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand mb-1">
                        Z-Report Resmi #{report.id}
                      </span>
                      <h2 className="font-display text-xl font-bold text-cream">Rekap Tutup Shift</h2>
                      <p className="text-xs text-faint mt-0.5">
                        {formatTime(report.openedAt)} — {formatTime(report.closedAt)} • Kasir:{" "}
                        <strong className="text-sand">{report.cashierName}</strong>
                      </p>
                    </div>
                    <button
                      onClick={onClose}
                      className="btn-press grid size-8 place-items-center rounded-xl border border-line bg-coal text-faint hover:text-cream"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {/* KARTU STATUS VARIANCE (SELISIH KAS) */}
                  <div
                    className={`rounded-2xl border p-4.5 text-center ${
                      report.variance === 0
                        ? "border-emerald-400/40 bg-emerald-950/40 text-emerald-300"
                        : report.variance < 0
                          ? "border-red-400/50 bg-red-950/40 text-red-200 shadow-[0_0_30px_-6px] shadow-red-500/30"
                          : "border-amber-400/50 bg-amber-950/40 text-amber-200"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2 mb-1">
                      {report.variance === 0 ? (
                        <CheckCircle2 className="size-5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className={`size-5 ${report.variance < 0 ? "text-red-400" : "text-amber-400"}`} />
                      )}
                      <p className="font-display text-xs font-bold uppercase tracking-widest">
                        {report.variance === 0
                          ? "Kas Laci Seimbang (Match)"
                          : report.variance < 0
                            ? "Peringatan: Kas Laci Kurang (Shortage)"
                            : "Kas Laci Berlebih (Overage)"}
                      </p>
                    </div>

                    <p
                      className={`font-display text-3xl font-bold tabular tracking-tight my-1 ${
                        report.variance === 0
                          ? "text-emerald-400"
                          : report.variance < 0
                            ? "text-red-400"
                            : "text-amber-300"
                      }`}
                    >
                      {report.variance > 0 ? "+" : ""}
                      {formatIDR(report.variance)}
                    </p>

                    <p className="text-xs opacity-80 mt-1">
                      {report.variance === 0
                        ? "Uang tunai fisik di laci cocok 100% dengan total transaksi sistem."
                        : report.variance < 0
                          ? `Terdapat selisih minus sebesar ${formatIDR(Math.abs(report.variance))}. Laporan ini otomatis tercatat di dashboard Owner.`
                          : `Uang fisik di laci melebihi hitungan sistem sebesar ${formatIDR(report.variance)}.`}
                    </p>
                  </div>

                  {/* RINCIAN KOMPARASI KAS & NON-TUNAI */}
                  <div className="rounded-2xl border border-line bg-coal p-4 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-line">
                      <span className="text-faint">Uang Fisik Diinput (Blind Count):</span>
                      <span className="font-display text-sm font-bold tabular text-cream">
                        {formatIDR(report.actualCash)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-line">
                      <span className="text-faint">Ekspektasi Kas Sistem (Database):</span>
                      <span className="font-display text-sm font-bold tabular text-sand">
                        {formatIDR(report.expectedCash)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <span className="text-faint">Penjualan Tunai ({report.cashOrders} transaksi):</span>
                      <span className="tabular font-semibold text-cream">
                        {formatIDR(report.expectedCash)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-faint">Penjualan QRIS:</span>
                      <span className="tabular font-semibold text-sky-300">
                        {formatIDR(report.qrisTotal)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-faint">Penjualan Kartu Debit:</span>
                      <span className="tabular font-semibold text-purple-300">
                        {formatIDR(report.debitTotal)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-line">
                      <span className="text-faint font-bold">Total Seluruh Transaksi:</span>
                      <span className="tabular font-display font-bold text-sm text-brand">
                        {report.totalOrders} Pesanan ({formatIDR(report.expectedCash + report.qrisTotal + report.debitTotal)})
                      </span>
                    </div>

                    {report.note && (
                      <div className="pt-2 border-t border-line text-[11px] text-faint">
                        <span className="font-semibold text-sand">Catatan:</span> {report.note}
                      </div>
                    )}
                  </div>

                  {/* AUDIT MULTI-CHANNEL & PENJUALAN PRODUK SHIFT */}
                  <details className="group rounded-2xl border border-line bg-coal/50 overflow-hidden">
                    <summary className="flex items-center justify-between p-3.5 cursor-pointer text-xs font-bold text-sand hover:text-cream select-none bg-surface/40">
                      <span>Rincian Multi-Channel &amp; Penjualan Menu (Shift Hari Ini)</span>
                      <ChevronDown className="size-4 group-open:rotate-180 transition-transform text-faint" />
                    </summary>
                    <div className="p-3.5 pt-2 border-t border-line/50">
                      <SalesSummarySection compact />
                    </div>
                  </details>

                  {/* TOMBOL AKSI AKHIR */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handlePrintZReport}
                      className="btn-press flex items-center justify-center gap-2 rounded-2xl border border-line-2 bg-coal py-3.5 font-display text-xs sm:text-sm font-bold text-sand hover:text-cream hover:border-brand/50"
                    >
                      <Printer className="size-4 text-brand" />
                      <span>Cetak Z-Report</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="btn-press flex items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-display text-xs sm:text-sm font-bold text-coal hover:brightness-110 shadow-md shadow-brand/40"
                    >
                      <LogOut className="size-4" />
                      <span>Selesai &amp; Ganti Shift</span>
                    </button>
                  </div>

                  {/* ELEMEN THERMAL PRINT KHUSUS Z-REPORT (Hanya muncul saat window.print()) */}
                  <div
                    id="thermal-z-report"
                    className="thermal-receipt hidden print:block text-black bg-white font-mono text-[11px] leading-tight w-[72mm] max-w-full p-2 mx-auto"
                    style={{
                      color: "#000000",
                      backgroundColor: "#ffffff",
                      fontFamily: "'Courier New', Courier, monospace",
                    }}
                  >
                    <div className="text-center pb-2">
                      <h1 className="text-[14px] font-black uppercase">BREWMETRICS</h1>
                      <p className="text-[10px] font-bold uppercase tracking-wider">
                        *** LAPORAN Z-REPORT (TUTUP SHIFT) ***
                      </p>
                      <p className="text-[9px] text-gray-600">Jl. Metro Tanjung Bunga No. 8, Makassar</p>
                    </div>

                    <div className="border-b border-dashed border-black my-1" />

                    <div className="text-[9.5px] space-y-0.5 py-1">
                      <div className="flex justify-between">
                        <span>Report ID:</span>
                        <span className="font-bold">#ZR-{report.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Kasir:</span>
                        <span className="font-bold capitalize">{report.cashierName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Buka Shift:</span>
                        <span>{new Date(report.openedAt).toLocaleString("id-ID")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tutup Shift:</span>
                        <span>{new Date(report.closedAt).toLocaleString("id-ID")}</span>
                      </div>
                    </div>

                    <div className="border-b border-dashed border-black my-1" />

                    <div className="text-[10px] space-y-1 py-1">
                      <div className="flex justify-between">
                        <span>Total Transaksi:</span>
                        <span>{report.totalOrders} struk</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Transaksi Tunai:</span>
                        <span>{report.cashOrders} struk</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Penjualan QRIS:</span>
                        <span>{formatIDR(report.qrisTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Penjualan Debit:</span>
                        <span>{formatIDR(report.debitTotal)}</span>
                      </div>
                    </div>

                    <div className="border-b border-dashed border-black my-1" />

                    <div className="text-[10.5px] space-y-1 py-1">
                      <div className="flex justify-between">
                        <span>Kas Sistem (Expected):</span>
                        <span>{formatIDR(report.expectedCash)}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Kas Fisik (Actual):</span>
                        <span>{formatIDR(report.actualCash)}</span>
                      </div>
                      <div className="flex justify-between font-black text-[12px] pt-1">
                        <span>SELISIH (VARIANCE):</span>
                        <span>
                          {report.variance > 0 ? "+" : ""}
                          {formatIDR(report.variance)}
                        </span>
                      </div>
                      <div className="text-center text-[9px] font-bold uppercase pt-1">
                        {report.variance === 0
                          ? "(KAS PAS / BALANCE)"
                          : report.variance < 0
                            ? "(KAS KURANG / SHORTAGE)"
                            : "(KAS LEBIH / OVERAGE)"}
                      </div>
                    </div>

                    <div className="border-b border-dashed border-black my-1" />

                    {report.note && (
                      <div className="text-[9px] py-1 text-gray-700">
                        <span>Catatan: {report.note}</span>
                      </div>
                    )}

                    <div className="text-center pt-2 pb-1 text-[8.5px] text-gray-600">
                      <p>Tanda Tangan Kasir: ___________________</p>
                      <p className="pt-2">Tanda Tangan Supervisor: _______________</p>
                      <p className="pt-2">BrewMetrics POS Anti-Fraud Audit System</p>
                    </div>
                  </div>
                </div>
              )
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
