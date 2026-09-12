"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CloudOff, CloudUpload, RefreshCcw } from "lucide-react";
import AppShell from "@/components/AppShell";
import CatalogPane from "@/components/pos/CatalogPane";
import VariantSheet, { type VariantSelection } from "@/components/pos/VariantSheet";
import TicketPane from "@/components/pos/TicketPane";
import PaymentModal, { type Method } from "@/components/pos/PaymentModal";
import OrdersDrawer from "@/components/pos/OrdersDrawer";
import OrderHistoryModal from "@/components/pos/OrderHistoryModal";
import VoidAuthModal, { type VoidRequest } from "@/components/pos/VoidAuthModal";
import CloseShiftModal from "@/components/pos/CloseShiftModal";
import CashMovementModal from "@/components/cash/CashMovementModal";
import SplitBillModal from "@/components/pos/SplitBillModal";
import type {
  CatalogDto,
  OrderReceipt,
  SessionUser,
  TodayOrderDto,
  StoreSettingDto,
  OrderType,
  DiscountType,
  PaymentBreakdownItem,
} from "@/lib/types";
import { cartLineKey, cartTotal, calculateOrderTotals, toPayloadLines, type CartLine } from "@/lib/cart";
import { enqueueOrder, flushQueue, newOfflineId, queueCount } from "@/lib/offline";

