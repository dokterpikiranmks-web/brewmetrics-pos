"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, FolderPlus, Trash2, Check,
  Coffee, Filter, CupSoda, Flame, Sparkles, Croissant, CakeSlice,
  Utensils, Wine, Milk, Beer, Cookie, Soup, GlassWater, Leaf,
} from "lucide-react";

export interface CategoryData {
  id?: number;
  name: string;
  icon: string;
  sortOrder: number;
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
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  initialData?: CategoryData | null;
  onClose: () => void;
  onSave: (cat: CategoryData) => void;
  onDelete?: (id: number) => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Coffee");
  const [sortOrder, setSortOrder] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.name);
        setIcon(initialData.icon || "Coffee");
        setSortOrder(initialData.sortOrder || 1);
      } else {
        setName("");
        setIcon("Coffee");
        setSortOrder(1);
      }
      setError(null);
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
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-coal/80 backdrop-blur-md p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="w-full max-w-md rounded-3xl border border-line-2 bg-panel-2 p-5 sm:p-6 shadow-[0_24px_54px_rgba(0,0,0,0.85)] max-h-[92dvh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
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

            {error && (
              <div className="mb-4 rounded-xl border border-red-400/40 bg-red-400/15 p-2.5 text-xs text-red-200 font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nama Kategori */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-1.5">
                  Nama Kategori
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="cth: Espresso Bar, Artisan Tea, Pastry"
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

              {/* Tombol Aksi */}
              <div className="pt-2 flex items-center justify-between gap-2.5">
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
