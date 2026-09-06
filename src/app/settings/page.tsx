"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, Store, MapPin, Phone, ReceiptText, Percent, Check,
  Loader2, Printer, AlertCircle, Sparkles, RefreshCcw, Image as ImageIcon,
  Users, UserPlus, ShieldCheck, CircleUserRound, Crown, KeyRound, Pencil,
  Search, Lock, Database, HardDriveDownload, UploadCloud, FileSpreadsheet,
  Download, AlertTriangle, CheckCircle2, ShieldAlert, HeartHandshake,
  Trophy, MessageCircle,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import StaffModal from "@/components/settings/StaffModal";
import ExportReportModal from "@/components/analytics/ExportReportModal";
import type { StoreSettingDto, StaffUserDto, SessionUser, Role, CustomerDto } from "@/lib/types";
import { formatIDR, formatDateID, formatTime } from "@/lib/format";
import { ROLE_LABEL, ROLE_ACCENT } from "@/lib/nav";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "warn" } | null>(null);

  // Active Sub-Tab: "store" | "customers" | "staff" | "backup"
  const [activeTab, setActiveTab] = useState<"store" | "customers" | "staff" | "backup">("store");
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

  // Store Settings State
  const [cafeName, setCafeName] = useState("BREWMETRICS Specialty Coffee");
  const [address, setAddress] = useState("Jl. Metro Tanjung Bunga No. 8, Makassar");
  const [phone, setPhone] = useState("0812-4455-6677");
  const [logoUrl, setLogoUrl] = useState("");
  const [taxPercentage, setTaxPercentage] = useState<number>(10);
  const [serviceChargePercentage, setServiceChargePercentage] = useState<number>(0);
  const [receiptFooterMessage, setReceiptFooterMessage] = useState(
    "Terima kasih atas kunjungan Anda!\nFollow IG: @brewmetrics.coffee"
  );
  // Printer Configuration State
  const [printerPaperSize, setPrinterPaperSize] = useState<"58mm" | "80mm">("58mm");
  const [autoPrintReceipt, setAutoPrintReceipt] = useState<boolean>(true);

  // Mini CRM Customers State
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSort, setCustomerSort] = useState<"spend" | "orders" | "recent">("spend");

  // Staff & PIN Management State (Khusus Role 'owner')
  const [staffList, setStaffList] = useState<StaffUserDto[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffQuery, setStaffQuery] = useState("");
  const [staffRoleFilter, setStaffRoleFilter] = useState<"all" | Role>("all");
  const [staffModal, setStaffModal] = useState<{ open: boolean; data?: StaffUserDto | null }>({
    open: false,
    data: null,
  });

  // Backup & Restore State (Khusus Role 'owner')
  const [backingUp, setBackingUp] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<any | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoreAgreement, setRestoreAgreement] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const showToast = (msg: string, kind: "ok" | "warn" = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3800);
  };

  /* ---------------------- LOAD CURRENT SESSION USER ---------------------- */
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user: SessionUser | null }) => {
        if (d.user) {
          setCurrentUser(d.user);
        }
      })
      .catch(() => {});
  }, []);

  /* ------------------------ LOAD STORE SETTINGS ------------------------- */
  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = (await res.json()) as { settings: StoreSettingDto };
        if (data.settings) {
          setCafeName(data.settings.cafeName);
          setAddress(data.settings.address);
          setPhone(data.settings.phone);
          setLogoUrl(data.settings.logoUrl || "");
          setTaxPercentage(data.settings.taxPercentage ?? 10);
          setServiceChargePercentage(data.settings.serviceChargePercentage ?? 0);
          setReceiptFooterMessage(
            data.settings.receiptFooterMessage ||
              "Terima kasih atas kunjungan Anda!\nFollow IG: @brewmetrics.coffee"
          );
          setPrinterPaperSize(data.settings.printerPaperSize ?? "58mm");
          setAutoPrintReceipt(data.settings.autoPrintReceipt ?? true);
        }
      }
    } catch (err) {
      console.error("loadSettings error:", err);
      showToast("Gagal memuat pengaturan dari server.", "warn");
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------- LOAD CUSTOMERS --------------------------- */
  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const params = new URLSearchParams({
        sortBy: customerSort,
        limit: "50",
      });
      if (customerSearch.trim()) {
        params.set("q", customerSearch.trim());
      }
      const res = await fetch(`/api/customers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers ?? []);
      }
    } catch (err) {
      console.error("loadCustomers error:", err);
      showToast("Gagal memuat data pelanggan setia.", "warn");
    } finally {
      setLoadingCustomers(false);
    }
  };

  useEffect(() => {
    if (activeTab === "customers") {
      loadCustomers();
    }
  }, [activeTab, customerSort]);

  /* ---------------------------- LOAD STAFF ----------------------------- */
  const loadStaff = async () => {
    setLoadingStaff(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = (await res.json()) as { users: StaffUserDto[] };
        if (data.users) {
          setStaffList(data.users);
        }
      } else if (res.status === 403) {
        // Bukan owner, jaga keamanan
        setActiveTab("store");
      }
    } catch (err) {
      console.error("loadStaff error:", err);
      showToast("Gagal memuat daftar staf pengguna.", "warn");
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Ambil data staf otomatis ketika owner berpindah ke tab staf
  useEffect(() => {
    if (activeTab === "staff" && currentUser?.role === "owner") {
      loadStaff();
    }
  }, [activeTab, currentUser]);

  /* ----------------------- SAVE STORE SETTINGS -------------------------- */
  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cafeName.trim()) {
      showToast("Nama kafe tidak boleh kosong.", "warn");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cafeName: cafeName.trim(),
          address: address.trim(),
          phone: phone.trim(),
          logoUrl: logoUrl.trim(),
          taxPercentage: Number(taxPercentage) || 0,
          serviceChargePercentage: Number(serviceChargePercentage) || 0,
          receiptFooterMessage: receiptFooterMessage.trim(),
          printerPaperSize,
          autoPrintReceipt,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Gagal menyimpan pengaturan.", "warn");
        return;
      }

      showToast("Pengaturan profil kafe & printer berhasil disimpan!", "ok");
    } catch (err) {
      console.error("save settings error:", err);
      showToast("Terjadi kendala saat menyimpan pengaturan.", "warn");
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------- STAFF CRUD ----------------------------- */
  const handleSaveStaff = async (payload: {
    id?: number;
    name: string;
    role: Role;
    pin?: string;
    active?: boolean;
  }): Promise<{ error?: string } | void> => {
    try {
      const isEdit = Boolean(payload.id);
      const res = await fetch("/api/users", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || "Gagal menyimpan data staf." };
      }

      await loadStaff();
      showToast(
        isEdit
          ? `Data staf "${payload.name}" berhasil diperbarui.`
          : `Staf baru "${payload.name}" berhasil didaftarkan.`,
        "ok"
      );
    } catch (err) {
      console.error("handleSaveStaff error:", err);
      return { error: "Koneksi ke server terputus saat menyimpan staf." };
    }
  };

  const handleToggleStaffActive = async (staff: StaffUserDto) => {
    try {
      const nextActive = !staff.active;
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: staff.id,
          active: nextActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Gagal mengubah status staf.", "warn");
        return;
      }

      await loadStaff();
      showToast(
        nextActive
          ? `Akun "${staff.name}" kini aktif.`
          : `Akun "${staff.name}" telah dinonaktifkan.`,
        "ok"
      );
    } catch (err) {
      console.error("toggle active error:", err);
      showToast("Gagal memperbarui status aktif staf.", "warn");
    }
  };

  /* ------------------- BACKUP & RESTORE HANDLERS ------------------- */
  const handleDownloadBackup = async () => {
    setBackingUp(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Gagal mengunduh file cadangan database.", "warn");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition");
      let filename = `brewmetrics-backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (cd && cd.includes("filename=")) {
        filename = cd.split("filename=")[1].replace(/["']/g, "").trim();
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("File cadangan database (.json) berhasil diunduh.", "ok");
    } catch (err) {
      console.error("backup error:", err);
      showToast("Terjadi gangguan saat mengunduh cadangan.", "warn");
    } finally {
      setBackingUp(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      showToast("Pilih file cadangan berformat JSON (.json).", "warn");
      return;
    }
    setRestoreFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        setRestorePreview(parsed);
      } catch {
        showToast("File rusak atau tidak dapat dibaca sebagai JSON yang valid.", "warn");
        setRestorePreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!restorePreview) {
      showToast("Data file cadangan belum siap atau tidak valid.", "warn");
      return;
    }
    setRestoring(true);
    try {
      const res = await fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restorePreview),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Gagal memulihkan database.", "warn");
        return;
      }

      showToast(
        data.message || "Database berhasil dipulihkan dari file cadangan!",
        "ok"
      );
      setRestoreConfirmOpen(false);
      setRestoreFile(null);
      setRestorePreview(null);
      setRestoreAgreement(false);

      // Muat ulang data terbaru
      await loadSettings();
      if (currentUser?.role === "owner") {
        await loadStaff();
      }
    } catch (err) {
      console.error("restore error:", err);
      showToast("Terjadi kegagalan jaringan saat memulihkan database.", "warn");
    } finally {
      setRestoring(false);
    }
  };

  /* ------------------- SAMPLE PREVIEW CALCULATION ------------------- */
  const sampleSubtotal = 54000;
  const sampleService = Math.round((sampleSubtotal * (Number(serviceChargePercentage) || 0)) / 100);
  const sampleTax = Math.round(((sampleSubtotal + sampleService) * (Number(taxPercentage) || 0)) / 100);
  const sampleTotal = sampleSubtotal + sampleService + sampleTax;

  /* ------------------- FILTERED STAFF COMPUTATION ------------------- */
  const filteredStaff = useMemo(() => {
    let list = staffList;
    if (staffRoleFilter !== "all") {
      list = list.filter((s) => s.role === staffRoleFilter);
    }
    if (staffQuery.trim()) {
      const q = staffQuery.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }
    return list;
  }, [staffList, staffRoleFilter, staffQuery]);

  // Statistik Ringkas Staf
  const staffStats = useMemo(() => {
    return {
      total: staffList.length,
      cashiers: staffList.filter((s) => s.role === "cashier").length,
      managers: staffList.filter((s) => s.role === "manager").length,
      owners: staffList.filter((s) => s.role === "owner").length,
      active: staffList.filter((s) => s.active).length,
    };
  }, [staffList]);

  return (
    <AppShell allowedRoles={["owner", "manager"]}>
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-5 max-w-[1500px] w-full mx-auto">
        {/* ===================================================================
            HEADER: OWNER & MANAGER SETTINGS
           =================================================================== */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-faint font-bold mb-1 flex items-center gap-2">
              Outlet Configuration &amp; Access Control
              <span className="inline-flex items-center gap-1.5 text-brand normal-case tracking-normal">
                {activeTab === "store" ? (
                  <>
                    <Store className="size-3.5" /> Profil Kafe &amp; Printer
                  </>
                ) : activeTab === "customers" ? (
                  <>
                    <HeartHandshake className="size-3.5" /> Pelanggan Setia (CRM)
                  </>
                ) : activeTab === "staff" ? (
                  <>
                    <Users className="size-3.5" /> Kelola Staf &amp; PIN
                  </>
                ) : (
                  <>
                    <Database className="size-3.5" /> Backup &amp; Restore Database
                  </>
                )}
              </span>
            </p>
            <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">
              {activeTab === "store"
                ? "Pengaturan Profil & Printer Kafe"
                : activeTab === "customers"
                ? "Pelanggan Setia (Mini CRM)"
                : activeTab === "staff"
                ? "Manajemen Staf & Hak Akses"
                : "Backup & Restore Database"}
            </h1>
            <p className="text-xs sm:text-sm text-sand mt-1">
              {activeTab === "store"
                ? "Atur identitas kafe, persentase Pajak PB1, Service Charge, ukuran kertas thermal (58mm/80mm), dan opsi cetak otomatis."
                : activeTab === "customers"
                ? "Daftar pelanggan setia, frekuensi kunjungan, akumulasi total belanja, dan database kontak WhatsApp pelanggan."
                : activeTab === "staff"
                ? "Daftarkan akun staf baru, kelola peran (Role), dan atur 4 digit PIN login POS secara terpusat."
                : "Ekspor seluruh database ke file JSON untuk pencadangan aman, atau pulihkan data dari file backup."}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {activeTab === "store" ? (
              <>
                <button
                  type="button"
                  onClick={loadSettings}
                  className="btn-press grid size-9 sm:size-10 place-items-center rounded-xl border border-line bg-panel text-sand hover:text-cream shrink-0"
                  title="Muat ulang pengaturan"
                >
                  <RefreshCcw className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-press flex items-center gap-2 rounded-xl border border-line-2 bg-panel px-3.5 py-2.5 text-xs font-semibold text-sand hover:text-cream hover:border-brand/40"
                  title="Cetak struk pratinjau"
                >
                  <Printer className="size-4 text-brand" />
                  <span>Test Cetak Thermal</span>
                </button>
              </>
            ) : activeTab === "customers" ? (
              <>
                <button
                  type="button"
                  onClick={loadCustomers}
                  className="btn-press grid size-9 sm:size-10 place-items-center rounded-xl border border-line bg-panel text-sand hover:text-cream shrink-0"
                  title="Segarkan data pelanggan"
                >
                  <RefreshCcw className="size-4" />
                </button>
              </>
            ) : activeTab === "staff" ? (
              <>
                <button
                  type="button"
                  onClick={loadStaff}
                  className="btn-press grid size-9 sm:size-10 place-items-center rounded-xl border border-line bg-panel text-sand hover:text-cream shrink-0"
                  title="Segarkan daftar staf"
                >
                  <RefreshCcw className="size-4" />
                </button>
                {currentUser?.role === "owner" && (
                  <button
                    type="button"
                    onClick={() => setStaffModal({ open: true, data: null })}
                    className="btn-press flex items-center gap-2 rounded-2xl bg-brand px-4 py-2.5 text-xs font-bold text-coal hover:bg-brand-light shadow-lg shadow-brand/20"
                  >
                    <UserPlus className="size-4" strokeWidth={2.5} />
                    <span>Tambah Staf Baru</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setExportModalOpen(true)}
                  className="btn-press flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
                  title="Ekspor Laporan Penjualan Excel"
                >
                  <FileSpreadsheet className="size-4" />
                  <span>Ekspor Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={backingUp}
                  className="btn-press flex items-center gap-2 rounded-2xl bg-brand px-4 py-2.5 text-xs font-bold text-coal hover:bg-brand-light shadow-lg shadow-brand/20 disabled:opacity-50"
                  title="Unduh file backup database"
                >
                  {backingUp ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" strokeWidth={2.5} />
                  )}
                  <span>Unduh Backup (.json)</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* ===================================================================
            SUB-NAVIGATION TABS (PROFIL & PRINTER vs CRM PELANGGAN vs KELOLA STAF & PIN vs BACKUP & RESTORE)
           =================================================================== */}
        <div className="flex items-center gap-2 border-b border-line pb-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("store")}
            className={`btn-press px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "store"
                ? "bg-brand text-coal shadow-md shadow-brand/20"
                : "text-sand hover:text-cream hover:bg-panel"
            }`}
          >
            <Store className="size-4" />
            <span>Profil &amp; Printer Kafe</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("customers");
              if (customers.length === 0) loadCustomers();
            }}
            className={`btn-press px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "customers"
                ? "bg-brand text-coal shadow-md shadow-brand/20"
                : "text-sand hover:text-cream hover:bg-panel"
            }`}
          >
            <HeartHandshake className="size-4" />
            <span>Pelanggan Setia (CRM)</span>
            {customers.length > 0 && (
              <span className="grid place-items-center rounded-full bg-coal/40 px-2 py-0.5 text-[10px] font-bold">
                {customers.length}
              </span>
            )}
          </button>

          {currentUser?.role === "owner" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("staff");
                  if (staffList.length === 0) loadStaff();
                }}
                className={`btn-press px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                  activeTab === "staff"
                    ? "bg-brand text-coal shadow-md shadow-brand/20"
                    : "text-sand hover:text-cream hover:bg-panel"
                }`}
              >
                <Users className="size-4" />
                <span>Kelola Staf &amp; PIN</span>
                <span className="grid place-items-center rounded-full bg-coal/40 px-2 py-0.5 text-[10px] font-bold">
                  {staffList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("backup")}
                className={`btn-press px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                  activeTab === "backup"
                    ? "bg-brand text-coal shadow-md shadow-brand/20"
                    : "text-sand hover:text-cream hover:bg-panel"
                }`}
              >
                <Database className="size-4" />
                <span>Backup &amp; Restore</span>
              </button>
            </>
          )}
        </div>

        {/* ===================================================================
            TAB 1: PROFIL KAFE & STRUK (SEMUA OWNER & MANAJER)
           =================================================================== */}
        {activeTab === "store" && (
          loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 h-96 rounded-3xl border border-line bg-panel animate-pulse-soft" />
              <div className="h-96 rounded-3xl border border-line bg-panel animate-pulse-soft" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* KOLOM KIRI: FORM PENGATURAN (7 KOLOM) */}
              <form onSubmit={handleSaveStore} className="lg:col-span-7 space-y-5">
                {/* CARD 1: IDENTITAS OUTLET */}
                <div className="rounded-3xl border border-line bg-panel p-5 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-line text-cream font-display font-bold text-sm">
                    <Store className="size-4.5 text-brand" />
                    <span>Identitas &amp; Alamat Outlet</span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-1.5">
                        Nama Kafe / Restoran
                      </label>
                      <input
                        type="text"
                        value={cafeName}
                        onChange={(e) => setCafeName(e.target.value)}
                        placeholder="cth: BREWMETRICS Specialty Coffee"
                        className="input-dark text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-1.5 flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-sand" />
                        <span>Alamat Outlet (Muncul di Header Struk)</span>
                      </label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="cth: Jl. Metro Tanjung Bunga No. 8, Makassar"
                        className="input-dark text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-1.5 flex items-center gap-1.5">
                          <Phone className="size-3.5 text-sand" />
                          <span>No. Telepon / WhatsApp</span>
                        </label>
                        <input
                          type="text"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="cth: 0812-4455-6677"
                          className="input-dark text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-1.5 flex items-center gap-1.5">
                          <ImageIcon className="size-3.5 text-sand" />
                          <span>URL Logo (Opsional)</span>
                        </label>
                        <input
                          type="text"
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          placeholder="https://domain.com/logo.png"
                          className="input-dark text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 2: PAJAK & BIAYA LAYANAN */}
                <div className="rounded-3xl border border-line bg-panel p-5 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-line text-cream font-display font-bold text-sm">
                    <Percent className="size-4.5 text-brand" />
                    <span>Pajak Penjualan (PB1) &amp; Service Charge</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Pajak PB1 */}
                    <div className="rounded-2xl border border-line-2 bg-coal p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-cream">Pajak Restoran (PB1)</label>
                        <span className="text-[10px] uppercase tracking-wider text-brand font-bold bg-brand/10 border border-brand/30 px-2 py-0.5 rounded-full">
                          Otomatis di Kasir
                        </span>
                      </div>
                      <p className="text-[11px] text-faint leading-relaxed">
                        Pajak daerah restoran (biasanya 10%). Masukkan 0 jika harga menu sudah nett (termasuk pajak).
                      </p>
                      <div className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 mt-2 focus-within:border-brand/50">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={taxPercentage}
                          onChange={(e) => setTaxPercentage(Number(e.target.value))}
                          className="w-full bg-transparent font-display text-lg font-bold tabular outline-none text-cream"
                        />
                        <span className="font-display font-bold text-sand">%</span>
                      </div>
                    </div>

                    {/* Service Charge */}
                    <div className="rounded-2xl border border-line-2 bg-coal p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-cream">Service Charge</label>
                        <span className="text-[10px] uppercase tracking-wider text-sand font-bold bg-panel border border-line px-2 py-0.5 rounded-full">
                          Biaya Layanan
                        </span>
                      </div>
                      <p className="text-[11px] text-faint leading-relaxed">
                        Biaya layanan untuk dine-in / operasional (contoh: 5%). Masukkan 0 jika tidak ada service fee.
                      </p>
                      <div className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 mt-2 focus-within:border-brand/50">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={serviceChargePercentage}
                          onChange={(e) => setServiceChargePercentage(Number(e.target.value))}
                          className="w-full bg-transparent font-display text-lg font-bold tabular outline-none text-cream"
                        />
                        <span className="font-display font-bold text-sand">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 flex items-start gap-2.5 text-xs text-amber-200/90 leading-relaxed">
                    <AlertCircle className="size-4 text-brand shrink-0 mt-0.5" />
                    <p>
                      Nilai persentase di atas akan langsung mengalkulasi <strong>Subtotal keranjang</strong> di
                      POS kasir dan menghasilkan <strong>Grand Total</strong> tagihan secara otomatis.
                    </p>
                  </div>
                </div>

                {/* CARD 3: FORMAT FOOTER STRUK */}
                <div className="rounded-3xl border border-line bg-panel p-5 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-line text-cream font-display font-bold text-sm">
                    <ReceiptText className="size-4.5 text-brand" />
                    <span>Pesan Penutup Struk (Receipt Footer)</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-1.5">
                      Pesan Penutup / Promo / Akun Media Sosial
                    </label>
                    <textarea
                      rows={3}
                      value={receiptFooterMessage}
                      onChange={(e) => setReceiptFooterMessage(e.target.value)}
                      placeholder="cth: Terima kasih atas kunjungan Anda!\nFollow Instagram kami: @brewmetrics.coffee"
                      className="input-dark text-xs sm:text-sm resize-none font-mono"
                    />
                    <p className="text-[11px] text-faint mt-1">
                      Pesan ini akan dicetak di bagian paling bawah setiap struk thermal pelanggan.
                    </p>
                  </div>
                </div>

                {/* CARD 4: KONFIGURASI PRINTER KASIR */}
                <div className="rounded-3xl border border-line bg-panel p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-line">
                    <div className="flex items-center gap-2.5 text-cream font-display font-bold text-sm">
                      <Printer className="size-4.5 text-brand" />
                      <span>Konfigurasi Printer Kasir (Thermal Receipt)</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/30">
                      Hardware POS
                    </span>
                  </div>

                  <div className="space-y-4">
                    {/* Pilihan Ukuran Kertas */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-faint mb-2">
                        Lebar Kertas Thermal (Printer Paper Size)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Card 58mm */}
                        <button
                          type="button"
                          onClick={() => setPrinterPaperSize("58mm")}
                          className={`btn-press p-4 rounded-2xl border text-left transition-all ${
                            printerPaperSize === "58mm"
                              ? "border-brand bg-brand/10 shadow-md shadow-brand/10 ring-1 ring-brand"
                              : "border-line bg-coal hover:border-line-2 text-sand"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-display text-sm font-bold text-cream">
                              58mm (Lebar Mini)
                            </span>
                            {printerPaperSize === "58mm" && (
                              <span className="grid size-5 place-items-center rounded-full bg-brand text-coal">
                                <Check className="size-3 stroke-[3]" />
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-faint leading-relaxed">
                            Lebar area cetak <strong>48mm (~200px)</strong>. Cocok untuk printer portable Bluetooth, USB mini kasir, atau laci kasir sempit.
                          </p>
                        </button>

                        {/* Card 80mm */}
                        <button
                          type="button"
                          onClick={() => setPrinterPaperSize("80mm")}
                          className={`btn-press p-4 rounded-2xl border text-left transition-all ${
                            printerPaperSize === "80mm"
                              ? "border-brand bg-brand/10 shadow-md shadow-brand/10 ring-1 ring-brand"
                              : "border-line bg-coal hover:border-line-2 text-sand"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-display text-sm font-bold text-cream">
                              80mm (Lebar Standar)
                            </span>
                            {printerPaperSize === "80mm" && (
                              <span className="grid size-5 place-items-center rounded-full bg-brand text-coal">
                                <Check className="size-3 stroke-[3]" />
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-faint leading-relaxed">
                            Lebar area cetak <strong>72mm (~300px)</strong>. Format standar restoran &amp; kafe modern dengan kolom struk lebih lega dan terbaca jelas.
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Toggle Cetak Otomatis */}
                    <div className="rounded-2xl border border-line-2 bg-coal p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-cream flex items-center gap-2">
                          <span>Cetak Otomatis Setelah Bayar (Auto-Print)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setAutoPrintReceipt(!autoPrintReceipt)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            autoPrintReceipt ? "bg-brand" : "bg-line-2"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block size-4 transform rounded-full bg-coal shadow ring-0 transition duration-200 ease-in-out ${
                              autoPrintReceipt ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                      <p className="text-[11px] text-faint leading-relaxed">
                        Bila aktif, dialog cetak struk (<code>window.print()</code>) otomatis langsung dipanggil sesaat setelah kasir menyelesaikan transaksi pembayaran di POS.
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-sand">Ingin mencoba layout hasil cetak?</span>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-line-2 bg-coal px-3 py-2 text-xs font-semibold text-sand hover:text-cream hover:border-brand/40"
                      >
                        <Printer className="size-3.5 text-brand" />
                        <span>Cetak Struk Sampel ({printerPaperSize})</span>
                      </button>
                    </div>
                  </div>

                  {/* Tombol Simpan */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-display text-sm font-bold text-coal shadow-[0_12px_32px_-8px] shadow-brand/70 hover:brightness-110 disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          <span>Menyimpan Pengaturan ke Database…</span>
                        </>
                      ) : (
                        <>
                          <Check className="size-4.5" />
                          <span>Simpan Pengaturan Kafe &amp; Printer</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* KOLOM KANAN: LIVE THERMAL RECEIPT PREVIEW (5 KOLOM) */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-brand uppercase tracking-wider">
                    <Sparkles className="size-4" />
                    <span>Pratinjau Struk Thermal Dinamis</span>
                  </div>
                  <span className="text-[11px] text-faint font-mono">
                    Format {printerPaperSize} ({printerPaperSize === "58mm" ? "48mm / 200px" : "72mm / 300px"})
                  </span>
                </div>

                {/* Kertas Struk Simulasi */}
                <div className="rounded-3xl border border-line-2 bg-coal p-4 sm:p-5 shadow-2xl overflow-hidden">
                  <div
                    className={`bg-white text-black font-mono leading-tight p-4 rounded-xl shadow-inner mx-auto transition-all ${
                      printerPaperSize === "58mm"
                        ? "max-w-[210px] text-[9px]"
                        : "max-w-sm text-[11px]"
                    }`}
                    style={{
                      fontFamily: "'Courier New', Courier, monospace",
                      color: "#000000",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    {/* Header Struk */}
                    <div className="text-center pb-2">
                      <h2 className="text-[14px] font-black uppercase tracking-wider">
                        {cafeName || "NAMA KAFE"}
                      </h2>
                      <p className="text-[9.5px] mt-1 text-gray-800 leading-tight">
                        {address || "Alamat Outlet"}
                      </p>
                      <p className="text-[9px] text-gray-700 mt-0.5">
                        Telp: {phone || "—"}
                      </p>
                    </div>

                    <div className="border-b border-dashed border-black my-1" />

                    {/* Info Transaksi Contoh */}
                    <div className="text-[9px] space-y-0.5 py-1">
                      <div className="flex justify-between">
                        <span>No. Struk:</span>
                        <span className="font-bold">#BM-SAMPLE-01</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Waktu:</span>
                        <span>
                          {new Date().toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}{" "}
                          {new Date().toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Kasir:</span>
                        <span>Sinta (Kasir)</span>
                      </div>
                    </div>

                    <div className="border-b border-dashed border-black my-1" />

                    {/* Sample Items */}
                    <div className="py-1 space-y-1.5 text-[10px]">
                      <div>
                        <div className="flex justify-between font-bold">
                          <span>1x Caffe Latte (Dingin)</span>
                          <span>Rp 29.000</span>
                        </div>
                        <p className="text-[8.5px] text-gray-600 pl-2">+ Susu Full Cream, Gula Aren</p>
                      </div>
                      <div>
                        <div className="flex justify-between font-bold">
                          <span>1x Butter Croissant</span>
                          <span>Rp 25.000</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-b border-dashed border-black my-1" />

                    {/* Rincian Tagihan Dinamis (Subtotal, Service, Pajak, Grand Total) */}
                    <div className="space-y-1 py-1 text-[10px]">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{formatIDR(sampleSubtotal)}</span>
                      </div>

                      {serviceChargePercentage > 0 && (
                        <div className="flex justify-between text-gray-800">
                          <span>Service Charge ({serviceChargePercentage}%):</span>
                          <span>{formatIDR(sampleService)}</span>
                        </div>
                      )}

                      {taxPercentage > 0 && (
                        <div className="flex justify-between text-gray-800">
                          <span>Pajak PB1 ({taxPercentage}%):</span>
                          <span>{formatIDR(sampleTax)}</span>
                        </div>
                      )}

                      <div className="flex justify-between font-black text-[12px] pt-1 border-t border-dotted border-black">
                        <span>TOTAL:</span>
                        <span>{formatIDR(sampleTotal)}</span>
                      </div>

                      <div className="flex justify-between pt-0.5 text-[9.5px]">
                        <span>Metode Bayar:</span>
                        <span className="font-bold uppercase">QRIS / TUNAI</span>
                      </div>
                    </div>

                    <div className="border-b border-dashed border-black my-1" />

                    {/* Footer Dinamis */}
                    <div className="text-center pt-2 pb-1 space-y-1 text-[9px] text-gray-800">
                      <p className="font-bold uppercase tracking-wider">
                        *** LUNAS / TERIMA KASIH ***
                      </p>
                      <p className="whitespace-pre-line text-[9px]">
                        {receiptFooterMessage || "Terima kasih atas kunjungan Anda!"}
                      </p>
                      <p className="text-[8px] pt-1 text-gray-500">
                        Powered by BrewMetrics POS System
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {/* ===================================================================
            TAB: PELANGGAN SETIA (MINI CRM)
           =================================================================== */}
        {activeTab === "customers" && (
          <div className="space-y-5">
            {/* KPI Overview Pelanggan CRM */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="rounded-3xl border border-line bg-panel p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-faint">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Total Pelanggan</span>
                  <HeartHandshake className="size-4 text-brand" />
                </div>
                <div className="mt-3">
                  <p className="font-display text-2xl sm:text-3xl font-bold text-cream tabular">
                    {customers.length}
                  </p>
                  <p className="text-[11px] text-emerald-400 mt-0.5">Basis data CRM aktif</p>
                </div>
              </div>

              <div className="rounded-3xl border border-line bg-panel p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-faint">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Akumulasi Belanja</span>
                  <Trophy className="size-4 text-amber-400" />
                </div>
                <div className="mt-3">
                  <p className="font-display text-xl sm:text-2xl font-bold text-amber-400 tabular truncate">
                    {formatIDR(customers.reduce((sum, c) => sum + (c.totalSpend || 0), 0))}
                  </p>
                  <p className="text-[11px] text-faint mt-0.5">Kontribusi omzet CRM</p>
                </div>
              </div>

              <div className="rounded-3xl border border-line bg-panel p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-faint">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Total Kunjungan</span>
                  <Store className="size-4 text-sky-400" />
                </div>
                <div className="mt-3">
                  <p className="font-display text-2xl sm:text-3xl font-bold text-sky-300 tabular">
                    {customers.reduce((sum, c) => sum + (c.totalOrders || 0), 0)}
                  </p>
                  <p className="text-[11px] text-faint mt-0.5">Transaksi tercatat</p>
                </div>
              </div>

              <div className="rounded-3xl border border-line bg-panel p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-faint">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Rata-rata Belanja</span>
                  <Percent className="size-4 text-brand-2" />
                </div>
                <div className="mt-3">
                  <p className="font-display text-xl sm:text-2xl font-bold text-cream tabular truncate">
                    {formatIDR(
                      customers.length > 0
                        ? Math.round(
                            customers.reduce((sum, c) => sum + (c.totalSpend || 0), 0) / customers.length
                          )
                        : 0
                    )}
                  </p>
                  <p className="text-[11px] text-sand mt-0.5">Nilai per pelanggan</p>
                </div>
              </div>
            </div>

            {/* Filter, Search & Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="size-4 text-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadCustomers();
                  }}
                  placeholder="Cari nama atau nomor HP pelanggan..."
                  className="input-dark text-xs pl-10 w-full"
                />
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {(
                  [
                    { key: "spend", label: "Top Belanja (Spend)" },
                    { key: "orders", label: "Paling Loyal (Orders)" },
                    { key: "recent", label: "Kunjungan Terbaru" },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setCustomerSort(s.key)}
                    className={`btn-press px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      customerSort === s.key
                        ? "bg-brand text-coal font-bold shadow-sm shadow-brand/30"
                        : "bg-panel text-faint hover:text-cream border border-line"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer List Table */}
            {loadingCustomers ? (
              <div className="py-20 text-center text-faint flex flex-col items-center justify-center gap-3">
                <Loader2 className="size-8 animate-spin text-brand" />
                <p className="text-xs">Memuat database pelanggan setia...</p>
              </div>
            ) : customers.length === 0 ? (
              <div className="rounded-3xl border border-line bg-panel p-12 text-center space-y-3">
                <HeartHandshake className="size-12 text-faint mx-auto opacity-60" />
                <p className="font-display font-bold text-cream text-base">Belum ada data pelanggan tersimpan</p>
                <p className="text-xs text-faint max-w-md mx-auto leading-relaxed">
                  Data pelanggan akan otomatis terdaftar dan terakumulasi saat kasir memasukkan nomor HP pelanggan pada panel kasir POS saat transaksi berlangsung.
                </p>
              </div>
            ) : (
              <div className="rounded-3xl border border-line bg-panel overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-line bg-coal/50 text-[10px] font-bold uppercase tracking-wider text-faint">
                        <th className="py-3 px-4 sm:px-6 w-16 text-center">Rank</th>
                        <th className="py-3 px-4">Nama Pelanggan</th>
                        <th className="py-3 px-4">No. HP / WhatsApp</th>
                        <th className="py-3 px-4 text-center">Frekuensi</th>
                        <th className="py-3 px-4 text-right">Total Belanja</th>
                        <th className="py-3 px-4 text-right hidden sm:table-cell">Rata-rata/Order</th>
                        <th className="py-3 px-4 sm:px-6 text-right">Kunjungan Terakhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {customers.map((cust, idx) => {
                        const cleanPhone = cust.phone.replace(/[^0-9]/g, "");
                        const waNumber = cleanPhone.startsWith("0")
                          ? "62" + cleanPhone.slice(1)
                          : cleanPhone.startsWith("62")
                          ? cleanPhone
                          : "62" + cleanPhone;
                        const avg = cust.totalOrders > 0 ? Math.round(cust.totalSpend / cust.totalOrders) : 0;

                        return (
                          <tr key={cust.id} className="hover:bg-panel-2 transition-colors">
                            {/* Rank */}
                            <td className="py-3.5 px-4 text-center">
                              {idx === 0 ? (
                                <span className="inline-grid place-items-center size-6 rounded-full bg-amber-400/20 text-amber-400 font-bold border border-amber-400/40 text-[11px]">
                                  🥇
                                </span>
                              ) : idx === 1 ? (
                                <span className="inline-grid place-items-center size-6 rounded-full bg-slate-300/20 text-slate-300 font-bold border border-slate-300/40 text-[11px]">
                                  🥈
                                </span>
                              ) : idx === 2 ? (
                                <span className="inline-grid place-items-center size-6 rounded-full bg-amber-700/20 text-amber-600 font-bold border border-amber-700/40 text-[11px]">
                                  🥉
                                </span>
                              ) : (
                                <span className="font-mono text-faint text-[11px]">#{idx + 1}</span>
                              )}
                            </td>

                            {/* Nama & Avatar */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="grid size-9 place-items-center rounded-2xl border border-line-2 bg-coal font-display font-bold text-sand shrink-0">
                                  {cust.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-display font-bold text-cream text-sm block">
                                    {cust.name}
                                  </span>
                                  <span className="text-[10px] text-faint">ID Pelanggan #{cust.id}</span>
                                </div>
                              </div>
                            </td>

                            {/* No Telepon & WA action */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sand text-[12px]">{cust.phone}</span>
                                {cleanPhone && (
                                  <a
                                    href={`https://wa.me/${waNumber}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn-press inline-grid place-items-center size-6 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
                                    title="Hubungi via WhatsApp"
                                  >
                                    <MessageCircle className="size-3" />
                                  </a>
                                )}
                              </div>
                            </td>

                            {/* Frekuensi Transaksi */}
                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-brand/10 text-brand border border-brand/20">
                                {cust.totalOrders}x pesanan
                              </span>
                            </td>

                            {/* Total Belanja */}
                            <td className="py-3.5 px-4 text-right">
                              <span className="font-display font-bold text-cream text-sm tabular">
                                {formatIDR(cust.totalSpend)}
                              </span>
                            </td>

                            {/* Average per Order */}
                            <td className="py-3.5 px-4 text-right hidden sm:table-cell text-sand font-mono tabular text-[11px]">
                              {formatIDR(avg)}
                            </td>

                            {/* Kunjungan Terakhir */}
                            <td className="py-3.5 px-4 sm:px-6 text-right text-faint text-[11px]">
                              {cust.lastVisitAt ? (
                                <>
                                  <span className="text-sand font-medium block">
                                    {formatDateID(new Date(cust.lastVisitAt))}
                                  </span>
                                  <span className="text-[10px]">{formatTime(cust.lastVisitAt)}</span>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 2: KELOLA STAF & PIN (KHUSUS ROLE 'OWNER')
           =================================================================== */}
        {activeTab === "staff" && currentUser?.role === "owner" && (
          <div className="space-y-5">
            {/* KPI Overview Staf */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="rounded-3xl border border-line bg-panel p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-faint">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Total Staf</span>
                  <Users className="size-4 text-brand" />
                </div>
                <div className="mt-3">
                  <p className="font-display text-2xl sm:text-3xl font-bold text-cream tabular">
                    {staffStats.total}
                  </p>
                  <p className="text-[11px] text-emerald-400 mt-0.5">
                    {staffStats.active} staf aktif
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-line bg-panel p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-faint">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Tim Kasir</span>
                  <CircleUserRound className="size-4 text-brand-2" />
                </div>
                <div className="mt-3">
                  <p className="font-display text-2xl sm:text-3xl font-bold text-brand-2 tabular">
                    {staffStats.cashiers}
                  </p>
                  <p className="text-[11px] text-faint mt-0.5">Akses terminal POS</p>
                </div>
              </div>

              <div className="rounded-3xl border border-line bg-panel p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-faint">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Manajer</span>
                  <ShieldCheck className="size-4 text-sky-300" />
                </div>
                <div className="mt-3">
                  <p className="font-display text-2xl sm:text-3xl font-bold text-sky-300 tabular">
                    {staffStats.managers}
                  </p>
                  <p className="text-[11px] text-faint mt-0.5">Stok, BOM &amp; Menu</p>
                </div>
              </div>

              <div className="rounded-3xl border border-line bg-panel p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-faint">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Owner</span>
                  <Crown className="size-4 text-brand" />
                </div>
                <div className="mt-3">
                  <p className="font-display text-2xl sm:text-3xl font-bold text-brand tabular">
                    {staffStats.owners}
                  </p>
                  <p className="text-[11px] text-faint mt-0.5">Akses penuh sistem</p>
                </div>
              </div>
            </div>

            {/* Filter, Search & Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="size-4 text-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={staffQuery}
                  onChange={(e) => setStaffQuery(e.target.value)}
                  placeholder="Cari nama staf pengguna..."
                  className="input-dark text-xs pl-10 w-full"
                />
              </div>

              {/* Role Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {(["all", "cashier", "manager", "owner"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setStaffRoleFilter(r)}
                    className={`btn-press px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      staffRoleFilter === r
                        ? "bg-brand text-coal font-bold shadow-sm shadow-brand/30"
                        : "bg-panel text-faint hover:text-cream border border-line"
                    }`}
                  >
                    {r === "all" ? "Semua Staf" : ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>

            {/* Staff List Table & Cards */}
            {loadingStaff ? (
              <div className="py-20 text-center text-faint flex flex-col items-center justify-center gap-3">
                <Loader2 className="size-8 animate-spin text-brand" />
                <p className="text-xs">Memuat daftar staf dan kredensial PIN...</p>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="rounded-3xl border border-line bg-panel p-12 text-center">
                <Users className="size-10 text-faint mx-auto mb-3" />
                <p className="font-display font-bold text-cream">Tidak ada staf yang cocok</p>
                <p className="text-xs text-faint mt-1">Coba kata kunci pencarian lain atau pilih filter Semua Staf.</p>
              </div>
            ) : (
              <div className="rounded-3xl border border-line bg-panel overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-line bg-coal/50 text-[10px] font-bold uppercase tracking-wider text-faint">
                        <th className="py-3 px-4 sm:px-6">Nama Staf</th>
                        <th className="py-3 px-4">Hak Akses (Role)</th>
                        <th className="py-3 px-4">Status PIN POS</th>
                        <th className="py-3 px-4">Status Akun</th>
                        <th className="py-3 px-4 hidden md:table-cell">Terdaftar</th>
                        <th className="py-3 px-4 sm:px-6 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filteredStaff.map((staff) => {
                        const isMe = staff.id === currentUser?.id;
                        return (
                          <tr key={staff.id} className="hover:bg-panel-2 transition-colors">
                            {/* Nama & Avatar */}
                            <td className="py-3.5 px-4 sm:px-6">
                              <div className="flex items-center gap-3">
                                <div className="grid size-9 place-items-center rounded-2xl border border-line-2 bg-coal font-display font-bold text-sand shrink-0">
                                  {staff.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-display font-bold text-cream text-sm">
                                      {staff.name}
                                    </span>
                                    {isMe && (
                                      <span className="rounded-md bg-brand/20 px-1.5 py-0.5 text-[9px] font-bold text-brand border border-brand/40">
                                        Anda
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-faint">ID Staf #{staff.id}</span>
                                </div>
                              </div>
                            </td>

                            {/* Role Badge */}
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${ROLE_ACCENT[staff.role]}`}
                              >
                                {staff.role === "owner" && <Crown className="size-3" />}
                                {staff.role === "manager" && <ShieldCheck className="size-3" />}
                                {staff.role === "cashier" && <CircleUserRound className="size-3" />}
                                <span>{ROLE_LABEL[staff.role]}</span>
                              </span>
                            </td>

                            {/* PIN Status */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2 text-faint">
                                <Lock className="size-3.5 text-brand" />
                                <span className="font-mono text-sm tracking-widest text-sand">●●●●</span>
                                <span className="text-[10px] text-emerald-400 font-semibold">(Tersimpan)</span>
                              </div>
                            </td>

                            {/* Status Akun Toggle */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleStaffActive(staff)}
                                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    staff.active ? "bg-emerald-500" : "bg-line-2"
                                  }`}
                                  title={staff.active ? "Klik untuk nonaktifkan akun" : "Klik untuk aktifkan akun"}
                                >
                                  <span
                                    className={`pointer-events-none inline-block size-4 transform rounded-full bg-cream shadow ring-0 transition duration-200 ease-in-out ${
                                      staff.active ? "translate-x-4" : "translate-x-0"
                                    }`}
                                  />
                                </button>
                                <span
                                  className={`text-[11px] font-semibold ${
                                    staff.active ? "text-emerald-400" : "text-faint"
                                  }`}
                                >
                                  {staff.active ? "Aktif" : "Nonaktif"}
                                </span>
                              </div>
                            </td>

                            {/* Created Date */}
                            <td className="py-3.5 px-4 text-faint text-[11px] hidden md:table-cell">
                              {formatDateID(new Date(staff.createdAt))}
                            </td>

                            {/* Action Button */}
                            <td className="py-3.5 px-4 sm:px-6 text-right">
                              <button
                                type="button"
                                onClick={() => setStaffModal({ open: true, data: staff })}
                                className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-line bg-coal px-3 py-1.5 text-xs font-semibold text-sand hover:text-cream hover:border-brand/40"
                              >
                                <Pencil className="size-3.5 text-brand" />
                                <span>Edit &amp; PIN</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 3: BACKUP & RESTORE DATABASE (KHUSUS ROLE OWNER)
           =================================================================== */}
        {activeTab === "backup" && currentUser?.role === "owner" && (
          <div className="space-y-6">
            {/* Grid 2 Kartu Utama: Cadangkan vs Pulihkan */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* CARD 1: UNDUH CADANGAN (5 KOLOM) */}
              <div className="lg:col-span-5 rounded-3xl border border-line bg-panel p-6 sm:p-7 shadow-ticket flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="grid size-12 place-items-center rounded-2xl bg-brand/15 border border-brand/30 text-brand">
                      <HardDriveDownload className="size-6" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-300">
                      <CheckCircle2 className="size-3.5" /> Siap Dicadangkan
                    </span>
                  </div>

                  <div>
                    <h2 className="font-display text-lg font-bold text-cream">
                      Cadangkan Database Lengkap
                    </h2>
                    <p className="text-xs text-sand mt-1 leading-relaxed">
                      Ekspor seluruh data operasional ke perangkat lokal Anda dalam satu file terformat JSON terstruktur.
                    </p>
                  </div>

                  {/* Rincian Cakupan Tabel */}
                  <div className="rounded-2xl border border-line bg-coal/60 p-4 space-y-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-faint">
                      Cakupan Data Cadangan:
                    </p>
                    <ul className="grid grid-cols-2 gap-2 text-[11px] text-sand">
                      <li className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-brand" />
                        Profil &amp; Struk Toko
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-brand" />
                        Akun Staf &amp; PIN
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-brand" />
                        Katalog &amp; Varian
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-brand" />
                        Resep BOM &amp; HPP
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-brand" />
                        Stok Bahan Baku
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-brand" />
                        Seluruh Order &amp; Item
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-brand" />
                        Buku Kas Operasional
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-brand" />
                        Laporan Z-Report Shift
                      </li>
                    </ul>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={backingUp}
                  className="btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 px-4 font-display text-sm font-bold text-coal shadow-lg shadow-brand/20 hover:bg-brand-light disabled:opacity-50"
                >
                  {backingUp ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Menyiapkan Berkas JSON…</span>
                    </>
                  ) : (
                    <>
                      <Download className="size-4" strokeWidth={2.5} />
                      <span>Unduh File Cadangan (.json)</span>
                    </>
                  )}
                </button>
              </div>

              {/* CARD 2: PULIHKAN DATABASE (RESTORE) (7 KOLOM) */}
              <div className="lg:col-span-7 rounded-3xl border border-line bg-panel p-6 sm:p-7 shadow-ticket flex flex-col justify-between space-y-6">
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="grid size-12 place-items-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                      <UploadCloud className="size-6" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-300">
                      <AlertTriangle className="size-3.5" /> Zona Kritis (Restore)
                    </span>
                  </div>

                  <div>
                    <h2 className="font-display text-lg font-bold text-cream">
                      Pulihkan Database dari File Cadangan
                    </h2>
                    <p className="text-xs text-sand mt-1 leading-relaxed">
                      Pilih file cadangan (.json) yang sebelumnya telah Anda unduh untuk mengembalikan seluruh kondisi data outlet.
                    </p>
                  </div>

                  {/* Input File Picker */}
                  <div className="relative rounded-2xl border-2 border-dashed border-line hover:border-brand/50 bg-coal/40 p-5 transition-colors text-center">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      className="absolute inset-0 size-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center justify-center pointer-events-none">
                      <UploadCloud className="size-8 text-sand mb-2" />
                      {restoreFile ? (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-brand">
                            {restoreFile.name}
                          </p>
                          <p className="text-[11px] text-sand">
                            Ukuran: {(restoreFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-cream">
                            Klik atau seret file <span className="text-brand">.json</span> ke sini
                          </p>
                          <p className="text-[10.5px] text-faint">
                            Hanya menerima file JSON cadangan resmi BrewMetrics POS
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pratinjau Metadata File Cadangan jika Valid */}
                  {restorePreview && (
                    <div className="rounded-2xl border border-line-2 bg-coal/70 p-4 text-xs space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-faint">Versi Skema:</span>
                        <span className="font-bold text-cream">{restorePreview.version || "1.0"}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-faint">Waktu Ekspor:</span>
                        <span className="font-medium text-sand">
                          {restorePreview.exportedAt
                            ? formatDateID(new Date(restorePreview.exportedAt))
                            : "-"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-faint">Total Produk Terdata:</span>
                        <span className="font-bold text-brand">
                          {restorePreview.tables?.products?.length ?? restorePreview.metadata?.totalProducts ?? "-"} item
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-faint">Total Transaksi Order:</span>
                        <span className="font-bold text-brand">
                          {restorePreview.tables?.orders?.length ?? restorePreview.metadata?.totalOrders ?? "-"} transaksi
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Warning Box */}
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-950/25 p-4 text-xs text-amber-200 flex items-start gap-3">
                    <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">
                      <strong className="font-bold text-amber-100">Peringatan:</strong> Tindakan pemulihan akan{" "}
                      <span className="underline decoration-amber-400/60 font-semibold">
                        menggantikan seluruh data database yang aktif saat ini
                      </span>
                      . Transaksi kasir terbaru yang belum tercadangkan akan tertimpa.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setRestoreAgreement(false);
                    setRestoreConfirmOpen(true);
                  }}
                  disabled={!restoreFile || !restorePreview || restoring}
                  className="btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3.5 px-4 font-display text-sm font-bold text-coal shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <UploadCloud className="size-4" strokeWidth={2.5} />
                  <span>Mulai Proses Pemulihan Database…</span>
                </button>
              </div>
            </div>

            {/* CARD 3: PINTASAN EKSPOR LAPORAN KEUANGAN */}
            <div className="rounded-3xl border border-line bg-panel p-5 sm:p-6 shadow-ticket flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <FileSpreadsheet className="size-6" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-cream">
                    Ekspor Laporan Penjualan &amp; Finansial (Excel .xlsx)
                  </h3>
                  <p className="text-xs text-sand mt-0.5">
                    Unduh rekapitulasi penjualan kasir, pajak PB1, service charge, HPP, dan profit bersih per rentang tanggal.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExportModalOpen(true)}
                className="btn-press flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 shrink-0"
              >
                <FileSpreadsheet className="size-4" />
                <span>Buka Ekspor Excel</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Konfirmasi Eksekusi Restore */}
        <AnimatePresence>
          {restoreConfirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !restoring && setRestoreConfirmOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />

              <motion.div
                initial={{ scale: 0.94, opacity: 0, y: 16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.94, opacity: 0, y: 16 }}
                className="relative w-full max-w-md rounded-3xl border border-amber-500/40 bg-panel p-6 sm:p-7 shadow-ticket overflow-hidden"
              >
                <div className="flex items-start gap-3.5 mb-5">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400">
                    <ShieldAlert className="size-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-cream">
                      Konfirmasi Pemulihan Database
                    </h3>
                    <p className="text-xs text-sand mt-0.5 leading-relaxed">
                      Tindakan ini akan menimpa seluruh data operasional saat ini.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="rounded-2xl border border-line bg-coal/70 p-3.5 text-xs space-y-2">
                    <div className="flex justify-between text-sand">
                      <span>Nama Berkas:</span>
                      <strong className="text-cream truncate max-w-[200px]">{restoreFile?.name}</strong>
                    </div>
                    <div className="flex justify-between text-sand">
                      <span>Ukuran:</span>
                      <strong className="text-cream">{((restoreFile?.size || 0) / 1024).toFixed(1)} KB</strong>
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-red-500/30 bg-red-950/20 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={restoreAgreement}
                      onChange={(e) => setRestoreAgreement(e.target.checked)}
                      disabled={restoring}
                      className="size-4 mt-0.5 rounded border-line accent-amber-500"
                    />
                    <span className="text-xs text-red-200 font-medium leading-relaxed">
                      Saya mengerti konsekuensinya dan setuju untuk menimpa seluruh data database aktif dengan isi berkas cadangan ini.
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRestoreConfirmOpen(false)}
                    disabled={restoring}
                    className="btn-press rounded-xl border border-line bg-coal px-4 py-2.5 text-xs font-semibold text-sand hover:text-cream"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteRestore}
                    disabled={!restoreAgreement || restoring}
                    className="btn-press flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-500 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {restoring ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Memulihkan Database…</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="size-4" />
                        <span>Ya, Timpa &amp; Pulihkan</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal Ekspor Laporan Penjualan Excel */}
        <ExportReportModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          onSuccessToast={(msg) => showToast(msg, "ok")}
          onErrorToast={(msg) => showToast(msg, "warn")}
        />

        {/* Modal Registrasi & Edit Staf */}
        <StaffModal
          open={staffModal.open}
          initialData={staffModal.data}
          currentUserId={currentUser?.id}
          onClose={() => setStaffModal({ open: false, data: null })}
          onSave={handleSaveStaff}
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
      </div>
    </AppShell>
  );
}
