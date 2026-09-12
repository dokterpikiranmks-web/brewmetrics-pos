"use client";

import { useEffect, useState } from "react";
import { useBranch } from "@/context/BranchContext";
import type { OutletDto, CreateOutletPayload, UpdateOutletPayload } from "@/lib/types";
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Phone,
  MapPin,
  Loader2,
  X,
  Store,
} from "lucide-react";

export function BranchManager() {
  const { refreshOutlets } = useBranch();
  const [outlets, setOutlets] = useState<OutletDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<OutletDto | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchOutlets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/outlets");
      if (res.ok) {
        const data = await res.json();
        setOutlets(data.outlets || []);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Gagal memuat data cabang.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutlets();
  }, []);

  const openCreateModal = () => {
    setEditingOutlet(null);
    setFormName("");
    setFormCode("");
    setFormAddress("");
    setFormPhone("");
    setFormIsActive(true);
    setErrorMsg("");
    setModalOpen(true);
  };

  const openEditModal = (outlet: OutletDto) => {
    setEditingOutlet(outlet);
    setFormName(outlet.name);
    setFormCode(outlet.code);
    setFormAddress(outlet.address || "");
    setFormPhone(outlet.phone || "");
    setFormIsActive(outlet.isActive);
    setErrorMsg("");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim()) {
      setErrorMsg("Nama cabang dan kode cabang wajib diisi.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (editingOutlet) {
        const payload: UpdateOutletPayload = {
          id: editingOutlet.id,
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          address: formAddress.trim(),
          phone: formPhone.trim(),
          isActive: formIsActive,
        };
        const res = await fetch("/api/outlets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Gagal memperbarui cabang.");
        }
        setSuccessMsg(`Cabang "${payload.name}" berhasil diperbarui.`);
      } else {
        const payload: CreateOutletPayload = {
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          address: formAddress.trim(),
          phone: formPhone.trim(),
          isActive: formIsActive,
        };
        const res = await fetch("/api/outlets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Gagal menambahkan cabang.");
        }
        setSuccessMsg(`Cabang "${payload.name}" berhasil ditambahkan.`);
      }

      setModalOpen(false);
      await fetchOutlets();
      await refreshOutlets();
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (outlet: OutletDto) => {
    try {
      const res = await fetch("/api/outlets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: outlet.id, isActive: !outlet.isActive }),
      });
      if (res.ok) {
        await fetchOutlets();
        await refreshOutlets();
      }
    } catch (err) {
      console.error("Gagal toggle status outlet:", err);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/outlets?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus cabang.");
      }
      setSuccessMsg("Cabang berhasil dihapus.");
      setDeleteConfirmId(null);
      await fetchOutlets();
      await refreshOutlets();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menghapus cabang.");
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = outlets.filter((o) => o.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-panel border border-line">
        <div className="flex items-center gap-3.5">
          <div className="grid size-12 place-items-center rounded-2xl bg-brand/15 border border-brand/30 text-brand">
            <Building2 className="size-6" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-cream">
              Kelola Cabang / Outlet
            </h2>
            <p className="text-xs text-sand">
              Multi-cabang &amp; Mother Account: Monitor dan delegasikan akses kasir ke masing-masing cabang.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="btn-press flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-coal font-bold text-xs shadow-lg shadow-brand/20 hover:brightness-110 transition-all shrink-0"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          Tambah Cabang
        </button>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg("")}>
            <X className="size-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg("")}>
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-xl bg-panel border border-line">
          <p className="text-[11px] font-semibold text-faint uppercase tracking-wider">Total Cabang</p>
          <p className="font-display text-2xl font-bold text-cream mt-1">{outlets.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-panel border border-line">
          <p className="text-[11px] font-semibold text-faint uppercase tracking-wider">Cabang Aktif</p>
          <p className="font-display text-2xl font-bold text-emerald-400 mt-1">{activeCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-panel border border-line col-span-2 sm:col-span-1">
          <p className="text-[11px] font-semibold text-faint uppercase tracking-wider">Nonaktif</p>
          <p className="font-display text-2xl font-bold text-sand mt-1">
            {outlets.length - activeCount}
          </p>
        </div>
      </div>

      {/* List Cabang */}
      <div className="rounded-2xl border border-line bg-panel overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <p className="font-display text-sm font-bold text-cream">Daftar Cabang Terdaftar</p>
          <span className="text-xs text-sand font-medium">{outlets.length} cabang</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-faint flex flex-col items-center gap-3">
            <Loader2 className="size-6 animate-spin text-brand" />
            <p className="text-xs">Memuat daftar cabang...</p>
          </div>
        ) : outlets.length === 0 ? (
          <div className="p-12 text-center text-faint flex flex-col items-center gap-2">
            <Store className="size-8 text-faint" />
            <p className="text-xs">Belum ada cabang terdaftar.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {outlets.map((outlet) => (
              <div
                key={outlet.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-panel-2/50 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div className="grid size-10 place-items-center rounded-xl bg-coal border border-line text-brand shrink-0 mt-0.5">
                    <Store className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-sm font-bold text-cream">{outlet.name}</h3>
                      <span className="px-2 py-0.5 rounded-md bg-brand/10 border border-brand/20 text-brand text-[10px] font-mono font-bold">
                        {outlet.code}
                      </span>
                      {outlet.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                          <CheckCircle2 className="size-3" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sand/10 text-sand text-[10px] font-semibold">
                          <XCircle className="size-3" />
                          Nonaktif
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 space-y-0.5 text-xs text-sand">
                      {outlet.address && (
                        <p className="flex items-center gap-1.5 text-faint">
                          <MapPin className="size-3.5 text-sand shrink-0" />
                          <span className="truncate max-w-sm">{outlet.address}</span>
                        </p>
                      )}
                      {outlet.phone && (
                        <p className="flex items-center gap-1.5 text-faint">
                          <Phone className="size-3.5 text-sand shrink-0" />
                          <span>{outlet.phone}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(outlet)}
                    className={`btn-press px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                      outlet.isActive
                        ? "border-line bg-coal text-sand hover:text-cream"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    }`}
                  >
                    {outlet.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(outlet)}
                    className="btn-press grid size-8 place-items-center rounded-xl border border-line bg-coal text-sand hover:text-cream hover:border-line-2"
                    title="Edit Cabang"
                  >
                    <Edit2 className="size-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(outlet.id)}
                    className="btn-press grid size-8 place-items-center rounded-xl border border-line bg-coal text-faint hover:text-red-400 hover:border-red-400/30"
                    title="Hapus Cabang"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Cabang */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-coal/80 backdrop-blur-sm animate-in fade-in-0">
          <div className="relative w-full max-w-md rounded-2xl border border-line-2 bg-panel-solid p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-line mb-5">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-xl bg-brand text-coal">
                  <Building2 className="size-4" strokeWidth={2.5} />
                </div>
                <h3 className="font-display text-sm font-bold text-cream">
                  {editingOutlet ? "Edit Data Cabang" : "Tambah Cabang Baru"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn-press grid size-7 place-items-center rounded-lg text-faint hover:text-cream"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-sand mb-1.5">
                  Nama Cabang <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Cabang Pettarani, Cabang Pusat"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-line bg-coal px-3.5 py-2.5 text-xs text-cream focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-sand mb-1.5">
                  Kode Cabang (Unik) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: HQ01, PTR02, BTM03"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-line bg-coal px-3.5 py-2.5 text-xs font-mono font-semibold uppercase text-cream focus:border-brand focus:outline-none"
                />
                <p className="text-[10px] text-faint mt-1">
                  Digunakan sebagai kode referensi order dan identifikasi sistem.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sand mb-1.5">
                  Alamat Lengkap
                </label>
                <textarea
                  rows={2}
                  placeholder="Alamat jalan, nomor, kota..."
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full rounded-xl border border-line bg-coal px-3.5 py-2 text-xs text-cream focus:border-brand focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-sand mb-1.5">
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  type="tel"
                  placeholder="08123456789"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full rounded-xl border border-line bg-coal px-3.5 py-2.5 text-xs text-cream focus:border-brand focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="size-4 rounded accent-brand"
                />
                <label htmlFor="isActiveToggle" className="text-xs font-medium text-sand select-none cursor-pointer">
                  Cabang Aktif &amp; Siap Melayani Transaksi
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-line mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-press px-4 py-2.5 rounded-xl border border-line bg-coal text-xs font-semibold text-sand hover:text-cream"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-press flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-coal text-xs font-bold shadow-lg shadow-brand/20 hover:brightness-110 disabled:opacity-50"
                >
                  {saving && <Loader2 className="size-3.5 animate-spin" />}
                  {editingOutlet ? "Simpan Perubahan" : "Buat Cabang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal Hapus */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-coal/80 backdrop-blur-sm animate-in fade-in-0">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-panel-solid p-6 shadow-2xl">
            <h3 className="font-display text-sm font-bold text-cream">Hapus Cabang?</h3>
            <p className="text-xs text-sand mt-2">
              Cabang hanya dapat dihapus jika belum pernah digunakan dalam pesanan atau penugasan staf.
            </p>
            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="btn-press px-4 py-2 rounded-xl border border-line bg-coal text-xs font-semibold text-sand hover:text-cream"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDelete(deleteConfirmId)}
                className="btn-press flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 text-cream text-xs font-bold hover:bg-red-600 disabled:opacity-50"
              >
                {deleting && <Loader2 className="size-3.5 animate-spin" />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
