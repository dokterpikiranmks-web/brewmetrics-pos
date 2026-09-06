"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, X, Delete, Loader2, KeyRound, AlertTriangle } from "lucide-react";
import { formatIDR } from "@/lib/format";

export interface VoidRequest {
  type: "item" | "clear" | "order";
  orderId?: number;
  orderNumber?: string;
  key?: string;
  name?: string;
  price?: number;
}

export default function VoidAuthModal({
  open,
  request,
  onClose,
  onAuthorized,
}: {
  open: boolean;
  request: VoidRequest | null;
  onClose: () => void;
  onAuthorized: (supervisor: { id: number; name: string; role: string }) => void;
}) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setError(null);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const handleKeypad = (char: string) => {
    if (pin.length < 8) {
      setPin((prev) => prev + char);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin("");
    setError(null);
  };

  const submitAuth = async (pinValue = pin) => {
    const trimmed = pinValue.trim();
    if (!trimmed) {
      setError("Masukkan PIN Manager/Owner.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (request?.type === "order" && request.orderId) {
        // Void transaksi yang SUDAH tersimpan di database
        const res = await fetch(`/api/orders/${request.orderId}/void`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pin: trimmed,
            reason: request.name ? `Void pesanan ${request.orderNumber ?? request.orderId}: ${request.name}` : undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Otorisasi void ditolak.");
          setPin("");
          return;
        }

        onAuthorized(data.supervisor ?? { id: 0, name: "Supervisor", role: "manager" });
        onClose();
      } else {
        // Fallback otorisasi supervisor umum
        const res = await fetch("/api/auth/verify-void-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pin: trimmed,
            reason: request?.type === "item" ? `Hapus item ${request.name}` : "Batalkan transaksi",
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Otorisasi ditolak.");
          setPin("");
          return;
        }

        onAuthorized(data.supervisor);
        onClose();
      }
    } catch {
      setError("Gagal menghubungi server otorisasi.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && pin.length >= 4) {
      e.preventDefault();
      submitAuth();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-coal/80 backdrop-blur-md p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="w-full max-w-sm rounded-3xl border border-red-500/30 bg-panel-2 p-5 sm:p-6 shadow-[0_24px_54px_rgba(0,0,0,0.85)]"
          >
            {/* --------------------------- HEADER --------------------------- */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-2xl border border-red-400/40 bg-red-400/15 text-red-400 shadow-[0_0_24px_-4px] shadow-red-500/40">
                  <ShieldAlert className="size-6" />
                </div>
                <div>
                  <h2 className="font-display text-base sm:text-lg font-bold text-cream">
                    Otorisasi Void
                  </h2>
                  <p className="text-[11px] text-faint">Sistem Pengamanan Kasir</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="btn-press grid size-8 place-items-center rounded-xl border border-line bg-coal text-faint hover:text-cream"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* ------------------------ DETAIL REQUEST ------------------------ */}
            <div className="rounded-2xl border border-line bg-coal/70 p-3 mb-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-faint">Tindakan:</span>
                <span className="font-bold text-red-400">
                  {request?.type === "order"
                    ? "Batalkan Pesanan Tersimpan (Void)"
                    : request?.type === "item"
                      ? "Hapus Item Menu"
                      : "Batalkan Seluruh Struk"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-faint">Keterangan:</span>
                <span className="font-semibold text-cream truncate max-w-[190px]">
                  {request?.name ?? request?.orderNumber ?? "—"}
                </span>
              </div>
              {request?.price !== undefined && (
                <div className="flex items-center justify-between text-xs mt-1 border-t border-line/60 pt-1">
                  <span className="text-faint">Nominal Void:</span>
                  <span className="font-display font-bold tabular text-sand">
                    {formatIDR(request.price)}
                  </span>
                </div>
              )}
            </div>

            {/* ------------------------ NOTIFIKASI ERROR ------------------------ */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3.5 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 p-2.5 text-xs font-semibold text-red-300 leading-snug"
              >
                <AlertTriangle className="size-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* ----------------------- DISPLAY INPUT PIN ----------------------- */}
            <div className="mb-4 text-center">
              <p className="text-[10.5px] uppercase font-bold tracking-[0.16em] text-faint mb-2">
                Masukkan PIN Manager / Owner
              </p>
              <div className="flex items-center justify-center gap-2 py-2">
                {[0, 1, 2, 3].map((idx) => {
                  const filled = pin.length > idx;
                  return (
                    <span
                      key={idx}
                      className={`grid size-11 place-items-center rounded-2xl border text-xl font-bold font-display tabular transition-all ${
                        filled
                          ? "border-red-400/60 bg-red-400/15 text-cream shadow-[0_0_16px_-4px] shadow-red-500/30"
                          : "border-line bg-coal text-faint"
                      }`}
                    >
                      {filled ? "•" : ""}
                    </span>
                  );
                })}
              </div>
              {/* Input tersembunyi untuk mendukung ketikan keyboard fisik */}
              <input
                ref={inputRef}
                type="password"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 8));
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                className="sr-only"
                autoFocus
              />
            </div>

            {/* ------------------- NUMERIC TOUCH KEYPAD (POS) ------------------- */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeypad(num)}
                  disabled={loading}
                  className="btn-press rounded-2xl border border-line bg-panel py-3 text-lg font-bold font-display text-cream hover:border-line-2 hover:bg-panel-2 active:scale-95 disabled:opacity-50"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                disabled={loading || pin.length === 0}
                className="btn-press rounded-2xl border border-line bg-panel text-xs font-bold text-faint hover:text-red-400 py-3 disabled:opacity-30"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleKeypad("0")}
                disabled={loading}
                className="btn-press rounded-2xl border border-line bg-panel py-3 text-lg font-bold font-display text-cream hover:border-line-2 hover:bg-panel-2 active:scale-95 disabled:opacity-50"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                disabled={loading || pin.length === 0}
                className="btn-press grid place-items-center rounded-2xl border border-line bg-panel py-3 text-sand hover:text-cream disabled:opacity-30"
              >
                <Delete className="size-5" />
              </button>
            </div>

            {/* ------------------------ TOMBOL AKSI ------------------------ */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => submitAuth()}
                disabled={loading || pin.length < 4}
                className="btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 py-3.5 font-display text-sm font-bold text-white shadow-[0_12px_32px_-8px] shadow-red-500/60 hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Memverifikasi PIN…</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="size-4" />
                    <span>Setujui Void Sekarang</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="btn-press w-full rounded-2xl border border-line py-2.5 text-xs font-semibold text-faint hover:text-cream"
              >
                Batalkan &amp; Kembali
              </button>
            </div>

            {/* Catatan Otorisasi Supervisor */}
            <p className="mt-3 text-center text-[11px] text-faint leading-relaxed">
              Masukkan PIN Supervisor (Manager atau Owner) yang terdaftar untuk mengotorisasi pembatalan pesanan.
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
