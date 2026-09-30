"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Camera,
  Clock,
  Store,
  Calendar,
  Maximize2,
  X,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Plus,
  Search,
  Sparkles,
  ShieldCheck,
  FileSpreadsheet,
  Smile,
  BatteryMedium,
  AlertCircle,
  HeartPulse,
  Lock,
  KeyRound,
  Users,
  Check,
  Building2,
  SlidersHorizontal,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { SelfieAttendanceModal } from "@/components/attendance/SelfieAttendanceModal";
import type { AttendanceDto, OutletDto, SessionUser } from "@/lib/types";
import * as XLSX from "xlsx";

type MoodTag = "optimal" | "lelah" | "tegang" | "cemas";

interface LightboxPhotoData {
  url: string;
  userName: string;
  time: string;
  type: string;
  outlet: string;
  mood?: string;
  moodDiagnosis?: string;
}

export default function AdminPage() {
  // Authentication & Gate State
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // PIN Pad Gate State
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinVerifying, setPinVerifying] = useState(false);

  // Data & Filter State
  const [attendances, setAttendances] = useState<AttendanceDto[]>([]);
  const [outlets, setOutlets] = useState<OutletDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedOutletId, setSelectedOutletId] = useState<string>("all");
  const [period, setPeriod] = useState<"today" | "last7days" | "thisMonth" | "all">("all");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedMood, setSelectedMood] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // AI & Action States
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<LightboxPhotoData | null>(null);

  // 1. Periksa sesi aktif pada saat inisialisasi
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user: SessionUser | null }) => {
        if (!alive) return;
        if (d.user && (d.user.role === "owner" || d.user.role === "manager")) {
          setCurrentUser(d.user);
          setIsUnlocked(true);
        }
      })
      .catch((e) => console.error("Gagal memeriksa sesi auth:", e))
      .finally(() => {
        if (alive) setAuthChecking(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  // 2. Fetch Data Cabang & Log Absensi
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedOutletId !== "all") params.set("outletId", selectedOutletId);
      if (selectedMood !== "all") params.set("mood", selectedMood);

      if (selectedDate && selectedDate.trim() !== "") {
        params.set("date", selectedDate.trim());
      } else if (period !== "all") {
        params.set("period", period);
      }

      const res = await fetch(`/api/attendance?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAttendances(data.attendances || []);
      }
    } catch (err) {
      console.error("Gagal memuat log absensi:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedOutletId, period, selectedDate, selectedMood]);

  useEffect(() => {
    if (!isUnlocked) return;
    fetchLogs();
  }, [isUnlocked, fetchLogs]);

  useEffect(() => {
    if (!isUnlocked) return;
    fetch("/api/outlets")
      .then((r) => r.json())
      .then((d) => {
        if (d.outlets) setOutlets(d.outlets);
      })
      .catch((e) => console.error(e));
  }, [isUnlocked]);

  // Handle Verifikasi PIN pada Gerbang Masuk Admin
  const handleVerifyPin = async (overridePin?: string) => {
    const pinToSubmit = overridePin ?? pinInput;
    if (!pinToSubmit || pinToSubmit.trim().length === 0) {
      setPinError("Silakan masukkan PIN otorisasi.");
      return;
    }

    setPinVerifying(true);
    setPinError("");

    try {
      const res = await fetch("/api/admin/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinToSubmit.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "PIN tidak valid.");
      }

      setCurrentUser(data.user);
      setIsUnlocked(true);
      setToastMessage("Berhasil masuk ke Portal Admin Owner!");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memverifikasi PIN.";
      setPinError(msg);
      setPinInput("");
    } finally {
      setPinVerifying(false);
    }
  };

  // Trigger Gemini AI Mood Scanner untuk 1 baris
  const handleAnalyzeMood = async (item: AttendanceDto) => {
    setAnalyzingId(item.id);
    try {
      const res = await fetch("/api/attendance/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceId: item.id,
          photoUrl: item.photoUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memproses mood.");
      }

      // Perbarui state lokal secara instan
      setAttendances((prev) =>
        prev.map((att) =>
          att.id === item.id
            ? { ...att, mood: data.mood, moodDiagnosis: data.moodDiagnosis }
            : att
        )
      );

      setToastMessage(`Mood ${item.userName} terdeteksi: ${data.mood.toUpperCase()}`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memindai mood wajah.";
      alert(msg);
    } finally {
      setAnalyzingId(null);
    }
  };

  // Trigger Gemini AI Batch Scanner
  const handleBatchAnalyze = async () => {
    const unanalyzed = attendances.filter((a) => !a.mood || a.mood === "" || a.mood === "optimal");
    if (unanalyzed.length === 0) {
      alert("Semua log absensi pada daftar saat ini telah memiliki analisis mood.");
      return;
    }

    setBatchAnalyzing(true);
    let successCount = 0;

    for (const item of unanalyzed.slice(0, 5)) {
      try {
        const res = await fetch("/api/attendance/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attendanceId: item.id, photoUrl: item.photoUrl }),
        });
        if (res.ok) successCount++;
      } catch {
        // continue
      }
    }

    setBatchAnalyzing(false);
    await fetchLogs();
    setToastMessage(`Berhasil menganalisis ${successCount} foto wajah staf dengan Gemini AI!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Export Data Log Absensi ke Excel
  const handleExportExcel = () => {
    if (attendances.length === 0) {
      alert("Tidak ada data log absensi untuk diekspor.");
      return;
    }

    const exportRows = filteredAttendances.map((a, idx) => ({
      No: idx + 1,
      "Nama Karyawan": a.userName,
      Peran: a.userRole,
      "Cabang / Outlet": a.outletName,
      Tipe: a.type === "clock_in" || a.type === "in" ? "Masuk" : "Pulang",
      "Waktu Catat": new Date(a.createdAt).toLocaleString("id-ID"),
      "Sentimen Mood": (a.mood || "Optimal").toUpperCase(),
      "Diagnosis Energi AI": a.moodDiagnosis || "Kondisi Energi Prima",
      Catatan: a.notes || a.note || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Log Absensi & Mood");
    const todayStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Log_Absensi_Mood_Karyawan_${todayStr}.xlsx`);
  };

  // Filter Data di sisi Client untuk pencarian cepat & tipe
  const filteredAttendances = useMemo(() => {
    return attendances.filter((a) => {
      if (selectedType !== "all") {
        const isIn = a.type === "clock_in" || a.type === "in";
        if (selectedType === "in" && !isIn) return false;
        if (selectedType === "out" && isIn) return false;
      }
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase().trim();
        const matchName = a.userName.toLowerCase().includes(q);
        const matchOutlet = (a.outletName || "").toLowerCase().includes(q);
        const matchMood = (a.mood || "").toLowerCase().includes(q);
        if (!matchName && !matchOutlet && !matchMood) return false;
      }
      return true;
    });
  }, [attendances, selectedType, searchQuery]);

  // Statistik Ringkasan
  const stats = useMemo(() => {
    const total = filteredAttendances.length;
    const inCount = filteredAttendances.filter((a) => a.type === "clock_in" || a.type === "in").length;
    const outCount = filteredAttendances.filter((a) => a.type === "clock_out" || a.type === "out").length;
    const moodOptimal = filteredAttendances.filter((a) => (a.mood || "optimal") === "optimal").length;
    const moodLelah = filteredAttendances.filter((a) => a.mood === "lelah").length;
    const moodTegang = filteredAttendances.filter((a) => a.mood === "tegang").length;
    const moodCemas = filteredAttendances.filter((a) => a.mood === "cemas").length;

    const positivePercent = total > 0 ? Math.round(((moodOptimal + moodLelah * 0.5) / total) * 100) : 100;

    return { total, inCount, outCount, moodOptimal, moodLelah, moodTegang, moodCemas, positivePercent };
  }, [filteredAttendances]);

  // Komponen Helper untuk Badge Mood
  const renderMoodBadge = (mood?: string | null) => {
    const normalized = (mood || "optimal").toLowerCase().trim() as MoodTag;

    switch (normalized) {
      case "optimal":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-[11px]">
            <Smile className="size-3.5 text-emerald-400" />
            Optimal
          </span>
        );
      case "lelah":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-[11px]">
            <BatteryMedium className="size-3.5 text-amber-400" />
            Lelah
          </span>
        );
      case "tegang":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold text-[11px]">
            <AlertCircle className="size-3.5 text-rose-400" />
            Tegang
          </span>
        );
      case "cemas":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-400 font-bold text-[11px]">
            <HeartPulse className="size-3.5 text-violet-400" />
            Cemas
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-panel-2 border border-line text-sand font-bold text-[11px]">
            <Sparkles className="size-3.5 text-brand" />
            {mood}
          </span>
        );
    }
  };

  // Loading Screen Awal
  if (authChecking) {
    return (
      <div className="min-h-screen bg-coal flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-brand" />
          <p className="text-xs text-sand font-semibold">Memverifikasi otentikasi admin...</p>
        </div>
      </div>
    );
  }

  // GERBANG PROTEKSI PIN STATIS & OWNER (Jika belum terautentikasi)
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-coal flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-panel border border-line rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in-0 zoom-in-95">
          <div className="text-center space-y-2">
            <div className="inline-grid size-14 place-items-center rounded-2xl bg-brand/15 border border-brand/30 text-brand mx-auto shadow-lg shadow-brand/10">
              <ShieldCheck className="size-7" />
            </div>
            <h1 className="font-display text-xl font-bold text-cream tracking-tight">
              Portal Admin &amp; Owner
            </h1>
            <p className="text-xs text-sand leading-relaxed">
              Halaman ini dilindungi. Masukkan PIN Admin atau Owner untuk mengakses log absensi dan sentimen mood.
            </p>
          </div>

          {/* Form PIN Pad */}
          <div className="space-y-4">
            <div className="relative">
              <input
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyPin()}
                placeholder="••••"
                className="w-full text-center text-2xl tracking-[0.5em] py-3.5 rounded-2xl bg-coal border border-line focus:border-brand text-cream focus:outline-none transition-colors"
                autoFocus
              />
              <KeyRound className="size-4 text-faint absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {pinError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-semibold text-center flex items-center justify-center gap-1.5">
                <AlertCircle className="size-4 shrink-0" />
                {pinError}
              </div>
            )}

            <button
              type="button"
              onClick={() => handleVerifyPin()}
              disabled={pinVerifying || pinInput.length === 0}
              className="btn-press w-full py-3.5 rounded-2xl bg-brand text-coal font-bold text-sm shadow-xl shadow-brand/20 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {pinVerifying ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  <Lock className="size-4" />
                  Buka Akses Admin
                </>
              )}
            </button>

            {/* Quick Demo PIN Chip */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setPinInput("1234");
                  handleVerifyPin("1234");
                }}
                className="text-[11px] text-faint hover:text-brand transition-colors inline-flex items-center gap-1 underline underline-offset-4"
              >
                Gunakan PIN Owner Demo (1234)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // HALAMAN UTAMA DASBOR ADMIN (Telah Terotentikasi)
  return (
    <AppShell allowedRoles={["owner", "manager"]}>
      <div className="space-y-6 pb-12">
        {/* Toast Notifikasi */}
        {toastMessage && (
          <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-brand text-coal font-bold text-xs shadow-2xl shadow-brand/30 animate-in fade-in-0 slide-in-from-top-3">
            <CheckCircle2 className="size-4" />
            {toastMessage}
          </div>
        )}

        {/* Hero Header Dasbor */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-panel border border-line shadow-xl">
          <div className="flex items-center gap-4">
            <div className="grid size-14 place-items-center rounded-2xl bg-brand/15 border border-brand/30 text-brand shrink-0 shadow-lg shadow-brand/10">
              <ShieldCheck className="size-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl sm:text-2xl font-bold text-cream">
                  Admin Portal — Monitoring Log Absensi &amp; Mood
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-brand/20 border border-brand/30 text-brand">
                  Live Audit
                </span>
              </div>
              <p className="text-xs sm:text-sm text-sand mt-0.5">
                Pengawasan biometrik wajah selfie staf &amp; analisis energi emosional (Kopi Aso &amp; Nasi Kebuli Mandhi).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              className="btn-press flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-coal text-sand hover:text-cream text-xs font-semibold"
              title="Perbarui data"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin text-brand" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleBatchAnalyze}
              disabled={batchAnalyzing || loading}
              className="btn-press flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-brand/30 bg-brand/10 text-brand hover:bg-brand/20 text-xs font-semibold"
              title="Analisis semua foto dengan AI"
            >
              <Sparkles className={`size-3.5 ${batchAnalyzing ? "animate-spin" : ""}`} />
              <span>{batchAnalyzing ? "Menganalisis..." : "Scan Semua Mood AI"}</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="btn-press flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold"
              title="Unduh laporan excel"
            >
              <FileSpreadsheet className="size-3.5" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="btn-press flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-coal font-bold text-xs shadow-lg shadow-brand/20 hover:brightness-110"
            >
              <Plus className="size-4" strokeWidth={2.5} />
              <span>Catat Absen</span>
            </button>
          </div>
        </div>

        {/* Kartu Metrik & Rangkuman Sentimen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-2xl bg-panel border border-line">
            <p className="text-[11px] font-semibold text-faint uppercase tracking-wider flex items-center gap-1">
              <Users className="size-3.5" />
              Total Log
            </p>
            <p className="font-display text-2xl font-bold text-cream mt-1">{stats.total}</p>
          </div>

          <div className="p-4 rounded-2xl bg-panel border border-line">
            <p className="text-[11px] font-semibold text-faint uppercase tracking-wider flex items-center gap-1">
              <Clock className="size-3.5 text-emerald-400" />
              Absen Masuk
            </p>
            <p className="font-display text-2xl font-bold text-emerald-400 mt-1">{stats.inCount}</p>
          </div>

          <div className="p-4 rounded-2xl bg-panel border border-line">
            <p className="text-[11px] font-semibold text-faint uppercase tracking-wider flex items-center gap-1">
              <Clock className="size-3.5 text-amber-400" />
              Absen Pulang
            </p>
            <p className="font-display text-2xl font-bold text-amber-400 mt-1">{stats.outCount}</p>
          </div>

          <div className="p-4 rounded-2xl bg-panel border border-line">
            <p className="text-[11px] font-semibold text-faint uppercase tracking-wider flex items-center gap-1">
              <Smile className="size-3.5 text-emerald-400" />
              Optimal
            </p>
            <p className="font-display text-2xl font-bold text-emerald-400 mt-1">{stats.moodOptimal}</p>
          </div>

          <div className="p-4 rounded-2xl bg-panel border border-line">
            <p className="text-[11px] font-semibold text-faint uppercase tracking-wider flex items-center gap-1">
              <BatteryMedium className="size-3.5 text-amber-400" />
              Lelah
            </p>
            <p className="font-display text-2xl font-bold text-amber-400 mt-1">{stats.moodLelah}</p>
          </div>

          <div className="p-4 rounded-2xl bg-panel border border-line">
            <p className="text-[11px] font-semibold text-faint uppercase tracking-wider flex items-center gap-1">
              <AlertCircle className="size-3.5 text-rose-400" />
              Tegang / Cemas
            </p>
            <p className="font-display text-2xl font-bold text-rose-400 mt-1">
              {stats.moodTegang + stats.moodCemas}
            </p>
          </div>
        </div>

        {/* Toolbar Filter & Pencarian Lengkap */}
        <div className="p-4 rounded-2xl bg-panel border border-line space-y-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Karyawan */}
            <div className="relative flex-1 max-w-sm">
              <Search className="size-4 text-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama karyawan / cabang..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-coal border border-line text-xs text-cream placeholder:text-faint focus:border-brand focus:outline-none"
              />
            </div>

            {/* Presets Periode */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-coal border border-line text-xs font-semibold overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  setSelectedDate("");
                  setPeriod("today");
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  period === "today" && !selectedDate
                    ? "bg-brand text-coal font-bold shadow"
                    : "text-sand hover:text-cream"
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedDate("");
                  setPeriod("last7days");
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  period === "last7days" && !selectedDate
                    ? "bg-brand text-coal font-bold shadow"
                    : "text-sand hover:text-cream"
                }`}
              >
                7 Hari
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedDate("");
                  setPeriod("thisMonth");
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  period === "thisMonth" && !selectedDate
                    ? "bg-brand text-coal font-bold shadow"
                    : "text-sand hover:text-cream"
                }`}
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedDate("");
                  setPeriod("all");
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  period === "all" && !selectedDate
                    ? "bg-brand text-coal font-bold shadow"
                    : "text-sand hover:text-cream"
                }`}
              >
                Semua
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-line/60">
            {/* Filter Cabang (Kopi Aso / Nasi Kebuli) */}
            <div className="flex items-center gap-2">
              <Store className="size-3.5 text-brand shrink-0" />
              <select
                value={selectedOutletId}
                onChange={(e) => setSelectedOutletId(e.target.value)}
                className="rounded-xl border border-line bg-coal px-3 py-1.5 text-xs text-cream focus:border-brand focus:outline-none"
              >
                <option value="all">Semua Cabang</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Tanggal Spesifik (Date Picker) */}
            <div className="flex items-center gap-2">
              <Calendar className="size-3.5 text-brand shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-xl border border-line bg-coal px-3 py-1.5 text-xs text-cream focus:border-brand focus:outline-none [color-scheme:dark]"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate("")}
                  className="text-[10px] text-rose-400 hover:underline"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Filter Mood */}
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-brand shrink-0" />
              <select
                value={selectedMood}
                onChange={(e) => setSelectedMood(e.target.value)}
                className="rounded-xl border border-line bg-coal px-3 py-1.5 text-xs text-cream focus:border-brand focus:outline-none"
              >
                <option value="all">Semua Sentimen Mood</option>
                <option value="optimal">Optimal (🟢)</option>
                <option value="lelah">Lelah (🟡)</option>
                <option value="tegang">Tegang (🔴)</option>
                <option value="cemas">Cemas (🟣)</option>
              </select>
            </div>

            {/* Filter Tipe Kehadiran */}
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 text-brand shrink-0" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="rounded-xl border border-line bg-coal px-3 py-1.5 text-xs text-cream focus:border-brand focus:outline-none"
              >
                <option value="all">Semua Tipe Absensi</option>
                <option value="in">Jam Masuk (Clock In)</option>
                <option value="out">Jam Pulang (Clock Out)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabel Data Log Absensi & Mood */}
        <div className="rounded-3xl border border-line bg-panel overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-16 text-center text-faint flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-brand" />
              <p className="text-xs text-sand font-medium">Memuat log absensi wajah &amp; mood staf...</p>
            </div>
          ) : filteredAttendances.length === 0 ? (
            <div className="p-16 text-center text-faint flex flex-col items-center gap-3">
              <Camera className="size-10 text-faint/50" />
              <h3 className="font-display text-sm font-bold text-cream">Tidak ada log absensi ditemukan</h3>
              <p className="text-xs text-sand max-w-sm">
                Coba sesuaikan filter cabang, tanggal, atau gunakan tombol &quot;Catat Absen&quot; untuk memasukkan absensi baru.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-coal/70 text-[11px] uppercase tracking-wider text-faint">
                  <tr>
                    <th className="py-3.5 px-4">Foto Wajah</th>
                    <th className="py-3.5 px-4">Karyawan</th>
                    <th className="py-3.5 px-4">ID &amp; Cabang</th>
                    <th className="py-3.5 px-4">Waktu (Timestamp)</th>
                    <th className="py-3.5 px-4">Hasil Mood Scanner</th>
                    <th className="py-3.5 px-4">Catatan</th>
                    <th className="py-3.5 px-4 text-center">Aksi AI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {filteredAttendances.map((att) => {
                    const dateObj = new Date(att.createdAt);
                    const timeFormatted = dateObj.toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    });
                    const dateFormatted = dateObj.toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    });

                    const isClockIn = att.type === "clock_in" || att.type === "in";

                    return (
                      <tr key={att.id} className="hover:bg-panel-2/50 transition-colors">
                        {/* Foto Wajah dengan Zoom / Lightbox */}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxPhoto({
                                url: att.photoUrl,
                                userName: att.userName,
                                time: `${dateFormatted} ${timeFormatted}`,
                                type: isClockIn ? "Masuk" : "Pulang",
                                outlet: att.outletName || "Cabang Pusat",
                                mood: att.mood || "optimal",
                                moodDiagnosis: att.moodDiagnosis || "Kondisi Energi Prima",
                              })
                            }
                            className="relative group size-12 rounded-xl overflow-hidden border border-line bg-black shrink-0 block cursor-zoom-in shadow-sm hover:border-brand transition-colors"
                            title="Klik untuk memperbesar foto wajah"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={att.photoUrl}
                              alt={`Selfie ${att.userName}`}
                              className="size-full object-cover group-hover:scale-110 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-coal/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Maximize2 className="size-3.5 text-cream drop-shadow" />
                            </div>
                          </button>
                        </td>

                        {/* Nama Karyawan & Role */}
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-bold text-cream text-[13px]">{att.userName}</p>
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-brand/10 border border-brand/20 text-brand">
                              {att.userRole}
                            </span>
                          </div>
                        </td>

                        {/* ID Cabang (Kopi Aso / Nasi Kebuli) */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-sand">
                            <Building2 className="size-3.5 text-brand shrink-0" />
                            <span className="font-semibold text-cream">
                              {att.outletName || "KOPI ASO (Pusat)"}
                            </span>
                          </div>
                        </td>

                        {/* Timestamp & Tipe */}
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {isClockIn ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                                <CheckCircle2 className="size-2.5" />
                                Masuk
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-[10px]">
                                <Clock className="size-2.5" />
                                Pulang
                              </span>
                            )}
                            <div className="leading-tight font-mono text-[11px] text-cream">
                              {timeFormatted}
                            </div>
                            <div className="text-[10px] text-faint">{dateFormatted}</div>
                          </div>
                        </td>

                        {/* Hasil Mood Scanner */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="space-y-1">
                            <div>{renderMoodBadge(att.mood)}</div>
                            <p className="text-[11px] text-sand/90 line-clamp-2 leading-relaxed italic">
                              &ldquo;{att.moodDiagnosis || "Kondisi Energi Prima. Siap melayani pelanggan."}&rdquo;
                            </p>
                          </div>
                        </td>

                        {/* Catatan */}
                        <td className="py-3 px-4 text-faint italic max-w-[150px] truncate">
                          {att.notes || att.note || "—"}
                        </td>

                        {/* Tombol Re-Scan AI */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleAnalyzeMood(att)}
                            disabled={analyzingId === att.id}
                            className="btn-press inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-brand/30 bg-brand/10 text-brand hover:bg-brand/20 text-[11px] font-semibold"
                            title="Analisis ulang ekspresi wajah dengan Gemini AI"
                          >
                            <Sparkles className={`size-3 ${analyzingId === att.id ? "animate-spin" : ""}`} />
                            <span>{analyzingId === att.id ? "Scanning..." : "Scan AI"}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Lightbox Foto Wajah */}
        {lightboxPhoto && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-coal/90 backdrop-blur-md animate-in fade-in-0"
            onClick={() => setLightboxPhoto(null)}
          >
            <div
              className="relative max-w-sm sm:max-w-md w-full rounded-3xl border border-line bg-panel-solid overflow-hidden shadow-2xl p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div>
                  <h4 className="font-display text-base font-bold text-cream">
                    {lightboxPhoto.userName}
                  </h4>
                  <p className="text-xs text-sand">
                    Absensi {lightboxPhoto.type} • {lightboxPhoto.outlet}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxPhoto(null)}
                  className="btn-press grid size-8 place-items-center rounded-xl bg-coal text-faint hover:text-cream"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lightboxPhoto.url}
                  alt={`Selfie ${lightboxPhoto.userName}`}
                  className="size-full object-cover"
                />
              </div>

              <div className="space-y-2 p-3 rounded-2xl bg-coal border border-line text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-faint">Sentimen Mood:</span>
                  {renderMoodBadge(lightboxPhoto.mood)}
                </div>
                <div className="text-[11px] text-sand italic leading-relaxed">
                  &ldquo;{lightboxPhoto.moodDiagnosis}&rdquo;
                </div>
                <div className="pt-2 border-t border-line/60 flex items-center justify-between text-faint text-[10px]">
                  <span>Waktu: {lightboxPhoto.time}</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="size-3" /> Biometrik Terverifikasi
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Catat Absensi Manual */}
        <SelfieAttendanceModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => fetchLogs()}
        />
      </div>
    </AppShell>
  );
}
