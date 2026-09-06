"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Banknote,
  QrCode,
  CreditCard,
  Building2,
  CloudOff,
  CloudUpload,
  Ban,
} from "lucide-react";
import type { TodayOrderDto } from "@/lib/types";
import { formatIDR, formatTime } from "@/lib/format";

const PAY_ICON: Record<string, typeof Banknote> = {
  cash: Banknote,
  qris: QrCode,
  debit: CreditCard,
  transfer: Building2,
};

const PAY_LABEL: Record<string, string> = {
  cash: "Tunai",
  qris: "QRIS",
  debit: "Debit",
  transfer: "Transfer",
};

export default function OrdersDrawer({
  open,
  orders,
  queueCount,
  onClose,
  onVoidOrder,
}: {
  open: boolean;
  orders: TodayOrderDto[];
  queueCount: number;
  onClose: () => void;
  onVoidOrder?: (order: TodayOrderDto) => void;
}) {
  const activeOrders = orders.filter((o) => o.status !== "void");
  const todayTotal = activeOrders.reduce((s, o) => s + o.total, 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-coal/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: 440 }}
            animate={{ x: 0 }}
            exit={{ x: 440 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-full max-w-md border-l border-line bg-coal-2 flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <div>
                <p className="font-display text-base font-bold">Pesanan Hari Ini</p>
                <p className="text-[11px] text-faint mt-0.5">
                  {activeOrders.length} transaksi aktif •{" "}
                  <span className="text-brand font-semibold tabular">{formatIDR(todayTotal)}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="btn-press grid size-9 place-items-center rounded-xl border border-line bg-panel text-faint hover:text-cream"
              >
                <X className="size-4" />
              </button>
            </div>

            {queueCount > 0 && (
              <div className="mx-4 mt-4 flex items-center gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-3">
                <CloudOff className="size-4 text-amber-400 shrink-0" />
                <p className="text-[11.5px] text-amber-300">
                  {queueCount} pesanan offline menunggu sinkron ke server.
                </p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {orders.length === 0 && (
                <p className="py-16 text-center text-sm text-faint">Belum ada transaksi hari ini.</p>
              )}
              {orders.map((o) => {
                const Icon = PAY_ICON[o.paymentMethod] ?? Banknote;
                const isVoided = o.status === "void";

                return (
                  <div
                    key={o.id}
                    className={`flex flex-col gap-2 rounded-2xl border p-3.5 transition-colors ${
                      isVoided
                        ? "border-red-500/20 bg-red-950/10 opacity-70"
                        : "border-line bg-panel hover:border-line-2"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`grid size-9 place-items-center rounded-xl border ${
                            isVoided
                              ? "border-red-500/30 bg-red-500/10 text-red-400"
                              : "border-line-2/60 bg-coal text-brand"
                          }`}
                        >
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className={`text-[13px] font-bold font-display tabular ${isVoided ? "line-through text-red-300" : "text-cream"}`}>
                              {o.orderNumber}
                            </p>
                            {isVoided && (
                              <span className="rounded-md border border-red-500/40 bg-red-500/15 px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-red-400">
                                VOID
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-faint mt-0.5">
                            {formatTime(o.createdAt)} • {o.cashierName.split(" ")[0]}
                            {o.customerName && (
                              <span className="text-sand font-medium"> • {o.customerName}</span>
                            )}
                            {o.orderType && (
                              <span className="uppercase text-[10px]">
                                {" "}• {o.orderType === "take-away" ? "Take Away" : "Dine In"}
                                {o.tableNumber ? ` (${o.tableNumber})` : ""}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={`font-display text-sm font-bold tabular ${
                            isVoided ? "line-through text-faint" : "text-cream"
                          }`}
                        >
                          {formatIDR(o.total)}
                        </p>
                        <p className="text-[10px] text-faint mt-0.5 uppercase">
                          {PAY_LABEL[o.paymentMethod] ?? o.paymentMethod}
                        </p>
                      </div>
                    </div>

                    {/* Baris bawah: Item count, Diskon, status sync & Tombol Void */}
                    <div className="flex items-center justify-between border-t border-line/50 pt-2 text-[10.5px] text-faint">
                      <div className="flex items-center gap-2">
                        <span>{o.itemCount} item</span>
                        {(o.discountAmount ?? 0) > 0 && (
                          <span className="text-amber-400">
                            • Diskon {formatIDR(o.discountAmount ?? 0)}
                          </span>
                        )}
                        {o.isOfflineSync && (
                          <span className="inline-flex items-center gap-1 text-amber-400">
                            <CloudUpload className="size-3" /> sync
                          </span>
                        )}
                      </div>

                      {!isVoided && onVoidOrder && (
                        <button
                          type="button"
                          onClick={() => onVoidOrder(o)}
                          className="btn-press flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] font-bold text-red-400 hover:bg-red-500/20 hover:border-red-500/50"
                          title="Batalkan transaksi ini dengan otorisasi supervisor"
                        >
                          <Ban className="size-3" />
                          <span>Void Transaksi</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
