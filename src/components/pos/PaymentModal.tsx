"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote, QrCode, CreditCard, X, Loader2, Check, Printer, CloudOff, ArrowRight,
} from "lucide-react";
import type { OrderReceipt } from "@/lib/types";
import { formatIDR, formatTime } from "@/lib/format";

type Method = "cash" | "qris" | "debit";

const METHODS: { id: Method; label: string; icon: typeof Banknote; desc: string }[] = [
  { id: "cash", label: "Tunai", icon: Banknote, desc: "Hitung kembalian otomatis" },
  { id: "qris", label: "QRIS", icon: QrCode, desc: "Scan & lunas instan" },
  { id: "debit", label: "Debit", icon: CreditCard, desc: "Gesek kartu EDC" },
];

export default function PaymentModal({
  open,
  total,
  offline,
  onClose,
  onSubmit,
  onDone,
}: {
  open: boolean;
  total: number;
  offline: boolean;
  onClose: () => void;
  onSubmit: (method: Method, tendered: number) => Promise<OrderReceipt | null>;
  onDone: () => void;
}) {
  const [method, setMethod] = useState<Method>("cash");
  const [tendered, setTendered] = useState<number>(total);
  const [phase, setPhase] = useState<"pay" | "loading" | "success">("pay");
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);

  useEffect(() => {
    if (open) {
      setMethod("cash");
      setTendered(total);
      setPhase("pay");
      setReceipt(null);
    }
  }, [open, total]);

  const change = Math.max(0, tendered - total);
  const insufficient = method === "cash" && tendered < total;

  const quickCash = useMemo(() => {
    const base = [total, 20000, 50000, 100000].filter((v, i, a) => a.indexOf(v) === i);
    return base.sort((a, b) => a - b).slice(0, 5);
  }, [total]);

  const confirm = async () => {
    setPhase("loading");
    const r = await onSubmit(method, method === "cash" ? tendered : total);
    if (r) {
      setReceipt(r);
      setPhase("success");
      if (navigator.vibrate) navigator.vibrate(40);
    } else {
      setPhase("pay");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-coal/75 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ y: 40, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="w-full max-w-lg rounded-3xl border border-line-2 bg-panel-2 shadow-ticket overflow-hidden"
          >
            {phase !== "success" ? (
              <>
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-line">
                  <div>
                    <p className="font-display text-lg font-bold">Pembayaran</p>
                    <p className="text-[11px] text-faint mt-0.5 flex items-center gap-1.5">
                      {offline && (
                        <span className="inline-flex items-center gap-1 text-amber-400">
                          <CloudOff className="size-3" /> Mode offline — akan tersinkron
                        </span>
                      )}
                      {!offline && "Pilih metode & konfirmasi"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-display text-2xl font-bold tabular text-brand text-glow">{formatIDR(total)}</p>
                    <button onClick={onClose} className="btn-press grid size-9 place-items-center rounded-xl border border-line bg-coal text-faint hover:text-cream">
                      <X className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-3 gap-2">
                    {METHODS.map((m) => {
                      const active = method === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setMethod(m.id)}
                          className={`btn-press rounded-2xl border p-3.5 text-left transition-colors ${
                            active ? "border-brand bg-brand/12" : "border-line bg-coal hover:border-line-2"
                          }`}
                        >
                          <m.icon className={`size-5 mb-2 ${active ? "text-brand" : "text-sand"}`} />
                          <p className={`text-[13px] font-bold ${active ? "text-brand" : "text-cream"}`}>{m.label}</p>
                          <p className="text-[10px] text-faint mt-0.5 leading-tight">{m.desc}</p>
                        </button>
                      );
                    })}
                  </div>

                  {method === "cash" && (
                    <div className="rounded-2xl border border-line bg-coal p-4 space-y-3.5">
                      <div className="flex flex-wrap gap-2">
                        {quickCash.map((v) => (
                          <button
                            key={v}
                            onClick={() => setTendered(v)}
                            className={`btn-press rounded-full border px-4 py-2 text-xs font-bold tabular transition-colors ${
                              tendered === v
                                ? "border-brand bg-brand/15 text-brand"
                                : "border-line-2/70 bg-panel text-sand hover:text-cream"
                            }`}
                          >
                            {v === total ? "Uang Pas" : formatIDR(v)}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-faint shrink-0">
                          Uang diterima
                        </label>
                        <div className="flex items-center gap-2 rounded-xl border border-line-2 bg-panel px-3 py-2 w-full max-w-[220px]">
                          <span className="text-xs text-faint">Rp</span>
                          <input
                            type="number"
                            min={0}
                            value={tendered || ""}
                            onChange={(e) => setTendered(Number(e.target.value))}
                            className="w-full bg-transparent font-display text-lg font-bold tabular outline-none text-cream"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-line pt-3">
                        <p className="text-xs text-faint">Kembalian</p>
                        <p className={`font-display text-xl font-bold tabular ${insufficient ? "text-red-400" : "text-emerald-400"}`}>
                          {insufficient ? "Kurang!" : formatIDR(change)}
                        </p>
                      </div>
                    </div>
                  )}

                  {method === "qris" && (
                    <div className="rounded-2xl border border-line bg-coal p-4 flex items-center gap-4">
                      <div className="grid size-24 shrink-0 place-items-center rounded-xl bg-cream p-2">
                        <QrCode className="size-full text-coal" strokeWidth={1.2} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-cream">Scan QRIS statis merchant</p>
                        <p className="text-xs text-faint mt-1 leading-relaxed">
                          Konfirmasi otomatis tercatat dengan nominal {formatIDR(total)}.
                        </p>
                      </div>
                    </div>
                  )}

                  {method === "debit" && (
                    <div className="rounded-2xl border border-line bg-coal p-4 flex items-center gap-4">
                      <div className="grid size-14 shrink-0 place-items-center rounded-xl border border-line-2 bg-panel text-brand">
                        <CreditCard className="size-7" strokeWidth={1.6} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-cream">Gesek / tap kartu di EDC</p>
                        <p className="text-xs text-faint mt-1">Nominal {formatIDR(total)} dikirim ke mesin EDC.</p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={confirm}
                    disabled={insufficient || phase === "loading"}
                    className="btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-display text-[15px] font-bold text-coal shadow-[0_16px_44px_-14px] shadow-brand/70 hover:brightness-110 disabled:opacity-40"
                  >
                    {phase === "loading" ? (
                      <>
                        <Loader2 className="size-5 animate-spin" /> Memproses…
                      </>
                    ) : (
                      <>
                        Konfirmasi Bayar — {formatIDR(total)} <ArrowRight className="size-4" />
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="p-7 text-center">
                <motion.div
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16 }}
                  className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-emerald-400/15 border border-emerald-400/40"
                >
                  <div className="grid size-12 place-items-center rounded-full bg-emerald-400 text-coal shadow-[0_0_40px_-8px] shadow-emerald-400/70">
                    <Check className="size-7" strokeWidth={3} />
                  </div>
                </motion.div>

                <p className="text-[11px] uppercase tracking-[0.24em] text-faint mb-1">Transaksi Berhasil</p>
                <p className="font-display text-3xl font-bold tabular text-cream">{receipt?.orderNumber}</p>
                <p className="text-xs text-faint mt-1.5">
                  {receipt && formatTime(receipt.createdAt)} • Kasir {receipt?.cashierName.split(" ")[0]} • Stok bahan telah terpotong otomatis
                </p>

                {method === "cash" && receipt && (
                  <div className="mx-auto mt-5 max-w-xs rounded-2xl border border-line bg-coal p-4">
                    <div className="flex justify-between text-xs text-faint mb-2">
                      <span>Tunai</span>
                      <span className="tabular text-sand">{formatIDR(receipt.tendered ?? 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-cream">Kembalian</span>
                      <span className="font-display text-2xl font-bold tabular text-emerald-400">
                        {formatIDR(receipt.change ?? 0)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-6 grid grid-cols-[1fr_auto] gap-2.5">
                  <button
                    onClick={() => {
                      onDone();
                      onClose();
                    }}
                    className="btn-press rounded-2xl bg-brand py-3.5 font-display text-sm font-bold text-coal hover:brightness-110"
                  >
                    Transaksi Baru
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="btn-press grid w-12 place-items-center rounded-2xl border border-line bg-coal text-sand hover:text-cream"
                    title="Cetak struk"
                  >
                    <Printer className="size-4.5" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
