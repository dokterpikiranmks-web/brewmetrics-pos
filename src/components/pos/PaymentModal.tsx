"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote, QrCode, CreditCard, X, Loader2, Check, CheckCircle2,
  Printer, CloudOff, ArrowRight, Plus, Sparkles,
} from "lucide-react";
import type { OrderReceipt } from "@/lib/types";
import { formatIDR, formatTime } from "@/lib/format";
import ReceiptPrint from "./ReceiptPrint";

type Method = "cash" | "qris" | "debit";

const METHODS: { id: Method; label: string; icon: typeof Banknote; desc: string }[] = [
  { id: "cash", label: "Tunai", icon: Banknote, desc: "Hitung kembalian otomatis" },
  { id: "qris", label: "QRIS", icon: QrCode, desc: "Scan & lunas instan" },
  { id: "debit", label: "Debit", icon: CreditCard, desc: "Gesek kartu EDC" },
];

export default function PaymentModal({
  open,
  total,
  offline,
  onClose,
  onSubmit,
  onDone,
}: {
  open: boolean;
  total: number;
  offline: boolean;
  onClose: () => void;
  onSubmit: (method: Method, tendered: number) => Promise<OrderReceipt | null>;
  onDone: () => void;
}) {
  const [method, setMethod] = useState<Method>("cash");
  const [tendered, setTendered] = useState<number>(total);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<OrderReceipt | null>(null);

  const prevOpenRef = useRef(false);

  // Inisialisasi state HANYA saat modal pertama kali dibuka (transisi open: false -> true)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setMethod("cash");
      setTendered(total);
      setIsLoading(false);
      setIsSuccess(false);
      setCompletedOrder(null);
    }
    prevOpenRef.current = open;
  }, [open, total]);

  // Tombol "Pesanan Baru": Mengosongkan keranjang belanja dan menutup modal
  const handleNewOrder = () => {
    setIsSuccess(false);
    setCompletedOrder(null);
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

  const change = Math.max(0, tendered - total);
  const insufficient = method === "cash" && tendered < total;

  const quickCash = useMemo(() => {
    const base = [total, 20000, 50000, 100000].filter((v, i, a) => a.indexOf(v) === i);
    return base.sort((a, b) => a - b).slice(0, 5);
  }, [total]);

  const handleConfirm = async () => {
    setIsLoading(true);
    const result = await onSubmit(method, method === "cash" ? tendered : total);
    if (result) {
      // Simpan data transaksi dan aktifkan modal Transaksi Berhasil
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
              isSuccess ? "max-w-md" : "max-w-lg"
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
                      {!offline && "Pilih metode bayar pelanggan"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-display text-2xl font-bold tabular text-brand text-glow">{formatIDR(total)}</p>
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
                  <div className="grid grid-cols-3 gap-2">
                    {METHODS.map((m) => {
                      const active = method === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMethod(m.id)}
                          className={`btn-press rounded-2xl border p-3.5 text-left transition-colors ${
                            active ? "border-brand bg-brand/12" : "border-line bg-coal hover:border-line-2"
                          }`}
                        >
                          <m.icon className={`size-5 mb-2 ${active ? "text-brand" : "text-sand"}`} />
                          <p className={`text-[13px] font-bold ${active ? "text-brand" : "text-cream"}`}>{m.label}</p>
                          <p className="text-[10px] text-faint mt-0.5 leading-tight">{m.desc}</p>
                        </button>
                      );
                    })}
                  </div>

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
                        <p className={`font-display text-xl font-bold tabular ${insufficient ? "text-red-400" : "text-emerald-400"}`}>
                          {insufficient ? "Kurang!" : formatIDR(change)}
                        </p>
                      </div>
                    </div>
                  )}

                  {method === "qris" && (
                    <div className="rounded-2xl border border-line bg-coal p-4 flex items-center gap-4">
                      <div className="grid size-24 shrink-0 place-items-center rounded-xl bg-cream p-2">
                        <QrCode className="size-full text-coal" strokeWidth={1.2} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-cream">Scan QRIS statis merchant</p>
                        <p className="text-xs text-faint mt-1 leading-relaxed">
                          Konfirmasi otomatis tercatat dengan nominal {formatIDR(total)}.
                        </p>
                      </div>
                    </div>
                  )}

                  {method === "debit" && (
                    <div className="rounded-2xl border border-line bg-coal p-4 flex items-center gap-4">
                      <div className="grid size-14 shrink-0 place-items-center rounded-xl border border-line-2 bg-panel text-brand">
                        <CreditCard className="size-7" strokeWidth={1.6} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-cream">Gesek / tap kartu di EDC</p>
                        <p className="text-xs text-faint mt-1">Nominal {formatIDR(total)} dikirim ke mesin EDC.</p>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={insufficient || isLoading}
                    className="btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-display text-[15px] font-bold text-coal shadow-[0_16px_44px_-14px] shadow-brand/70 hover:brightness-110 disabled:opacity-40"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="size-5 animate-spin" /> Memproses Pembayaran…
                      </>
                    ) : (
                      <>
                        Konfirmasi Bayar — {formatIDR(total)} <ArrowRight className="size-4" />
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              /* ===================================================================
                 2. TAMPILAN MODAL TRANSAKSI BERHASIL (SUCCESS STATE)
                 Hanya muncul jika isSuccess === true & API database mengembalikan 200
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
                    {completedOrder?.paymentMethod === "cash"
                      ? "Tunai"
                      : completedOrder?.paymentMethod === "qris"
                        ? "QRIS"
                        : "Debit"}
                  </span>
                </p>

                {/* Kartu Ringkasan Pembayaran & Kembalian */}
                <div className="mx-auto mt-4 rounded-2xl border border-line bg-coal p-4 text-left space-y-3 text-xs">
                  {completedOrder?.paymentMethod === "cash" && (
                    <div className="pb-3 border-b border-line space-y-1.5">
                      <div className="flex justify-between text-faint">
                        <span>Uang Diterima</span>
                        <span className="tabular font-medium text-sand">{formatIDR(completedOrder.tendered ?? 0)}</span>
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
                      <span>Metode Pembayaran</span>
                      <span className="font-semibold text-sand uppercase">
                        {completedOrder?.paymentMethod === "cash"
                          ? "Tunai"
                          : completedOrder?.paymentMethod === "qris"
                            ? "QRIS"
                            : "Debit"}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Total Menu ({completedOrder?.itemCount ?? 0} item)</span>
                      <span className="tabular text-sand">{formatIDR(completedOrder?.subtotal ?? total)}</span>
                    </div>

                    {(completedOrder?.serviceCharge ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span>Biaya Layanan</span>
                        <span className="tabular text-sand">{formatIDR(completedOrder?.serviceCharge ?? 0)}</span>
                      </div>
                    )}

                    {(completedOrder?.tax ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span>Pajak Restoran (PB1)</span>
                        <span className="tabular text-sand">{formatIDR(completedOrder?.tax ?? 0)}</span>
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
                {completedOrder && <ReceiptPrint receipt={completedOrder} />}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
