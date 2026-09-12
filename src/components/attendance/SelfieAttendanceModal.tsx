"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Clock,
  Store,
  User,
} from "lucide-react";
import type { SessionUser, StaffUserDto, OutletDto, AttendanceDto } from "@/lib/types";

interface SelfieAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: SessionUser | null;
  onSuccess?: (att: AttendanceDto) => void;
}

export function SelfieAttendanceModal({
  isOpen,
  onClose,
  currentUser,
  onSuccess,
}: SelfieAttendanceModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Form states
  const [staffList, setStaffList] = useState<StaffUserDto[]>([]);
  const [outlets, setOutlets] = useState<OutletDto[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [selectedOutletId, setSelectedOutletId] = useState<number | "">("");
  const [type, setType] = useState<"clock_in" | "clock_out">("clock_in");
  const [note, setNote] = useState("");

  // Camera & Photo states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Load staff and outlets if user not logged in or to populate choices
  useEffect(() => {
    if (!isOpen) return;

    if (currentUser) {
      setSelectedUserId(currentUser.id);
      if (currentUser.outletId) {
        setSelectedOutletId(currentUser.outletId);
      }
    }

    // Fetch staff
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.users) {
          setStaffList(data.users);
          if (!currentUser && data.users.length > 0) {
            setSelectedUserId(data.users[0].id);
            if (data.users[0].outletId) {
              setSelectedOutletId(data.users[0].outletId);
            }
          }
        }
      })
      .catch((err) => console.error("Error loading staff:", err));

    // Fetch outlets
    fetch("/api/outlets?activeOnly=true")
      .then((r) => r.json())
      .then((data) => {
        if (data.outlets) {
          setOutlets(data.outlets);
          if (!selectedOutletId && data.outlets.length > 0) {
            setSelectedOutletId(data.outlets[0].id);
          }
        }
      })
      .catch((err) => console.error("Error loading outlets:", err));
  }, [isOpen, currentUser]);

  // Start Camera
  const startCamera = async () => {
    setCameraError("");
    setCapturedPhoto(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Perangkat tidak mendukung akses kamera browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(
        err.message ||
          "Gagal mengakses kamera depan. Pastikan izin kamera telah diberikan di peramban."
      );
      setCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setCapturedPhoto(null);
      setSuccessMsg("");
      setErrorMessage("");
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Capture frame from video
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Flip horizontally for natural mirror selfie
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedPhoto(dataUrl);
    stopCamera();
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const handleSubmitAttendance = async () => {
    if (!selectedUserId) {
      setErrorMessage("Silakan pilih staf.");
      return;
    }
    if (!capturedPhoto) {
      setErrorMessage("Foto wajah selfie wajib diambil.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(selectedUserId),
          outletId: selectedOutletId ? Number(selectedOutletId) : undefined,
          type,
          photoUrl: capturedPhoto,
          note: note.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mencatat absensi.");
      }

      setSuccessMsg(data.message || "Absensi berhasil dicatat!");
      if (onSuccess && data.attendance) {
        onSuccess(data.attendance);
      }

      // Auto close after 1.8s
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan sistem saat absensi.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-coal/85 backdrop-blur-sm animate-in fade-in-0 overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl border border-line-2 bg-panel-solid p-5 sm:p-6 shadow-2xl my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-line mb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-brand text-coal">
              <Camera className="size-5" strokeWidth={2.4} />
            </div>
            <div>
              <h3 className="font-display text-sm sm:text-base font-bold text-cream">
                Absensi Foto Wajah (Selfie)
              </h3>
              <p className="text-[11px] text-sand">Verifikasi kehadiran staf dengan foto langsung</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-press grid size-7 place-items-center rounded-lg text-faint hover:text-cream"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Success Banner */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in-0">
            <CheckCircle2 className="size-4 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Controls */}
        <div className="space-y-3.5 mb-4">
          {/* Tipe Absensi Toggle (Masuk vs Pulang) */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-coal border border-line">
            <button
              type="button"
              onClick={() => setType("clock_in")}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                type === "clock_in"
                  ? "bg-emerald-500 text-coal shadow-md"
                  : "text-sand hover:text-cream"
              }`}
            >
              <Clock className="size-3.5" />
              Absen Masuk
            </button>
            <button
              type="button"
              onClick={() => setType("clock_out")}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                type === "clock_out"
                  ? "bg-amber-500 text-coal shadow-md"
                  : "text-sand hover:text-cream"
              }`}
            >
              <Clock className="size-3.5" />
              Absen Pulang
            </button>
          </div>

          {/* Staf Selection */}
          <div>
            <label className="block text-[11px] font-semibold text-sand mb-1">
              Nama Staf / Kasir
            </label>
            {currentUser ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-coal border border-line text-xs text-cream">
                <User className="size-3.5 text-brand shrink-0" />
                <span className="font-semibold">{currentUser.name}</span>
                <span className="text-[10px] text-faint ml-auto capitalize">
                  ({currentUser.role})
                </span>
              </div>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => {
                  const uid = Number(e.target.value);
                  setSelectedUserId(uid);
                  const st = staffList.find((s) => s.id === uid);
                  if (st?.outletId) {
                    setSelectedOutletId(st.outletId);
                  }
                }}
                className="w-full rounded-xl border border-line bg-coal px-3 py-2 text-xs text-cream focus:border-brand focus:outline-none"
              >
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role}) {s.outletName ? `• ${s.outletName}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Cabang Selection */}
          <div>
            <label className="block text-[11px] font-semibold text-sand mb-1">
              Lokasi Cabang / Outlet
            </label>
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-coal px-3 py-2 text-xs text-cream focus:border-brand focus:outline-none"
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Camera Viewport / Photo Preview */}
        <div className="relative aspect-[4/3] w-full rounded-2xl bg-black overflow-hidden border border-line-2 mb-4 flex items-center justify-center">
          {capturedPhoto ? (
            <div className="relative size-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedPhoto}
                alt="Foto Selfie Absensi"
                className="size-full object-cover"
              />
              <div className="absolute top-2.5 right-2.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/90 text-coal text-[11px] font-bold shadow-lg">
                  <CheckCircle2 className="size-3.5" />
                  Foto Siap
                </span>
              </div>
            </div>
          ) : cameraError ? (
            <div className="p-6 text-center flex flex-col items-center gap-2 text-sand">
              <CameraOff className="size-8 text-red-400" />
              <p className="text-xs text-red-300 max-w-xs">{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="mt-2 btn-press px-3 py-1.5 rounded-lg bg-panel border border-line text-xs font-semibold text-cream hover:text-brand"
              >
                Coba Lagi
              </button>
            </div>
          ) : (
            <div className="relative size-full">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="size-full object-cover scale-x-[-1]"
              />
              {/* Face Guide Oval */}
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="w-48 h-56 rounded-[50%] border-2 border-dashed border-brand/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
              <div className="absolute bottom-2 inset-x-0 text-center pointer-events-none">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-coal/70 backdrop-blur-sm text-[10px] font-semibold text-sand border border-white/10">
                  Posisikan wajah Anda di tengah lingkaran
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Note Input */}
        <div className="mb-5">
          <input
            type="text"
            placeholder="Catatan opsional (misal: Shift Pagi, Lembur)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-line bg-coal px-3 py-2 text-xs text-cream focus:border-brand focus:outline-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-line">
          {capturedPhoto ? (
            <>
              <button
                type="button"
                disabled={submitting}
                onClick={retakePhoto}
                className="btn-press flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-line bg-coal text-xs font-semibold text-sand hover:text-cream"
              >
                <RefreshCw className="size-3.5" />
                Foto Ulang
              </button>
              <button
                type="button"
                disabled={submitting || Boolean(successMsg)}
                onClick={handleSubmitAttendance}
                className="btn-press flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-coal text-xs font-bold shadow-lg shadow-brand/20 hover:brightness-110 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" strokeWidth={2.4} />
                    Kirim Absensi Sekarang
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="btn-press px-4 py-2.5 rounded-xl border border-line bg-coal text-xs font-semibold text-sand hover:text-cream"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!cameraActive}
                onClick={capturePhoto}
                className="btn-press flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-coal text-xs font-bold shadow-lg shadow-brand/20 hover:brightness-110 disabled:opacity-50"
              >
                <Camera className="size-4" strokeWidth={2.4} />
                Ambil Foto &amp; Absen
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
