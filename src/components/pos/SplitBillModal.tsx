"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Split,
  ArrowRight,
  ArrowLeft,
  ChevronsRight,
  ChevronsLeft,
  Receipt,
  X,
  Plus,
  Minus,
  Check,
  AlertCircle,
  ShoppingBag,
} from "lucide-react";
import type { CartLine } from "@/lib/cart";
import { cartTotal, calculateOrderTotals } from "@/lib/cart";
import { formatIDR } from "@/lib/format";
import type { StoreSettingDto } from "@/lib/types";

interface SplitBillModalProps {
  open: boolean;
  lines: CartLine[];
  storeSettings?: StoreSettingDto | null;
  onClose: () => void;
  onPaySplitBill: (newBillLines: CartLine[], remainingLines: CartLine[]) => void;
}

export default function SplitBillModal({
  open,
  lines,
  storeSettings,
  onClose,
  onPaySplitBill,
}: SplitBillModalProps) {
  // Nota Asal (keranjang yang tersisa) dan Nota Baru (yang akan dibayar)
  const [originalList, setOriginalList] = useState<CartLine[]>([]);
  const [newBillList, setNewBillList] = useState<CartLine[]>([]);

  // Inisialisasi daftar saat modal dibuka
  useEffect(() => {
    if (open) {
      // Deep copy item cart
      setOriginalList(lines.map((l) => ({ ...l })));
      setNewBillList([]);
    }
  }, [open, lines]);

  const taxPct = storeSettings?.taxPercentage ?? 10;
  const servicePct = storeSettings?.serviceChargePercentage ?? 0;

  // Hitungan finansial Nota Asal
  const originalSubtotal = useMemo(() => cartTotal(originalList), [originalList]);
  const originalTotals = useMemo(
    () => calculateOrderTotals(originalSubtotal, taxPct, servicePct),
    [originalSubtotal, taxPct, servicePct]
  );
  const originalItemCount = useMemo(
    () => originalList.reduce((s, l) => s + l.qty, 0),
    [originalList]
  );

  // Hitungan finansial Nota Baru
  const newSubtotal = useMemo(() => cartTotal(newBillList), [newBillList]);
  const newTotals = useMemo(
    () => calculateOrderTotals(newSubtotal, taxPct, servicePct),
    [newSubtotal, taxPct, servicePct]
  );
  const newItemCount = useMemo(
    () => newBillList.reduce((s, l) => s + l.qty, 0),
    [newBillList]
  );

  // Memindahkan kuantitas dari Nota Asal -> Nota Baru
  const handleMoveToNew = (lineKey: string, qtyToMove: number) => {
    setOriginalList((prevOriginal) => {
      const sourceIndex = prevOriginal.findIndex((it) => it.key === lineKey);
      if (sourceIndex === -1) return prevOriginal;

      const sourceItem = prevOriginal[sourceIndex];
      const actualMove = Math.min(qtyToMove, sourceItem.qty);

      // Kurangi dari Original
      let updatedOriginal: CartLine[];
      if (sourceItem.qty <= actualMove) {
        updatedOriginal = prevOriginal.filter((_, idx) => idx !== sourceIndex);
      } else {
        updatedOriginal = [...prevOriginal];
        updatedOriginal[sourceIndex] = {
          ...sourceItem,
          qty: sourceItem.qty - actualMove,
        };
      }

      // Tambahkan ke New Bill
      setNewBillList((prevNew) => {
        const destIndex = prevNew.findIndex((it) => it.key === lineKey);
        if (destIndex === -1) {
          return [...prevNew, { ...sourceItem, qty: actualMove }];
        } else {
          const updatedNew = [...prevNew];
          updatedNew[destIndex] = {
            ...updatedNew[destIndex],
            qty: updatedNew[destIndex].qty + actualMove,
          };
          return updatedNew;
        }
      });

      return updatedOriginal;
    });
  };

  // Mengembalikan kuantitas dari Nota Baru -> Nota Asal
  const handleMoveToOriginal = (lineKey: string, qtyToMove: number) => {
    setNewBillList((prevNew) => {
      const sourceIndex = prevNew.findIndex((it) => it.key === lineKey);
      if (sourceIndex === -1) return prevNew;

      const sourceItem = prevNew[sourceIndex];
      const actualMove = Math.min(qtyToMove, sourceItem.qty);

      // Kurangi dari New Bill
      let updatedNew: CartLine[];
      if (sourceItem.qty <= actualMove) {
        updatedNew = prevNew.filter((_, idx) => idx !== sourceIndex);
      } else {
        updatedNew = [...prevNew];
        updatedNew[sourceIndex] = {
          ...sourceItem,
          qty: sourceItem.qty - actualMove,
        };
      }

      // Tambahkan kembali ke Original
      setOriginalList((prevOrig) => {
        const destIndex = prevOrig.findIndex((it) => it.key === lineKey);
        if (destIndex === -1) {
          return [...prevOrig, { ...sourceItem, qty: actualMove }];
        } else {
          const updatedOrig = [...prevOrig];
          updatedOrig[destIndex] = {
            ...updatedOrig[destIndex],
            qty: updatedOrig[destIndex].qty + actualMove,
          };
          return updatedOrig;
        }
      });

      return updatedNew;
    });
  };

  const handleProceedPayNewBill = () => {
    if (newBillList.length === 0) return;
    onPaySplitBill(newBillList, originalList);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-coal/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ y: 30, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.97, opacity: 0 }}
            className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-line bg-panel shadow-2xl overflow-hidden"
          >
            {/* Header Modal Split Nota */}
            <div className="flex items-center justify-between border-b border-line px-5 sm:px-6 py-4 bg-surface/50">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-brand/15 text-brand border border-brand/20">
                  <Split className="size-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-cream">
                    Split Nota (Pemisah Tagihan)
                  </h2>
                  <p className="text-xs text-faint">
                    Pindahkan item atau bagi kuantitas ke <strong>Nota Baru</strong> untuk dibayar terlebih dahulu.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="btn-press flex size-9 items-center justify-center rounded-xl border border-line-2 bg-coal text-sand hover:text-cream transition"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Grid 2 Kolom Daftar Nota */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 min-h-[380px]">
              {/* ===================================================================
                  KOLOM KIRI: NOTA ASAL (KERANJANG UTAMA / SISA)
                 =================================================================== */}
              <div className="flex flex-col rounded-2xl border border-line bg-coal/60 overflow-hidden">
                <div className="bg-surface/70 px-4 py-3 border-b border-line flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="size-4 text-brand" />
                    <span className="font-display text-sm font-bold text-cream">Nota Asal</span>
                    <span className="rounded-full bg-surface border border-line px-2 py-0.2 text-[10px] font-bold text-sand">
                      {originalItemCount} item
                    </span>
                  </div>
                  <span className="text-[10px] text-faint">Tersimpan di Keranjang</span>
                </div>

                {/* List Item Nota Asal */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[300px]">
                  {originalList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-44 text-faint text-center p-4">
                      <ShoppingBag className="size-8 opacity-30 mb-1.5" />
                      <p className="text-xs">Semua item telah dipindahkan ke Nota Baru.</p>
                    </div>
                  ) : (
                    originalList.map((item) => (
                      <div
                        key={item.key}
                        className="p-3 rounded-xl border border-line bg-panel space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-cream">{item.name}</p>
                            {item.variantName && (
                              <p className="text-[11px] text-sand">{item.variantName}</p>
                            )}
                            {item.mods && item.mods.length > 0 && (
                              <p className="text-[10px] text-faint italic">
                                + {item.mods.map((m) => m.name).join(", ")}
                              </p>
                            )}
                          </div>
                          <p className="font-display font-bold tabular text-sand text-[13px] shrink-0">
                            {formatIDR(item.unitPrice * item.qty)}
                          </p>
                        </div>

                        {/* Tombol Pemindah */}
                        <div className="flex items-center justify-between pt-1 border-t border-line/60">
                          <span className="font-mono font-bold text-brand">
                            {item.qty} pcs @ {formatIDR(item.unitPrice)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleMoveToNew(item.key, 1)}
                              className="btn-press flex items-center gap-1 px-2.5 py-1 rounded-lg border border-brand/40 bg-brand/10 text-brand text-[10.5px] font-bold hover:bg-brand/20 transition"
                              title="Pindahkan 1 pcs ke Nota Baru"
                            >
                              <span>Pindah 1</span>
                              <ArrowRight className="size-3" />
                            </button>

                            {item.qty > 1 && (
                              <button
                                type="button"
                                onClick={() => handleMoveToNew(item.key, item.qty)}
                                className="btn-press flex items-center gap-1 px-2 py-1 rounded-lg border border-line-2 bg-coal text-sand text-[10.5px] font-bold hover:text-cream hover:border-brand/40 transition"
                                title="Pindahkan semua pcs ke Nota Baru"
                              >
                                <span>Semua</span>
                                <ChevronsRight className="size-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Subtotal Nota Asal */}
                <div className="border-t border-line p-3 bg-surface/40 text-xs space-y-1">
                  <div className="flex justify-between text-faint">
                    <span>Subtotal</span>
                    <span className="tabular">{formatIDR(originalTotals.subtotal)}</span>
                  </div>
                  {originalTotals.tax > 0 && (
                    <div className="flex justify-between text-faint">
                      <span>PB1 ({taxPct}%)</span>
                      <span className="tabular">{formatIDR(originalTotals.tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 font-bold text-cream border-t border-line/50">
                    <span>Total Sisa Nota</span>
                    <span className="font-display text-sm tabular text-brand">
                      {formatIDR(originalTotals.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ===================================================================
                  KOLOM KANAN: NOTA BARU (AKAN DIBAYAR SEKARANG)
                 =================================================================== */}
              <div className="flex flex-col rounded-2xl border border-brand/40 bg-coal/60 overflow-hidden ring-1 ring-brand/20">
                <div className="bg-brand/10 px-4 py-3 border-b border-brand/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Split className="size-4 text-brand" />
                    <span className="font-display text-sm font-bold text-brand">Nota Baru</span>
                    <span className="rounded-full bg-brand text-coal px-2 py-0.2 text-[10px] font-extrabold tabular">
                      {newItemCount} item
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-brand uppercase tracking-wider">
                    Dibayar Sekarang
                  </span>
                </div>

                {/* List Item Nota Baru */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[300px]">
                  {newBillList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-44 text-faint text-center p-4">
                      <Receipt className="size-8 opacity-30 mb-1.5 text-brand" />
                      <p className="text-xs text-sand">Nota Baru masih kosong.</p>
                      <p className="text-[11px] text-faint mt-0.5">
                        Klik tombol <strong>"Pindah 1"</strong> pada Nota Asal untuk memasukkan item ke sini.
                      </p>
                    </div>
                  ) : (
                    newBillList.map((item) => (
                      <div
                        key={item.key}
                        className="p-3 rounded-xl border border-line bg-panel space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-cream">{item.name}</p>
                            {item.variantName && (
                              <p className="text-[11px] text-sand">{item.variantName}</p>
                            )}
                            {item.mods && item.mods.length > 0 && (
                              <p className="text-[10px] text-faint italic">
                                + {item.mods.map((m) => m.name).join(", ")}
                              </p>
                            )}
                          </div>
                          <p className="font-display font-bold tabular text-brand text-[13px] shrink-0">
                            {formatIDR(item.unitPrice * item.qty)}
                          </p>
                        </div>

                        {/* Tombol Kembalikan ke Nota Asal */}
                        <div className="flex items-center justify-between pt-1 border-t border-line/60">
                          <span className="font-mono font-bold text-cream">
                            {item.qty} pcs @ {formatIDR(item.unitPrice)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleMoveToOriginal(item.key, 1)}
                              className="btn-press flex items-center gap-1 px-2.5 py-1 rounded-lg border border-line-2 bg-coal text-sand text-[10.5px] font-bold hover:text-cream hover:border-brand/40 transition"
                              title="Kembalikan 1 pcs ke Nota Asal"
                            >
                              <ArrowLeft className="size-3" />
                              <span>Kembalikan 1</span>
                            </button>

                            {item.qty > 1 && (
                              <button
                                type="button"
                                onClick={() => handleMoveToOriginal(item.key, item.qty)}
                                className="btn-press flex items-center gap-1 px-2 py-1 rounded-lg border border-line-2 bg-coal text-sand text-[10.5px] font-bold hover:text-cream hover:border-brand/40 transition"
                                title="Kembalikan semua pcs ke Nota Asal"
                              >
                                <ChevronsLeft className="size-3" />
                                <span>Semua</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Subtotal Nota Baru */}
                <div className="border-t border-line p-3 bg-surface/40 text-xs space-y-1">
                  <div className="flex justify-between text-faint">
                    <span>Subtotal</span>
                    <span className="tabular">{formatIDR(newTotals.subtotal)}</span>
                  </div>
                  {newTotals.tax > 0 && (
                    <div className="flex justify-between text-faint">
                      <span>PB1 ({taxPct}%)</span>
                      <span className="tabular">{formatIDR(newTotals.tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 font-bold text-cream border-t border-line/50">
                    <span>Total Nota Baru</span>
                    <span className="font-display text-base tabular text-brand text-glow">
                      {formatIDR(newTotals.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Modal: Batal & Tombol Aksi Bayar Nota Baru */}
            <div className="border-t border-line px-5 sm:px-6 py-4 bg-surface/60 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-faint text-center sm:text-left">
                Setelah Nota Baru berhasil dibayar, sisa item Nota Asal tetap berada di keranjang untuk pembayaran selanjutnya.
              </p>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-press flex-1 sm:flex-initial rounded-xl border border-line-2 bg-coal px-4 py-2.5 text-xs font-bold text-sand hover:text-cream transition"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleProceedPayNewBill}
                  disabled={newBillList.length === 0}
                  className="btn-press flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-2.5 font-display text-xs sm:text-sm font-bold text-coal shadow-lg shadow-brand/25 hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none transition"
                >
                  <Check className="size-4 stroke-[3]" />
                  <span>Bayar Nota Baru Ini ({formatIDR(newTotals.grandTotal)})</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
