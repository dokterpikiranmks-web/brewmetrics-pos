"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Minus,
  Plus,
  Trash2,
  ReceiptText,
  ShoppingBag,
  Scale,
  ArrowRight,
  CircleDollarSign,
  X,
  Tag,
  Percent,
  CircleCheck,
  Phone,
  Sparkles,
  Award,
  Loader2,
  Split,
  Camera,
  UtensilsCrossed,
  Building2,
} from "lucide-react";
import { SelfieAttendanceModal } from "@/components/attendance/SelfieAttendanceModal";
import { useBranch } from "@/context/BranchContext";
import { cartTotal, calculateOrderTotals, type CartLine, type OrderTotals } from "@/lib/cart";
import { formatIDR } from "@/lib/format";
import type { StoreSettingDto, OrderType, DiscountType, DiscountDto, DiscountScope, SessionUser } from "@/lib/types";

interface TicketPaneProps {
  lines: CartLine[];
  storeSettings?: StoreSettingDto | null;
  customerName: string;
  setCustomerName: (name: string) => void;
  customerPhone?: string;
  setCustomerPhone?: (phone: string) => void;
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  tableNumber: string;
  setTableNumber: (table: string) => void;
  discount: {
    type: DiscountType;
    value: number;
    name?: string;
    id?: number;
    minOrder?: number;
    scope?: DiscountScope;
    targetProductId?: number | null;
  } | null;
  setDiscount: (
    discount: {
      type: DiscountType;
      value: number;
      name?: string;
      id?: number;
      minOrder?: number;
      scope?: DiscountScope;
      targetProductId?: number | null;
    } | null
  ) => void;
  onQty: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
  onPay: () => void;
  onOpenSplitBill?: () => void;
  onOpenHistory: () => void;
  onCloseShift?: () => void;
  onCashMovement?: () => void;
  onAddSurcharge?: (name: string, amount: number) => void;
  historyCount: number;
  cashierName?: string;
  currentUser?: SessionUser | null;
}

