"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet,
  Calendar,
  X,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";

interface ExportReportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccessToast?: (msg: string) => void;
  onErrorToast?: (msg: string) => void;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

type PresetType = "today" | "last7days" | "thisMonth" | "custom";

export default function ExportReportModal({
  open,
  onClose,
  onSuccessToast,
  onErrorToast,
}: ExportReportModalProps) {
  const today = new Date();
  const todayStr = toDateInputValue(today);

  const [activePreset, setActivePreset] = useState<PresetType>("today");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [downloading, setDownloading] = useState(false);

  // Fungsi helper untuk menerapkan filter preset
  const handleSelectPreset = (preset: PresetType) => {
    setActivePreset(preset);
    const now = new Date();

    if (preset === "today") {
      const d = toDateInputValue(now);
      setStartDate(d);
      setEndDate(d);
    } else if (preset === "last7days") {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      setStartDate(toDateInputValue(past));
      setEndDate(toDateInputValue(now));
    } else if (preset === "thisMonth") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(toDateInputValue(startOfMonth));
      setEndDate(toDateInputValue(endOfMonth));
    }
  };

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      onErrorToast?.("Pilih rentang tanggal awal dan akhir.");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      onErrorToast?.("Tanggal awal tidak boleh melampaui tanggal akhir.");
      return;
    }

    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (activePreset !== "custom") {
        params.set("preset", activePreset);
      }
      params.set("startDate", startDate);
      params.set("endDate", endDate);

      const res = await fetch(`/api/reports/export?${params.toString()}`);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Gagal mengunduh file Excel laporan.");
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      // Ambil nama file dari response header atau gunakan fallback
      const cd = res.headers.get("Content-Disposition");
      let filename = `Laporan_Penjualan_${startDate}_sd_${endDate}.xlsx`;
      if (cd && cd.includes("filename=")) {
        filename = cd.split("filename=")[1].replace(/["']/g, "").trim();
      }

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      onSuccessToast?.("File Excel laporan penjualan berhasil diunduh.");
      onClose();
    } catch (err: any) {
      console.error("Export download error:", err);
      onErrorToast?.(err.message || "Terjadi gangguan saat mengunduh laporan.");
    } finally {
      setDownloading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-lg rounded-3xl border border-line bg-panel p-6 sm:p-7 shadow-ticket overflow-hidden"
        >
          {/* Accent Top Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand via-emerald-400 to-amber-500" />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 grid size-8 place-items-center rounded-xl text-faint hover:bg-coal hover:text-cream transition-colors"
          >
            <X className="size-4" />
          </button>

          {/* Header */}
          <div className="flex items-start gap-3.5 mb-6">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <FileSpreadsheet className="size-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-cream">
                Ekspor Laporan Penjualan
              </h2>
              <p className="text-xs text-sand mt-0.5 leading-relaxed">
                Unduh rekapitulasi data penjualan, PB1, Service Charge, HPP, dan
                Profit bersih dalam spreadsheet Excel (.xlsx).
              </p>
            </div>
          </div>

          <form onSubmit={handleDownload} className="space-y-5">
            {/* Tombol Preset Filter */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-sand mb-2.5 flex items-center gap-1.5">
                <Clock className="size-3.5 text-brand" />
                Pilihan Periode Waktu
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectPreset("today")}
                  className={`btn-press py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                    activePreset === "today"
                      ? "border-brand bg-brand/15 text-brand shadow-sm"
                      : "border-line bg-coal/60 text-sand hover:text-cream hover:bg-coal"
                  }`}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreset("last7days")}
                  className={`btn-press py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                    activePreset === "last7days"
                      ? "border-brand bg-brand/15 text-brand shadow-sm"
                      : "border-line bg-coal/60 text-sand hover:text-cream hover:bg-coal"
                  }`}
                >
                  7 Hari Terakhir
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreset("thisMonth")}
                  className={`btn-press py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                    activePreset === "thisMonth"
                      ? "border-brand bg-brand/15 text-brand shadow-sm"
                      : "border-line bg-coal/60 text-sand hover:text-cream hover:bg-coal"
                  }`}
                >
                  Bulan Ini
                </button>
              </div>
            </div>

            {/* Pemilih Tanggal Kustom (startDate & endDate) */}
            <div className="rounded-2xl border border-line bg-coal/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-cream flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-sand" />
                  Rentang Tanggal
                </span>
                {activePreset !== "custom" && (
                  <span className="text-[10px] text-faint bg-panel px-2 py-0.5 rounded-md border border-line">
                    Preset aktif
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-faint mb-1">
                    Dari Tanggal
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setActivePreset("custom");
                    }}
                    className="w-full rounded-xl border border-line bg-panel px-3 py-2 text-xs text-cream outline-none focus:border-brand transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-faint mb-1">
                    Sampai Tanggal
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setActivePreset("custom");
                    }}
                    className="w-full rounded-xl border border-line bg-panel px-3 py-2 text-xs text-cream outline-none focus:border-brand transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Rincian Kolom yang Disertakan */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-3.5 text-xs text-emerald-300 flex items-start gap-2.5">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed text-[11px]">
                <strong className="font-semibold text-emerald-200">
                  Data yang diekspor memuat:
                </strong>{" "}
                Waktu Transaksi, No Order, Kasir, Metode Bayar, Subtotal, PB1,
                Service Charge, Total Omzet, Total HPP, Profit, dan{" "}
                <strong className="text-emerald-100 underline">
                  baris total rekapitulasi di akhir tabel
                </strong>
                .
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={downloading}
                className="btn-press rounded-xl border border-line bg-coal px-4 py-2.5 text-xs font-semibold text-sand hover:text-cream hover:bg-panel"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={downloading}
                className="btn-press flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-coal shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Menyiapkan Excel…</span>
                  </>
                ) : (
                  <>
                    <Download className="size-4" />
                    <span>Unduh Excel (.xlsx)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
