"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Coffee, Plus, Trash2, Check, AlertCircle, Sparkles, Scale,
  DollarSign, TrendingUp, Info, ShieldAlert, Tag,
  Filter, CupSoda, Flame, Croissant, CakeSlice, Leaf, Milk, Beer,
  UploadCloud, Image as ImageIcon, Loader2,
} from "lucide-react";
import { formatIDR, formatQty } from "@/lib/format";
import type { IngredientDto } from "@/lib/types";
import { uploadProductImage } from "@/lib/supabase";

export interface RecipeItemData {
  id?: number;
  ingredientId: number;
  ingredientName: string;
  unit: string;
  costPerUnit: number;
  qty: number;
  variantId?: number | null; // null = all variants
  variantName?: string | null;
}

export interface VariantData {
  id?: number;
  name: string;
  priceDelta: number;
}

export interface ProductFormData {
  id?: number;
  categoryId: number;
  name: string;
  tagline: string;
  price: number;
  hpp?: number;
  color: string;
  icon: string;
  imageUrl?: string;
  isActive: boolean;
  variants: VariantData[];
  recipe: RecipeItemData[];
}

const COLOR_SWATCHES = [
  { label: "Amber", hex: "#F59E0B" },
  { label: "Warm Brown", hex: "#92400E" },
  { label: "Deep Roast", hex: "#B45309" },
  { label: "Honey", hex: "#FBBF24" },
  { label: "Lime / Matcha", hex: "#84CC16" },
  { label: "Emerald", hex: "#10B981" },
  { label: "Sky / Cooler", hex: "#38BDF8" },
  { label: "Berry / Red", hex: "#EF4444" },
  { label: "Rose", hex: "#F43F5E" },
  { label: "Purple / Artisan", hex: "#A855F7" },
];

const ICONS_MAP: Record<string, typeof Coffee> = {
  Coffee,
  Filter,
  CupSoda,
  Flame,
  Sparkles,
  Croissant,
  CakeSlice,
  Leaf,
  Milk,
  Beer,
};

