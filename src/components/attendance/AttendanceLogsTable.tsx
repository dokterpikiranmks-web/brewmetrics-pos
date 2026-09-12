"use client";

import { useEffect, useState, useCallback } from "react";
import type { AttendanceDto, OutletDto } from "@/lib/types";
import {
  Camera,
  Clock,
  Store,
  User,
  Calendar,
  Maximize2,
  X,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { SelfieAttendanceModal } from "./SelfieAttendanceModal";

export function AttendanceLogsTable() {
  const [attendances, setAttendances] = useState<AttendanceDto[]>([]);
  const [outlets, setOutlets] = useState<OutletDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"today" | "last7days" | "thisMonth" | "all">("today");
  const [selectedOutletId, setSelectedOutletId] = useState<string>("all");

  // Modal Selfie State
  const [modalOpen, setModalOpen] = useState(false);

  // Lightbox Photo State
  const [lightboxPhoto, setLightboxPhoto] = useState<{
    url: string;
    userName: string;
    time: string;
    type: string;
    outlet: string;
  } | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (period !== "all") params.set("period", period);
      if (selectedOutletId !== "all") params.set("outletId", selectedOutletId);

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
  }, [period, selectedOutletId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    fetch("/api/outlets")
      .then((r) => r.json())
      .then((d) => {
        if (d.outlets) setOutlets(d.outlets);
      })
      .catch((e) => console.error(e));
  }, []);

  const clockInCount = attendances.filter((a) => a.type === "clock_in").length;
  const clockOutCount = attendances.filter((a) => a.type === "clock_out").length;

  return (
    <div className="space-y-6">
      {/* Header & Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-panel border border-line">
        <div className="flex items-center gap-3.5">
          <div className="grid size-12 place-items-center rounded-2xl bg-brand/15 border border-brand/30 text-brand">
            <Camera className="size-6" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-cream">
              Log Absensi Foto Wajah Staf
            </h2>
            <p className="text-xs text-sand">
              Verifikasi kehadiran foto selfie kasir &amp; staf per cabang dengan audit timestamp akurat.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="btn-press grid size-10 place-items-center rounded-xl border border-line bg-coal text-sand hover:text-cream"
            title="Muat ulang data"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin text-brand" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn-press flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-coal font-bold text-xs shadow-lg shadow-brand/20 hover:brightness-110 shrink-0"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            Catat Absen Staf
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3.5">
        <div className="p-4 rounded-xl bg-panel border border-line">
          <p className="text-[11px] font-semibold text-faint uppercase tracking-wider">Total Absensi</p>
          <p className="font-display text-2xl font-bold text-cream mt-1">{attendances.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-panel border border-line">
          <p className="text-[11px] font-semibold text-faint uppercase tracking-wider">Absen Masuk</p>
          <p className="font-display text-2xl font-bold text-emerald-400 mt-1">{clockInCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-panel border border-line">
          <p className="text-[11px] font-semibold text-faint uppercase tracking-wider">Absen Pulang</p>
          <p className="font-display text-2xl font-bold text-amber-400 mt-1">{clockOutCount}</p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-panel border border-line">
        {/* Period Filter Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-coal border border-line text-xs font-semibold">
          <button
            type="button"
            onClick={() => setPeriod("today")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              period === "today"
                ? "bg-brand text-coal font-bold shadow-sm"
                : "text-sand hover:text-cream"
            }`}
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={() => setPeriod("last7days")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              period === "last7days"
                ? "bg-brand text-coal font-bold shadow-sm"
                : "text-sand hover:text-cream"
            }`}
          >
            7 Hari Terakhir
          </button>
          <button
            type="button"
            onClick={() => setPeriod("thisMonth")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              period === "thisMonth"
                ? "bg-brand text-coal font-bold shadow-sm"
                : "text-sand hover:text-cream"
            }`}
          >
            Bulan Ini
          </button>
          <button
            type="button"
            onClick={() => setPeriod("all")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              period === "all"
                ? "bg-brand text-coal font-bold shadow-sm"
                : "text-sand hover:text-cream"
            }`}
          >
            Semua
          </button>
        </div>

        {/* Outlet Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Store className="size-4 text-faint shrink-0" />
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
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-line bg-panel overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-faint flex flex-col items-center gap-3">
            <Loader2 className="size-6 animate-spin text-brand" />
            <p className="text-xs">Memuat data absensi staf...</p>
          </div>
        ) : attendances.length === 0 ? (
          <div className="p-12 text-center text-faint flex flex-col items-center gap-2">
            <Camera className="size-8 text-faint" />
            <p className="text-xs">Tidak ada data absensi untuk filter yang dipilih.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-coal/50 text-[11px] uppercase tracking-wider text-faint">
                <tr>
                  <th className="py-3 px-4">Foto Wajah</th>
                  <th className="py-3 px-4">Nama Staf</th>
                  <th className="py-3 px-4">Tipe</th>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Cabang</th>
                  <th className="py-3 px-4">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {attendances.map((att) => {
                  const dateObj = new Date(att.createdAt);
                  const timeFormatted = dateObj.toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const dateFormatted = dateObj.toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <tr key={att.id} className="hover:bg-panel-2/50 transition-colors">
                      {/* Photo Thumbnail with Zoom */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxPhoto({
                              url: att.photoUrl,
                              userName: att.userName,
                              time: `${dateFormatted} ${timeFormatted}`,
                              type: att.type === "clock_in" ? "Masuk" : "Pulang",
                              outlet: att.outletName || "Cabang Pusat",
                            })
                          }
                          className="relative group size-12 rounded-xl overflow-hidden border border-line bg-black shrink-0 block cursor-zoom-in"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={att.photoUrl}
                            alt={`Foto absensi ${att.userName}`}
                            className="size-full object-cover group-hover:scale-110 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-coal/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 className="size-3.5 text-cream drop-shadow" />
                          </div>
                        </button>
                      </td>

                      {/* Staf Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-cream">{att.userName}</p>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-brand/10 border border-brand/20 text-brand">
                            {att.userRole}
                          </span>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4">
                        {att.type === "clock_in" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                            <CheckCircle2 className="size-3" />
                            Masuk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-[10px]">
                            <Clock className="size-3" />
                            Pulang
                          </span>
                        )}
                      </td>

                      {/* Time */}
                      <td className="py-3 px-4">
                        <div className="leading-tight">
                          <p className="font-semibold text-cream font-mono">{timeFormatted}</p>
                          <p className="text-[10px] text-faint mt-0.5">{dateFormatted}</p>
                        </div>
                      </td>

                      {/* Outlet */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-sand">
                          <Store className="size-3.5 text-brand shrink-0" />
                          {att.outletName || "Cabang Pusat"}
                        </span>
                      </td>

                      {/* Note */}
                      <td className="py-3 px-4 text-faint italic">
                        {att.note || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lightbox Zoom Modal */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-coal/90 backdrop-blur-md animate-in fade-in-0"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-sm sm:max-w-md w-full rounded-2xl border border-line-2 bg-panel-solid overflow-hidden shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-line mb-3">
              <div>
                <h4 className="font-display text-sm font-bold text-cream">
                  {lightboxPhoto.userName}
                </h4>
                <p className="text-[11px] text-sand">
                  Absen {lightboxPhoto.type} • {lightboxPhoto.outlet}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="btn-press grid size-7 place-items-center rounded-lg text-faint hover:text-cream"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-black border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxPhoto.url}
                alt={`Foto Selfie ${lightboxPhoto.userName}`}
                className="size-full object-cover"
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-sand">
              <span>Waktu: {lightboxPhoto.time}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold text-[10px]">
                Terverifikasi
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal Absensi Selfie */}
      <SelfieAttendanceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => fetchLogs()}
      />
    </div>
  );
}
