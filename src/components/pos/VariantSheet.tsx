"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Snowflake, Minus, Plus, X } from "lucide-react";
import type { CatalogDto } from "@/lib/types";
import { formatIDR } from "@/lib/format";
import { productIcon } from "./icons";

type Product = CatalogDto["products"][number];

export interface VariantSelection {
  variantId: number | null;
  variantName: string | null;
  modifierIds: number[];
  qty: number;
}

export default function VariantSheet({
  product,
  catalog,
  onClose,
  onConfirm,
}: {
  product: Product | null;
  catalog: CatalogDto;
  onClose: () => void;
  onConfirm: (sel: VariantSelection) => void;
}) {
  const variants = useMemo(
    () => (product ? catalog.variants.filter((v) => v.productId === product.id) : []),
    [catalog, product]
  );
  const [variantId, setVariantId] = useState<number | null>(null);
  const [mods, setMods] = useState<number[]>([]);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (product) {
      const vs = catalog.variants.filter((v) => v.productId === product.id);
      setVariantId(vs[0]?.id ?? null);
      setMods([]);
      setQty(1);
    }
  }, [product, catalog]);

  const total = useMemo(() => {
    if (!product) return 0;
    const v = variants.find((x) => x.id === variantId);
    const modPrice = mods.reduce((s, id) => s + (catalog.modifiers.find((m) => m.id === id)?.price ?? 0), 0);
    return (product.price + (v?.priceDelta ?? 0) + modPrice) * qty;
  }, [product, variants, variantId, mods, qty, catalog]);

  const isDrink = variants.length > 0;
  const Icon = product ? productIcon(product.icon) : null;

  return (
    <AnimatePresence>
      {product && Icon && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-coal/70 backdrop-blur-sm p-0 sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-line-2 bg-panel-2 shadow-ticket overflow-hidden"
          >
            <div className="flex items-start gap-3.5 p-5 pb-4 border-b border-line">
              <div
                className="grid size-12 shrink-0 place-items-center rounded-xl border border-line-2/60 bg-coal"
                style={{ boxShadow: `inset 0 0 26px -10px ${product.color}` }}
              >
                <Icon className="size-6" style={{ color: product.color }} strokeWidth={1.9} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold leading-tight">{product.name}</p>
                <p className="text-xs text-faint mt-0.5 truncate">{product.tagline}</p>
              </div>
              <button onClick={onClose} className="btn-press grid size-8 place-items-center rounded-lg border border-line bg-coal text-faint hover:text-cream">
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[58dvh] overflow-y-auto">
              {variants.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-faint font-bold mb-2">Varian</p>
                  <div className="grid grid-cols-2 gap-2">
                    {variants.map((v) => {
                      const active = variantId === v.id;
                      const Ic = v.name === "Panas" ? Flame : Snowflake;
                      return (
                        <button
                          key={v.id}
                          onClick={() => setVariantId(v.id)}
                          className={`btn-press flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                            active
                              ? "border-brand bg-brand/15 text-brand"
                              : "border-line bg-coal text-sand hover:border-line-2"
                          }`}
                        >
                          <Ic className="size-4" />
                          {v.name}
                          {v.priceDelta > 0 && (
                            <span className={`text-[11px] tabular ${active ? "text-brand/80" : "text-faint"}`}>
                              +{formatIDR(v.priceDelta).replace("Rp ", "")}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isDrink && catalog.modifiers.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-faint font-bold mb-2">Tambahan</p>
                  <div className="flex flex-wrap gap-2">
                    {catalog.modifiers.map((m) => {
                      const active = mods.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => setMods((prev) => (active ? prev.filter((x) => x !== m.id) : [...prev, m.id]))}
                          className={`btn-press rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
                            active
                              ? "border-brand-2/70 bg-brand-2/15 text-brand-2"
                              : "border-line bg-coal text-sand hover:border-line-2 hover:text-cream"
                          }`}
                        >
                          {m.name}
                          <span className={`ml-1.5 tabular ${active ? "text-brand-2/70" : "text-faint"}`}>
                            +{formatIDR(m.price).replace("Rp ", "")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl border border-line bg-coal px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-faint">Jumlah</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="btn-press grid size-9 place-items-center rounded-lg border border-line-2 bg-panel text-sand hover:text-cream"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="font-display text-xl font-bold tabular w-8 text-center">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(20, q + 1))}
                    className="btn-press grid size-9 place-items-center rounded-lg border border-brand/50 bg-brand/15 text-brand"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5 pt-2">
              <button
                onClick={() =>
                  onConfirm({
                    variantId,
                    variantName: variants.find((v) => v.id === variantId)?.name ?? null,
                    modifierIds: mods,
                    qty,
                  })
                }
                className="btn-press w-full rounded-2xl bg-brand py-4 font-display text-[15px] font-bold text-coal shadow-[0_16px_40px_-14px] shadow-brand/70 hover:brightness-110"
              >
                Tambah ke Struk — {formatIDR(total)}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