export default function TicketPane({
  lines,
  storeSettings,
  customerName,
  setCustomerName,
  customerPhone = "",
  setCustomerPhone,
  orderType,
  setOrderType,
  tableNumber,
  setTableNumber,
  discount,
  setDiscount,
  onQty,
  onRemove,
  onClear,
  onPay,
  onOpenSplitBill,
  onOpenHistory,
  onCloseShift,
  onCashMovement,
  onAddSurcharge,
  historyCount,
  cashierName = "Kasir",
  currentUser,
}: TicketPaneProps) {
  const { currentBranch } = useBranch();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [surchargeModalOpen, setSurchargeModalOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);

  const rawSubtotal = cartTotal(lines);
  const taxPct = storeSettings?.taxPercentage ?? 10;
  const servicePct = storeSettings?.serviceChargePercentage ?? 0;

  const totals: OrderTotals = calculateOrderTotals(
    rawSubtotal,
    taxPct,
    servicePct,
    discount?.type,
    discount?.value ?? 0,
    discount?.scope ?? "cart",
    discount?.targetProductId,
    lines
  );

  const totalItems = lines.reduce((s, l) => s + l.qty, 0);

  const handleMobilePay = () => {
    setMobileOpen(false);
    onPay();
  };

  return (
    <>
      {/* =========================================================================
          1. DESKTOP / TABLET (>= md): Sisi kanan tetap sebagai panel berdampingan
         ========================================================================= */}
      <aside className="hidden md:flex md:w-[370px] xl:w-[410px] shrink-0 border-l border-line bg-coal-2/70 flex-col min-h-0 h-full overflow-hidden">
        <TicketHeader
          linesCount={lines.length}
          totalItems={totalItems}
          historyCount={historyCount}
          cashierName={cashierName}
          onOpenSplitBill={onOpenSplitBill}
          onOpenHistory={onOpenHistory}
          onCloseShift={onCloseShift}
          onCashMovement={onCashMovement}
          onOpenAttendance={() => setAttendanceModalOpen(true)}
          onClear={onClear}
        />

        <OrderMetaForm
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          orderType={orderType}
          setOrderType={setOrderType}
          tableNumber={tableNumber}
          setTableNumber={setTableNumber}
        />

        <TicketItemList lines={lines} onQty={onQty} onRemove={onRemove} />

        <TicketSummary
          totals={totals}
          discount={discount}
          servicePct={servicePct}
          taxPct={taxPct}
          totalItems={totalItems}
          disabled={lines.length === 0}
          onOpenDiscount={() => setDiscountModalOpen(true)}
          onRemoveDiscount={() => setDiscount(null)}
          onOpenSurcharge={() => setSurchargeModalOpen(true)}
          onOpenSplitBill={onOpenSplitBill}
          onPay={onPay}
        />
      </aside>

      {/* =========================================================================
          2. STICKY FLOATING CART BAR (Khusus Layar HP / < md)
         ========================================================================= */}
      <AnimatePresence>
        {!mobileOpen && totalItems > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="fixed bottom-0 inset-x-0 z-40 bg-zinc-900/95 border-t border-zinc-800 p-3 shadow-2xl backdrop-blur-md md:hidden pointer-events-auto"
            style={{
              paddingBottom: "calc(12px + env(safe-area-inset-bottom, 12px))",
            }}
          >
            <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="btn-press flex items-center gap-3 cursor-pointer min-w-0 flex-1 text-left"
              >
                <div className="relative grid size-10 place-items-center rounded-xl bg-brand/15 border border-brand/40 text-brand shrink-0">
                  <ReceiptText className="size-5" />
                  <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-brand px-1 py-0.5 text-[10px] font-bold text-coal tabular">
                    {totalItems}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-sand uppercase tracking-wider leading-none">
                    {totalItems} Item • {customerName || "Umum"}
                  </p>
                  <p className="font-display text-base font-bold text-cream tabular leading-tight mt-1">
                    {formatIDR(totals.grandTotal)}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="btn-press flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 font-display text-xs font-bold text-coal shadow-[0_4px_16px_-4px] shadow-brand/60 shrink-0 hover:brightness-110"
              >
                <span>Lihat / Bayar</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          3. BOTTOM SHEET / DRAWER KERANJANG KASIR (Layar Mobile < md)
         ========================================================================= */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />

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
              className="relative z-10 w-full max-h-[88vh] max-h-[88dvh] flex flex-col rounded-t-[28px] border-t border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden"
              style={{
                maxHeight: "calc(var(--vh, 1vh) * 88)",
                paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
              }}
            >
              <div className="flex justify-center pt-2.5 pb-1 shrink-0">
                <div className="h-1.5 w-12 rounded-full bg-zinc-700" />
              </div>

              <TicketHeader
                linesCount={lines.length}
                totalItems={totalItems}
                historyCount={historyCount}
                cashierName={cashierName}
                onOpenSplitBill={() => {
                  setMobileOpen(false);
                  onOpenSplitBill?.();
                }}
                onOpenHistory={onOpenHistory}
                onCloseShift={onCloseShift}
                onCashMovement={onCashMovement}
                onOpenAttendance={() => {
                  setMobileOpen(false);
                  setAttendanceModalOpen(true);
                }}
                onClear={onClear}
                onClose={() => setMobileOpen(false)}
                isMobile
              />

              <OrderMetaForm
                customerName={customerName}
                setCustomerName={setCustomerName}
                customerPhone={customerPhone}
                setCustomerPhone={setCustomerPhone}
                orderType={orderType}
                setOrderType={setOrderType}
                tableNumber={tableNumber}
                setTableNumber={setTableNumber}
              />

              <TicketItemList lines={lines} onQty={onQty} onRemove={onRemove} />

              <TicketSummary
                totals={totals}
                discount={discount}
                servicePct={servicePct}
                taxPct={taxPct}
                totalItems={totalItems}
                disabled={lines.length === 0}
                onOpenDiscount={() => setDiscountModalOpen(true)}
                onRemoveDiscount={() => setDiscount(null)}
                onOpenSurcharge={() => setSurchargeModalOpen(true)}
                onOpenSplitBill={() => {
                  setMobileOpen(false);
                  onOpenSplitBill?.();
                }}
                onPay={handleMobilePay}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Pilihan Diskon & Promo */}
      <PromoSelectModal
        open={discountModalOpen}
        lines={lines}
        subtotal={rawSubtotal}
        outletId={currentUser?.outletId}
        branchId={currentBranch}
        currentDiscount={discount}
        onClose={() => setDiscountModalOpen(false)}
        onApply={(d) => {
          setDiscount(d);
          setDiscountModalOpen(false);
        }}
      />

      {/* Modal Tambah Biaya Tambahan (Surcharge) */}
      <CustomSurchargeModal
        open={surchargeModalOpen}
        onClose={() => setSurchargeModalOpen(false)}
        onAdd={onAddSurcharge}
      />

      {/* Modal Absensi Selfie Kasir */}
      <SelfieAttendanceModal
        isOpen={attendanceModalOpen}
        onClose={() => setAttendanceModalOpen(false)}
        currentUser={currentUser}
      />
    </>
  );
}

/* -----------------------------------------------------------------------------
 * SUBKOMPONEN FORM DATA PELANGGAN & TIPE PESANAN
 * -------------------------------------------------------------------------- */

