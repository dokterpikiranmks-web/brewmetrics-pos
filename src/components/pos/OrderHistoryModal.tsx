"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History,
  Search,
  Printer,
  X,
  Loader2,
  RefreshCw,
  Clock,
  User,
  CreditCard,
  Banknote,
  QrCode,
  Building2,
  AlertCircle,
} from "lucide-react";
import type { TodayOrderDto, OrderReceipt, StoreSettingDto } from "@/lib/types";
import { formatIDR, formatTime } from "@/lib/format";
import ReceiptPrint from "./ReceiptPrint";

interface OrderHistoryModalProps {
  open: boolean;
  onClose: () => void;
  storeSettings?: StoreSettingDto | null;
}

export default function OrderHistoryModal({
  open,
  onClose,
  storeSettings,
}: OrderHistoryModalProps) {
  const [orders, setOrders] = useState<TodayOrderDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reprintingId, setReprintingId] = useState<number | null>(null);
  const [reprintReceipt, setReprintReceipt] = useState<OrderReceipt | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders");
      if (!res.ok) throw new Error("Gagal mengambil riwayat transaksi.");
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err: any) {
      setError(err.message || "Gagal memuat transaksi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSearchQuery("");
      fetchOrders();
    } else {
      setReprintReceipt(null);
      setReprintingId(null);
    }
  }, [open]);

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase().trim();
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.tableNumber && o.tableNumber.toLowerCase().includes(q)) ||
        o.cashierName.toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

  const totalPaidToday = useMemo(() => {
    return orders
      .filter((o) => o.status === "paid")
      .reduce((sum, o) => sum + o.total, 0);
  }, [orders]);

  const handleReprint = async (orderId: number) => {
    try {
      setReprintingId(orderId);
      const res = await fetch(`/api/orders/${orderId}/receipt`);
      if (!res.ok) throw new Error("Gagal mengambil struk transaksi.");
      const data = await res.json();
      if (!data.receipt) throw new Error("Data struk tidak ditemukan.");

      setReprintReceipt(data.receipt);
      setTimeout(() => {
        window.print();
        setReprintingId(null);
      }, 300);
    } catch (err: any) {
      alert(err.message || "Gagal mencetak ulang struk.");
      setReprintingId(null);
    }
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case "cash":
        return <Banknote className="size-3.5 text-emerald-400" />;
      case "qris":
        return <QrCode className="size-3.5 text-sky-400" />;
      case "transfer":
        return <Building2 className="size-3.5 text-brand" />;
      default:
        return <CreditCard className="size-3.5 text-violet-400" />;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-coal/80 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ y: 30, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.97, opacity: 0 }}
            className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border border-line bg-panel shadow-2xl overflow-hidden"
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-surface/50">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-brand/15 text-brand border border-brand/20">
                  <History className="size-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-cream">
                    Riwayat Transaksi Hari Ini
                  </h2>
                  <p className="text-xs text-faint">
                    {orders.length} pesanan tercatat • Omzet hari ini:{" "}
                    <span className="font-bold text-brand">{formatIDR(totalPaidToday)}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchOrders}
                  disabled={loading}
                  className="btn-press flex size-9 items-center justify-center rounded-xl border border-line-2 bg-coal text-sand hover:text-cream transition disabled:opacity-50"
                  title="Segarkan data"
                >
                  <RefreshCw className={`size-4 ${loading ? "animate-spin text-brand" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-press flex size-9 items-center justify-center rounded-xl border border-line-2 bg-coal text-sand hover:text-cream transition"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Pencarian dan Filter */}
            <div className="border-b border-line p-4 bg-coal/40">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-faint" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nomor pesanan, nama pelanggan, atau nomor meja..."
                  className="w-full rounded-2xl border border-line bg-coal pl-10 pr-4 py-2.5 text-sm text-cream placeholder:text-faint outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/15 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-faint hover:text-sand"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Daftar Transaksi */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[300px]">
              {loading && orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-52 text-faint">
                  <Loader2 className="size-8 animate-spin text-brand mb-2" />
                  <p className="text-sm">Memuat transaksi hari ini...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-52 text-red-400">
                  <AlertCircle className="size-8 mb-2" />
                  <p className="text-sm font-medium">{error}</p>
                  <button
                    type="button"
                    onClick={fetchOrders}
                    className="mt-3 rounded-xl bg-coal border border-line-2 px-4 py-2 text-xs font-bold text-sand hover:text-cream"
                  >
                    Coba Lagi
                  </button>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-52 text-faint">
                  <History className="size-10 text-line-2 mb-2" />
                  <p className="text-sm font-medium text-sand">
                    {searchQuery ? "Tidak ada pesanan yang sesuai pencarian." : "Belum ada transaksi tercatat hari ini."}
                  </p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="mt-2 text-xs text-brand hover:underline"
                    >
                      Reset filter pencarian
                    </button>
                  )}
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const isVoid = order.status === "void";
                  const isReprinting = reprintingId === order.id;

                  return (
                    <div
                      key={order.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border transition-all ${
                        isVoid
                          ? "border-red-500/20 bg-red-500/5 opacity-75"
                          : "border-line bg-coal/60 hover:bg-coal hover:border-line-2"
                      }`}
                    >
                      {/* Info Pesanan Utama */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-bold text-cream">
                            {order.orderNumber}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              isVoid
                                ? "bg-red-500/15 text-red-400 border border-red-500/20"
                                : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            {isVoid ? "Dibatalkan (Void)" : "Lunas"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-[10px] text-faint border border-line">
                            <Clock className="size-3" />
                            {formatTime(order.createdAt)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-[10px] font-medium text-sand border border-line">
                            {getPaymentIcon(order.paymentMethod)}
                            <span className="uppercase">{order.paymentMethod}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-faint flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="size-3 text-sand" />
                            <strong className="text-sand">{order.customerName || "Umum"}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            {order.orderType === "take-away" ? "Take Away" : "Dine In"}
                            {order.tableNumber ? ` (Meja ${order.tableNumber})` : ""}
                          </span>
                          <span>•</span>
                          <span>{order.itemCount} item</span>
                          <span>•</span>
                          <span>Kasir: {order.cashierName}</span>
                        </div>
                      </div>

                      {/* Total & Aksi Cetak Ulang */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-line/60">
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] text-faint uppercase font-bold tracking-wider">Total Tagihan</p>
                          <p className="font-display text-base font-bold tabular text-brand">
                            {formatIDR(order.total)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleReprint(order.id)}
                          disabled={isReprinting}
                          className="btn-press flex items-center gap-1.5 rounded-xl border border-line-2 bg-panel px-3.5 py-2 text-xs font-bold text-sand hover:text-cream hover:border-brand/40 hover:bg-surface transition disabled:opacity-50"
                          title="Cetak ulang struk thermal transaksi ini"
                        >
                          {isReprinting ? (
                            <Loader2 className="size-3.5 animate-spin text-brand" />
                          ) : (
                            <Printer className="size-3.5 text-brand" />
                          )}
                          <span>Cetak Ulang</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Modal */}
            <div className="border-t border-line px-6 py-3 bg-surface/50 flex items-center justify-between text-xs text-faint">
              <span>Menampilkan {filteredOrders.length} dari {orders.length} pesanan hari ini</span>
              <button
                type="button"
                onClick={onClose}
                className="btn-press rounded-xl border border-line-2 bg-coal px-4 py-1.5 font-bold text-sand hover:text-cream transition"
              >
                Tutup
              </button>
            </div>

            {/* Elemen struk tersembunyi yang dicetak ulang saat window.print() */}
            {reprintReceipt && (
              <ReceiptPrint receipt={reprintReceipt} storeSettings={storeSettings} />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
