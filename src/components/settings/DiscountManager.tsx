"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag,
  Percent,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  X,
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
} from "lucide-react";
import { formatIDR } from "@/lib/format";
import type { DiscountDto, DiscountType } from "@/lib/types";

export default function DiscountManager({
  userRole = "owner",
  onToast,
}: {
  userRole?: string;
  onToast?: (msg: string, kind?: "ok" | "warn") => void;
}) {
  const [discounts, setDiscounts] = useState<DiscountDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Modal State Tambah / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountDto | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<DiscountType>("percentage");
  const [formValue, setFormValue] = useState<string>("10");
  const [formMinOrder, setFormMinOrder] = useState<string>("0");
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal State Konfirmasi Hapus
  const [deleteTarget, setDeleteTarget] = useState<DiscountDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDiscounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/discounts");
      if (!res.ok) throw new Error("Gagal mengambil master diskon.");
      const data = await res.json();
      setDiscounts(data.discounts || []);
    } catch (err) {
      console.error("fetch discounts error:", err);
      onToast?.("Gagal memuat daftar promo dari server.", "warn");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const filteredDiscounts = useMemo(() => {
    return discounts.filter((d) => {
      const matchSearch =
        !searchQuery.trim() || d.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && d.isActive) ||
        (filterStatus === "inactive" && !d.isActive);
      return matchSearch && matchStatus;
    });
  }, [discounts, searchQuery, filterStatus]);

  const activeCount = discounts.filter((d) => d.isActive).length;
  const inactiveCount = discounts.filter((d) => !d.isActive).length;

  const handleOpenAddModal = () => {
    setEditingDiscount(null);
    setFormName("");
    setFormType("percentage");
    setFormValue("10");
    setFormMinOrder("0");
    setFormIsActive(true);
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (d: DiscountDto) => {
    setEditingDiscount(d);
    setFormName(d.name);
    setFormType(d.type);
    setFormValue(String(d.value));
    setFormMinOrder(String(d.minOrder));
    setFormIsActive(d.isActive);
    setFormError(null);
    setModalOpen(true);
  };

  const handleToggleActive = async (d: DiscountDto) => {
    setTogglingId(d.id);
    try {
      const nextActive = !d.isActive;
      const res = await fetch("/api/discounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.id, isActive: nextActive }),
      });

      const data = await res.json();
      if (!res.ok) {
        onToast?.(data.error || "Gagal mengubah status promo.", "warn");
        return;
      }

      setDiscounts((prev) =>
        prev.map((item) => (item.id === d.id ? { ...item, isActive: nextActive } : item))
      );
      onToast?.(
        nextActive
          ? `Promo "${d.name}" kini aktif dan dapat dipilih kasir.`
          : `Promo "${d.name}" telah dinonaktifkan.`,
        "ok"
      );
    } catch {
      onToast?.("Terjadi kendala jaringan saat memperbarui status promo.", "warn");
    } finally {
      setTogglingId(null);
    }
  };

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formName.trim();
    if (!name || name.length < 2) {
      setFormError("Nama promo minimal 2 karakter.");
      return;
    }

    const numValue = Number(formValue);
    if (isNaN(numValue) || numValue <= 0) {
      setFormError("Nilai diskon harus lebih dari 0.");
      return;
    }

    if (formType === "percentage" && numValue > 100) {
      setFormError("Diskon persentase tidak boleh melebihi 100%.");
      return;
    }

    const numMinOrder = Math.max(0, Number(formMinOrder) || 0);

    setFormSubmitting(true);
    try {
      const isEdit = Boolean(editingDiscount);
      const res = await fetch("/api/discounts", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingDiscount?.id,
          name,
          type: formType,
          value: numValue,
          minOrder: numMinOrder,
          isActive: formIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Gagal menyimpan data promo.");
        return;
      }

      await fetchDiscounts();
      setModalOpen(false);
      onToast?.(
        isEdit
          ? `Promo "${name}" berhasil diperbarui!`
          : `Promo baru "${name}" berhasil dibuat dan siap digunakan!`,
        "ok"
      );
    } catch {
      setFormError("Koneksi server terputus saat menyimpan promo.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeletePromo = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/discounts?id=${deleteTarget.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        onToast?.(data.error || "Gagal menghapus promo.", "warn");
        return;
      }

      setDiscounts((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      onToast?.(`Promo "${deleteTarget.name}" berhasil dihapus.`, "ok");
      setDeleteTarget(null);
    } catch {
      onToast?.("Terjadi kesalahan jaringan saat menghapus promo.", "warn");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* =====================================================================
          HEADER & METRIK STATISTIK DISKON
         ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-line bg-panel p-4 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-brand/15 text-brand border border-brand/25 shrink-0">
            <Tag className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Total Master Promo</p>
            <p className="font-display text-xl sm:text-2xl font-bold text-cream tabular">
              {discounts.length}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300/80">
              Promo Aktif di POS
            </p>
            <p className="font-display text-xl sm:text-2xl font-bold text-emerald-400 tabular">
              {activeCount}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-panel p-4 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-zinc-800 text-sand border border-line shrink-0">
            <ToggleLeft className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Nonaktif (Draft)</p>
            <p className="font-display text-xl sm:text-2xl font-bold text-sand tabular">
              {inactiveCount}
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================================
          FILTER & TOMBOL TAMBAH PROMO
         ===================================================================== */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border border-line bg-panel">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-faint" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama promo atau diskon..."
            className="w-full rounded-xl border border-line bg-coal pl-10 pr-4 py-2 text-xs sm:text-sm text-cream placeholder:text-faint outline-none focus:border-brand/50 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-coal border border-line">
            <button
              type="button"
              onClick={() => setFilterStatus("all")}
              className={`btn-press px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                filterStatus === "all" ? "bg-brand text-coal" : "text-sand hover:text-cream"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("active")}
              className={`btn-press px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                filterStatus === "active" ? "bg-brand text-coal" : "text-sand hover:text-cream"
              }`}
            >
              Aktif
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("inactive")}
              className={`btn-press px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                filterStatus === "inactive" ? "bg-brand text-coal" : "text-sand hover:text-cream"
              }`}
            >
              Nonaktif
            </button>
          </div>

          <button
            type="button"
            onClick={fetchDiscounts}
            disabled={loading}
            className="btn-press grid size-9 place-items-center rounded-xl border border-line bg-coal text-sand hover:text-cream transition shrink-0"
            title="Segarkan daftar promo"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin text-brand" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="btn-press flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-coal hover:brightness-110 shadow-md shadow-brand/20 shrink-0"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            <span>Tambah Promo</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          DAFTAR PROMO CARD GRID
         ===================================================================== */}
      {loading && discounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-faint">
          <Loader2 className="size-8 animate-spin text-brand mb-2" />
          <p className="text-xs">Memuat master promo &amp; diskon...</p>
        </div>
      ) : filteredDiscounts.length === 0 ? (
        <div className="rounded-2xl border border-line bg-panel p-8 text-center text-faint">
          <Tag className="size-10 mx-auto mb-2 text-line-2" />
          <p className="font-semibold text-sand text-sm">
            {searchQuery ? "Tidak ada promo yang sesuai pencarian." : "Belum ada master promo."}
          </p>
          <p className="text-xs mt-1">
            Buat promo diskon agar kasir dapat memilih diskon resmi di keranjang POS.
          </p>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="btn-press mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-coal hover:brightness-110"
          >
            <Plus className="size-4" />
            <span>Buat Promo Pertama</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredDiscounts.map((d) => {
            const isToggling = togglingId === d.id;
            return (
              <div
                key={d.id}
                className={`rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                  d.isActive
                    ? "border-line bg-panel hover:border-brand/40 shadow-sm"
                    : "border-line/60 bg-coal/60 opacity-70"
                }`}
              >
                <div>
                  {/* Top Bar Card: Badge Tipe & Switch Toggle */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        d.type === "percentage"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {d.type === "percentage" ? (
                        <>
                          <Percent className="size-3" /> Diskon {d.value}%
                        </>
                      ) : (
                        <>Potongan {formatIDR(d.value)}</>
                      )}
                    </span>

                    {/* Toggle Switch Aktif/Nonaktif */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(d)}
                      disabled={isToggling}
                      className={`btn-press inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                        d.isActive
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                          : "bg-zinc-800 text-faint border border-line hover:text-cream"
                      }`}
                      title="Klik untuk mengubah status aktif/nonaktif promo"
                    >
                      {isToggling ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : d.isActive ? (
                        <>
                          <ToggleRight className="size-4 text-emerald-400" />
                          <span>Aktif</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="size-4 text-zinc-500" />
                          <span>Nonaktif</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Nama Promo */}
                  <h4 className="font-display text-base font-bold text-cream tracking-tight mb-1">
                    {d.name}
                  </h4>

                  {/* Syarat Minimal Belanja */}
                  <div className="text-xs text-sand flex items-center gap-1.5 mt-2">
                    <span className="text-faint">Syarat:</span>
                    {d.minOrder > 0 ? (
                      <span className="font-semibold text-amber-400 tabular">
                        Min. Belanja {formatIDR(d.minOrder)}
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-medium">Tanpa Minimal Belanja</span>
                    )}
                  </div>
                </div>

                {/* Footer Card: Tombol Edit & Hapus */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-line/60 text-xs">
                  <span className="text-[10px] text-faint">
                    ID #{d.id}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(d)}
                      className="btn-press flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line bg-coal text-sand hover:text-cream hover:border-brand/40 text-xs font-semibold"
                      title="Edit promo ini"
                    >
                      <Pencil className="size-3 text-brand" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(d)}
                      className="btn-press flex items-center gap-1 px-2 py-1.5 rounded-lg border border-line bg-coal text-faint hover:text-red-400 hover:border-red-500/40 text-xs"
                      title="Hapus promo ini"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =====================================================================
          MODAL FORM TAMBAH / EDIT PROMO
         ===================================================================== */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-coal/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-line-2 bg-panel-2 p-5 sm:p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-xl bg-brand/15 text-brand border border-brand/30">
                    <Tag className="size-4.5" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-cream">
                      {editingDiscount ? "Edit Master Promo" : "Tambah Promo Baru"}
                    </h3>
                    <p className="text-[11px] text-faint">
                      Atur nama, nilai diskon, dan batas minimal belanja
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-press grid size-8 place-items-center rounded-xl text-faint hover:text-cream"
                >
                  <X className="size-4" />
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/15 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="size-4 text-red-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSavePromo} className="space-y-4">
                {/* Nama Promo */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-faint block mb-1.5">
                    Nama Promo
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="cth: Diskon Member 10%, Jumat Berkah Rp 5.000"
                    className="w-full rounded-xl border border-line bg-coal px-3.5 py-2.5 text-xs sm:text-sm text-cream placeholder:text-faint outline-none focus:border-brand/50 transition font-medium"
                  />
                </div>

                {/* Pilihan Tipe Promo: Persentase vs Nominal Tetap */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-faint block mb-1.5">
                    Tipe Diskon
                  </label>
                  <div className="grid grid-cols-2 p-1 rounded-xl bg-coal border border-line">
                    <button
                      type="button"
                      onClick={() => setFormType("percentage")}
                      className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                        formType === "percentage"
                          ? "bg-brand text-coal shadow-sm"
                          : "text-sand hover:text-cream"
                      }`}
                    >
                      <Percent className="size-3.5" />
                      <span>Persentase (%)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType("fixed")}
                      className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                        formType === "fixed"
                          ? "bg-brand text-coal shadow-sm"
                          : "text-sand hover:text-cream"
                      }`}
                    >
                      <span>Nominal Tetap (Rp)</span>
                    </button>
                  </div>
                </div>

                {/* Nilai Diskon */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-faint block mb-1.5">
                    {formType === "percentage" ? "Persentase Diskon (%)" : "Nominal Potongan (Rp)"}
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-line bg-coal px-3.5 py-2.5 focus-within:border-brand/50 transition">
                    <span className="text-xs text-sand font-bold font-display">
                      {formType === "percentage" ? "%" : "Rp"}
                    </span>
                    <input
                      type="number"
                      required
                      min={1}
                      max={formType === "percentage" ? 100 : 10000000}
                      value={formValue}
                      onChange={(e) => setFormValue(e.target.value)}
                      placeholder={formType === "percentage" ? "10" : "5000"}
                      className="w-full bg-transparent font-display text-base font-bold tabular outline-none text-cream"
                    />
                  </div>
                </div>

                {/* Syarat Minimal Belanja */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-faint block mb-1.5">
                    Syarat Minimal Belanja (Rp)
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-line bg-coal px-3.5 py-2.5 focus-within:border-brand/50 transition">
                    <span className="text-xs text-sand font-bold font-display">Rp</span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={formMinOrder}
                      onChange={(e) => setFormMinOrder(e.target.value)}
                      placeholder="0 (isi 0 jika tanpa minimal belanja)"
                      className="w-full bg-transparent font-display text-base font-bold tabular outline-none text-cream"
                    />
                  </div>
                  <p className="text-[10px] text-faint mt-1">
                    Kasir hanya dapat menerapkan promo ini jika subtotal pesanan mencapai nilai minimal ini.
                  </p>
                </div>

                {/* Checkbox Status Aktif */}
                <div className="flex items-center gap-3 p-3 rounded-xl border border-line bg-coal">
                  <input
                    type="checkbox"
                    id="promoIsActive"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="size-4 rounded text-brand focus:ring-brand"
                  />
                  <label htmlFor="promoIsActive" className="text-xs text-cream cursor-pointer font-medium">
                    Aktifkan promo ini sekarang (dapat langsung digunakan oleh kasir di POS)
                  </label>
                </div>

                {/* Tombol Aksi Form */}
                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="btn-press flex-1 rounded-xl border border-line py-2.5 text-xs font-semibold text-sand hover:text-cream"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="btn-press flex-1 rounded-xl bg-brand py-2.5 text-xs font-bold text-coal hover:brightness-110 shadow-md shadow-brand/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {formSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    <span>{editingDiscount ? "Simpan Perubahan" : "Buat Promo"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          MODAL KONFIRMASI HAPUS PROMO
         ===================================================================== */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-coal/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl border border-line-2 bg-panel-2 p-5 sm:p-6 shadow-2xl space-y-4 text-center"
            >
              <div className="grid size-12 place-items-center rounded-2xl bg-red-500/15 text-red-400 border border-red-500/30 mx-auto">
                <ShieldAlert className="size-6" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-cream">Hapus Master Promo?</h3>
                <p className="text-xs text-sand mt-1">
                  Promo <strong className="text-red-400">"{deleteTarget.name}"</strong> akan dihapus
                  secara permanen dari sistem POS.
                </p>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="btn-press flex-1 rounded-xl border border-line py-2.5 text-xs font-semibold text-sand hover:text-cream"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeletePromo}
                  disabled={deleting}
                  className="btn-press flex-1 rounded-xl bg-red-500 py-2.5 text-xs font-bold text-white hover:bg-red-600 shadow-md shadow-red-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  <span>Hapus</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
