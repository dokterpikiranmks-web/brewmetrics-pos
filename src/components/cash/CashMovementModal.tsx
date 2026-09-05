"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleDollarSign,
  Tag,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { formatIDR } from "@/lib/format";

interface CashMovementModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  onSuccessToast?: (msg: string) => void;
  onErrorToast?: (msg: string) => void;
}

const OUT_PRESETS = [
  "Beli Bahan Darurat",
  "Air Galon & Gas",
  "Es Batu Darurat",
  "Perlengkapan / ATK",
  "Operasional Lainnya",
];

const IN_PRESETS = [
  "Tambah Kas Kecil (Modal Awal)",
  "Setoran Tambahan",
  "Pengembalian Petty Cash",
  "Pendapatan Lainnya",
];

const QUICK_AMOUNTS = [10000, 20000, 50000, 100000];

export default function CashMovementModal({
  open,
  onClose,
  onSaved,
  onSuccessToast,
  onErrorToast,
}: CashMovementModalProps) {
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

  const handleQuickAddAmount = (add: number) => {
    const current = Number(amount) || 0;
    setAmount(String(current + add));
  };

  const handleSelectPreset = (presetText: string) => {
    setNote(presetText);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Math.round(Number(amount));
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      onErrorToast?.("Nominal uang harus lebih dari 0.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/cash-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          amount: numAmount,
          note: note.trim() || (type === "out" ? "Kas Keluar Operasional" : "Kas Masuk Operasional"),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        onErrorToast?.(data.error || "Gagal mencatat transaksi kas.");
        return;
      }

      onSuccessToast?.(
        type === "out"
          ? `Kas keluar sebesar ${formatIDR(numAmount)} berhasil dicatat.`
          : `Kas masuk sebesar ${formatIDR(numAmount)} berhasil dicatat.`
      );
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Cash movement error:", err);
      onErrorToast?.("Koneksi server terputus saat menyimpan mutasi kas.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const currentPresets = type === "out" ? OUT_PRESETS : IN_PRESETS;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !saving && onClose()}
          className="absolute inset-0 bg-coal/75 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md rounded-3xl border border-line-2 bg-panel-2 p-6 sm:p-7 shadow-ticket overflow-hidden"
        >
          {/* Accent Line */}
          <div
            className={`absolute top-0 left-0 right-0 h-1 transition-colors duration-300 ${
              type === "in" ? "bg-emerald-400" : "bg-red-400"
            }`}
          />

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div
                className={`grid size-10 place-items-center rounded-2xl border ${
                  type === "in"
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                    : "border-red-400/40 bg-red-400/10 text-red-300"
                }`}
              >
                <CircleDollarSign className="size-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-cream">
                  Catat Kas Operasional
                </h2>
                <p className="text-[11px] text-faint">
                  Buku kas kecil &amp; petty cash harian outlet
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn-press grid size-8 place-items-center rounded-xl border border-line bg-coal text-faint hover:text-cream transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Toggle Tipe Kas (Masuk vs Keluar) */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl border border-line bg-coal/70">
              <button
                type="button"
                onClick={() => setType("out")}
                className={`btn-press flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
                  type === "out"
                    ? "border border-red-400/50 bg-red-500/20 text-red-200 shadow-sm"
                    : "text-sand hover:text-cream"
                }`}
              >
                <ArrowUpFromLine className="size-4" />
                <span>Kas Keluar (Petty)</span>
              </button>

              <button
                type="button"
                onClick={() => setType("in")}
                className={`btn-press flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
                  type === "in"
                    ? "border border-emerald-400/50 bg-emerald-500/20 text-emerald-200 shadow-sm"
                    : "text-sand hover:text-cream"
                }`}
              >
                <ArrowDownToLine className="size-4" />
                <span>Kas Masuk (Modal)</span>
              </button>
            </div>

            {/* Input Nominal */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-faint">
                  Nominal Uang (Rp) <span className="text-brand">*</span>
                </label>
                {amount && (
                  <span className="text-xs font-bold text-brand tabular">
                    {formatIDR(Number(amount) || 0)}
                  </span>
                )}
              </div>
              <input
                type="number"
                min="1"
                step="1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                autoFocus
                className="w-full rounded-2xl border border-line bg-coal px-4 py-3 text-lg font-bold tabular text-cream placeholder:text-faint focus:border-brand focus:outline-none transition-colors"
                required
              />

              {/* Quick Nominal Chips */}
              <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5">
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleQuickAddAmount(amt)}
                    className="btn-press px-2.5 py-1 rounded-lg border border-line bg-coal/50 text-[11px] font-semibold text-sand hover:text-cream hover:bg-coal whitespace-nowrap"
                  >
                    +{amt >= 1000 ? `${amt / 1000}k` : amt}
                  </button>
                ))}
                {amount && (
                  <button
                    type="button"
                    onClick={() => setAmount("")}
                    className="btn-press px-2 py-1 rounded-lg text-[10px] text-faint hover:text-red-400 ml-auto whitespace-nowrap"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Kategori Cepat (Presets) */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-faint mb-1.5 flex items-center gap-1.5">
                <Tag className="size-3 text-sand" /> Kategori / Keperluan Cepat
              </label>
              <div className="flex flex-wrap gap-1.5">
                {currentPresets.map((presetText) => (
                  <button
                    key={presetText}
                    type="button"
                    onClick={() => handleSelectPreset(presetText)}
                    className={`btn-press px-2.5 py-1 rounded-xl text-[11px] font-medium border transition-colors ${
                      note === presetText
                        ? "border-brand bg-brand/15 text-brand"
                        : "border-line bg-coal/40 text-sand hover:text-cream hover:bg-coal"
                    }`}
                  >
                    {presetText}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Keterangan / Catatan Bebas */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-faint mb-1.5">
                Keterangan / Rincian Tambahan
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  type === "out"
                    ? "cth: Beli 2 galon air & gas 3kg"
                    : "cth: Tambahan modal receh uang kembalian"
                }
                className="w-full rounded-2xl border border-line bg-coal px-4 py-2.5 text-xs text-cream placeholder:text-faint focus:border-brand focus:outline-none transition-colors"
              />
            </div>

            {/* Callout Penjelasan Integrasi Tutup Shift */}
            <div
              className={`rounded-2xl border p-3 text-xs flex items-start gap-2.5 ${
                type === "out"
                  ? "border-red-500/20 bg-red-950/20 text-red-200"
                  : "border-emerald-500/20 bg-emerald-950/20 text-emerald-200"
              }`}
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5 opacity-80" />
              <p className="text-[11px] leading-relaxed">
                {type === "out" ? (
                  <>
                    <strong className="font-semibold text-red-100">Otomatis Terpotong:</strong> Kas
                    keluar ini akan mengurangi estimasi saldo uang tunai fisik saat kasir melakukan{" "}
                    <span className="underline decoration-red-400/50 font-medium">Tutup Shift (Z-Report)</span>{" "}
                    dan langsung terakumulasi di dashboard Analitik.
                  </>
                ) : (
                  <>
                    <strong className="font-semibold text-emerald-100">Otomatis Ditambahkan:</strong> Kas
                    masuk ini akan menambah estimasi saldo uang tunai fisik yang harus disetorkan saat kasir{" "}
                    <span className="underline decoration-emerald-400/50 font-medium">Tutup Shift (Z-Report)</span>.
                  </>
                )}
              </p>
            </div>

            {/* Tombol Aksi */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="btn-press rounded-xl border border-line bg-coal px-4 py-2.5 text-xs font-semibold text-sand hover:text-cream"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={saving || !amount || Number(amount) <= 0}
                className={`btn-press flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-coal shadow-lg transition-all disabled:opacity-40 ${
                  type === "out"
                    ? "bg-red-400 hover:bg-red-300 shadow-red-500/20"
                    : "bg-emerald-400 hover:bg-emerald-300 shadow-emerald-500/20"
                }`}
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Menyimpan Kas…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    <span>{type === "out" ? "Simpan Kas Keluar" : "Simpan Kas Masuk"}</span>
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
