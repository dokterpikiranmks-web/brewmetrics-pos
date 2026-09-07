"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote,
  QrCode,
  CreditCard,
  Building2,
  Copy,
  Check,
  CheckCircle2,
  X,
  Loader2,
  Printer,
  CloudOff,
  ArrowRight,
  Plus,
  Sparkles,
  Layers,
  Trash2,
  AlertCircle,
  Split,
} from "lucide-react";
import type { OrderReceipt, StoreSettingDto, PaymentBreakdownItem } from "@/lib/types";
import { formatIDR, formatTime } from "@/lib/format";
import ReceiptPrint from "./ReceiptPrint";

export type Method = "cash" | "qris" | "debit" | "transfer" | "split";

const METHODS: { id: "cash" | "qris" | "debit" | "transfer"; label: string; icon: typeof Banknote; desc: string }[] = [
  { id: "cash", label: "Tunai", icon: Banknote, desc: "Hitung kembalian otomatis" },
  { id: "qris", label: "QRIS", icon: QrCode, desc: "Scan & lunas instan" },
  { id: "debit", label: "Debit", icon: CreditCard, desc: "Gesek kartu EDC" },
  { id: "transfer", label: "Transfer Bank", icon: Building2, desc: "BCA 1234-567-890" },
];

export default function PaymentModal({
  open,
  total,
  offline,
  storeSettings,
  onClose,
  onSubmit,
  onDone,
}: {
  open: boolean;
  total: number;
  offline: boolean;
  storeSettings?: StoreSettingDto | null;
  onClose: () => void;
  onSubmit: (
    method: Method,
    tendered: number,
    paymentReference?: string,
    paymentBreakdown?: PaymentBreakdownItem[]
  ) => Promise<OrderReceipt | null>;
  onDone: () => void;
}) {
  // Mode Pembayaran: "single" (Tunggal) atau "split" (Multi-Tender)
  const [paymentMode, setPaymentMode] = useState<"single" | "split">("single");

  // Single Mode State
  const [method, setMethod] = useState<"cash" | "qris" | "debit" | "transfer">("cash");
  const [tendered, setTendered] = useState<number>(total);
  const [paymentReference, setPaymentReference] = useState("");

  // Split (Multi-Tender) Mode State
  const [splitItems, setSplitItems] = useState<PaymentBreakdownItem[]>([
    { method: "cash", amount: Math.floor(total / 2) },
    { method: "qris", amount: total - Math.floor(total / 2) },
  ]);

  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<OrderReceipt | null>(null);

  const prevOpenRef = useRef(false);

  // Inisialisasi state HANYA saat modal pertama kali dibuka
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setPaymentMode("single");
      setMethod("cash");
      setTendered(total);
      setPaymentReference("");
      const half = Math.floor(total / 2);
      setSplitItems([
        { method: "cash", amount: half },
        { method: "qris", amount: total - half },
      ]);
      setCopied(false);
      setIsLoading(false);
      setIsSuccess(false);
      setCompletedOrder(null);
    }
    prevOpenRef.current = open;
  }, [open, total]);

  // Auto-print saat transaksi berhasil jika autoPrintReceipt aktif
  useEffect(() => {
    if (isSuccess && completedOrder) {
      const autoPrint =
        completedOrder.storeSettings?.autoPrintReceipt ??
        storeSettings?.autoPrintReceipt ??
        true;
      if (autoPrint) {
        const timer = setTimeout(() => {
          window.print();
        }, 350);
        return () => clearTimeout(timer);
      }
    }
  }, [isSuccess, completedOrder, storeSettings]);

  // Tombol "Pesanan Baru": Mengosongkan keranjang belanja dan menutup modal
  const handleNewOrder = () => {
    setIsSuccess(false);
    setCompletedOrder(null);
    setPaymentReference("");
    onDone(); // Kosongkan keranjang (setLines([]))
    onClose(); // Tutup modal
  };

  // Menutup modal via backdrop / tombol X
  const handleClose = () => {
    if (isSuccess) {
      onDone(); // Jika sudah sukses, tutup modal sekaligus kosongkan keranjang
    }
    onClose();
  };

  // Salin no rekening ke clipboard
  const handleCopyAccount = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText("1234567890");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* abaikan bila izin clipboard tidak tersedia */
    }
  };

  // Keyboard shortcut: Enter = Pesanan Baru (saat sukses), P = Cetak Struk
  useEffect(() => {
    if (!open || !isSuccess) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleNewOrder();
      } else if (e.key.toLowerCase() === "p" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        window.print();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isSuccess]);

  // Hitungan untuk Single Cash
  const change = Math.max(0, tendered - total);
  const insufficientSingle = paymentMode === "single" && method === "cash" && tendered < total;

  const quickCash = useMemo(() => {
    const base = [total, 20000, 50000, 100000].filter((v, i, a) => a.indexOf(v) === i);
    return base.sort((a, b) => a - b).slice(0, 5);
  }, [total]);

  // Hitungan untuk Split Mode
  const splitTotal = useMemo(() => {
    return splitItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  }, [splitItems]);

  const splitDifference = total - splitTotal; // 0 jika pas, > 0 jika kurang, < 0 jika lebih
  const isSplitValid =
    paymentMode === "split"
      ? splitItems.length >= 2 &&
        splitItems.every((it) => (Number(it.amount) || 0) > 0) &&
        splitDifference === 0
      : true;

  // Handler Split Tender Management
  const handleAddSplitRow = () => {
    const remaining = Math.max(0, splitDifference);
    const existingMethods = splitItems.map((it) => it.method);
    const candidateMethod: "cash" | "qris" | "debit" | "transfer" =
      METHODS.find((m) => !existingMethods.includes(m.id))?.id || "debit";

    setSplitItems((prev) => [
      ...prev,
      { method: candidateMethod, amount: remaining > 0 ? remaining : 0 },
    ]);
  };

  const handleUpdateSplitRow = (
    index: number,
    field: keyof PaymentBreakdownItem,
    val: any
  ) => {
    setSplitItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleRemoveSplitRow = (index: number) => {
    if (splitItems.length <= 2) return;
    setSplitItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFillRemaining = (index: number) => {
    const otherTotal = splitItems.reduce(
      (sum, it, i) => (i === index ? sum : sum + (Number(it.amount) || 0)),
      0
    );
    const needed = Math.max(0, total - otherTotal);
    handleUpdateSplitRow(index, "amount", needed);
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    let result: OrderReceipt | null = null;

    if (paymentMode === "split") {
      result = await onSubmit(
        "split",
        total,
        undefined,
        splitItems.map((s) => ({
          method: s.method,
          amount: Number(s.amount) || 0,
          reference: s.reference?.trim() || undefined,
        }))
      );
    } else {
      result = await onSubmit(
        method,
        method === "cash" ? tendered : total,
        method === "transfer" ? paymentReference.trim() : undefined,
        undefined
      );
    }

    if (result) {
      setCompletedOrder(result);
      setIsSuccess(true);
      setIsLoading(false);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(40);
      }
    } else {
      setIsLoading(false);
    }
  };

  const isButtonDisabled =
    isLoading ||
    (paymentMode === "single" ? insufficientSingle : !isSplitValid);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-coal/75 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ y: 40, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className={`w-full ${
              isSuccess ? "max-w-md" : "max-w-xl"
            } rounded-3xl border border-line-2 bg-panel-2 shadow-ticket overflow-hidden`}
          >
            {/* ===================================================================
                1. TAMPILAN PILIH PEMBAYARAN (SEBELUM KONFIRMASI)
               =================================================================== */}
            {!isSuccess ? (
              <>
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-line">
                  <div>
                    <p className="font-display text-lg font-bold">Pilih Pembayaran</p>
                    <p className="text-[11px] text-faint mt-0.5 flex items-center gap-1.5">
                      {offline && (
                        <span className="inline-flex items-center gap-1 text-amber-400">
                          <CloudOff className="size-3" /> Mode offline — akan tersinkron
                        </span>
                      )}
                      {!offline && "Pilih metode pembayaran pelanggan"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-display text-2xl font-bold tabular text-brand text-glow">
                      {formatIDR(total)}
                    </p>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="btn-press grid size-9 place-items-center rounded-xl border border-line bg-coal text-faint hover:text-cream"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {/* TAB SWITCHER: METODE TUNGGAL VS SPLIT PEMBAYARAN */}
                  <div className="grid grid-cols-2 p-1 rounded-2xl bg-coal border border-line">
                    <button
                      type="button"
                      onClick={() => setPaymentMode("single")}
                      className={`btn-press flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        paymentMode === "single"
                          ? "bg-brand text-coal shadow-md shadow-brand/20 font-extrabold"
                          : "text-sand hover:text-cream"
                      }`}
                    >
                      <CreditCard className="size-4" />
                      <span>Pembayaran Tunggal</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMode("split")}
                      className={`btn-press flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        paymentMode === "split"
                          ? "bg-brand text-coal shadow-md shadow-brand/20 font-extrabold"
                          : "text-sand hover:text-cream"
                      }`}
                    >
                      <Split className="size-4" />
                      <span>Split Pembayaran (Multi-Tender)</span>
                    </button>
                  </div>

                  {/* ----------------- MODE 1: METODE TUNGGAL ----------------- */}
                  {paymentMode === "single" ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {METHODS.map((m) => {
                          const active = method === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setMethod(m.id)}
                              className={`btn-press rounded-2xl border p-3 text-left transition-colors ${
                                active
                                  ? "border-brand bg-brand/12 shadow-sm shadow-brand/10 ring-1 ring-brand"
                                  : "border-line bg-coal hover:border-line-2"
                              }`}
                            >
                              <m.icon
                                className={`size-5 mb-2 ${active ? "text-brand" : "text-sand"}`}
                              />
                              <p
                                className={`text-[13px] font-bold leading-tight ${
                                  active ? "text-brand" : "text-cream"
                                }`}
                              >
                                {m.label}
                              </p>
                              <p className="text-[10px] text-faint mt-0.5 leading-tight truncate">
                                {m.desc}
                              </p>
                            </button>
                          );
                        })}
                      </div>

                      {/* Cash / Tunai Panel */}
                      {method === "cash" && (
                        <div className="rounded-2xl border border-line bg-coal p-4 space-y-3.5">
                          <div className="flex flex-wrap gap-2">
                            {quickCash.map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setTendered(v)}
                                className={`btn-press rounded-full border px-4 py-2 text-xs font-bold tabular transition-colors ${
                                  tendered === v
                                    ? "border-brand bg-brand/15 text-brand"
                                    : "border-line-2/70 bg-panel text-sand hover:text-cream"
                                }`}
                              >
                                {v === total ? "Uang Pas" : formatIDR(v)}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-faint shrink-0">
                              Uang diterima
                            </label>
                            <div className="flex items-center gap-2 rounded-xl border border-line-2 bg-panel px-3 py-2 w-full max-w-[220px]">
                              <span className="text-xs text-faint">Rp</span>
                              <input
                                type="number"
                                min={0}
                                value={tendered || ""}
                                onChange={(e) => setTendered(Number(e.target.value))}
                                className="w-full bg-transparent font-display text-lg font-bold tabular outline-none text-cream"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between border-t border-line pt-3">
                            <p className="text-xs text-faint">Kembalian</p>
                            <p
                              className={`font-display text-xl font-bold tabular ${
                                insufficientSingle ? "text-red-400" : "text-emerald-400"
                              }`}
                            >
                              {insufficientSingle ? "Kurang!" : formatIDR(change)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* QRIS Panel */}
                      {method === "qris" && (
                        <div className="rounded-2xl border border-line bg-coal p-4 flex items-center gap-4">
                          <div className="grid size-24 shrink-0 place-items-center rounded-xl bg-cream p-2">
                            <QrCode className="size-full text-coal" strokeWidth={1.2} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-cream">
                              Scan QRIS statis merchant
                            </p>
                            <p className="text-xs text-faint mt-1 leading-relaxed">
                              Konfirmasi otomatis tercatat dengan nominal {formatIDR(total)}.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Debit Panel */}
                      {method === "debit" && (
                        <div className="rounded-2xl border border-line bg-coal p-4 flex items-center gap-4">
                          <div className="grid size-14 shrink-0 place-items-center rounded-xl border border-line-2 bg-panel text-brand">
                            <CreditCard className="size-7" strokeWidth={1.6} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-cream">
                              Gesek / tap kartu di EDC
                            </p>
                            <p className="text-xs text-faint mt-1">
                              Nominal {formatIDR(total)} dikirim ke mesin EDC.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Transfer Bank Panel */}
                      {method === "transfer" && (
                        <div className="rounded-2xl border border-line bg-coal p-4 space-y-3.5">
                          <div className="flex items-start justify-between gap-3 rounded-xl border border-line-2 bg-panel p-3.5">
                            <div className="space-y-0.5">
                              <span className="inline-block rounded-md bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-400 mb-1">
                                Bank BCA
                              </span>
                              <p className="font-display text-base font-extrabold tracking-wider tabular text-cream">
                                1234-567-890
                              </p>
                              <p className="text-[11px] text-faint">
                                a/n BREWMETRICS Specialty Coffee
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleCopyAccount}
                              className="btn-press flex items-center gap-1.5 rounded-xl border border-line bg-coal px-3 py-2 text-xs font-semibold text-sand hover:text-cream hover:border-brand/40 shrink-0"
                            >
                              {copied ? (
                                <>
                                  <Check className="size-3.5 text-emerald-400" />
                                  <span className="text-emerald-400">Tersalin!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3.5" />
                                  <span>Salin Rekening</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint block mb-1.5">
                              Nomor Referensi / Catatan Pengirim (Opsional)
                            </label>
                            <input
                              type="text"
                              value={paymentReference}
                              onChange={(e) => setPaymentReference(e.target.value)}
                              placeholder="Contoh: Ref# 8849 / Bpk Rudi"
                              className="w-full rounded-xl border border-line bg-panel px-3.5 py-2.5 text-xs text-cream outline-none focus:border-brand/60 placeholder:text-faint/60"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    /* ----------------- MODE 2: SPLIT PEMBAYARAN ----------------- */
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200 flex items-start gap-2.5">
                        <Sparkles className="size-4 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] leading-relaxed">
                          Bagi pembayaran tagihan ke dua atau lebih cara bayar (mis. Tunai + QRIS).
                          Total uang yang diinput <strong>harus sama persis</strong> dengan total tagihan{" "}
                          <strong>{formatIDR(total)}</strong>.
                        </p>
                      </div>

                      {/* Daftar Baris Metode Pembayaran Split */}
                      <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                        {splitItems.map((item, index) => (
                          <div
                            key={index}
                            className="p-3.5 rounded-2xl border border-line bg-coal flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                          >
                            <div className="flex items-center gap-2">
                              <span className="grid size-6 place-items-center rounded-full bg-surface border border-line text-[10px] font-bold text-sand shrink-0">
                                {index + 1}
                              </span>
                              {/* Pilihan Metode Bayar */}
                              <select
                                value={item.method}
                                onChange={(e) =>
                                  handleUpdateSplitRow(index, "method", e.target.value)
                                }
                                className="rounded-xl border border-line-2 bg-panel px-3 py-2 text-xs font-semibold text-cream outline-none focus:border-brand"
                              >
                                <option value="cash">Tunai</option>
                                <option value="qris">QRIS</option>
                                <option value="debit">Kartu Debit</option>
                                <option value="transfer">Transfer Bank</option>
                              </select>
                            </div>

                            {/* Input Nominal Split */}
                            <div className="flex-1 flex items-center gap-2 rounded-xl border border-line-2 bg-panel px-3 py-1.5">
                              <span className="text-xs text-faint">Rp</span>
                              <input
                                type="number"
                                min={0}
                                value={item.amount || ""}
                                onChange={(e) =>
                                  handleUpdateSplitRow(index, "amount", Number(e.target.value))
                                }
                                placeholder="0"
                                className="w-full bg-transparent font-display text-sm font-bold tabular outline-none text-cream"
                              />
                              <button
                                type="button"
                                onClick={() => handleFillRemaining(index)}
                                className="btn-press rounded-lg bg-surface border border-line px-2 py-1 text-[10px] font-bold text-brand hover:bg-brand/10 transition shrink-0"
                                title="Isi sisa tagihan yang belum teralokasikan"
                              >
                                Sisa
                              </button>
                            </div>

                            {/* Tombol Hapus Baris (jika > 2) */}
                            {splitItems.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSplitRow(index)}
                                className="btn-press text-faint hover:text-red-400 p-1.5 rounded-xl border border-transparent hover:border-red-500/20 hover:bg-red-500/10 shrink-0 self-end sm:self-center"
                                title="Hapus cara bayar ini"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Tombol Tambah Cara Bayar */}
                      <button
                        type="button"
                        onClick={handleAddSplitRow}
                        className="btn-press flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl border border-dashed border-line-2 hover:border-brand/50 text-xs font-semibold text-sand hover:text-brand bg-panel/40"
                      >
                        <Plus className="size-3.5" />
                        <span>Tambah Metode Pembayaran Lain</span>
                      </button>

                      {/* Kotak Ringkasan & Validasi Split Total */}
                      <div className="p-4 rounded-2xl border border-line bg-coal/90 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-faint">
                          <span>Total Tagihan:</span>
                          <span className="font-semibold text-cream">{formatIDR(total)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sand font-medium">
                          <span>Total Alokasi Bayar:</span>
                          <span className="font-display font-bold tabular text-cream">
                            {formatIDR(splitTotal)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-line">
                          <span className="font-bold">Status Validasi:</span>
                          {splitDifference === 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-[11px]">
                              <CheckCircle2 className="size-3.5" /> Nominal Pas
                            </span>
                          ) : splitDifference > 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-[11px]">
                              <AlertCircle className="size-3.5" /> Kurang {formatIDR(splitDifference)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-[11px]">
                              <AlertCircle className="size-3.5" /> Kelebihan{" "}
                              {formatIDR(Math.abs(splitDifference))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tombol Konfirmasi Bayar */}
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isButtonDisabled}
                    className="btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-display text-[15px] font-bold text-coal shadow-[0_16px_44px_-14px] shadow-brand/70 hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="size-5 animate-spin" /> Memproses Pembayaran…
                      </>
                    ) : (
                      <>
                        {paymentMode === "split"
                          ? `Konfirmasi Split Bayar — ${formatIDR(total)}`
                          : `Konfirmasi Bayar — ${formatIDR(total)}`}{" "}
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              /* ===================================================================
                 2. TAMPILAN MODAL TRANSAKSI BERHASIL (SUCCESS STATE)
                 =================================================================== */
              <div className="p-6 sm:p-7 text-center">
                {/* Ikon Animasi Sukses */}
                <motion.div
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16 }}
                  className="mx-auto mb-3.5 grid size-16 place-items-center rounded-full bg-emerald-400/15 border border-emerald-400/40"
                >
                  <div className="grid size-10 place-items-center rounded-full bg-emerald-400 text-coal shadow-[0_0_32px_-6px] shadow-emerald-400/70">
                    <Check className="size-6" strokeWidth={3} />
                  </div>
                </motion.div>

                {/* Badge Status Lunas & Judul Sukses */}
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold tracking-wider uppercase mb-1.5">
                  <CheckCircle2 className="size-4" />
                  <span>Pembayaran Berhasil</span>
                </div>

                <p className="font-display text-2xl sm:text-3xl font-bold tabular text-cream tracking-tight">
                  {completedOrder?.orderNumber}
                </p>

                <p className="text-xs text-faint mt-1">
                  {completedOrder && formatTime(completedOrder.createdAt)} • Kasir{" "}
                  {completedOrder?.cashierName.split(" ")[0]} •{" "}
                  <span className="uppercase font-bold text-sand">
                    {completedOrder?.paymentMethod === "split"
                      ? "Split Pembayaran"
                      : completedOrder?.paymentMethod === "cash"
                        ? "Tunai"
                        : completedOrder?.paymentMethod === "qris"
                          ? "QRIS"
                          : completedOrder?.paymentMethod === "transfer"
                            ? "Transfer Bank"
                            : "Debit"}
                  </span>
                </p>

                {/* Kartu Ringkasan Pembayaran & Kembalian */}
                <div className="mx-auto mt-4 rounded-2xl border border-line bg-coal p-4 text-left space-y-3 text-xs">
                  {completedOrder?.paymentMethod === "cash" && (
                    <div className="pb-3 border-b border-line space-y-1.5">
                      <div className="flex justify-between text-faint">
                        <span>Uang Diterima</span>
                        <span className="tabular font-medium text-sand">
                          {formatIDR(completedOrder.tendered ?? 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline pt-1">
                        <span className="font-bold text-cream">Uang Kembalian</span>
                        <span className="font-display text-3xl font-extrabold tabular text-emerald-400 text-glow">
                          {formatIDR(completedOrder.change ?? 0)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 text-faint">
                    <div className="flex justify-between">
                      <span>Pelanggan</span>
                      <span className="font-semibold text-cream">
                        {completedOrder?.customerName ?? "Umum"}{" "}
                        <span className="text-[10px] text-faint font-normal uppercase">
                          ({completedOrder?.orderType === "take-away" ? "Take Away" : "Dine In"}
                          {completedOrder?.tableNumber ? ` • Meja ${completedOrder.tableNumber}` : ""})
                        </span>
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Metode Pembayaran</span>
                      <span className="font-semibold text-sand uppercase">
                        {completedOrder?.paymentMethod === "split"
                          ? "Split Pembayaran"
                          : completedOrder?.paymentMethod === "cash"
                            ? "Tunai"
                            : completedOrder?.paymentMethod === "qris"
                              ? "QRIS"
                              : completedOrder?.paymentMethod === "transfer"
                                ? "Transfer Bank"
                                : "Debit"}
                      </span>
                    </div>

                    {/* Jika Split: Tampilkan rincian pembagian cara bayar */}
                    {completedOrder?.paymentBreakdown &&
                      completedOrder.paymentBreakdown.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-panel border border-line-2 space-y-1 my-1">
                          <p className="text-[10px] font-bold uppercase text-amber-400">
                            Rincian Split Tender:
                          </p>
                          {completedOrder.paymentBreakdown.map((s, idx) => (
                            <div key={idx} className="flex justify-between text-[11px]">
                              <span className="capitalize text-sand">
                                •{" "}
                                {s.method === "cash"
                                  ? "Tunai"
                                  : s.method === "qris"
                                    ? "QRIS"
                                    : s.method === "transfer"
                                      ? "Transfer Bank"
                                      : "Debit"}
                                :
                              </span>
                              <span className="font-bold tabular text-cream">
                                {formatIDR(s.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                    {completedOrder?.paymentReference && (
                      <div className="flex justify-between text-sky-400/90">
                        <span>Ref / Pengirim</span>
                        <span className="font-medium truncate max-w-[180px]">
                          {completedOrder.paymentReference}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span>Total Menu ({completedOrder?.itemCount ?? 0} item)</span>
                      <span className="tabular text-sand">
                        {formatIDR(completedOrder?.subtotal ?? total)}
                      </span>
                    </div>

                    {(completedOrder?.discountAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-amber-400">
                        <span>Diskon Transaksi</span>
                        <span className="tabular font-medium">
                          - {formatIDR(completedOrder?.discountAmount ?? 0)}
                        </span>
                      </div>
                    )}

                    {(completedOrder?.serviceCharge ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span>Biaya Layanan</span>
                        <span className="tabular text-sand">
                          {formatIDR(completedOrder?.serviceCharge ?? 0)}
                        </span>
                      </div>
                    )}

                    {(completedOrder?.tax ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span>Pajak Restoran (PB1)</span>
                        <span className="tabular text-sand">
                          {formatIDR(completedOrder?.tax ?? 0)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between pt-2 border-t border-line/60 font-bold text-cream">
                      <span>Total Tagihan</span>
                      <span className="font-display text-base tabular text-brand">
                        {formatIDR(completedOrder?.total ?? completedOrder?.subtotal ?? total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notifikasi info pemotongan stok & tombol cetak manual */}
                <p className="mt-3 text-[11px] text-faint flex items-center justify-center gap-1.5">
                  <Sparkles className="size-3 text-brand shrink-0" />
                  <span>Stok bahan terpotong otomatis. Klik Cetak Struk bila diperlukan pelanggan.</span>
                </p>

                {/* Tombol Aksi: Cetak Struk & Pesanan Baru */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn-press flex items-center justify-center gap-2 rounded-2xl border border-line-2 bg-coal py-3.5 px-4 font-display text-sm font-bold text-sand hover:text-cream hover:border-brand/40 shadow-sm"
                    title="Cetak ulang struk thermal (P)"
                  >
                    <Printer className="size-4.5 text-brand" />
                    <span>Cetak Struk (P)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNewOrder}
                    className="btn-press flex items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 px-4 font-display text-sm font-bold text-coal shadow-[0_12px_28px_-8px] shadow-brand/70 hover:brightness-110"
                    title="Mulai pesanan baru dan kosongkan keranjang (Enter)"
                  >
                    <Plus className="size-4.5" strokeWidth={2.5} />
                    <span>Pesanan Baru</span>
                  </button>
                </div>

                {/* Elemen cetak thermal struk lunas (Hanya muncul pada window.print()) */}
                {completedOrder && (
                  <ReceiptPrint receipt={completedOrder} storeSettings={storeSettings} />
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