export default function ProductRecipeModal({
  open,
  initialData,
  categories,
  ingredients,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  initialData?: ProductFormData | null;
  categories: { id: number; name: string }[];
  ingredients: IngredientDto[];
  onClose: () => void;
  onSave: (data: ProductFormData) => void;
  onDelete?: (id: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<"info" | "recipe" | "margin">("info");

  // Form states
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id ?? 1);
  const [tagline, setTagline] = useState("");
  const [price, setPrice] = useState<number>(20000);
  const [color, setColor] = useState("#F59E0B");
  const [icon, setIcon] = useState("Coffee");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [variants, setVariants] = useState<VariantData[]>([]);
  const [recipe, setRecipe] = useState<RecipeItemData[]>([]);

  // State input bahan baru
  const [selectedIngId, setSelectedIngId] = useState<number>(ingredients[0]?.id ?? 1);
  const [ingQty, setIngQty] = useState<string>("");
  const [targetVariant, setTargetVariant] = useState<string>("all"); // "all" | variant name

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.name);
        setCategoryId(initialData.categoryId);
        setTagline(initialData.tagline);
        setPrice(initialData.price);
        setColor(initialData.color);
        setIcon(initialData.icon);
        setImageUrl(initialData.imageUrl || "");
        setIsActive(initialData.isActive);
        setVariants(initialData.variants || []);
        setRecipe(initialData.recipe || []);
      } else {
        setName("");
        setCategoryId(categories[0]?.id ?? 1);
        setTagline("");
        setPrice(22000);
        setColor("#F59E0B");
        setIcon("Coffee");
        setImageUrl("");
        setIsActive(true);
        setVariants([
          { name: "Panas", priceDelta: 0 },
          { name: "Dingin", priceDelta: 2000 },
        ]);
        setRecipe([]);
      }
      setUploadingImage(false);
      setUploadError(null);
      setActiveTab("info");
      setError(null);
      if (ingredients.length > 0) setSelectedIngId(ingredients[0].id);
      setIngQty("");
      setTargetVariant("all");
    }
  }, [open, initialData, categories, ingredients]);

  // Selected ingredient detail
  const currentIngredient = useMemo(
    () => ingredients.find((i) => i.id === selectedIngId) ?? ingredients[0],
    [ingredients, selectedIngId]
  );

  /* ---------------------- REAL-TIME HPP CALCULATION ---------------------- */
  const baseHpp = useMemo(() => {
    return recipe.reduce((sum, item) => {
      // Base items or item regardless
      return sum + item.qty * item.costPerUnit;
    }, 0);
  }, [recipe]);

  const grossProfit = Math.max(0, price - baseHpp);
  const marginPct = price > 0 ? Math.round(((price - baseHpp) / price) * 1000) / 10 : 0;

  // Saran harga jual ideal F&B (target margin 65%)
  const suggestedPrice = Math.ceil((baseHpp / 0.35) / 1000) * 1000;

  /* ----------------------------- HANDLERS ----------------------------- */
  const handleAddVariant = () => {
    setVariants((prev) => [...prev, { name: "Varian Baru", priceDelta: 0 }]);
  };

  const handleUpdateVariant = (index: number, field: keyof VariantData, value: string | number) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  const handleRemoveVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddIngredient = () => {
    if (!currentIngredient) return;
    const q = Number(ingQty);
    if (!q || q <= 0) {
      setError("Masukkan takaran bahan baku yang valid (> 0).");
      return;
    }

    const itemVariantName = targetVariant === "all" ? null : targetVariant;

    // Cek jika bahan sudah ada untuk varian yang sama
    const existingIndex = recipe.findIndex(
      (r) => r.ingredientId === currentIngredient.id && (r.variantName ?? null) === itemVariantName
    );

    if (existingIndex >= 0) {
      setRecipe((prev) =>
        prev.map((r, idx) => (idx === existingIndex ? { ...r, qty: r.qty + q } : r))
      );
    } else {
      setRecipe((prev) => [
        ...prev,
        {
          ingredientId: currentIngredient.id,
          ingredientName: currentIngredient.name,
          unit: currentIngredient.unit,
          costPerUnit: currentIngredient.costPerUnit,
          qty: q,
          variantName: itemVariantName,
        },
      ]);
    }

    setIngQty("");
    setError(null);
  };

  const handleRemoveIngredient = (index: number) => {
    setRecipe((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setUploadError(null);

    const { url, error: uploadErr } = await uploadProductImage(file);
    setUploadingImage(false);

    if (uploadErr || !url) {
      setUploadError(uploadErr || "Gagal mengunggah foto ke Supabase Storage.");
      return;
    }

    setImageUrl(url);
  };

  const handleRemoveImage = () => {
    setImageUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nama produk wajib diisi.");
      setActiveTab("info");
      return;
    }
    if (price <= 0) {
      setError("Harga jual produk harus lebih besar dari Rp 0.");
      setActiveTab("info");
      return;
    }

    onSave({
      id: initialData?.id,
      categoryId,
      name: name.trim(),
      tagline: tagline.trim(),
      price: Number(price),
      hpp: Math.round(baseHpp),
      color,
      icon,
      imageUrl: imageUrl.trim() || undefined,
      isActive,
      variants,
      recipe,
    });
    onClose();
  };

  const ActiveIcon = ICONS_MAP[icon] || Coffee;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-coal/85 backdrop-blur-md p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="w-full max-w-4xl rounded-3xl border border-line-2 bg-panel-2 shadow-[0_28px_64px_rgba(0,0,0,0.85)] flex flex-col max-h-[92dvh] overflow-hidden"
          >
            {/* =================================================================
                MODAL HEADER
               ================================================================= */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-line shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="grid size-11 place-items-center rounded-2xl border shadow-md transition-colors"
                  style={{
                    borderColor: `${color}60`,
                    backgroundColor: `${color}20`,
                    color: color,
                  }}
                >
                  <ActiveIcon className="size-6" />
                </div>
                <div>
                  <h2 className="font-display text-base sm:text-lg font-bold text-cream">
                    {initialData ? `Edit Menu: ${initialData.name}` : "Tambah Menu & Resep (BOM)"}
                  </h2>
                  <p className="text-xs text-faint">
                    Kelola Informasi Produk, Varian, &amp; Bill of Materials (BOM)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-press grid size-8 place-items-center rounded-xl border border-line bg-coal text-faint hover:text-cream"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* =================================================================
                TABS BAR & REALTIME HPP QUICK SUMMARY
               ================================================================= */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 sm:px-6 py-2.5 bg-coal/50 border-b border-line shrink-0">
              {/* Tab navigation pills */}
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-panel border border-line">
                <button
                  type="button"
                  onClick={() => setActiveTab("info")}
                  className={`btn-press flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "info"
                      ? "bg-brand text-coal shadow-sm shadow-brand/40"
                      : "text-faint hover:text-cream"
                  }`}
                >
                  <Tag className="size-3.5" />
                  <span>1. Info &amp; Varian</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("recipe")}
                  className={`btn-press flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "recipe"
                      ? "bg-brand text-coal shadow-sm shadow-brand/40"
                      : "text-faint hover:text-cream"
                  }`}
                >
                  <Scale className="size-3.5" />
                  <span>2. Resep (BOM)</span>
                  <span className="grid size-4.5 place-items-center rounded-full bg-coal/40 text-[10px] tabular font-bold">
                    {recipe.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("margin")}
                  className={`btn-press flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "margin"
                      ? "bg-brand text-coal shadow-sm shadow-brand/40"
                      : "text-faint hover:text-cream"
                  }`}
                >
                  <TrendingUp className="size-3.5" />
                  <span>3. Analisis Margin</span>
                </button>
              </div>

              {/* Mini radar HPP di header */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-faint">HPP:</span>
                  <span className="font-display font-bold tabular text-sand">
                    {formatIDR(baseHpp)}
                  </span>
                </div>
                <div className="h-3.5 w-px bg-line" />
                <div className="flex items-center gap-1.5">
                  <span className="text-faint">Margin:</span>
                  <span
                    className={`font-display font-bold tabular ${
                      marginPct >= 60
                        ? "text-emerald-400"
                        : marginPct >= 40
                          ? "text-amber-400"
                          : "text-red-400"
                    }`}
                  >
                    {marginPct}% ({formatIDR(grossProfit)})
                  </span>
                </div>
              </div>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="mx-6 mt-3 flex items-center gap-2 rounded-xl border border-red-400/40 bg-red-400/15 p-2.5 text-xs font-semibold text-red-200">
                <AlertCircle className="size-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* =================================================================
                TAB CONTENTS
               ================================================================= */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* TAB 1: INFORMASI PRODUK & VARIAN */}
              {activeTab === "info" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Nama Produk */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-1.5">
                        Nama Menu Produk
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="cth: Caffe Latte, Iced Matcha Espresso"
                        autoFocus
                        className="input-dark text-sm"
                      />
                    </div>

                    {/* Kategori */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-1.5">
                        Kategori Menu
                      </label>
                      <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(Number(e.target.value))}
                        className="input-dark text-sm"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id} className="bg-coal text-cream">
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Harga Jual Dasar */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-1.5">
                        Harga Jual Dasar (Rp)
                      </label>
                      <div className="flex items-center gap-2 rounded-2xl border border-line-2 bg-coal px-3.5 py-2.5 focus-within:border-brand/60">
                        <span className="font-display text-sm font-bold text-faint">Rp</span>
                        <input
                          type="number"
                          min={0}
                          step={500}
                          value={price}
                          onChange={(e) => setPrice(Number(e.target.value))}
                          className="w-full bg-transparent font-display text-base font-bold tabular outline-none text-cream"
                        />
                      </div>
                    </div>

                    {/* Tagline / Deskripsi */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-1.5">
                        Tagline / Deskripsi Ringkas
                      </label>
                      <input
                        type="text"
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        placeholder="cth: Double shot, susu steamed lembut"
                        className="input-dark text-sm"
                      />
                    </div>
                  </div>

                  {/* Upload Foto Produk (Supabase Storage) */}
                  <div className="rounded-2xl border border-line-2 bg-coal/70 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-sand">
                          Foto Produk (Supabase Storage)
                        </label>
                        <p className="text-[11px] text-faint mt-0.5">
                          Format JPG, PNG, atau WebP (Maks. 5MB). Otomatis diunggah ke bucket &apos;product-images&apos;.
                        </p>
                      </div>
                      {imageUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="text-xs text-red-400 hover:text-red-300 font-medium flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Hapus Foto</span>
                        </button>
                      )}
                    </div>

                    {uploadError && (
                      <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-300">
                        <AlertCircle className="size-4 shrink-0 text-red-400" />
                        <span>{uploadError}</span>
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {imageUrl ? (
                      <div className="flex items-center gap-4 rounded-xl border border-line bg-panel p-3">
                        <div className="relative size-16 sm:size-20 rounded-xl overflow-hidden border border-line-2 shrink-0 bg-coal">
                          <img
                            src={imageUrl}
                            alt="Pratinjau Produk"
                            className="size-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                              <Check className="size-3" /> Terunggah ke Supabase
                            </span>
                            <span className="text-[11px] text-faint truncate max-w-[240px]">
                              {imageUrl.split("/").pop()}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImage}
                            className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-line-2 bg-coal px-3 py-1 text-xs font-semibold text-sand hover:text-cream transition-colors"
                          >
                            <UploadCloud className="size-3.5" />
                            <span>Ganti Foto</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => !uploadingImage && fileInputRef.current?.click()}
                        className={`group border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                          uploadingImage
                            ? "border-brand/50 bg-brand/5 pointer-events-none"
                            : "border-line hover:border-brand/60 hover:bg-panel/60"
                        }`}
                      >
                        {uploadingImage ? (
                          <div className="flex flex-col items-center justify-center py-2 text-brand">
                            <Loader2 className="size-7 animate-spin mb-2" />
                            <p className="text-xs font-bold text-cream">Mengunggah ke Supabase Storage...</p>
                            <p className="text-[10px] text-faint mt-0.5">Menyimpan ke bucket &apos;product-images&apos;</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-1 text-faint group-hover:text-cream">
                            <div className="grid size-10 place-items-center rounded-xl bg-panel border border-line-2 mb-2 group-hover:scale-105 group-hover:border-brand/40 transition-all">
                              <UploadCloud className="size-5 text-brand" />
                            </div>
                            <p className="text-xs font-bold text-cream">
                              Klik untuk pilih & unggah foto menu
                            </p>
                            <p className="text-[11px] text-faint mt-0.5">
                              Format JPG, PNG, atau WebP hingga 5MB
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pilihan Warna & Ikon Fallback */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-2">
                        Warna Aksen Kartu POS
                      </label>
                      <div className="flex items-center gap-2 flex-wrap p-2 rounded-2xl border border-line bg-coal">
                        {COLOR_SWATCHES.map((swatch) => (
                          <button
                            key={swatch.hex}
                            type="button"
                            onClick={() => setColor(swatch.hex)}
                            className={`size-7 rounded-xl transition-all ${
                              color === swatch.hex
                                ? "ring-2 ring-white scale-110 shadow-md"
                                : "opacity-80 hover:opacity-100 hover:scale-105"
                            }`}
                            style={{ backgroundColor: swatch.hex }}
                            title={swatch.label}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-2">
                        Ikon Menu (Fallback)
                      </label>
                      <div className="flex items-center gap-2 flex-wrap p-2 rounded-2xl border border-line bg-coal">
                        {Object.keys(ICONS_MAP).map((iconKey) => {
                          const IconComp = ICONS_MAP[iconKey];
                          return (
                            <button
                              key={iconKey}
                              type="button"
                              onClick={() => setIcon(iconKey)}
                              className={`grid size-7 place-items-center rounded-xl border transition-all ${
                                icon === iconKey
                                  ? "border-brand bg-brand/20 text-brand scale-110 shadow-sm shadow-brand/40"
                                  : "border-line/60 bg-panel text-faint hover:text-cream"
                              }`}
                              title={iconKey}
                            >
                              <IconComp className="size-4" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Pengaturan Varian */}
                  <div className="pt-2 border-t border-line">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-display text-sm font-bold text-cream">Varian Produk</h3>
                        <p className="text-[11px] text-faint">
                          Contoh: Panas, Dingin (+2rb), atau Ukuran Large (+5rb)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddVariant}
                        className="btn-press flex items-center gap-1 rounded-xl border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-sand hover:text-cream"
                      >
                        <Plus className="size-3.5" />
                        <span>Tambah Varian</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {variants.map((v, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2.5 rounded-2xl border border-line bg-coal p-2.5"
                        >
                          <input
                            type="text"
                            value={v.name}
                            onChange={(e) => handleUpdateVariant(idx, "name", e.target.value)}
                            placeholder="Nama Varian (cth: Dingin)"
                            className="input-dark text-xs flex-1"
                          />
                          <div className="flex items-center gap-1.5 rounded-xl border border-line-2 bg-panel px-2.5 py-1.5 w-36">
                            <span className="text-[10px] text-faint">+Rp</span>
                            <input
                              type="number"
                              min={0}
                              step={500}
                              value={v.priceDelta}
                              onChange={(e) => handleUpdateVariant(idx, "priceDelta", Number(e.target.value))}
                              className="w-full bg-transparent text-xs font-bold tabular outline-none text-sand"
                              placeholder="0"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(idx)}
                            className="btn-press grid size-8 place-items-center rounded-xl text-faint hover:text-red-400 hover:bg-panel"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ))}
                      {variants.length === 0 && (
                        <p className="text-xs text-faint py-3 text-center italic">
                          Tidak ada varian (produk menggunakan harga tunggal).
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: RESEP & BILL OF MATERIALS (BOM) */}
              {activeTab === "recipe" && (
                <div className="space-y-5">
                  {/* Grid Bagian Atas: Form Tautkan Bahan di Kiri, Card Metrik Dinamis di Kanan */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Form Input Bahan Baku & Real-time Sub-HPP (7 Kolom) */}
                    <div className="lg:col-span-7 rounded-2xl border border-brand/40 bg-brand/5 p-4 space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-brand mb-2.5">
                          <Sparkles className="size-4" />
                          <span>Tautkan Bahan Baku ke Menu (Bill of Materials)</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {/* Dropdown Bahan Baku */}
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-faint mb-1">
                              Pilih Bahan Baku
                            </label>
                            <select
                              value={selectedIngId}
                              onChange={(e) => setSelectedIngId(Number(e.target.value))}
                              className="input-dark text-xs"
                            >
                              {ingredients.map((ing) => (
                                <option key={ing.id} value={ing.id} className="bg-coal text-cream">
                                  {ing.name} ({formatIDR(ing.costPerUnit)}/{ing.unit})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Takaran */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-faint mb-1">
                              Takaran ({currentIngredient?.unit})
                            </label>
                            <div className="flex items-center gap-1.5 rounded-xl border border-line-2 bg-coal px-3 py-2 focus-within:border-brand/60">
                              <input
                                type="number"
                                min={0.1}
                                step={0.1}
                                value={ingQty}
                                onChange={(e) => setIngQty(e.target.value)}
                                placeholder="cth: 18"
                                className="w-full bg-transparent text-xs font-bold tabular outline-none text-cream"
                              />
                              <span className="text-[11px] font-semibold text-sand">
                                {currentIngredient?.unit}
                              </span>
                            </div>
                          </div>

                          {/* Berlaku Untuk Varian */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-faint mb-1">
                              Berlaku Untuk
                            </label>
                            <select
                              value={targetVariant}
                              onChange={(e) => setTargetVariant(e.target.value)}
                              className="input-dark text-xs"
                            >
                              <option value="all">Semua Varian (Base)</option>
                              {variants.map((v) => (
                                <option key={v.name} value={v.name}>
                                  Khusus: {v.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Indikator Sub-HPP Real-Time: Sub-HPP = takaran * costPerUnit bahan */}
                        <div className="mt-3 flex items-center justify-between rounded-xl border border-brand/30 bg-coal/85 px-3.5 py-2.5">
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-brand">
                              Kalkulasi Sub-HPP Bahan
                            </span>
                            <p className="text-xs text-sand mt-0.5">
                              {currentIngredient ? (
                                <>
                                  <span className="font-semibold text-cream">{currentIngredient.name}</span>:{" "}
                                  {Number(ingQty) || 0} {currentIngredient.unit} × {formatIDR(currentIngredient.costPerUnit)}/{currentIngredient.unit}
                                </>
                              ) : (
                                "Pilih bahan baku dan masukkan takaran"
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[9.5px] text-faint uppercase font-bold block">Sub-HPP</span>
                            <span className="font-display text-base font-bold tabular text-brand text-glow">
                              {formatIDR((Number(ingQty) || 0) * (currentIngredient?.costPerUnit || 0))}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleAddIngredient}
                          className="btn-press flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 font-display text-xs font-bold text-coal shadow-md shadow-brand/40 hover:brightness-110"
                        >
                          <Plus className="size-3.5" />
                          <span>+ Masukkan ke Resep</span>
                        </button>
                      </div>
                    </div>

                    {/* Card Metrik Dinamis di Samping Form (5 Kolom) */}
                    <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                      {/* Card Metrik 1: Total HPP Resep */}
                      <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] uppercase font-bold tracking-wider text-red-300">
                            Total HPP Resep
                          </span>
                          <span className="text-[10px] text-faint tabular">
                            {recipe.length} bahan terpasang
                          </span>
                        </div>
                        <div className="my-1.5">
                          <p className="font-display text-2xl sm:text-3xl font-extrabold tabular text-red-300 text-glow">
                            {formatIDR(baseHpp)}
                          </p>
                        </div>
                        <p className="text-[11px] text-sand/80">
                          Total akumulasi modal bahan baku produk.
                        </p>
                      </div>

                      {/* Card Metrik 2: Margin Keuntungan */}
                      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] uppercase font-bold tracking-wider text-emerald-300">
                            Margin Keuntungan
                          </span>
                          <span className="text-[10px] text-faint font-semibold">
                            Harga Jual: {formatIDR(price)}
                          </span>
                        </div>
                        <div className="my-1.5 flex items-baseline gap-2">
                          <p className="font-display text-2xl sm:text-3xl font-extrabold tabular text-emerald-400 text-glow">
                            {marginPct}%
                          </p>
                          <span className="text-xs text-sand font-bold">
                            ({formatIDR(grossProfit)} laba kotor)
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-300/80 font-medium">
                          {marginPct >= 65 ? "✅ Margin Sehat (Standar F&B)" : marginPct >= 50 ? "⚠️ Cukup Sehat" : "🚨 Margin Tipis"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tabel Daftar Resep Aktif */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-display text-xs font-bold uppercase tracking-wider text-faint">
                        Komposisi Bahan Baku Terpasang ({recipe.length})
                      </h3>
                      <span className="text-xs text-sand font-bold">
                        Total HPP Bahan: {formatIDR(baseHpp)}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-line bg-coal overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-line bg-panel text-[10px] uppercase tracking-wider text-faint">
                            <tr>
                              <th className="py-2.5 px-3.5 font-bold">Bahan Baku</th>
                              <th className="py-2.5 px-3.5 font-bold">Takaran</th>
                              <th className="py-2.5 px-3.5 font-bold">Biaya Modal / Unit</th>
                              <th className="py-2.5 px-3.5 font-bold">Subtotal HPP</th>
                              <th className="py-2.5 px-3.5 font-bold">Cakupan Varian</th>
                              <th className="py-2.5 px-3.5 text-right font-bold">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line/60">
                            {recipe.map((item, idx) => {
                              const lineCost = item.qty * item.costPerUnit;
                              return (
                                <tr key={idx} className="hover:bg-panel/40 transition-colors">
                                  <td className="py-2.5 px-3.5 font-bold text-cream">
                                    {item.ingredientName}
                                  </td>
                                  <td className="py-2.5 px-3.5 font-semibold tabular text-sand">
                                    {formatQty(item.qty, item.unit)}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-faint tabular">
                                    {formatIDR(item.costPerUnit)} / {item.unit}
                                  </td>
                                  <td className="py-2.5 px-3.5 font-display font-bold tabular text-emerald-400">
                                    {formatIDR(lineCost)}
                                  </td>
                                  <td className="py-2.5 px-3.5">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                        item.variantName
                                          ? "border-sky-400/30 bg-sky-400/10 text-sky-300"
                                          : "border-line bg-panel text-faint"
                                      }`}
                                    >
                                      {item.variantName ? `Varian ${item.variantName}` : "Semua Varian"}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveIngredient(idx)}
                                      className="btn-press grid size-7 place-items-center rounded-lg text-faint hover:text-red-400 hover:bg-panel ml-auto"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                            {recipe.length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-8 text-center text-faint italic">
                                  Belum ada bahan baku yang ditautkan ke resep ini.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: KALKULATOR & SIMULASI MARGIN */}
              {activeTab === "margin" && (
                <div className="space-y-5">
                  {/* Radar Margin Box */}
                  <div
                    className={`rounded-3xl border p-5 sm:p-6 text-center ${
                      marginPct >= 65
                        ? "border-emerald-400/40 bg-emerald-950/25"
                        : marginPct >= 50
                          ? "border-amber-400/40 bg-amber-950/25"
                          : "border-red-400/40 bg-red-950/25"
                    }`}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-faint mb-1">
                      Kalkulasi Margin Resep Real-Time
                    </p>
                    <p
                      className={`font-display text-4xl sm:text-5xl font-extrabold tabular my-1 ${
                        marginPct >= 65
                          ? "text-emerald-400"
                          : marginPct >= 50
                            ? "text-amber-300"
                            : "text-red-400"
                      }`}
                    >
                      {marginPct}%
                    </p>
                    <p className="text-xs text-sand font-medium mt-1">
                      {marginPct >= 65
                        ? "✅ Sangat Sehat! Margin sesuai standar ideal profitabilitas cafe/resto."
                        : marginPct >= 50
                          ? "⚠️ Cukup Sehat. Masih dapat dioptimalkan dengan efisiensi bahan."
                          : "🚨 Margin Tipis. Berisiko rugi saat fluktuasi harga bahan baku."}
                    </p>
                  </div>

                  {/* Komparasi Finansial */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-line bg-coal p-4 text-center">
                      <span className="text-[10.5px] uppercase font-bold text-faint">Harga Jual Menu</span>
                      <p className="font-display text-xl font-bold tabular text-cream mt-1">
                        {formatIDR(price)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-line bg-coal p-4 text-center">
                      <span className="text-[10.5px] uppercase font-bold text-faint">Total HPP Bahan (BOM)</span>
                      <p className="font-display text-xl font-bold tabular text-red-300 mt-1">
                        {formatIDR(baseHpp)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-line bg-coal p-4 text-center">
                      <span className="text-[10.5px] uppercase font-bold text-faint">Laba Kotor Per Porsi</span>
                      <p className="font-display text-xl font-bold tabular text-emerald-400 mt-1">
                        {formatIDR(grossProfit)}
                      </p>
                    </div>
                  </div>

                  {/* Rekomendasi Harga Jual */}
                  <div className="rounded-2xl border border-brand/40 bg-brand/10 p-4 flex items-start gap-3 text-xs leading-relaxed">
                    <Sparkles className="size-5 text-brand shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-display font-bold text-cream text-sm mb-0.5">
                        Rekomendasi AI Pricing (Target Margin 65%)
                      </h4>
                      <p className="text-sand/90">
                        Berdasarkan total HPP bahan baku saat ini sebesar <strong>{formatIDR(baseHpp)}</strong>,
                        harga jual ideal yang disarankan adalah minimal{" "}
                        <strong className="text-brand font-display text-sm">{formatIDR(suggestedPrice)}</strong>.
                      </p>
                      {price < suggestedPrice && (
                        <button
                          type="button"
                          onClick={() => setPrice(suggestedPrice)}
                          className="btn-press mt-2 rounded-xl bg-brand px-3 py-1 text-[11px] font-bold text-coal hover:brightness-110"
                        >
                          Terapkan Harga Rekomendasi ({formatIDR(suggestedPrice)})
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* =================================================================
                MODAL FOOTER ACTIONS
               ================================================================= */}
            <div className="px-5 sm:px-6 py-4 border-t border-line bg-coal/70 flex items-center justify-between gap-3 shrink-0">
              {initialData?.id && onDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Hapus produk "${initialData.name}" dan seluruh resepnya?`)) {
                      onDelete(initialData.id!);
                      onClose();
                    }
                  }}
                  className="btn-press flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                >
                  <Trash2 className="size-3.5" />
                  <span>Hapus Menu</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-press rounded-xl border border-line px-4 py-2.5 text-xs font-semibold text-faint hover:text-cream"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="btn-press flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 font-display text-xs font-bold text-coal shadow-md shadow-brand/50 hover:brightness-110"
                >
                  <Check className="size-4" />
                  <span>Simpan Produk &amp; Resep</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
