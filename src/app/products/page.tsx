"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coffee, Search, Plus, Sparkles, Scale, TrendingUp, Filter, Tag,
  FolderPlus, Pencil, Trash2, CheckCircle2, AlertTriangle, ArrowRight,
  Layers, Package, ChefHat, RefreshCcw, Loader2, DollarSign,
  CupSoda, Flame, Croissant, CakeSlice, Leaf, Milk, Beer,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import ProductRecipeModal, { type ProductFormData, type RecipeItemData } from "@/components/products/ProductRecipeModal";
import CategoryModal, { type CategoryData } from "@/components/products/CategoryModal";
import type { CatalogDto, IngredientDto } from "@/lib/types";
import { formatIDR, formatQty } from "@/lib/format";

const ICONS_MAP: Record<string, typeof Coffee> = {
  Coffee, Filter, CupSoda, Flame, Sparkles, Croissant, CakeSlice, Leaf, Milk, Beer,
};

export default function ProductsPage() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<{ id: number; name: string; icon: string; sortOrder?: number }[]>([]);
  const [products, setProducts] = useState<ProductFormData[]>([]);
  const [ingredients, setIngredients] = useState<IngredientDto[]>([]);

  // Filter & Search
  const [selectedCat, setSelectedCat] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [viewTab, setViewTab] = useState<"products" | "categories" | "simulator">("products");

  // Modals state
  const [productModal, setProductModal] = useState<{ open: boolean; data?: ProductFormData | null }>({ open: false });
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; data?: CategoryData | null }>({ open: false });
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "warn" } | null>(null);

  // Simulator State
  const [simPrice, setSimPrice] = useState<number>(28000);
  const [simItems, setSimItems] = useState<{ ingId: number; qty: number }[]>([]);

  const showToast = (msg: string, kind: "ok" | "warn" = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3800);
  };

  /* -------------------------------- LOAD DATA -------------------------------- */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, catRes, ingRes] = await Promise.all([
        fetch("/api/products").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/categories").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/inventory").then((r) => (r.ok ? r.json() : null)),
      ]);

      if (ingRes?.ingredients) {
        setIngredients(ingRes.ingredients);
      }

      if (catRes?.categories) {
        setCategories(catRes.categories);
      }

      if (prodRes?.products) {
        setProducts(prodRes.products);
      }
    } catch (err) {
      console.error("loadData error:", err);
      showToast("Gagal memuat data dari server.", "warn");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ------------------------------- COMPUTED --------------------------------- */
  const productHppMap = useMemo(() => {
    const map = new Map<number, number>();
    products.forEach((p) => {
      // Prioritaskan server-calculated HPP dari database jika tersedia
      if (p.hpp && p.hpp > 0) {
        map.set(p.id ?? 0, p.hpp);
      } else {
        const total = p.recipe.reduce((s, r) => s + r.qty * r.costPerUnit, 0);
        map.set(p.id ?? 0, total);
      }
    });
    return map;
  }, [products]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (selectedCat !== "all") {
      list = list.filter((p) => p.categoryId === selectedCat);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.tagline.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, selectedCat, query]);

  // Statistik Ringkas
  const stats = useMemo(() => {
    const totalMenu = products.length;
    let totalMargin = 0;
    let validCount = 0;
    let criticalCount = 0;

    products.forEach((p) => {
      const hpp = productHppMap.get(p.id ?? 0) ?? 0;
      if (p.price > 0 && hpp > 0) {
        const margin = ((p.price - hpp) / p.price) * 100;
        totalMargin += margin;
        validCount++;
        if (margin < 50) criticalCount++;
      }
    });

    return {
      totalMenu,
      totalCats: categories.length,
      avgMargin: validCount > 0 ? Math.round(totalMargin / validCount) : 68,
      criticalCount,
    };
  }, [products, categories, productHppMap]);

  /* --------------------------- CRUD HANDLERS (API) --------------------------- */
  const handleSaveProduct = async (formData: ProductFormData) => {
    try {
      const isEdit = Boolean(formData.id);
      const url = isEdit ? `/api/products/${formData.id}` : "/api/products";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: formData.categoryId,
          name: formData.name,
          tagline: formData.tagline,
          price: formData.price,
          hpp: formData.hpp,
          color: formData.color,
          icon: formData.icon,
          imageUrl: formData.imageUrl ?? "",
          isActive: formData.isActive,
          isBundle: formData.isBundle ?? false,
          bundleItems: formData.bundleItems,
          variants: formData.variants,
          recipe: (formData.recipe || []).map((r) => ({
            ingredientId: r.ingredientId,
            qty: r.qty,
            variantName: r.variantName ?? null,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Gagal menyimpan produk.", "warn");
        return;
      }

      await loadData();
      showToast(
        isEdit
          ? `Menu "${formData.name}" berhasil diperbarui (HPP terverifikasi server: ${formatIDR(data.serverHpp)}).`
          : `Menu baru "${formData.name}" tersimpan (HPP terverifikasi server: ${formatIDR(data.serverHpp)}).`,
        "ok"
      );
    } catch (err) {
      console.error("handleSaveProduct error:", err);
      showToast("Koneksi gagal saat menyimpan produk.", "warn");
    }
  };

  const handleDeleteProduct = async (id: number) => {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Gagal menghapus produk.", "warn");
        return;
      }

      await loadData();
      showToast(data.message ?? "Menu berhasil dihapus dari database.", "ok");
    } catch (err) {
      console.error("handleDeleteProduct error:", err);
      showToast("Gagal menghubungi server untuk menghapus produk.", "warn");
    }
  };

  const handleSaveCategory = async (catData: CategoryData) => {
    try {
      const isEdit = Boolean(catData.id);
      const url = isEdit ? `/api/categories/${catData.id}` : "/api/categories";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catData.name,
          icon: catData.icon,
          sortOrder: catData.sortOrder,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Gagal menyimpan kategori.", "warn");
        return;
      }

      await loadData();
      showToast(isEdit ? `Kategori "${catData.name}" diperbarui.` : `Kategori baru "${catData.name}" dibuat.`, "ok");
    } catch (err) {
      console.error("handleSaveCategory error:", err);
      showToast("Gagal menyimpan kategori ke server.", "warn");
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Gagal menghapus kategori.", "warn");
        return;
      }

      if (selectedCat === id) setSelectedCat("all");
      await loadData();
      showToast("Kategori telah dihapus.", "ok");
    } catch (err) {
      console.error("handleDeleteCategory error:", err);
      showToast("Gagal menghubungi server untuk menghapus kategori.", "warn");
    }
  };

  return (
    <AppShell allowedRoles={["manager", "owner"]}>
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 max-w-[1500px] w-full mx-auto">
        {/* ===================================================================
            HEADER: OWNER & MANAGER COCKPIT MASTER DATA
           =================================================================== */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-faint font-bold mb-1 flex items-center gap-2">
              BOM &amp; Recipe Engineering
              <span className="inline-flex items-center gap-1.5 text-brand normal-case tracking-normal">
                <ChefHat className="size-3.5" /> Real-time Costing
              </span>
            </p>
            <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">
              Master Menu &amp; Resep (BOM)
            </h1>
            <p className="text-xs sm:text-sm text-sand mt-1">
              Kelola katalog produk, multi-varian, penautan bahan baku laci, dan hitung HPP otomatis.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={() => setCategoryModal({ open: true })}
              className="btn-press flex items-center gap-2 rounded-xl border border-line-2 bg-panel px-3.5 py-2.5 text-xs font-semibold text-sand hover:text-cream hover:border-brand/40"
            >
              <FolderPlus className="size-4 text-brand" />
              <span>+ Kategori Baru</span>
            </button>

            <button
              type="button"
              onClick={() => setProductModal({ open: true })}
              className="btn-press flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-display text-xs sm:text-sm font-bold text-coal shadow-[0_12px_28px_-8px] shadow-brand/70 hover:brightness-110"
            >
              <Plus className="size-4.5" />
              <span>+ Tambah Menu &amp; Resep</span>
            </button>

            <button
              type="button"
              onClick={loadData}
              className="btn-press grid size-9 sm:size-10 place-items-center rounded-xl border border-line bg-panel text-sand hover:text-cream shrink-0"
              title="Muat ulang katalog"
            >
              <RefreshCcw className="size-4" />
            </button>
          </div>
        </div>

        {/* ===================================================================
            KPI SUMMARY: TOTAL MENU, MARGIN RATA-RATA, RESEP AKTIF
           =================================================================== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="rounded-2xl border border-line bg-panel p-4">
            <div className="flex items-center justify-between text-faint mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Menu Aktif</span>
              <Package className="size-4 text-brand" />
            </div>
            <p className="font-display text-2xl font-bold tabular text-cream">{stats.totalMenu}</p>
            <p className="text-[10.5px] text-faint mt-0.5">Terbagi dalam {stats.totalCats} kategori</p>
          </div>

          <div className="rounded-2xl border border-line bg-panel p-4">
            <div className="flex items-center justify-between text-faint mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Rata-Rata Margin F&amp;B</span>
              <TrendingUp className="size-4 text-emerald-400" />
            </div>
            <p className="font-display text-2xl font-bold tabular text-emerald-400">{stats.avgMargin}%</p>
            <p className="text-[10.5px] text-faint mt-0.5">Target industri cafe: 65% – 70%</p>
          </div>

          <div className="rounded-2xl border border-line bg-panel p-4">
            <div className="flex items-center justify-between text-faint mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Kategori Menu</span>
              <Layers className="size-4 text-sky-300" />
            </div>
            <p className="font-display text-2xl font-bold tabular text-cream">{stats.totalCats}</p>
            <p className="text-[10.5px] text-faint mt-0.5">Espresso, Manual Brew, Tea, Pastry</p>
          </div>

          <div className="rounded-2xl border border-line bg-panel p-4">
            <div className="flex items-center justify-between text-faint mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Margin Kritis (&lt;50%)</span>
              <AlertTriangle className="size-4 text-amber-400" />
            </div>
            <p className={`font-display text-2xl font-bold tabular ${stats.criticalCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {stats.criticalCount} Menu
            </p>
            <p className="text-[10.5px] text-faint mt-0.5">
              {stats.criticalCount > 0 ? "Perlu efisiensi resep bahan" : "Seluruh menu ber-margin sehat"}
            </p>
          </div>
        </div>

        {/* ===================================================================
            VIEW TABS: PRODUK & RESEP, KELOLA KATEGORI, SIMULATOR MARGIN
           =================================================================== */}
        <div className="flex items-center gap-2 border-b border-line pb-1">
          <button
            type="button"
            onClick={() => setViewTab("products")}
            className={`btn-press flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all -mb-1 ${
              viewTab === "products"
                ? "border-brand text-brand"
                : "border-transparent text-faint hover:text-cream"
            }`}
          >
            <Coffee className="size-4" />
            <span>Katalog Menu &amp; Resep BOM</span>
            <span className="rounded-full bg-panel border border-line px-2 py-0.2 text-[10px] tabular">
              {products.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewTab("categories")}
            className={`btn-press flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all -mb-1 ${
              viewTab === "categories"
                ? "border-brand text-brand"
                : "border-transparent text-faint hover:text-cream"
            }`}
          >
            <Layers className="size-4" />
            <span>Kelola Kategori</span>
            <span className="rounded-full bg-panel border border-line px-2 py-0.2 text-[10px] tabular">
              {categories.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewTab("simulator")}
            className={`btn-press flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all -mb-1 ${
              viewTab === "simulator"
                ? "border-brand text-brand"
                : "border-transparent text-faint hover:text-cream"
            }`}
          >
            <Sparkles className="size-4" />
            <span>Simulator HPP &amp; Target Pricing</span>
          </button>
        </div>

        {/* ===================================================================
            VIEW 1: KATALOG MENU & RESEP (BOM)
           =================================================================== */}
        {viewTab === "products" && (
          <div className="space-y-4">
            {/* Search & Category Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <Search className="size-4 text-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari nama menu atau tagline rasa…"
                  className="input-dark pl-9 text-xs sm:text-sm w-full"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                <button
                  type="button"
                  onClick={() => setSelectedCat("all")}
                  className={`btn-press shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedCat === "all"
                      ? "bg-brand text-coal shadow-sm shadow-brand/40"
                      : "bg-panel border border-line text-faint hover:text-cream"
                  }`}
                >
                  Semua ({products.length})
                </button>
                {categories.map((cat) => {
                  const count = products.filter((p) => p.categoryId === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCat(cat.id)}
                      className={`btn-press shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        selectedCat === cat.id
                          ? "bg-brand text-coal shadow-sm shadow-brand/40"
                          : "bg-panel border border-line text-faint hover:text-cream"
                      }`}
                    >
                      {cat.name} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grid Kartu Produk & Resep */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-44 rounded-3xl border border-line bg-panel animate-pulse-soft" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-3xl border border-line bg-panel p-12 text-center">
                <Coffee className="size-10 text-faint mx-auto mb-3" />
                <p className="font-display font-bold text-cream">Tidak ada menu yang cocok</p>
                <p className="text-xs text-faint mt-1">Coba kata kunci pencarian lain atau pilih kategori Semua.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
                {filteredProducts.map((p) => {
                  const hpp = productHppMap.get(p.id ?? 0) ?? 0;
                  const profit = p.price - hpp;
                  const margin = p.price > 0 ? Math.round((profit / p.price) * 1000) / 10 : 0;
                  const categoryName = categories.find((c) => c.id === p.categoryId)?.name ?? "Menu";
                  const IconComp = ICONS_MAP[p.icon] || Coffee;

                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group rounded-3xl border border-line bg-panel p-4 sm:p-5 flex flex-col justify-between hover:border-line-2 transition-all relative overflow-hidden"
                    >
                      {/* Top Row: Icon, Name, Category, Price */}
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="size-11 rounded-2xl object-cover shrink-0 border border-line-2 shadow-sm"
                              />
                            ) : (
                              <div
                                className="grid size-11 place-items-center rounded-2xl border shrink-0 shadow-sm"
                                style={{
                                  borderColor: `${p.color}50`,
                                  backgroundColor: `${p.color}15`,
                                  color: p.color,
                                }}
                              >
                                <IconComp className="size-5.5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-faint">
                                  {categoryName}
                                </span>
                                {p.isBundle && (
                                  <span className="inline-flex items-center gap-0.5 rounded-md bg-brand/20 border border-brand/40 px-1.5 py-0.2 text-[8.5px] font-extrabold text-brand uppercase tracking-wider">
                                    <Sparkles className="size-2.5" />
                                    <span>Paket Bundling</span>
                                  </span>
                                )}
                              </div>
                              <h3 className="font-display text-base font-bold text-cream truncate leading-tight mt-0.5">
                                {p.name}
                              </h3>
                              <p className="text-[11px] text-sand/80 truncate mt-0.5">
                                {p.tagline || "—"}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-faint block">Harga Jual</span>
                            <span className="font-display text-base font-bold tabular text-brand">
                              {formatIDR(p.price)}
                            </span>
                          </div>
                        </div>

                        {/* Middle Row: Radar HPP & Margin */}
                        <div className="rounded-2xl border border-line bg-coal p-3 my-3">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-faint">{p.isBundle ? "HPP Modal:" : "HPP Bahan:"}</span>
                              <span className="font-display font-bold tabular text-sand">
                                {formatIDR(hpp)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-faint">Margin:</span>
                              <span
                                className={`font-display font-bold tabular px-2 py-0.5 rounded-full text-[11px] border ${
                                  margin >= 65
                                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-400"
                                    : margin >= 50
                                      ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                                      : "border-red-400/40 bg-red-400/10 text-red-300"
                                }`}
                              >
                                {margin}% ({formatIDR(profit)})
                              </span>
                            </div>
                          </div>

                          {/* Detail Ringkas Resep Bahan atau Isi Paket */}
                          <div className="mt-2.5 pt-2 border-t border-line/50 text-[10.5px] text-faint">
                            {p.isBundle ? (
                              <>
                                <span className="font-bold text-sand">
                                  Isi Paket ({p.bundleItems?.length ?? 0} menu):
                                </span>{" "}
                                {p.bundleItems && p.bundleItems.length > 0 ? (
                                  p.bundleItems.map((b) => `${b.qty}x ${b.productName || "Menu"}`).join(", ")
                                ) : (
                                  <span className="text-red-400 italic">Belum ada item penyusun</span>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="font-bold text-sand">BOM ({p.recipe.length} bahan):</span>{" "}
                                {p.recipe.length > 0 ? (
                                  p.recipe.map((r) => `${r.ingredientName} (${formatQty(r.qty, r.unit)})`).join(", ")
                                ) : (
                                  <span className="text-red-400 italic">Belum ada resep bahan baku</span>
                                )}
                              </>
                            )}
                          </div>

                          {/* Varian jika ada */}
                          {p.variants.length > 0 && (
                            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                              {p.variants.map((v) => (
                                <span
                                  key={v.name}
                                  className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-panel border border-line text-faint font-semibold tabular"
                                >
                                  {v.name} (+{formatIDR(v.priceDelta)})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom Row: Edit Action Buttons */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-line/60">
                        <button
                          type="button"
                          onClick={() => setProductModal({ open: true, data: p })}
                          className="btn-press flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-line-2 bg-panel py-2 text-xs font-semibold text-sand hover:text-cream hover:border-brand/40"
                        >
                          <Pencil className="size-3.5" />
                          <span>Edit Menu &amp; Resep</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Hapus menu "${p.name}"?`)) {
                              handleDeleteProduct(p.id!);
                            }
                          }}
                          className="btn-press grid size-8 place-items-center rounded-xl border border-line text-faint hover:text-red-400 hover:border-red-400/30"
                          title="Hapus menu"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            VIEW 2: KELOLA KATEGORI
           =================================================================== */}
        {viewTab === "categories" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-cream">Daftar Kategori Menu</h2>
                <p className="text-xs text-faint">Atur hierarki kategori dan ikon visualnya pada tampilan POS</p>
              </div>
              <button
                type="button"
                onClick={() => setCategoryModal({ open: true })}
                className="btn-press flex items-center gap-2 rounded-xl bg-brand px-4 py-2 font-display text-xs font-bold text-coal shadow-md shadow-brand/40 hover:brightness-110"
              >
                <Plus className="size-4" />
                <span>+ Kategori Baru</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {categories.map((cat) => {
                const count = products.filter((p) => p.categoryId === cat.id).length;
                const IconComp = ICONS_MAP[cat.icon] || Coffee;

                return (
                  <div
                    key={cat.id}
                    className="rounded-3xl border border-line bg-panel p-5 flex flex-col justify-between hover:border-line-2 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="grid size-12 place-items-center rounded-2xl border border-brand/40 bg-brand/10 text-brand">
                        <IconComp className="size-6" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-faint bg-coal px-2 py-1 rounded-lg border border-line tabular">
                        Urutan #{cat.sortOrder ?? 1}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display text-lg font-bold text-cream">{cat.name}</h3>
                      <p className="text-xs text-sand font-medium mt-0.5">
                        {count} Produk Terdaftar
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-4 mt-4 border-t border-line">
                      <button
                        type="button"
                        onClick={() =>
                          setCategoryModal({
                            open: true,
                            data: {
                              id: cat.id,
                              name: cat.name,
                              icon: cat.icon,
                              sortOrder: cat.sortOrder ?? 1,
                            },
                          })
                        }
                        className="btn-press flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-line bg-coal py-2 text-xs font-semibold text-sand hover:text-cream"
                      >
                        <Pencil className="size-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="btn-press grid size-8 place-items-center rounded-xl border border-line bg-coal text-faint hover:text-red-400"
                        title="Hapus kategori"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================================================================
            VIEW 3: SIMULATOR HPP & AI PRICING
           =================================================================== */}
        {viewTab === "simulator" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Form Simulasi */}
            <div className="lg:col-span-2 rounded-3xl border border-line bg-panel p-5 sm:p-6 space-y-5">
              <div>
                <div className="flex items-center gap-2 text-brand font-bold text-sm mb-1">
                  <Sparkles className="size-4.5" />
                  <span>Simulator HPP &amp; Target Pricing F&amp;B</span>
                </div>
                <p className="text-xs text-faint">
                  Uji racikan bahan baku dan takarannya untuk melihat langsung HPP per porsi sebelum menu dibuat.
                </p>
              </div>

              {/* Input Target Harga Jual */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-1.5">
                  Rencana Harga Jual (Rp)
                </label>
                <div className="flex items-center gap-2 rounded-2xl border border-line-2 bg-coal px-4 py-3 max-w-sm">
                  <span className="font-display text-sm font-bold text-faint">Rp</span>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={simPrice}
                    onChange={(e) => setSimPrice(Number(e.target.value))}
                    className="w-full bg-transparent font-display text-xl font-bold tabular outline-none text-cream"
                  />
                </div>
              </div>

              {/* Racikan Bahan Simulator */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-faint">
                    Bahan Baku Dalam Racikan ({simItems.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => ingredients[0] && setSimItems((prev) => [...prev, { ingId: ingredients[0].id, qty: 10 }])}
                    disabled={ingredients.length === 0}
                    className="btn-press flex items-center gap-1 rounded-xl border border-line bg-coal px-3 py-1.5 text-xs font-semibold text-sand hover:text-cream disabled:opacity-40"
                  >
                    <Plus className="size-3.5" />
                    <span>Tambah Bahan</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {simItems.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-line rounded-2xl bg-coal/40 p-4">
                      <p className="text-xs text-sand font-medium">Belum ada bahan baku di simulator.</p>
                      <p className="text-[11px] text-faint mt-1">
                        {ingredients.length === 0
                          ? "Tambahkan master bahan baku terlebih dahulu di menu Inventory."
                          : "Pilih bahan baku untuk mulai menyusun racikan dan menghitung estimasi HPP."}
                      </p>
                      {ingredients.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSimItems([{ ingId: ingredients[0].id, qty: 10 }])}
                          className="btn-press mt-3 inline-flex items-center gap-1 rounded-xl bg-brand/10 border border-brand/30 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/20"
                        >
                          <Plus className="size-3.5" />
                          <span>Pilih Bahan Pertama</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    simItems.map((item, idx) => {
                      const ing = ingredients.find((i) => i.id === item.ingId) ?? ingredients[0];
                      const subCost = (item.qty || 0) * (ing?.costPerUnit || 0);

                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2.5 rounded-2xl border border-line bg-coal p-3"
                        >
                          <select
                            value={item.ingId}
                            onChange={(e) =>
                              setSimItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, ingId: Number(e.target.value) } : it))
                              )
                            }
                            className="input-dark text-xs flex-1"
                          >
                            {ingredients.map((ig) => (
                              <option key={ig.id} value={ig.id}>
                                {ig.name} ({formatIDR(ig.costPerUnit)}/{ig.unit})
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1.5 rounded-xl border border-line bg-panel px-3 py-1.5 w-36">
                            <input
                              type="number"
                              min={0.1}
                              step={0.1}
                              value={item.qty}
                              onChange={(e) =>
                                setSimItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, qty: Number(e.target.value) } : it))
                                )
                              }
                              className="w-full bg-transparent text-xs font-bold tabular outline-none text-cream"
                            />
                            <span className="text-xs text-sand font-semibold">{ing?.unit}</span>
                          </div>

                          <div className="w-28 text-right font-display text-xs font-bold tabular text-sand">
                            {formatIDR(subCost)}
                          </div>

                          <button
                            type="button"
                            onClick={() => setSimItems((prev) => prev.filter((_, i) => i !== idx))}
                            className="btn-press grid size-8 place-items-center rounded-xl text-faint hover:text-red-400 hover:bg-panel"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>


            {/* Panel Hasil Simulasi Real-Time */}
            {(() => {
              const totalSimHpp = simItems.reduce((acc, it) => {
                const ing = ingredients.find((i) => i.id === it.ingId);
                return acc + (it.qty || 0) * (ing?.costPerUnit || 0);
              }, 0);
              const simGrossProfit = Math.max(0, simPrice - totalSimHpp);
              const simMarginPct =
                simPrice > 0 ? Math.round(((simPrice - totalSimHpp) / simPrice) * 1000) / 10 : 0;
              const simIdealPrice = Math.ceil(totalSimHpp / 0.35 / 1000) * 1000;

              return (
                <div className="space-y-4">
                  {/* Radar Margin Box */}
                  <div
                    className={`rounded-3xl border p-5 text-center ${
                      simMarginPct >= 65
                        ? "border-emerald-400/40 bg-emerald-950/25"
                        : simMarginPct >= 50
                          ? "border-amber-400/40 bg-amber-950/25"
                          : "border-red-400/40 bg-red-950/25"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-faint">
                      Estimasi Margin Kotor
                    </span>
                    <p
                      className={`font-display text-4xl font-black tabular my-1 ${
                        simMarginPct >= 65
                          ? "text-emerald-400"
                          : simMarginPct >= 50
                            ? "text-amber-300"
                            : "text-red-400"
                      }`}
                    >
                      {simMarginPct}%
                    </p>
                    <p className="text-xs text-sand">
                      Laba per porsi: <strong className="text-cream">{formatIDR(simGrossProfit)}</strong>
                    </p>
                  </div>

                  {/* Ringkasan Biaya */}
                  <div className="rounded-3xl border border-line bg-panel p-5 space-y-3 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-line">
                      <span className="text-faint">Total HPP Racikan:</span>
                      <span className="font-display font-bold tabular text-red-300">
                        {formatIDR(totalSimHpp)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-line">
                      <span className="text-faint">Harga Jual Direncanakan:</span>
                      <span className="font-display font-bold tabular text-brand">
                        {formatIDR(simPrice)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <span className="text-faint font-bold">Rekomendasi Harga Ideal (Margin 65%):</span>
                      <span className="font-display font-bold tabular text-emerald-400">
                        {formatIDR(simIdealPrice)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setProductModal({
                          open: true,
                          data: {
                            categoryId: categories[0]?.id ?? 1,
                            name: "Menu Racikan Baru",
                            tagline: "Dibuat dari Simulator HPP",
                            price: simPrice,
                            color: "#F59E0B",
                            icon: "Coffee",
                            isActive: true,
                            variants: [],
                            recipe: simItems.map((si) => {
                              const ing = ingredients.find((i) => i.id === si.ingId);
                              return {
                                ingredientId: si.ingId,
                                ingredientName: ing?.name ?? "Bahan",
                                unit: ing?.unit ?? "g",
                                costPerUnit: ing?.costPerUnit ?? 0,
                                qty: si.qty,
                              };
                            }),
                          },
                        });
                      }}
                      className="btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3 font-display text-xs font-bold text-coal shadow-md shadow-brand/40 hover:brightness-110 mt-2"
                    >
                      <Plus className="size-4" />
                      <span>Jadikan Menu Resmi</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ===================================================================
          MODALS
         =================================================================== */}
      <ProductRecipeModal
        open={productModal.open}
        initialData={productModal.data}
        categories={categories}
        ingredients={ingredients}
        allProducts={products.map((p) => ({
          id: p.id ?? 0,
          name: p.name,
          price: p.price,
          hpp: p.hpp ?? 0,
        }))}
        onClose={() => setProductModal({ open: false })}
        onSave={handleSaveProduct}
        onDelete={handleDeleteProduct}
      />

      <CategoryModal
        open={categoryModal.open}
        initialData={categoryModal.data}
        onClose={() => setCategoryModal({ open: false })}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className={`fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border px-5 py-3 text-sm font-semibold shadow-ticket backdrop-blur-lg max-w-md text-center ${
              toast.kind === "warn"
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
