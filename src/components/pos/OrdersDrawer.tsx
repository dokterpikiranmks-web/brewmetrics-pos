"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Banknote, QrCode, CreditCard, CloudOff, CloudUpload } from "lucide-react";
import type { TodayOrderDto } from "@/lib/types";
import { formatIDR, formatTime } from "@/lib/format";

const PAY_ICON: Record<string, typeof Banknote> = { cash: Banknote, qris: QrCode, debit: CreditCard };
const PAY_LABEL: Record<string, string> = { cash: "Tunai", qris: "QRIS", debit: "Debit" };

export default function OrdersDrawer({
  open,
  orders,
  queueCount,
  onClose,
}: {
  open: boolean;
  orders: TodayOrderDto[];
  queueCount: number;
  onClose: () => void;
}) {
  const todayTotal = orders.reduce((s, o) => s + o.total, 0);
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
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-full max-w-sm border-l border-line bg-coal-2 flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <div>
                <p className="font-display text-base font-bold">Pesanan Hari Ini</p>
                <p className="text-[11px] text-faint mt-0.5">
                  {orders.length} transaksi • <span className="text-brand font-semibold tabular">{formatIDR(todayTotal)}</span>
                </p>
              </div>
              <button onClick={onClose} className="btn-press grid size-9 place-items-center rounded-xl border border-line bg-panel text-faint hover:text-cream">
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

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {orders.length === 0 && (
                <p className="py-16 text-center text-sm text-faint">Belum ada transaksi hari ini.</p>
              )}
              {orders.map((o) => {
                const Icon = PAY_ICON[o.paymentMethod] ?? Banknote;
                return (
                  <div key={o.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3.5 py-3">
                    <div className="grid size-9 place-items-center rounded-lg border border-line-2/60 bg-coal text-brand">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-bold font-display tabular">{o.orderNumber}</p>
                      <p className="text-[10.5px] text-faint truncate">
                        {formatTime(o.createdAt)} • {o.itemCount} item • {PAY_LABEL[o.paymentMethod] ?? o.paymentMethod} • {o.cashierName.split(" ")[0]}
                        {o.isOfflineSync && (
                          <span className="ml-1.5 inline-flex items-center gap-1 text-amber-400">
                            <CloudUpload className="size-3" /> sync
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="font-display text-sm font-bold tabular text-cream">{formatIDR(o.total)}</p>
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