export default function PosPage() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogDto | null>(null);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [settings, setSettings] = useState<StoreSettingDto | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [sheet, setSheet] = useState<CatalogDto["products"][number] | null>(null);

  // Metadata Transaksi Kasir & Pelanggan
  const [customerName, setCustomerName] = useState("Umum");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("dine-in");
  const [tableNumber, setTableNumber] = useState("");
  const [discount, setDiscount] = useState<{
    type: DiscountType;
    value: number;
    name?: string;
    id?: number;
    minOrder?: number;
  } | null>(null);

  const [payOpen, setPayOpen] = useState(false);
  const [splitBillOpen, setSplitBillOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [cashMovementOpen, setCashMovementOpen] = useState(false);
  const [todayOrders, setTodayOrders] = useState<TodayOrderDto[]>([]);
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState(0);
  const [toast, setToast] = useState<{ msg: string; kind: "err" | "ok" | "warn" } | null>(null);
  const [voidRequest, setVoidRequest] = useState<VoidRequest | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingSplitRemainingRef = useRef<CartLine[] | null>(null);
  const pendingSplitBackupRef = useRef<CartLine[] | null>(null);

  const showToast = useCallback((msg: string, kind: "err" | "ok" | "warn" = "ok") => {
    clearTimeout(toastTimer.current);
    setToast({ msg, kind });
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  const refreshToday = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = (await res.json()) as { orders: TodayOrderDto[] };
        setTodayOrders(data.orders);
      }
    } catch {
      /* abaikan saat offline */
    }
  }, []);

  // Tangkap event buka riwayat pesanan dari navbar AppShell
  useEffect(() => {
    const handleOpenHistory = () => setOrderHistoryOpen(true);
    window.addEventListener("bm-open-order-history", handleOpenHistory);

    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("tab") === "history") {
        setOrderHistoryOpen(true);
      }
    }

    return () => {
      window.removeEventListener("bm-open-order-history", handleOpenHistory);
    };
  }, []);

  useEffect(() => {
    setQueue(queueCount());
    setOnline(navigator.onLine);

    // Proteksi Rute: Halaman /pos HANYA boleh diakses oleh user role 'cashier'
    // Jika user role 'owner' atau 'manager' mencoba mengakses, redirect paksa langsung ke /analytics
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user: SessionUser | null }) => {
        if (!d.user) {
          router.replace("/");
          return;
        }
        if (d.user.role !== "cashier") {
          router.replace("/analytics");
          return;
        }
        setMe(d.user);
      })
      .catch(() => router.replace("/"));

    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: { settings?: StoreSettingDto }) => {
        if (d.settings) setSettings(d.settings);
      })
      .catch(() => {});
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((d: CatalogDto) => setCatalog(d))
      .catch(() => {});
    refreshToday();
    const t = setInterval(refreshToday, 30000);
    return () => clearInterval(t);
  }, [refreshToday, router]);

  /* ------------------------- ONLINE / OFFLINE HANDLING ------------------------ */
  useEffect(() => {
    const goOnline = async () => {
      setOnline(true);
      const result = await flushQueue();
      if (result.synced > 0) {
        showToast(`${result.synced} pesanan offline berhasil tersinkron ke server.`, "ok");
        refreshToday();
      }
    };
    const goOffline = () => setOnline(false);
    const onQueueChange = () => setQueue(queueCount());

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("bm-queue-change", onQueueChange);
    const interval = setInterval(async () => {
      if (navigator.onLine && queueCount() > 0) {
        const result = await flushQueue();
        if (result.synced > 0) {
          showToast(`${result.synced} pesanan offline tersinkron.`, "ok");
          refreshToday();
        }
      }
    }, 15000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("bm-queue-change", onQueueChange);
      clearInterval(interval);
    };
  }, [refreshToday, showToast]);

  /* -------------------------------- CART LOGIC ------------------------------- */
  const addLine = useCallback(
    (product: CatalogDto["products"][number], sel: VariantSelection) => {
      const mods = sel.modifierIds
        .map((id) => catalog?.modifiers.find((m) => m.id === id))
        .filter((m): m is CatalogDto["modifiers"][number] => Boolean(m));
      const variantDelta = catalog?.variants.find((v) => v.id === sel.variantId)?.priceDelta ?? 0;
      const unitPrice = product.price + variantDelta + mods.reduce((s, m) => s + m.price, 0);
      const key = cartLineKey(product.id, sel.variantId, sel.modifierIds);
      setLines((prev) => {
        const existing = prev.find((l) => l.key === key);
        if (existing) {
          return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + sel.qty) } : l));
        }
        return [
          ...prev,
          {
            key,
            productId: product.id,
            variantId: sel.variantId,
            name: product.name,
            variantName: sel.variantName,
            color: product.color,
            unitPrice,
            qty: sel.qty,
            mods: mods.map((m) => ({ id: m.id, name: m.name, price: m.price })),
          },
        ];
      });
      setSheet(null);
    },
    [catalog]
  );

  const pickProduct = (product: CatalogDto["products"][number]) => {
    const vs = catalog?.variants.filter((v) => v.productId === product.id) ?? [];
    if (vs.length === 0) {
      addLine(product, { variantId: null, variantName: null, modifierIds: [], qty: 1 });
    } else {
      setSheet(product);
    }
  };

  // Pengurangan kuantitas di keranjang aktif (murni state lokal, tanpa PIN)
  const handleQty = (key: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  };

  // Penghapusan item di keranjang aktif (murni state lokal, tanpa PIN)
  const handleRemoveLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  // Kosongkan keranjang aktif (murni state lokal, tanpa PIN)
  const handleClearLines = () => {
    setLines([]);
  };

  /* ------------------- VOID AUTHORIZATION (SAVED ORDERS ONLY) ------------------ */
  // Otorisasi PIN Void HANYA muncul saat membatalkan transaksi yang SUDAH tersimpan di DB
  const handleVoidSavedOrder = (order: TodayOrderDto) => {
    setVoidRequest({
      type: "order",
      orderId: order.id,
      orderNumber: order.orderNumber,
      name: `${order.itemCount} item (${order.customerName ?? "Umum"})`,
      price: order.total,
    });
  };

  const handleVoidAuthorized = (supervisor: { id: number; name: string; role: string }) => {
    showToast(
      `Transaksi ${voidRequest?.orderNumber ?? ""} berhasil di-void oleh ${supervisor.name} (${supervisor.role}). Stok bahan dikembalikan.`,
      "ok"
    );
    setVoidRequest(null);
    refreshToday();
  };

  /* ---------------------- CALCULATE TAX & SERVICE CHARGE --------------------- */
  const rawSubtotal = cartTotal(lines);
  const totals = calculateOrderTotals(
    rawSubtotal,
    settings?.taxPercentage ?? 10,
    settings?.serviceChargePercentage ?? 0,
    discount?.type,
    discount?.value ?? 0
  );

  /* ------------------------------- SUBMIT ORDER ------------------------------ */
  const submitOrder = async (
    method: Method,
    tendered: number,
    paymentReference?: string,
    paymentBreakdown?: PaymentBreakdownItem[]
  ): Promise<OrderReceipt | null> => {
    const grandTotal = totals.grandTotal;
    const payloadLines = toPayloadLines(lines);

    const buildProvisional = (): OrderReceipt => ({
      id: 0,
      orderNumber: `OFFLINE-${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`,
      customerName: customerName.trim() || "Umum",
      customerPhone: customerPhone.trim() || null,
      orderType,
      tableNumber: tableNumber.trim() || null,
      paymentMethod: method,
      paymentReference: paymentReference || null,
      paymentBreakdown: paymentBreakdown || [],
      subtotal: totals.subtotal,
      discountType: discount?.type ?? null,
      discountValue: discount?.value ?? 0,
      discountAmount: totals.discountAmount,
      discountName: discount?.name ?? null,
      tax: totals.tax,
      serviceCharge: totals.serviceCharge,
      total: grandTotal,
      tendered: method === "cash" ? tendered : grandTotal,
      change: method === "cash" ? Math.max(0, tendered - grandTotal) : 0,
      itemCount: lines.reduce((s, l) => s + l.qty, 0),
      hpp: 0,
      profit: 0,
      cashierName: me?.name ?? "Mode Offline",
      createdAt: new Date().toISOString(),
      items: lines.map((l) => ({
        productName: l.name,
        variantName: l.variantName,
        qty: l.qty,
        unitPrice: l.unitPrice,
        totalPrice: l.unitPrice * l.qty,
        modifiers: l.mods,
      })),
      storeSettings: settings,
    });

    const queueOffline = () => {
      enqueueOrder({
        offlineId: newOfflineId(),
        queuedAt: Date.now(),
        lines: payloadLines,
        paymentMethod: method,
        tendered,
        paymentBreakdown,
        estTotal: grandTotal,
        cashierName: me?.name ?? "",
      });
      refreshToday();
      return buildProvisional();
    };

    if (!online) return queueOffline();

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: method,
          tendered,
          paymentBreakdown,
          customerName: customerName.trim() || "Umum",
          customerPhone: customerPhone.trim() || undefined,
          orderType,
          tableNumber: tableNumber.trim() || undefined,
          discountType: discount?.type,
          discountValue: discount?.value,
          discountName: discount?.name,
          paymentReference: paymentReference?.trim() || undefined,
          lines: payloadLines,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "INSUFFICIENT_STOCK" && Array.isArray(data.details)) {
          const names = data.details.map((d: { name: string }) => d.name).join(", ");
          showToast(`Stok tidak cukup: ${names}. Hubungi manajer untuk restock.`, "err");
        } else {
          showToast(data.error ?? "Gagal menyimpan pesanan.", "err");
        }
        return null;
      }
      refreshToday();
      return (data as { receipt: OrderReceipt }).receipt;
    } catch {
      showToast("Koneksi terputus — pesanan disimpan offline & akan disinkronkan.", "warn");
      return queueOffline();
    }
  };

  // Reset keranjang dan metadata pesanan saat transaksi selesai atau pesanan baru dimulai
  const handleResetForNewOrder = () => {
    setLines([]);
    setCustomerName("Umum");
    setCustomerPhone("");
    setOrderType("dine-in");
    setTableNumber("");
    setDiscount(null);
  };

  // Handler proses Split Bill: langsung bayar Nota Baru, amankan sisa Nota Asal
  const handlePaySplitBill = (newBillLines: CartLine[], remainingLines: CartLine[]) => {
    pendingSplitRemainingRef.current = remainingLines;
    pendingSplitBackupRef.current = lines;
    setLines(newBillLines);
    setSplitBillOpen(false);
    setPayOpen(true);
  };

  const handleClosePayment = () => {
    // Jika pembayaran dibatalkan saat split bill, pulihkan keranjang ke item lengkap
    if (pendingSplitBackupRef.current) {
      setLines(pendingSplitBackupRef.current);
      pendingSplitBackupRef.current = null;
      pendingSplitRemainingRef.current = null;
    }
    setPayOpen(false);
  };

  const handlePaymentDone = () => {
    // Jika ada sisa item dari Nota Asal, pasang ke keranjang untuk pembayaran nota berikutnya
    if (pendingSplitRemainingRef.current && pendingSplitRemainingRef.current.length > 0) {
      setLines(pendingSplitRemainingRef.current);
      pendingSplitRemainingRef.current = null;
      pendingSplitBackupRef.current = null;
      showToast("Nota baru berhasil dibayar! Sisa item nota asal kini ada di keranjang kasir.", "ok");
    } else {
      pendingSplitBackupRef.current = null;
      pendingSplitRemainingRef.current = null;
      handleResetForNewOrder();
    }
  };

  return (
    <AppShell allowedRoles={["cashier"]}>
      {/* offline / sync strip */}
      <AnimatePresence>
        {(!online || queue > 0) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-amber-400/25 bg-amber-400/10"
          >
            <div className="flex items-center gap-2.5 px-4 py-2 text-amber-300 text-[12px]">
              {online ? <CloudUpload className="size-4 shrink-0" /> : <CloudOff className="size-4 shrink-0" />}
              <span className="font-semibold">
                {online
                  ? `Sinkronisasi: ${queue} pesanan offline sedang dikirim ke server…`
                  : `Internet terputus — terminal tetap aktif. ${queue} pesanan akan tersinkron otomatis.`}
              </span>
              <RefreshCcw className={`size-3.5 ml-auto ${queue > 0 && online ? "animate-spin" : "opacity-40"}`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row md:h-[calc(100dvh-68px)] md:overflow-hidden">
        {!catalog ? (
          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 p-3 sm:p-5 content-start overflow-hidden ml-0 md:ml-[76px] lg:ml-[92px]">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-[148px] rounded-2xl border border-line bg-panel animate-pulse-soft" style={{ animationDelay: `${i * 90}ms` }} />
            ))}
          </div>
        ) : (
          <CatalogPane
            catalog={catalog}
            onPick={pickProduct}
            onOpenHistory={() => setOrderHistoryOpen(true)}
          />
        )}

        <TicketPane
          lines={lines}
          storeSettings={settings}
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          orderType={orderType}
          setOrderType={setOrderType}
          tableNumber={tableNumber}
          setTableNumber={setTableNumber}
          discount={discount}
          setDiscount={setDiscount}
          onQty={handleQty}
          onRemove={handleRemoveLine}
          onClear={handleClearLines}
          onPay={() => setPayOpen(true)}
          onOpenSplitBill={() => setSplitBillOpen(true)}
          onOpenHistory={() => setOrderHistoryOpen(true)}
          onCloseShift={() => setShiftModalOpen(true)}
          onCashMovement={() => setCashMovementOpen(true)}
          historyCount={todayOrders.length}
          cashierName={me?.name ?? "Kasir"}
          currentUser={me}
        />
      </div>

      {catalog && (
        <VariantSheet
          product={sheet}
          catalog={catalog}
          onClose={() => setSheet(null)}
          onConfirm={(sel) => sheet && addLine(sheet, sel)}
        />
      )}

      <PaymentModal
        open={payOpen}
        total={totals.grandTotal}
        offline={!online}
        storeSettings={settings}
        onClose={handleClosePayment}
        onSubmit={submitOrder}
        onDone={handlePaymentDone}
      />

      <SplitBillModal
        open={splitBillOpen}
        onClose={() => setSplitBillOpen(false)}
        lines={lines}
        storeSettings={settings}
        onPaySplitBill={handlePaySplitBill}
      />

      <OrderHistoryModal
        open={orderHistoryOpen}
        onClose={() => setOrderHistoryOpen(false)}
        storeSettings={settings}
      />

      <OrdersDrawer
        open={drawerOpen}
        orders={todayOrders}
        queueCount={queue}
        onClose={() => setDrawerOpen(false)}
        onVoidOrder={handleVoidSavedOrder}
      />

      {/* Modal Otorisasi Void Khusus Pembatalan Transaksi Tersimpan */}
      <VoidAuthModal
        open={Boolean(voidRequest)}
        request={voidRequest}
        onClose={() => setVoidRequest(null)}
        onAuthorized={handleVoidAuthorized}
      />

      {/* Modal Tutup Shift (Blind Z-Report) */}
      <CloseShiftModal
        open={shiftModalOpen}
        cashierName={me?.name ?? "Kasir"}
        onClose={() => setShiftModalOpen(false)}
        onShiftClosed={(r) => {
          refreshToday();
          showToast(
            r.variance === 0
              ? "Tutup shift selesai: Uang fisik pas (seimbang)."
              : `Tutup shift selesai: Selisih ${r.variance > 0 ? "+" : ""}${r.variance}. Laporan tercatat untuk Owner.`,
            r.variance === 0 ? "ok" : "warn"
          );
        }}
      />

      {/* Modal Arus Kas Operasional / Petty Cash */}
      <CashMovementModal
        open={cashMovementOpen}
        onClose={() => setCashMovementOpen(false)}
        onSaved={refreshToday}
        onSuccessToast={(m) => showToast(m, "ok")}
        onErrorToast={(m) => showToast(m, "err")}
      />

      {/* toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className={`fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border px-5 py-3.5 text-sm font-semibold shadow-ticket backdrop-blur-lg max-w-md text-center ${
              toast.kind === "err"
                ? "border-red-400/40 bg-red-950/85 text-red-200"
                : toast.kind === "warn"
                  ? "border-amber-400/40 bg-amber-950/85 text-amber-200"
                  : "border-emerald-400/40 bg-emerald-950/85 text-emerald-200"
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