function OrderMetaForm({
  customerName,
  setCustomerName,
  customerPhone = "",
  setCustomerPhone,
  orderType,
  setOrderType,
  tableNumber,
  setTableNumber,
}: {
  customerName: string;
  setCustomerName: (v: string) => void;
  customerPhone?: string;
  setCustomerPhone?: (v: string) => void;
  orderType: OrderType;
  setOrderType: (v: OrderType) => void;
  tableNumber: string;
  setTableNumber: (v: string) => void;
}) {
  const [matchedCustomer, setMatchedCustomer] = useState<{
    id: number;
    name: string;
    phone: string;
    totalOrders: number;
    totalSpend: number;
  } | null>(null);
  const [searching, setSearching] = useState(false);

  // Auto-lookup customer when phone is typed (>= 4 digits)
  useEffect(() => {
    const phone = customerPhone.trim();
    if (phone.length < 4) {
      setMatchedCustomer(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(phone)}`);
        if (res.ok) {
          const data = await res.json();
          const list: any[] = data.customers || [];
          const cleanPhone = phone.replace(/\D/g, "");
          const exact = list.find((c) => c && c.phone && c.phone.replace(/\D/g, "") === cleanPhone);
          const match = exact || list[0] || null;

          if (match) {
            setMatchedCustomer(match);
            if (!customerName || customerName === "Umum") {
              setCustomerName(match.name);
            }
          } else {
            setMatchedCustomer(null);
          }
        }
      } catch (err) {
        console.error("Lookup customer error:", err);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [customerPhone]);

  return (
    <div className="px-3.5 sm:px-4 py-2 bg-coal/75 border-b border-line space-y-2 shrink-0">
      {/* Input No HP & Mini CRM Lookup */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-faint" />
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone?.(e.target.value)}
            placeholder="No. HP Pelanggan (CRM)..."
            className="w-full rounded-xl border border-line bg-panel py-1.5 pl-7 pr-7 text-xs text-cream placeholder:text-faint outline-none focus:border-brand/40"
          />
          {searching && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 animate-spin text-brand" />
          )}
        </div>

        {matchedCustomer && (
          <div
            className="flex items-center gap-1 rounded-xl bg-brand/15 border border-brand/40 px-2 py-1 text-[10px] font-bold text-brand shrink-0"
            title={`Pelanggan Setia: ${matchedCustomer.name} (${matchedCustomer.totalOrders}x belanja)`}
          >
            <Award className="size-3 text-brand" />
            <span>Setia ({matchedCustomer.totalOrders}x)</span>
          </div>
        )}
      </div>

      {/* Input Nama Pelanggan */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nama Pelanggan…"
            className="w-full rounded-xl border border-line bg-panel py-1.5 px-3 text-xs text-cream placeholder:text-faint outline-none focus:border-brand/40"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setCustomerName("Umum");
            setCustomerPhone?.("");
            setMatchedCustomer(null);
          }}
          className={`btn-press rounded-xl px-2.5 py-1.5 text-[11px] font-semibold border transition-colors ${
            customerName === "Umum" && !customerPhone
              ? "bg-brand/15 border-brand/40 text-brand font-bold"
              : "border-line bg-panel text-faint hover:text-sand"
          }`}
          title="Isi nama Umum"
        >
          Umum
        </button>
      </div>

      {/* Tipe Pesanan & Meja */}
      <div className="flex items-center gap-2">
        <div className="flex-1 grid grid-cols-2 p-0.5 rounded-xl bg-panel border border-line">
          <button
            type="button"
            onClick={() => setOrderType("dine-in")}
            className={`py-1 text-center text-xs font-semibold rounded-lg transition-colors ${
              orderType === "dine-in"
                ? "bg-brand text-coal font-bold shadow-sm"
                : "text-faint hover:text-cream"
            }`}
          >
            Dine In
          </button>
          <button
            type="button"
            onClick={() => setOrderType("take-away")}
            className={`py-1 text-center text-xs font-semibold rounded-lg transition-colors ${
              orderType === "take-away"
                ? "bg-brand text-coal font-bold shadow-sm"
                : "text-faint hover:text-cream"
            }`}
          >
            Take Away
          </button>
        </div>

        {orderType === "dine-in" && (
          <div className="w-28 relative">
            <input
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="No. Meja"
              className="w-full rounded-xl border border-line bg-panel py-1 px-2.5 text-xs text-cream placeholder:text-faint outline-none focus:border-brand/40 text-center font-bold"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * SUBKOMPONEN TICKET HEADER
 * -------------------------------------------------------------------------- */

function TicketHeader({
  linesCount,
  totalItems,
  historyCount,
  cashierName = "Kasir",
  onOpenSplitBill,
  onOpenHistory,
  onCloseShift,
  onCashMovement,
  onOpenAttendance,
  onClear,
  onClose,
  isMobile = false,
}: {
  linesCount: number;
  totalItems: number;
  historyCount: number;
  cashierName?: string;
  onOpenSplitBill?: () => void;
  onOpenHistory: () => void;
  onCloseShift?: () => void;
  onCashMovement?: () => void;
  onOpenAttendance?: () => void;
  onClear: () => void;
  onClose?: () => void;
  isMobile?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-line shrink-0">
      <div className="flex items-center gap-2.5">
        <ReceiptText className="size-5 text-brand" />
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-display text-[15px] font-bold leading-none text-cream">
              Keranjang
            </p>
            {totalItems > 0 && (
              <span className="rounded-full bg-brand/20 px-1.5 py-0.2 text-[10px] font-bold text-brand tabular">
                {totalItems}
              </span>
            )}
          </div>
          <p className="text-[10px] text-faint mt-0.5">
            Kasir: <strong className="text-sand">{cashierName}</strong>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {onCashMovement && (
          <button
            type="button"
            onClick={onCashMovement}
            className="btn-press relative grid size-8 sm:size-9 place-items-center rounded-xl border border-line bg-panel text-sand hover:text-emerald-400 hover:border-emerald-400/40"
            title="Catat Kas Operasional (Petty Cash)"
          >
            <CircleDollarSign className="size-4" />
          </button>
        )}

        {onCloseShift && (
          <button
            type="button"
            onClick={onCloseShift}
            className="btn-press relative grid size-8 sm:size-9 place-items-center rounded-xl border border-line bg-panel text-sand hover:text-amber-400 hover:border-amber-400/40"
            title="Tutup Shift (Blind Z-Report)"
          >
            <Scale className="size-4" />
          </button>
        )}

        {onOpenAttendance && (
          <button
            type="button"
            onClick={onOpenAttendance}
            className="btn-press relative grid size-8 sm:size-9 place-items-center rounded-xl border border-line bg-panel text-sand hover:text-brand hover:border-brand/40"
            title="Absensi Foto Selfie Wajah"
          >
            <Camera className="size-4" />
          </button>
        )}

        {onOpenSplitBill && (
          <button
            type="button"
            onClick={onOpenSplitBill}
            disabled={linesCount === 0 || totalItems < 2}
            className="btn-press relative grid size-8 sm:size-9 place-items-center rounded-xl border border-line bg-panel text-sand hover:text-brand hover:border-brand/40 disabled:opacity-40 disabled:pointer-events-none"
            title="Split Nota (Pecah Tagihan)"
          >
            <Split className="size-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onOpenHistory}
          className="btn-press relative grid size-8 sm:size-9 place-items-center rounded-xl border border-line bg-panel text-sand hover:text-brand"
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
          className="btn-press grid size-8 sm:size-9 place-items-center rounded-xl border border-line bg-panel text-faint hover:text-red-400 hover:border-red-400/30 disabled:opacity-40"
          title="Kosongkan keranjang"
        >
          <Trash2 className="size-4" />
        </button>

        {isMobile && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="btn-press grid size-8 sm:size-9 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-sand hover:text-cream ml-1"
            title="Tutup lembar keranjang"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * SUBKOMPONEN DAFTAR ITEM TIKET
 * -------------------------------------------------------------------------- */

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
    <div
      className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 space-y-2.5 min-h-[140px] gpu-scroll overscroll-contain"
      style={{
        transform: "translate3d(0, 0, 0)",
        willChange: "transform, scroll-position",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {lines.length === 0 && (
        <div className="flex h-full min-h-[160px] flex-col items-center justify-center text-center text-faint">
          <ReceiptText className="size-8 opacity-30 mb-2 text-sand" />
          <p className="text-xs">Keranjang masih kosong.</p>
          <p className="text-[11px] text-faint mt-0.5">Ketuk menu di katalog untuk menambahkan.</p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {lines.map((l) => (
          <motion.div
            key={l.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.16 }}
            className="rounded-2xl border border-line bg-panel p-3 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {l.isSurcharge ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold uppercase tracking-wider shrink-0 border border-amber-500/30">
                      Biaya
                    </span>
                  ) : (
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: l.color }}
                    />
                  )}
                  <p className="font-semibold text-cream truncate">{l.name}</p>
                </div>
                {l.variantName && (
                  <p className="text-[11px] text-sand mt-0.5 font-medium">{l.variantName}</p>
                )}
                {l.mods.length > 0 && (
                  <p className="text-[10px] text-faint mt-0.5 leading-snug">
                    + {l.mods.map((m) => m.name).join(", ")}
                  </p>
                )}
              </div>
              <p className="font-display font-bold tabular text-sand text-[13px] shrink-0">
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

/* -----------------------------------------------------------------------------
 * SUBKOMPONEN RINGKASAN HARGA & TOMBOL BAYAR
 * -------------------------------------------------------------------------- */

function TicketSummary({
  totals,
  discount,
  servicePct,
  taxPct,
  totalItems = 0,
  disabled,
  onOpenDiscount,
  onRemoveDiscount,
  onOpenSurcharge,
  onOpenSplitBill,
  onPay,
}: {
  totals: OrderTotals;
  discount?: {
    id?: number;
    name?: string;
    type: DiscountType;
    value: number;
    minOrder?: number;
    scope?: DiscountScope;
    targetProductId?: number | null;
  } | null;
  servicePct: number;
  taxPct: number;
  totalItems?: number;
  disabled: boolean;
  onOpenDiscount: () => void;
  onRemoveDiscount: () => void;
  onOpenSurcharge?: () => void;
  onOpenSplitBill?: () => void;
  onPay: () => void;
}) {
  return (
    <div className="border-t border-line px-4 sm:px-5 py-3 sm:py-3.5 bg-panel/50 shrink-0">
      <div className="space-y-1.5 mb-3 text-xs">
        <div className="flex items-center justify-between">
          <p className="text-faint">Subtotal</p>
          <p className="text-sand tabular">{formatIDR(totals.subtotal)}</p>
        </div>

        {/* Diskon Transaksi */}
        {totals.discountAmount > 0 ? (
          <div className="flex items-center justify-between text-amber-400">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate">
                {discount?.name
                  ? `${discount.name}${discount.scope === "product" ? " (Per Menu)" : ""}`
                  : `Diskon ${totals.discountType === "percentage" ? `(${totals.discountValue}%)` : "(Nominal)"}`}
              </span>
              <button
                type="button"
                onClick={onOpenDiscount}
                className="text-[10px] text-faint hover:text-cream underline shrink-0"
              >
                Ubah
              </button>
              <button
                type="button"
                onClick={onRemoveDiscount}
                className="text-[10px] text-red-400 hover:text-red-300 ml-0.5 shrink-0"
                title="Hapus diskon"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
            <p className="tabular font-semibold shrink-0">- {formatIDR(totals.discountAmount)}</p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onOpenDiscount}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline disabled:opacity-40"
            >
              <Tag className="size-3.5" />
              <span>+ Pilih Promo / Diskon</span>
            </button>
          </div>
        )}

        <div className="flex items-center justify-between pt-0.5">
          <button
            type="button"
            onClick={onOpenSurcharge}
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Plus className="size-3.5" />
            <span>+ Biaya Tambahan</span>
          </button>
        </div>

        {totals.discountAmount > 0 && (
          <div className="flex items-center justify-between text-sand">
            <p className="text-faint">Subtotal Stlh Diskon</p>
            <p className="tabular">{formatIDR(totals.subtotalAfterDiscount)}</p>
          </div>
        )}

        {totals.serviceCharge > 0 && (
          <div className="flex items-center justify-between text-sand">
            <p className="text-faint">Layanan ({servicePct}%)</p>
            <p className="tabular">{formatIDR(totals.serviceCharge)}</p>
          </div>
        )}

        {totals.tax > 0 && (
          <div className="flex items-center justify-between text-sand">
            <p className="text-faint">PB1 ({taxPct}%)</p>
            <p className="tabular">{formatIDR(totals.tax)}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-3 pt-2 border-t border-line/60">
        <p className="font-display text-base font-bold text-cream">Total Tagihan</p>
        <motion.p
          key={totals.grandTotal}
          initial={{ scale: 1.06 }}
          animate={{ scale: 1 }}
          className="font-display text-xl sm:text-2xl font-bold tabular text-brand text-glow"
        >
          {formatIDR(totals.grandTotal)}
        </motion.p>
      </div>

      <div className="flex items-center gap-2">
        {onOpenSplitBill && (
          <button
            type="button"
            onClick={onOpenSplitBill}
            disabled={disabled || totalItems < 2}
            className="btn-press flex items-center justify-center gap-1.5 rounded-2xl border border-line bg-panel py-3.5 px-3.5 font-display text-xs font-bold text-sand hover:text-brand hover:border-brand/40 disabled:opacity-40 disabled:pointer-events-none shrink-0 transition-colors"
            title="Pecah pesanan menjadi 2 nota pembayaran"
          >
            <Split className="size-4 text-brand" />
            <span>Split Nota</span>
          </button>
        )}
        <button
          type="button"
          onClick={onPay}
          disabled={disabled}
          className="btn-press relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-brand py-3.5 sm:py-3.5 font-display text-sm sm:text-[15px] font-bold text-coal shadow-[0_16px_44px_-14px] shadow-brand/70 hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
        >
          <span>Bayar Sekarang</span>
          <ArrowRight className="size-4.5" />
        </button>
      </div>

      <p className="mt-1.5 text-center text-[10px] text-faint">
        Struk dicetak setelah pembayaran lunas
      </p>
    </div>
  );
}

/* -----------------------------------------------------------------------------
 * MODAL PILIH PROMO & DISKON (MASTER PROMO)
 * -------------------------------------------------------------------------- */

/* -----------------------------------------------------------------------------
 * MEMOIZED PROMO CARD COMPONENT
 * - React.memo avoids CPU re-renders
 * - onPointerDown eliminates mobile touch delay
 * - GPU-friendly styling (no costly backdrop blur or multi-layer box shadows)
 * -------------------------------------------------------------------------- */
interface PromoCardProps {
  promo: DiscountDto;
  eligible: boolean;
  isSelected: boolean;
  estimatedDiscount: number;
  subtotal: number;
  targetInCart: boolean;
  onApply: (promo: DiscountDto) => void;
}

const PromoCard = memo(function PromoCard({
  promo,
  eligible,
  isSelected,
  estimatedDiscount,
  subtotal,
  targetInCart,
  onApply,
}: PromoCardProps) {
  const isProductScope = promo.scope === "product";
  const meetsMinOrder = subtotal >= promo.minOrder;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 0 && eligible) {
        onApply(promo);
      }
    },
    [eligible, onApply, promo]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && eligible) {
        e.preventDefault();
        onApply(promo);
      }
    },
    [eligible, onApply, promo]
  );

  return (
    <div
      role="button"
      tabIndex={eligible ? 0 : -1}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      className={`promo-card relative rounded-2xl border p-3.5 transition-colors text-left flex flex-col justify-between gap-2.5 select-none touch-manipulation ${
        isSelected
          ? "border-brand bg-brand/10 border-2"
          : eligible
          ? "border-line bg-panel hover:border-brand/40 hover:bg-panel/90 cursor-pointer"
          : "border-line/40 bg-panel/30 opacity-60 cursor-not-allowed"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="font-display text-sm font-bold text-cream truncate">
              {promo.name}
            </h4>
            <span
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                promo.type === "percentage"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              }`}
            >
              {promo.type === "percentage" ? (
                <>
                  <Percent className="size-2.5" />
                  <span>{promo.value}%</span>
                </>
              ) : (
                <span>Potongan {formatIDR(promo.value)}</span>
              )}
            </span>
          </div>

          {/* Scope & Branch Tags */}
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            {isProductScope ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                <UtensilsCrossed className="size-2.5" />
                <span>Menu: {promo.targetProductName || `Item #${promo.targetProductId}`}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                <Tag className="size-2.5" />
                <span>Total Belanja</span>
              </span>
            )}

            {promo.outletId && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Building2 className="size-2.5" />
                <span>Cabang: {promo.outletName || `#${promo.outletId}`}</span>
              </span>
            )}
          </div>

          <p className="text-[11px] text-faint mt-1">
            {promo.minOrder > 0
              ? `Min. belanja ${formatIDR(promo.minOrder)}`
              : "Tanpa minimum belanja"}
          </p>
          {(promo.validUntil || promo.endDate) && (
            <p className="text-[10px] text-amber-300/80 font-medium mt-0.5">
              Berlaku s/d {new Date(promo.validUntil || promo.endDate!).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </div>

        {isSelected ? (
          <div className="flex items-center gap-1 rounded-full bg-brand px-2 py-1 text-[10px] font-bold text-coal shrink-0">
            <CircleCheck className="size-3" />
            <span>Terpasang</span>
          </div>
        ) : eligible ? (
          <span className="text-xs font-bold text-amber-400 tabular shrink-0">
            Hemat {formatIDR(estimatedDiscount)}
          </span>
        ) : null}
      </div>

      {/* Warnings if not eligible */}
      {!meetsMinOrder && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 text-[10px] text-amber-300 font-medium">
          Belanja kurang {formatIDR(promo.minOrder - subtotal)} untuk promo ini
        </div>
      )}
      {meetsMinOrder && !targetInCart && (
        <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 px-2.5 py-1.5 text-[10px] text-purple-300 font-medium">
          Menu {promo.targetProductName || "khusus"} belum ada di keranjang kasir
        </div>
      )}
    </div>
  );
});

