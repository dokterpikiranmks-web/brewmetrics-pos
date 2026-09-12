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
  Eye,
  ChevronRight,
  ReceiptText,
  Percent,
  CheckCircle2,
  Calendar,
  Layers,
  Tag,
} from "lucide-react";
import type { TodayOrderDto, OrderReceipt, StoreSettingDto } from "@/lib/types";
import { formatIDR, formatTime, formatDateID } from "@/lib/format";
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

  // State untuk Detail Transaksi (Modal/Drawer)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<OrderReceipt | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

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
      setSelectedOrderId(null);
      setSelectedReceipt(null);
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

  const channelTotals = useMemo(() => {
    let cash = 0;
    let qris = 0;
    let debit = 0;
    let transfer = 0;

    for (const o of orders) {
      if (o.status !== "paid") continue;
      if (
        o.paymentMethod === "split" &&
        Array.isArray(o.paymentBreakdown) &&
        o.paymentBreakdown.length > 0
      ) {
        for (const item of o.paymentBreakdown) {
          const amt = Number(item.amount) || 0;
          const m = String(item.method).toLowerCase();
          if (m === "cash") cash += amt;
          else if (m === "qris") qris += amt;
          else if (m === "debit") debit += amt;
          else if (m === "transfer") transfer += amt;
        }
      } else {
        const m = String(o.paymentMethod).toLowerCase();
        if (m === "cash") cash += o.total;
        else if (m === "qris") qris += o.total;
        else if (m === "debit") debit += o.total;
        else if (m === "transfer") transfer += o.total;
      }
    }

    return {
      cash,
      qris,
      debit,
      transfer,
      grandTotal: cash + qris + debit + transfer,
    };
  }, [orders]);

  const totalPaidToday = useMemo(() => {
    return channelTotals.grandTotal;
  }, [channelTotals]);

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

  const handleOpenDetail = async (orderId: number) => {
    setSelectedOrderId(orderId);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/receipt`);
      if (!res.ok) throw new Error("Gagal mengambil detail transaksi.");
      const data = await res.json();
      if (!data.receipt) throw new Error("Data transaksi tidak ditemukan.");
      setSelectedReceipt(data.receipt);
    } catch (err: any) {
      alert(err.message || "Gagal memuat rincian transaksi.");
      setSelectedOrderId(null);
      setSelectedReceipt(null);
    } finally {
      setLoadingDetail(false);
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
      case "split":
        return <Layers className="size-3.5 text-amber-400" />;
      default:
        return <CreditCard className="size-3.5 text-violet-400" />;
    }
  };

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case "cash":
        return "Tunai";
      case "qris":
        return "QRIS";
      case "transfer":
        return "Transfer Bank";
      case "split":
        return "Split Bayar";
      case "debit":
        return "Debit";
      default:
        return method.toUpperCase();
    }
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
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-line px-5 sm:px-6 py-4 bg-surface/50">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-brand/15 text-brand border border-brand/20">
                  <History className="size-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-cream">
                    Riwayat Transaksi Kasir
                  </h2>
                  <p className="text-xs text-faint">
                    {orders.length} pesanan tercatat hari ini • Omzet:{" "}
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

            {/* Ringkasan Multi-Channel (Rekonsiliasi Split Payment) */}
            <div className="border-b border-line bg-coal/60 px-4 sm:px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                <div className="flex items-center justify-between text-emerald-400 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Kas Tunai</span>
                  <Banknote className="size-3.5" />
                </div>
                <p className="font-display text-sm font-bold text-cream tabular">
                  {formatIDR(channelTotals.cash)}
                </p>
              </div>

              <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-2.5">
                <div className="flex items-center justify-between text-sky-400 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">QRIS</span>
                  <QrCode className="size-3.5" />
                </div>
                <p className="font-display text-sm font-bold text-cream tabular">
                  {formatIDR(channelTotals.qris)}
                </p>
              </div>

              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-2.5">
                <div className="flex items-center justify-between text-violet-400 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Kartu Debit</span>
                  <CreditCard className="size-3.5" />
                </div>
                <p className="font-display text-sm font-bold text-cream tabular">
                  {formatIDR(channelTotals.debit)}
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5">
                <div className="flex items-center justify-between text-amber-400 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Transfer Bank</span>
                  <Building2 className="size-3.5" />
                </div>
                <p className="font-display text-sm font-bold text-cream tabular">
                  {formatIDR(channelTotals.transfer)}
                </p>
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
                  placeholder="Cari nomor pesanan, nama pelanggan, meja, atau kasir (Klik baris untuk detail)..."
                  className="w-full rounded-2xl border border-line bg-coal pl-10 pr-4 py-2.5 text-xs sm:text-sm text-cream placeholder:text-faint outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/15 transition"
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

            {/* Daftar Transaksi (Setiap Baris Clickable) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[300px]">
              {loading && orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-52 text-faint">
                  <Loader2 className="size-8 animate-spin text-brand mb-2" />
                  <p className="text-sm">Memuat transaksi kasir hari ini...</p>
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
                    {searchQuery
                      ? "Tidak ada pesanan yang sesuai pencarian."
                      : "Belum ada transaksi tercatat hari ini."}
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
                      onClick={() => handleOpenDetail(order.id)}
                      className={`btn-press group cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border transition-all ${
                        isVoid
                          ? "border-red-500/20 bg-red-500/5 hover:border-red-500/40 opacity-75"
                          : "border-line bg-coal/60 hover:bg-coal hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5"
                      }`}
                      title="Klik untuk membuka detail transaksi lengkap"
                    >
                      {/* Info Pesanan Utama */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-bold text-cream group-hover:text-brand transition-colors">
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
                            <span>{getPaymentLabel(order.paymentMethod)}</span>
                          </span>
                          {order.discountName && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold">
                              <Tag className="size-2.5" />
                              <span>{order.discountName}</span>
                            </span>
                          )}
                        </div>

                        {/* Rincian Split Payment (jika metode split) */}
                        {order.paymentMethod === "split" &&
                          Array.isArray(order.paymentBreakdown) &&
                          order.paymentBreakdown.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                              <span className="text-[10px] text-faint">Split:</span>
                              {order.paymentBreakdown.map((b, bIdx) => (
                                <span
                                  key={bIdx}
                                  className="inline-flex items-center gap-1 rounded-md bg-surface/80 border border-line px-1.5 py-0.5 text-[10px] text-sand"
                                >
                                  <span className="capitalize text-faint">{b.method}:</span>
                                  <span className="font-bold text-cream tabular">{formatIDR(b.amount)}</span>
                                </span>
                              ))}
                            </div>
                          )}

                        <div className="flex items-center gap-2.5 text-xs text-faint flex-wrap">
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

                      {/* Total & Aksi Cetak Ulang / Detail */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-line/60 shrink-0">
                        <div className="text-left sm:text-right pr-1">
                          <p className="text-[10px] text-faint uppercase font-bold tracking-wider">
                            Total Tagihan
                          </p>
                          <p className="font-display text-base font-bold tabular text-brand">
                            {formatIDR(order.total)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReprint(order.id);
                            }}
                            disabled={isReprinting}
                            className="btn-press flex items-center gap-1.5 rounded-xl border border-line-2 bg-panel px-3 py-2 text-xs font-bold text-sand hover:text-cream hover:border-brand/40 hover:bg-surface transition disabled:opacity-50"
                            title="Cetak ulang struk thermal transaksi ini"
                          >
                            {isReprinting ? (
                              <Loader2 className="size-3.5 animate-spin text-brand" />
                            ) : (
                              <Printer className="size-3.5 text-brand" />
                            )}
                            <span className="hidden sm:inline">Cetak Ulang</span>
                          </button>

                          <div className="p-1 text-faint group-hover:text-brand transition-colors">
                            <ChevronRight className="size-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Modal Riwayat */}
            <div className="border-t border-line px-5 sm:px-6 py-3 bg-surface/50 flex items-center justify-between text-xs text-faint">
              <span>
                Menampilkan {filteredOrders.length} dari {orders.length} pesanan hari ini
              </span>
              <button
                type="button"
                onClick={onClose}
                className="btn-press rounded-xl border border-line-2 bg-coal px-4 py-1.5 font-bold text-sand hover:text-cream transition"
              >
                Tutup
              </button>
            </div>

            {/* ===================================================================
                DRAWER / MODAL DETAIL TRANSAKSI (MENGAMBIL RELASI ORDER_ITEMS)
               =================================================================== */}
            <AnimatePresence>
              {selectedOrderId !== null && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md"
                >
                  <motion.div
                    initial={{ scale: 0.95, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.95, y: 20, opacity: 0 }}
                    className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-line-2 bg-panel shadow-2xl overflow-hidden"
                  >
                    {/* Header Detail Transaksi */}
                    <div className="flex items-center justify-between border-b border-line px-5 sm:px-6 py-4 bg-surface/60">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-2xl bg-brand/15 text-brand border border-brand/20">
                          <ReceiptText className="size-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-base sm:text-lg font-bold text-cream">
                              Detail Transaksi
                            </h3>
                            {selectedReceipt && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  selectedReceipt.status === "void"
                                    ? "bg-red-500/15 text-red-400 border border-red-500/20"
                                    : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                                }`}
                              >
                                {selectedReceipt.status === "void" ? "Void" : "Lunas"}
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-xs font-bold text-brand">
                            {selectedReceipt?.orderNumber || "Memuat..."}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrderId(null);
                          setSelectedReceipt(null);
                        }}
                        className="btn-press flex size-9 items-center justify-center rounded-xl border border-line-2 bg-coal text-sand hover:text-cream transition"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    {/* Konten Detail Transaksi */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
                      {loadingDetail ? (
                        <div className="flex flex-col items-center justify-center py-16 text-faint">
                          <Loader2 className="size-8 animate-spin text-brand mb-2" />
                          <p className="text-sm font-medium">Memuat detail transaksi &amp; item...</p>
                        </div>
                      ) : selectedReceipt ? (
                        <>
                          {/* Grid Metadata Transaksi */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl border border-line bg-coal/60">
                            <div>
                              <p className="text-[10px] font-bold uppercase text-faint">Waktu Transaksi</p>
                              <p className="font-medium text-cream mt-0.5">
                                {formatTime(selectedReceipt.createdAt)}
                              </p>
                              <p className="text-[10px] text-faint">
                                {formatDateID(new Date(selectedReceipt.createdAt))}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase text-faint">Kasir Bertugas</p>
                              <p className="font-semibold text-cream mt-0.5">
                                {selectedReceipt.cashierName}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase text-faint">Pelanggan</p>
                              <p className="font-semibold text-cream mt-0.5">
                                {selectedReceipt.customerName || "Umum"}
                              </p>
                              {selectedReceipt.customerPhone && (
                                <p className="text-[10px] text-sand">{selectedReceipt.customerPhone}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase text-faint">Tipe &amp; Meja</p>
                              <p className="font-bold text-cream uppercase mt-0.5">
                                {selectedReceipt.orderType === "take-away" ? "Take Away" : "Dine In"}
                              </p>
                              {selectedReceipt.tableNumber && (
                                <p className="text-[10px] text-brand font-bold">
                                  Meja: {selectedReceipt.tableNumber}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Informasi Metode Pembayaran */}
                          <div className="p-3.5 rounded-2xl border border-line bg-coal/60 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase text-faint">
                                Cara Pembayaran:
                              </span>
                              <span className="inline-flex items-center gap-1.5 font-bold text-cream uppercase">
                                {getPaymentIcon(selectedReceipt.paymentMethod)}
                                <span>{getPaymentLabel(selectedReceipt.paymentMethod)}</span>
                              </span>
                            </div>

                            {/* Rincian Split Pembayaran jika Multi-Tender */}
                            {(selectedReceipt.paymentMethod === "split" ||
                              (selectedReceipt.paymentBreakdown &&
                                selectedReceipt.paymentBreakdown.length > 0)) && (
                              <div className="mt-2 pt-2 border-t border-line/60 space-y-1.5">
                                <p className="text-[10px] font-bold text-amber-400 uppercase">
                                  Rincian Pembagian Bayar (Split Breakdown):
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {(selectedReceipt.paymentBreakdown || []).map((split, sIdx) => (
                                    <div
                                      key={sIdx}
                                      className="flex items-center justify-between p-2 rounded-xl bg-panel border border-line-2"
                                    >
                                      <span className="flex items-center gap-1.5 font-medium text-sand capitalize">
                                        {getPaymentIcon(split.method)}
                                        <span>{getPaymentLabel(split.method)}</span>
                                      </span>
                                      <span className="font-bold tabular text-cream">
                                        {formatIDR(split.amount)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {selectedReceipt.paymentReference && (
                              <div className="flex items-center justify-between text-[11px] pt-1 text-sky-400">
                                <span>Referensi Transaksi:</span>
                                <span className="font-mono font-bold">{selectedReceipt.paymentReference}</span>
                              </div>
                            )}
                          </div>

                          {/* Tabel / Daftar Order Items */}
                          <div className="rounded-2xl border border-line bg-coal/40 overflow-hidden">
                            <div className="bg-surface/60 px-4 py-2.5 border-b border-line flex items-center justify-between">
                              <span className="font-display text-xs font-bold text-cream">
                                Daftar Item Pesanan ({selectedReceipt.items.length} jenis,{" "}
                                {selectedReceipt.itemCount} qty)
                              </span>
                              <span className="text-[10px] text-faint">Relasi order_items</span>
                            </div>

                            <div className="divide-y divide-line/60">
                              {selectedReceipt.items.map((it, idx) => (
                                <div
                                  key={idx}
                                  className="p-3.5 flex items-start justify-between gap-3"
                                >
                                  <div className="space-y-0.5 flex-1 min-w-0">
                                    <p className="font-bold text-cream text-xs truncate">
                                      {it.productName}
                                      {it.variantName && (
                                        <span className="text-sand font-normal ml-1">
                                          ({it.variantName})
                                        </span>
                                      )}
                                    </p>
                                    {it.modifiers && it.modifiers.length > 0 && (
                                      <p className="text-[10px] text-faint italic">
                                        + {it.modifiers.map((m) => m.name).join(", ")}
                                      </p>
                                    )}
                                    <p className="text-[11px] text-sand">
                                      {it.qty} x {formatIDR(it.unitPrice)}
                                    </p>
                                  </div>
                                  <p className="font-display font-bold tabular text-cream text-xs shrink-0">
                                    {formatIDR(it.totalPrice)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Ringkasan Tagihan & Finansial */}
                          <div className="p-4 rounded-2xl border border-line bg-coal/70 space-y-2">
                            <div className="flex justify-between text-sand">
                              <span>Subtotal Item</span>
                              <span className="tabular">{formatIDR(selectedReceipt.subtotal)}</span>
                            </div>

                            {(selectedReceipt.discountAmount || 0) > 0 && (
                              <div className="flex justify-between text-amber-400">
                                <span>
                                  Diskon Transaksi
                                  {selectedReceipt.discountName ? ` (${selectedReceipt.discountName})` : ""}
                                </span>
                                <span className="tabular font-medium">
                                  - {formatIDR(selectedReceipt.discountAmount || 0)}
                                </span>
                              </div>
                            )}

                            {(selectedReceipt.serviceCharge || 0) > 0 && (
                              <div className="flex justify-between text-sand">
                                <span>Biaya Layanan</span>
                                <span className="tabular">
                                  {formatIDR(selectedReceipt.serviceCharge || 0)}
                                </span>
                              </div>
                            )}

                            {(selectedReceipt.tax || 0) > 0 && (
                              <div className="flex justify-between text-sand">
                                <span>Pajak Restoran (PB1)</span>
                                <span className="tabular">{formatIDR(selectedReceipt.tax || 0)}</span>
                              </div>
                            )}

                            <div className="flex justify-between pt-2 border-t border-line font-bold text-cream text-sm">
                              <span>Total Bayar</span>
                              <span className="font-display text-base tabular text-brand">
                                {formatIDR(selectedReceipt.total || selectedReceipt.subtotal)}
                              </span>
                            </div>

                            {selectedReceipt.tendered !== null && selectedReceipt.tendered !== undefined && (
                              <div className="flex justify-between pt-1 text-[11px] text-faint">
                                <span>Uang Diterima (Tendered)</span>
                                <span className="tabular">{formatIDR(selectedReceipt.tendered)}</span>
                              </div>
                            )}

                            {selectedReceipt.change !== null && selectedReceipt.change !== undefined && selectedReceipt.change > 0 && (
                              <div className="flex justify-between text-[11px] font-bold text-emerald-400">
                                <span>Uang Kembalian</span>
                                <span className="tabular font-display text-sm">
                                  {formatIDR(selectedReceipt.change)}
                                </span>
                              </div>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>

                    {/* Footer Modal Detail Transaksi: Tombol Cetak Ulang Struk & Tutup */}
                    <div className="border-t border-line px-5 sm:px-6 py-3.5 bg-surface/60 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrderId(null);
                          setSelectedReceipt(null);
                        }}
                        className="btn-press rounded-xl border border-line-2 bg-coal px-4 py-2.5 font-bold text-sand hover:text-cream transition text-xs"
                      >
                        Tutup
                      </button>

                      {selectedReceipt && (
                        <button
                          type="button"
                          onClick={() => handleReprint(selectedReceipt.id)}
                          disabled={reprintingId === selectedReceipt.id}
                          className="btn-press flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-coal shadow-md shadow-brand/25 hover:brightness-110 disabled:opacity-50 transition"
                          title="Cetak ulang struk thermal untuk pesanan ini"
                        >
                          {reprintingId === selectedReceipt.id ? (
                            <Loader2 className="size-4 animate-spin text-coal" />
                          ) : (
                            <Printer className="size-4 text-coal" />
                          )}
                          <span>Cetak Ulang Struk</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

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
