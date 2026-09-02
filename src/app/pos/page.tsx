"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloudOff, CloudUpload, RefreshCcw } from "lucide-react";
import AppShell from "@/components/AppShell";
import CatalogPane from "@/components/pos/CatalogPane";
import VariantSheet, { type VariantSelection } from "@/components/pos/VariantSheet";
import TicketPane from "@/components/pos/TicketPane";
import PaymentModal from "@/components/pos/PaymentModal";
import OrdersDrawer from "@/components/pos/OrdersDrawer";
import type { CatalogDto, OrderReceipt, SessionUser, TodayOrderDto } from "@/lib/types";
import { cartLineKey, cartTotal, toPayloadLines, type CartLine } from "@/lib/cart";
import { enqueueOrder, flushQueue, newOfflineId, queueCount } from "@/lib/offline";

export default function PosPage() {
  const [catalog, setCatalog] = useState<CatalogDto | null>(null);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [sheet, setSheet] = useState<CatalogDto["products"][number] | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [todayOrders, setTodayOrders] = useState<TodayOrderDto[]>([]);
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState(0);
  const [toast, setToast] = useState<{ msg: string; kind: "err" | "ok" | "warn" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  useEffect(() => {
    setQueue(queueCount());
    setOnline(navigator.onLine);
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.user)).catch(() => {});
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((d: CatalogDto) => setCatalog(d))
      .catch(() => {});
    refreshToday();
    const t = setInterval(refreshToday, 30000);
    return () => clearInterval(t);
  }, [refreshToday]);

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

  const changeQty = (key: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  };

  /* ------------------------------- SUBMIT ORDER ------------------------------ */
  const submitOrder = async (method: "cash" | "qris" | "debit", tendered: number): Promise<OrderReceipt | null> => {
    const estTotal = cartTotal(lines);
    const payloadLines = toPayloadLines(lines);

    const buildProvisional = (): OrderReceipt => ({
      id: 0,
      orderNumber: `OFFLINE-${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`,
      paymentMethod: method,
      subtotal: estTotal,
      tendered: method === "cash" ? tendered : estTotal,
      change: method === "cash" ? Math.max(0, tendered - estTotal) : 0,
      itemCount: lines.reduce((s, l) => s + l.qty, 0),
      hpp: 0,
      profit: 0,
      cashierName: me?.name ?? "Mode Offline",
      createdAt: new Date().toISOString(),
      items: lines.map((l) => ({
        productName: l.name, variantName: l.variantName, qty: l.qty,
        unitPrice: l.unitPrice, totalPrice: l.unitPrice * l.qty, modifiers: l.mods,
      })),
    });

    const queueOffline = () => {
      enqueueOrder({
        offlineId: newOfflineId(),
        queuedAt: Date.now(),
        lines: payloadLines,
        paymentMethod: method,
        tendered,
        estTotal,
        cashierName: me?.name ?? "",
      });
      setLines([]);
      void refreshToday;
      return buildProvisional();
    };

    if (!online) return queueOffline();

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: method, tendered, lines: payloadLines }),
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
      setLines([]);
      refreshToday();
      return (data as { receipt: OrderReceipt }).receipt;
    } catch {
      showToast("Koneksi terputus — pesanan disimpan offline & akan disinkronkan.", "warn");
      return queueOffline();
    }
  };

  const total = cartTotal(lines);

  return (
    <AppShell allowedRoles={["cashier", "manager", "owner"]}>
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

      <div className="flex flex-1 min-h-0 flex-col sm:flex-row sm:h-[calc(100dvh-68px)] sm:overflow-hidden">
        {!catalog ? (
          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 p-5 content-start overflow-hidden ml-[76px] lg:ml-[92px]">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-[148px] rounded-2xl border border-line bg-panel animate-pulse-soft" style={{ animationDelay: `${i * 90}ms` }} />
            ))}
          </div>
        ) : (
          <CatalogPane catalog={catalog} onPick={pickProduct} />
        )}

        <TicketPane
          lines={lines}
          onQty={changeQty}
          onRemove={(key) => setLines((prev) => prev.filter((l) => l.key !== key))}
          onClear={() => setLines([])}
          onPay={() => setPayOpen(true)}
          onOpenHistory={() => setDrawerOpen(true)}
          historyCount={todayOrders.length}
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
        total={total}
        offline={!online}
        onClose={() => setPayOpen(false)}
        onSubmit={submitOrder}
        onDone={() => setLines([])}
      />

      <OrdersDrawer open={drawerOpen} orders={todayOrders} queueCount={queue} onClose={() => setDrawerOpen(false)} />

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