interface PromoSelectModalProps {
  open: boolean;
  lines: CartLine[];
  subtotal: number;
  outletId?: number | null;
  branchId?: string | null;
  currentDiscount: {
    id?: number;
    name?: string;
    type: DiscountType;
    value: number;
    minOrder?: number;
    scope?: DiscountScope;
    targetProductId?: number | null;
  } | null;
  onClose: () => void;
  onApply: (d: {
    id?: number;
    name?: string;
    type: DiscountType;
    value: number;
    minOrder?: number;
    scope?: DiscountScope;
    targetProductId?: number | null;
  } | null) => void;
}

function PromoSelectModal({
  open,
  lines,
  subtotal,
  outletId,
  branchId,
  currentDiscount,
  onClose,
  onApply,
}: PromoSelectModalProps) {
  const [promos, setPromos] = useState<DiscountDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    async function fetchPromos() {
      setLoading(true);
      setError(null);
      try {
        const endpoint = `/api/discounts?activeOnly=true${outletId ? `&outletId=${outletId}` : ""}${branchId ? `&branch_id=${branchId}` : ""}`;
        const res = await fetch(endpoint, {
          headers: branchId ? { "x-branch-id": branchId } : {},
        });
        if (!res.ok) throw new Error("Gagal mengambil data promo");
        const json = await res.json();
        const list: DiscountDto[] = json.discounts || json.data || [];

        // RECURRING DAY & TIME-BOUND PROMO FILTERING
        const now = new Date();
        const currentDay = now.getDay(); // 0 = Minggu, 1 = Senin, ..., 5 = Jumat, 6 = Sabtu
        const activePromos = list.filter((p) => {
          const fromStr = p.validFrom || p.startDate;
          const untilStr = p.validUntil || p.endDate;
          if (fromStr && now < new Date(fromStr)) return false;
          if (untilStr && now > new Date(untilStr)) return false;

          // Validasi hari aktif berulang (Recurring Day Promo, e.g. Jumat Berkah = [5])
          const days = p.activeDays ?? (p as any).active_days;
          if (Array.isArray(days) && days.length > 0) {
            const numDays = days.map(Number);
            if (!numDays.includes(currentDay)) {
              return false;
            }
          }

          return true;
        });

        setPromos(activePromos);
      } catch (err: any) {
        setError(err.message || "Gagal memuat daftar promo");
      } finally {
        setLoading(false);
      }
    }
    fetchPromos();
  }, [open, outletId, branchId]);

  const handleApplyPromo = useCallback(
    (promo: DiscountDto) => {
      onApply({
        id: promo.id,
        name: promo.name,
        type: promo.type,
        value: promo.value,
        minOrder: promo.minOrder,
        scope: promo.scope || "cart",
        targetProductId: promo.targetProductId ?? null,
      });
    },
    [onApply]
  );

  const handleClear = () => {
    onApply(null);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-coal/80">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md rounded-3xl border border-line bg-coal-2 p-5 shadow-2xl space-y-4 max-h-[85dvh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-line shrink-0">
              <div className="flex items-center gap-2">
                <Tag className="size-4 text-brand" />
                <h3 className="font-display text-base font-bold text-cream">Pilih Promo / Diskon</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="btn-press grid size-8 place-items-center rounded-xl text-faint hover:text-cream"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Info Belanja Saat Ini */}
            <div className="rounded-2xl border border-line bg-panel/70 px-4 py-2.5 flex items-center justify-between text-xs shrink-0">
              <span className="text-faint">Subtotal Belanja:</span>
              <span className="font-display text-sm font-bold text-cream tabular">
                {formatIDR(subtotal)}
              </span>
            </div>

            {/* Promo List with GPU Hardware Acceleration */}
            <div
              className="flex-1 space-y-2.5 pr-1 min-h-[220px] gpu-scroll pos-native-scroll"
              style={{
                overflowY: "scroll",
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
                contain: "content",
                transform: "translate3d(0, 0, 0)",
                willChange: "transform, scroll-position",
              }}
            >
              {loading ? (
                <div className="py-12 text-center text-faint flex flex-col items-center justify-center gap-2">
                  <Loader2 className="size-6 animate-spin text-brand" />
                  <p className="text-xs">Memuat daftar promo aktif...</p>
                </div>
              ) : error ? (
                <div className="py-8 text-center text-red-400 text-xs bg-red-500/10 rounded-2xl border border-red-500/20 p-4">
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      const endpoint = `/api/discounts?activeOnly=true${outletId ? `&outletId=${outletId}` : ""}`;
                      fetch(endpoint)
                        .then((r) => r.json())
                        .then((j) => {
                          setPromos(j.discounts || j.data || []);
                          setError(null);
                        })
                        .catch((e) => setError(e.message))
                        .finally(() => setLoading(false));
                    }}
                    className="mt-2 text-xs font-semibold text-brand underline"
                  >
                    Coba Lagi
                  </button>
                </div>
              ) : promos.length === 0 ? (
                <div className="py-12 text-center text-faint space-y-2">
                  <Tag className="size-8 mx-auto opacity-40 text-sand" />
                  <p className="text-xs text-sand font-medium">Belum ada promo aktif</p>
                  <p className="text-[11px] text-faint">
                    Buat dan aktifkan promo di menu Pengaturan &gt; Kelola Diskon & Promo.
                  </p>
                </div>
              ) : (
                promos.map((promo) => {
                  const meetsMinOrder = subtotal >= promo.minOrder;
                  const isProductScope = promo.scope === "product";
                  const matchingLines = isProductScope && promo.targetProductId
                    ? lines.filter((l) => l.productId === promo.targetProductId)
                    : [];
                  const targetInCart = !isProductScope || matchingLines.length > 0;
                  const targetSubtotal = isProductScope
                    ? matchingLines.reduce((s, l) => s + l.unitPrice * l.qty, 0)
                    : subtotal;

                  const eligible = meetsMinOrder && targetInCart;
                  const isSelected =
                    currentDiscount?.id === promo.id ||
                    (!currentDiscount?.id && currentDiscount?.name === promo.name);

                  // Calculate estimated savings
                  let estimatedDiscount = 0;
                  if (eligible) {
                    if (promo.type === "percentage") {
                      estimatedDiscount = Math.min(targetSubtotal, Math.round((targetSubtotal * Math.min(100, promo.value)) / 100));
                    } else {
                      estimatedDiscount = Math.min(targetSubtotal, Math.round(promo.value));
                    }
                  }

                  return (
                    <PromoCard
                      key={promo.id}
                      promo={promo}
                      eligible={eligible}
                      isSelected={isSelected}
                      estimatedDiscount={estimatedDiscount}
                      subtotal={subtotal}
                      targetInCart={targetInCart}
                      onApply={handleApplyPromo}
                    />
                  );
                })
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-line shrink-0">
              {currentDiscount && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="btn-press flex-1 rounded-xl border border-line py-2.5 text-xs font-semibold text-faint hover:text-red-400"
                >
                  Hapus Promo
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="btn-press flex-1 rounded-xl bg-panel border border-line py-2.5 text-xs font-bold text-sand hover:text-cream"
              >
                Tutup
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* -----------------------------------------------------------------------------
 * SUBKOMPONEN MODAL BIAYA TAMBAHAN (SURCHARGE)
 * -------------------------------------------------------------------------- */

function CustomSurchargeModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd?: (name: string, amount: number) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setAmount("");
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim() || "Biaya Tambahan";
    const parsedAmount = parseInt(amount.replace(/\D/g, ""), 10);
    if (!parsedAmount || parsedAmount <= 0) return;

    onAdd?.(cleanName, parsedAmount);
    onClose();
  };

  const SUGGESTIONS = ["Biaya Ongkir", "Paper Bag / Kantong", "Packaging / Kardus", "Biaya Admin", "Lain-lain"];
  const NOMINALS = [2000, 5000, 10000, 15000, 20000];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            className="w-full max-w-md rounded-2xl border border-line bg-panel-solid p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Plus className="size-5" />
                <h3 className="font-display text-base font-bold text-cream">Biaya Tambahan (Surcharge)</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid size-7 place-items-center rounded-lg text-faint hover:text-cream hover:bg-coal"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-sand uppercase tracking-wider mb-1.5">
                  Nama Biaya
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Ongkir, Paper Bag, Box Khusus..."
                  className="w-full rounded-xl border border-line bg-coal px-3.5 py-2.5 text-sm text-cream placeholder:text-faint outline-none focus:border-amber-400"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setName(s)}
                      className="px-2 py-1 rounded-lg border border-line bg-coal text-[11px] text-sand hover:text-cream hover:border-amber-400/40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-sand uppercase tracking-wider mb-1.5">
                  Nominal Biaya (Rp)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  step={500}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-line bg-coal px-3.5 py-2.5 text-sm font-bold text-cream placeholder:text-faint outline-none focus:border-amber-400 tabular"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {NOMINALS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAmount(String(n))}
                      className="px-2 py-1 rounded-lg border border-line bg-coal text-[11px] text-amber-400 font-bold hover:bg-amber-400/10 hover:border-amber-400/40 tabular"
                    >
                      {formatIDR(n)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-line bg-coal text-xs font-bold text-sand hover:text-cream"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || !amount || Number(amount) <= 0}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-coal text-xs font-bold shadow-lg shadow-amber-500/20 disabled:opacity-40 transition-colors"
                >
                  Tambahkan ke Keranjang
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
