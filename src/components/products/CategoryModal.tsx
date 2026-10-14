"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, FolderPlus, Trash2, Check, Store,
  Coffee, Filter, CupSoda, Flame, Sparkles, Croissant, CakeSlice,
  Utensils, Wine, Milk, Beer, Cookie, Soup, GlassWater, Leaf,
} from "lucide-react";

export interface CategoryData {
  id?: number;
  name: string;
  icon: string;
  sortOrder: number;
  outletId?: number;
  branchId?: string;
}

const AVAILABLE_ICONS = [
  { name: "Coffee", label: "Kopi", icon: Coffee },
  { name: "Filter", label: "Manual Brew", icon: Filter },
  { name: "CupSoda", label: "Minuman Dingin", icon: CupSoda },
  { name: "Milk", label: "Susu / Latte", icon: Milk },
  { name: "Leaf", label: "Teh / Herbal", icon: Leaf },
  { name: "Flame", label: "Signature Panas", icon: Flame },
  { name: "Sparkles", label: "Spesial", icon: Sparkles },
  { name: "Croissant", label: "Pastry", icon: Croissant },
  { name: "CakeSlice", label: "Cake", icon: CakeSlice },
  { name: "Cookie", label: "Snack / Bites", icon: Cookie },
  { name: "GlassWater", label: "Air / Mocktail", icon: GlassWater },
  { name: "Wine", label: "Artisan", icon: Wine },
  { name: "Beer", label: "Fermentasi", icon: Beer },
  { name: "Soup", label: "Makanan Hangat", icon: Soup },
  { name: "Utensils", label: "Main Course", icon: Utensils },
];

export default function CategoryModal({
  open,
  initialData,
  outlets = [],
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  initialData?: CategoryData | null;
  outlets?: { id: number; name: string; brandName?: string; code?: string }[];
  onClose: () => void;
  onSave: (cat: CategoryData) => void;
  onDelete?: (id: number) => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Coffee");
  const [sortOrder, setSortOrder] = useState(1);
  const [outletId, setOutletId] = useState<number>(1);
  const [outletList, setOutletList] = useState<{ id: number; name: string; brandName?: string; code?: string }[]>(outlets);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.name);
        setIcon(initialData.icon || "Coffee");
        setSortOrder(initialData.sortOrder || 1);
        setOutletId(initialData.outletId ?? 1);
      } else {
        setName("");
        setIcon("Coffee");
        setSortOrder(1);
        setOutletId(1);
      }
      setError(null);

      // Ambil data outlets dari API /api/outlets
      fetch("/api/outlets")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.outlets && Array.isArray(data.outlets)) {
            setOutletList(data.outlets);
            if (!initialData?.outletId && data.outlets.length > 0) {
              setOutletId((prev) => prev || data.outlets[0].id);
            }
          }
        })
        .catch((err) => {
          console.error("fetch outlets error in CategoryModal:", err);
        });
    }
  }, [open, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nama kategori wajib diisi.");
      return;
    }
    onSave({
      id: initialData?.id,
      name: name.trim(),
      icon,
      sortOrder: Number(sortOrder) || 1,
      outletId: Number(outletId) || 1,
      branchId: (initialData as any)?.branchId,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-coal/80 backdrop-blur-md p-3 sm:p-4 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="relative w-full max-w-md max-h-[90dvh] flex flex-col rounded-3xl border border-line-2 bg-panel-2 shadow-[0_24px_54px_rgba(0,0,0,0.85)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-4 sm:p-5 border-b border-line">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl border border-brand/40 bg-brand/10 text-brand">
                  <FolderPlus className="size-5" />
                </div>
                <div>
                  <h2 className="font-display text-base sm:text-lg font-bold text-cream">
                    {initialData ? "Edit Kategori Menu" : "Tambah Kategori Baru"}
                  </h2>
                  <p className="text-xs text-faint">Kelompokkan menu agar kasir mudah mencari</p>
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

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 touch-auto pb-6">
                {error && (
                  <div className="rounded-xl border border-red-400/40 bg-red-400/15 p-2.5 text-xs text-red-200 font-semibold">
                    {error}
                  </div>
                )}
              {/* Dropdown Cabang / Brand */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-sand mb-1.5 flex items-center gap-1.5">
                  <Store className="size-3.5 text-brand" />
                  <span>Cabang / Brand</span>
                </label>
                <select
                  value={outletId}
                  onChange={(e) => setOutletId(Number(e.target.value))}
                  className="input-dark text-sm w-full"
                >
                  {outletList.length === 0 ? (
                    <option value={1} className="bg-coal text-cream">
                      Cabang Pusat / Default (ID: 1)
                    </option>
                  ) : (
                    outletList.map((o) => (
                      <option key={o.id} value={o.id} className="bg-coal text-cream">
                        {o.name} {o.brandName ? `(${o.brandName})` : ""} {o.code ? `[${o.code}]` : ""}
                      </option>
                    ))
                  )}
                </select>
                <p className="text-[10.5px] text-faint mt-1">
                  Kategori ini hanya akan dapat diakses oleh kasir cabang yang dipilih.
                </p>
              </div>

              {/* Nama Kategori */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-1.5">
                  Nama Kategori
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="cth: Espresso Bar, Nasi Rempah, Minuman Dingin"
                  autoFocus
                  className="input-dark text-sm"
                />
              </div>

              {/* Urutan Tampilan */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-1.5">
                  Urutan Tampilan (Sort Order)
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  className="input-dark text-sm w-32 tabular"
                />
              </div>

              {/* Pilihan Ikon Visual */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-2">
                  Pilih Ikon Visual
                </label>
                <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1 rounded-2xl border border-line bg-coal">
                  {AVAILABLE_ICONS.map((item) => {
                    const IconComp = item.icon;
                    const isSelected = icon === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setIcon(item.name)}
                        className={`btn-press flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 text-center transition-all ${
                          isSelected
                            ? "border-brand bg-brand/15 text-brand shadow-sm shadow-brand/30"
                            : "border-line/60 bg-panel text-faint hover:text-cream hover:border-line-2"
                        }`}
                        title={item.label}
                      >
                        <IconComp className="size-5" />
                        <span className="text-[9px] font-medium truncate w-full">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              </div>

              {/* Tombol Aksi - Sticky Footer */}
              <div className="flex-shrink-0 p-4 border-t border-line bg-panel-2/95 flex items-center justify-between gap-2.5 sticky bottom-0 z-10">
                {initialData?.id && onDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Hapus kategori "${initialData.name}"?`)) {
                        onDelete(initialData.id!);
                        onClose();
                      }
                    }}
                    className="btn-press flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Hapus</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-press rounded-xl border border-line px-4 py-2.5 text-xs font-semibold text-faint hover:text-cream"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn-press flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 font-display text-xs font-bold text-coal shadow-md shadow-brand/50 hover:brightness-110"
                  >
                    <Check className="size-4" />
                    <span>Simpan Kategori</span>
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
