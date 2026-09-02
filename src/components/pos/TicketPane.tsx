"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, Trash2, ReceiptText, ShoppingBag } from "lucide-react";
import type { CartLine } from "@/lib/cart";
import { cartTotal } from "@/lib/cart";
import { formatIDR } from "@/lib/format";

export default function TicketPane({
  lines,
  onQty,
  onRemove,
  onClear,
  onPay,
  onOpenHistory,
  historyCount,
}: {
  lines: CartLine[];
  onQty: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
  onPay: () => void;
  onOpenHistory: () => void;
  historyCount: number;
}) {
  const total = cartTotal(lines);

  return (
    <aside className="w-full sm:w-[380px] xl:w-[420px] shrink-0 border-t sm:border-t-0 sm:border-l border-line bg-coal-2/70 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line">
        <div className="flex items-center gap-2.5">
          <ReceiptText className="size-5 text-brand" />
          <div>
            <p className="font-display text-[15px] font-bold leading-none">Struk Aktif</p>
            <p className="text-[10px] text-faint mt-1">{lines.length} line item</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenHistory}
            className="btn-press relative grid size-9 place-items-center rounded-xl border border-line bg-panel text-sand hover:text-brand"
            title="Pesanan hari ini"
          >
            <ShoppingBag className="size-4" />
            {historyCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-brand px-1 py-0.5 text-[10px] font-bold text-coal tabular">
                {historyCount}
              </span>
            )}
          </button>
          <button
            onClick={onClear}
            disabled={lines.length === 0}
            className="btn-press grid size-9 place-items-center rounded-xl border border-line bg-panel text-faint hover:text-red-400 hover:border-red-400/30 disabled:opacity-40"
            title="Kosongkan struk"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[140px]">
        <AnimatePresence initial={false}>
          {lines.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full grid place-items-center py-10"
            >
              <div className="text-center">
                <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl border border-dashed border-line-2 text-faint">
                  <ReceiptText className="size-6" />
                </div>
                <p className="text-sm text-faint">Ketuk menu untuk mulai pesanan</p>
              </div>
            </motion.div>
          )}
          {lines.map((l) => (
            <motion.div
              key={l.key}
              layout
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24, height: 0, marginBottom: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="rounded-xl border border-line bg-panel px-3.5 py-3"
            >
              <div className="flex items-start gap-3">
                <span className="mt-1 size-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold leading-tight text-cream">
                    {l.name}
                    {l.variantName && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-2">{l.variantName}</span>}
                  </p>
                  {l.mods.length > 0 && (
                    <p className="mt-0.5 text-[10.5px] text-faint">+ {l.mods.map((m) => m.name).join(", ")}</p>
                  )}
                  <p className="mt-1 text-[11px] text-sand tabular">{formatIDR(l.unitPrice)}</p>
                </div>
                <p className="font-display text-sm font-bold tabular text-cream whitespace-nowrap">
                  {formatIDR(l.unitPrice * l.qty)}
                </p>
              </div>
              <div className="mt-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onQty(l.key, -1)}
                    className="btn-press grid size-7 place-items-center rounded-md border border-line-2 bg-coal text-sand hover:text-cream"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-7 text-center font-display text-sm font-bold tabular">{l.qty}</span>
                  <button
                    onClick={() => onQty(l.key, 1)}
                    className="btn-press grid size-7 place-items-center rounded-md border border-brand/40 bg-brand/10 text-brand"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => onRemove(l.key)}
                  className="btn-press text-[11px] font-semibold text-faint hover:text-red-400"
                >
                  Hapus
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="border-t border-line px-5 py-4 bg-panel/50">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-faint">Subtotal</p>
          <p className="text-xs text-sand tabular">{formatIDR(total)}</p>
        </div>
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-base font-bold">Total Tagihan</p>
          <motion.p
            key={total}
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            className="font-display text-2xl font-bold tabular text-brand text-glow"
          >
            {formatIDR(total)}
          </motion.p>
        </div>
        <button
          onClick={onPay}
          disabled={lines.length === 0}
          className="btn-press relative w-full overflow-hidden rounded-2xl bg-brand py-4 font-display text-[15px] font-bold text-coal shadow-[0_16px_44px_-14px] shadow-brand/70 hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
        >
          Bayar Sekarang
        </button>
        <p className="mt-2.5 text-center text-[10px] text-faint">Stok bahan otomatis terpotong saat transaksi tersimpan</p>
      </div>
    </aside>
  );
}
