"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Minus, Plus, Trash2, ReceiptText, ShoppingBag, ChevronUp, ChevronDown, Scale, ArrowRight, CircleDollarSign,
} from "lucide-react";
import type { CartLine } from "@/lib/cart";
import { cartTotal, calculateOrderTotals } from "@/lib/cart";
import { formatIDR } from "@/lib/format";
import type { StoreSettingDto } from "@/lib/types";

export default function TicketPane({
  lines,
  storeSettings,
  subtotal: propSubtotal,
  serviceCharge: propServiceCharge,
  tax: propTax,
  grandTotal: propGrandTotal,
  onQty,
  onRemove,
  onClear,
  onPay,
  onOpenHistory,
  onCloseShift,
  onCashMovement,
  historyCount,
  cashierName = "Kasir",
}: {
  lines: CartLine[];
  storeSettings?: StoreSettingDto | null;
  subtotal?: number;
  serviceCharge?: number;
  tax?: number;
  grandTotal?: number;
  onQty: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
  onPay: () => void;
  onOpenHistory: () => void;
  onCloseShift?: () => void;
  onCashMovement?: () => void;
  historyCount: number;
  cashierName?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const rawSubtotal = propSubtotal ?? cartTotal(lines);
  const taxPct = storeSettings?.taxPercentage ?? 10;
  const servicePct = storeSettings?.serviceChargePercentage ?? 0;

  const computed = calculateOrderTotals(rawSubtotal, taxPct, servicePct);
  const subtotal = propSubtotal ?? computed.subtotal;
  const serviceCharge = propServiceCharge ?? computed.serviceCharge;
  const tax = propTax ?? computed.tax;
  const grandTotal = propGrandTotal ?? computed.grandTotal;

  const totalItems = lines.reduce((s, l) => s + l.qty, 0);

  const handleMobilePay = () => {
    setMobileOpen(false);
    onPay();
  };

  return (
    <>
      {/* =========================================================================
          1. DESKTOP / TABLET (>= sm): Sisi kanan tetap sebagai panel statis
         ========================================================================= */}
      <aside className="hidden sm:flex sm:w-[380px] xl:w-[420px] shrink-0 border-t sm:border-t-0 sm:border-l border-line bg-coal-2/70 flex-col min-h-0">
        <TicketHeader
          linesCount={lines.length}
          historyCount={historyCount}
          onOpenHistory={onOpenHistory}
          onCloseShift={onCloseShift}
          onCashMovement={onCashMovement}
          onClear={onClear}
        />
        <TicketItemList
          lines={lines}
          onQty={onQty}
          onRemove={onRemove}
        />
        <TicketSummary
          subtotal={subtotal}
          serviceCharge={serviceCharge}
          tax={tax}
          grandTotal={grandTotal}
          servicePct={servicePct}
          taxPct={taxPct}
          disabled={lines.length === 0}
          onPay={onPay}
        />
      </aside>

      {/* =========================================================================
          2. MOBILE (< sm): Sembunyi dari kanan, ganti Bottom Bar & Bottom Sheet
         ========================================================================= */}
      {/* Floating Bottom Bar trigger pada layar HP */}
      <div className="fixed inset-x-3 bottom-3 z-30 sm:hidden">
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {lines.length > 0 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="btn-press flex-1 flex items-center justify-between gap-3 rounded-2xl border border-brand/50 bg-coal-2/95 px-4 py-3.5 shadow-[0_14px_36px_rgba(0,0,0,0.7)] backdrop-blur-xl text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="relative grid size-10 place-items-center rounded-xl bg-brand text-coal font-bold shadow-md shadow-brand/40">
                    <ReceiptText className="size-5" />
                    <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-brand-2 px-1 py-0.5 text-[10px] font-bold text-cream tabular">
                      {totalItems}
                    </span>
                  </div>
                  <div>
                    <p className="font-display text-sm font-bold text-cream leading-tight">
                      {lines.length} Menu ({totalItems} item)
                    </p>
                    <p className="text-[10px] text-brand flex items-center gap-1 mt-0.5 font-medium">
                      <span>Tarik / ketuk untuk rincian</span>
                      <ChevronUp className="size-3" />
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-faint">Total</p>
                  <p className="font-display text-sm font-bold tabular text-brand">{formatIDR(grandTotal)}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={onPay}
                className="btn-press flex items-center justify-center gap-1.5 rounded-2xl bg-brand px-4 py-3.5 font-display text-sm font-bold text-coal shadow-[0_14px_36px_rgba(0,0,0,0.7)] backdrop-blur-xl shrink-0"
              >
                <span>Bayar</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-coal-2/95 px-4 py-2.5 shadow-ticket backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="btn-press flex items-center gap-2 text-faint text-xs font-medium hover:text-sand"
              >
                <ReceiptText className="size-4" />
                <span>Keranjang belanja kosong</span>
              </button>
              <div className="flex items-center gap-2">
                {onCloseShift && (
                  <button
                    type="button"
                    onClick={onCloseShift}
                    className="btn-press flex items-center gap-1 rounded-xl border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:border-amber-400/60"
                    title="Tutup Shift (Blind Z-Report)"
                  >
                    <Scale className="size-3.5" />
                    <span>Shift</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenHistory}
                  className="btn-press relative flex items-center gap-1.5 rounded-xl border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-sand hover:text-brand"
                  title="Pesanan hari ini"
                >
                  <ShoppingBag className="size-3.5" />
                  <span>Riwayat</span>
                  {historyCount > 0 && (
                    <span className="rounded-full bg-brand px-1.5 py-0.2 text-[10px] font-bold text-coal tabular">
                      {historyCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="btn-press rounded-xl border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-sand hover:text-cream"
                >
                  Buka Struk
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Drawer / Bottom Sheet saat mobileOpen = true pada layar HP */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 sm:hidden">
            {/* Backdrop gelap */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-coal/75 backdrop-blur-sm"
            />

            {/* Panel Bottom Sheet dengan gesture drag ke bawah */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 500) {
                  setMobileOpen(false);
                }
              }}
              className="absolute inset-x-0 bottom-0 max-h-[88dvh] flex flex-col rounded-t-[28px] border-t border-line-2 bg-coal-2 shadow-[0_-16px_48px_rgba(0,0,0,0.85)] z-10"
            >
              {/* Handle bar tarik drawer */}
              <div className="flex justify-center pt-2.5 pb-1">
                <div className="h-1.2 w-12 rounded-full bg-line-2/80" />
              </div>

              {/* Header Drawer */}
              <TicketHeader
                linesCount={lines.length}
                historyCount={historyCount}
                onOpenHistory={onOpenHistory}
                onCloseShift={onCloseShift}
                onCashMovement={onCashMovement}
                onClear={onClear}
                onClose={() => setMobileOpen(false)}
                isMobile
              />

              {/* Daftar item pesanan */}
              <TicketItemList
                lines={lines}
                onQty={onQty}
                onRemove={onRemove}
              />

              {/* Ringkasan & Tombol Bayar */}
              <TicketSummary
                subtotal={subtotal}
                serviceCharge={serviceCharge}
                tax={tax}
                grandTotal={grandTotal}
                servicePct={servicePct}
                taxPct={taxPct}
                disabled={lines.length === 0}
                onPay={handleMobilePay}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

/* -----------------------------------------------------------------------------
 * SUBKOMPONEN UNTUK KONSISTENSI DESKTOP & MOBILE BOTTOM SHEET
 * -------------------------------------------------------------------------- */

function TicketHeader({
  linesCount,
  historyCount,
  onOpenHistory,
  onCloseShift,
  onCashMovement,
  onClear,
  onClose,
  isMobile = false,
}: {
  linesCount: number;
  historyCount: number;
  onOpenHistory: () => void;
  onCloseShift?: () => void;
  onCashMovement?: () => void;
  onClear: () => void;
  onClose?: () => void;
  isMobile?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-line">
      <div className="flex items-center gap-2.5">
        <ReceiptText className="size-5 text-brand" />
        <div>
          <p className="font-display text-[15px] font-bold leading-none">Keranjang Pesanan</p>
          <p className="text-[10px] text-faint mt-1">{linesCount} menu dipilih</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Tombol Catat Kas Operasional (Petty Cash) */}
        {onCashMovement && (
          <button
            type="button"
            onClick={onCashMovement}
            className="btn-press relative grid size-9 place-items-center rounded-xl border border-line bg-panel text-sand hover:text-emerald-400 hover:border-emerald-400/40"
            title="Catat Kas Masuk / Keluar (Petty Cash)"
          >
            <CircleDollarSign className="size-4" />
          </button>
        )}

        {/* Tombol Tutup Shift (Blind Z-Report) */}
        {onCloseShift && (
          <button
            type="button"
            onClick={onCloseShift}
            className="btn-press relative grid size-9 place-items-center rounded-xl border border-line bg-panel text-sand hover:text-amber-400 hover:border-amber-400/40"
            title="Tutup Shift (Blind Z-Report)"
          >
            <Scale className="size-4" />
          </button>
        )}

        <button
          type="button"
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
          type="button"
          onClick={onClear}
          disabled={linesCount === 0}
          className="btn-press grid size-9 place-items-center rounded-xl border border-line bg-panel text-faint hover:text-red-400 hover:border-red-400/30 disabled:opacity-40"
          title="Kosongkan keranjang"
        >
          <Trash2 className="size-4" />
        </button>

        {isMobile && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="btn-press grid size-9 place-items-center rounded-xl border border-line bg-panel text-sand hover:text-cream"
            title="Tutup lembar struk"
          >
            <ChevronDown className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function TicketItemList({
  lines,
  onQty,
  onRemove,
}: {
  lines: CartLine[];
  onQty: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
}) {
  return (
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
              <p className="text-sm text-faint">Ketuk menu di katalog untuk mulai pesanan</p>
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
                  {l.variantName && (
                    <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-2">
                      {l.variantName}
                    </span>
                  )}
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
                  type="button"
                  onClick={() => onQty(l.key, -1)}
                  className="btn-press grid size-7 place-items-center rounded-md border border-line-2 bg-coal text-sand hover:text-cream"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-7 text-center font-display text-sm font-bold tabular">{l.qty}</span>
                <button
                  type="button"
                  onClick={() => onQty(l.key, 1)}
                  className="btn-press grid size-7 place-items-center rounded-md border border-brand/40 bg-brand/10 text-brand"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              <button
                type="button"
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
  );
}

function TicketSummary({
  subtotal,
  serviceCharge,
  tax,
  grandTotal,
  servicePct,
  taxPct,
  disabled,
  onPay,
}: {
  subtotal: number;
  serviceCharge: number;
  tax: number;
  grandTotal: number;
  servicePct: number;
  taxPct: number;
  disabled: boolean;
  onPay: () => void;
}) {
  return (
    <div className="border-t border-line px-5 py-4 bg-panel/50">
      <div className="space-y-1.5 mb-3 text-xs">
        <div className="flex items-center justify-between">
          <p className="text-faint">Subtotal</p>
          <p className="text-sand tabular">{formatIDR(subtotal)}</p>
        </div>

        {serviceCharge > 0 && (
          <div className="flex items-center justify-between text-sand">
            <p className="text-faint">Layanan ({servicePct}%)</p>
            <p className="tabular">{formatIDR(serviceCharge)}</p>
          </div>
        )}

        {tax > 0 && (
          <div className="flex items-center justify-between text-sand">
            <p className="text-faint">PB1 ({taxPct}%)</p>
            <p className="tabular">{formatIDR(tax)}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4 pt-2 border-t border-line/60">
        <p className="font-display text-base font-bold text-cream">Total Tagihan</p>
        <motion.p
          key={grandTotal}
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          className="font-display text-2xl font-bold tabular text-brand text-glow"
        >
          {formatIDR(grandTotal)}
        </motion.p>
      </div>

      {/* Tombol Utama Bayar Sekarang (Full Width - Anti Fraud) */}
      <button
        type="button"
        onClick={onPay}
        disabled={disabled}
        className="btn-press relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-brand py-4 font-display text-[15px] font-bold text-coal shadow-[0_16px_44px_-14px] shadow-brand/70 hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
      >
        <span>Bayar Sekarang</span>
        <ArrowRight className="size-4.5" />
      </button>

      <p className="mt-2.5 text-center text-[10px] text-faint">
        Struk hanya dicetak resmi setelah pembayaran lunas
      </p>
    </div>
  );
}
