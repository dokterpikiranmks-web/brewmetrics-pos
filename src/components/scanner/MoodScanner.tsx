"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Webcam from "react-webcam";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Camera,
  RefreshCw,
  X,
  Plus,
  Check,
  AlertCircle,
  Zap,
  Heart,
  Wind,
  Smile,
  ShieldCheck,
} from "lucide-react";
import type { CatalogDto } from "@/lib/types";
import { formatIDR } from "@/lib/format";
import { productIcon } from "@/components/pos/icons";

export type MoodTag = "tegang" | "cemas" | "lelah" | "optimal";

export interface MoodDiagnosisResult {
  mood_tag: MoodTag;
  diagnosis_text: string;
}

export interface MoodScannerProps {
  isOpen: boolean;
  onClose: () => void;
  catalog?: CatalogDto | null;
  onAddToCart?: (product: CatalogDto["products"][number]) => void;
  onMoodScanned?: (mood: MoodTag, diagnosisText: string) => void;
}

const SCANNING_PHRASES = [
  "Menganalisa mikro-ekspresi wajah...",
  "Mengukur ketegangan otot...",
  "Memetakan kebutuhan energi...",
];

export default function MoodScanner({
  isOpen,
  onClose,
  catalog,
  onAddToCart,
  onMoodScanned,
}: MoodScannerProps) {
  const webcamRef = useRef<Webcam | null>(null);

  // UI States: "idle" (Siaga) | "scanning" (Theatrical Scanning) | "result" (Result & Rekomendasi)
  const [scannerState, setScannerState] = useState<"idle" | "scanning" | "result">("idle");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [result, setResult] = useState<MoodDiagnosisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [addedIds, setAddedIds] = useState<number[]>([]);

  // Reset state saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setScannerState("idle");
      setCapturedImage(null);
      setPhraseIndex(0);
      setResult(null);
      setErrorMsg(null);
      setAddedIds([]);
    }
  }, [isOpen]);

  // Rotasi teks loading bergantian saat fase Scanning (UI State 2)
  useEffect(() => {
    if (scannerState !== "scanning") return;

    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % SCANNING_PHRASES.length);
    }, 1100);

    return () => clearInterval(interval);
  }, [scannerState]);

  // Eksekusi Pindai Energi Wajah (State 1 -> State 2 -> State 3)
  const handleStartScan = async () => {
    setErrorMsg(null);

    if (!webcamRef.current) {
      setErrorMsg("Kamera belum siap. Pastikan izin kamera aktif.");
      return;
    }

    // Ambil screenshot Base64 dari react-webcam
    const imageBase64 = webcamRef.current.getScreenshot({
      width: 640,
      height: 480,
    });

    if (!imageBase64) {
      setErrorMsg("Gagal mengambil gambar dari kamera. Coba ulangi kembali.");
      return;
    }

    setCapturedImage(imageBase64);
    setScannerState("scanning");
    setPhraseIndex(0);

    const startTime = Date.now();

    try {
      let data: any = null;
      let lastFetchErr: any = null;

      // Coba fetch hingga 2 kali jika terjadi transient network drop di Android TWA
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const res = await fetch("/api/analyze-mood", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ image: imageBase64 }),
          });

          data = await res.json();
          if (res.ok && data?.mood_tag) {
            break;
          }
          throw new Error(data?.error || "Gagal memproses analisa ekspresi wajah dengan AI.");
        } catch (fetchErr: any) {
          lastFetchErr = fetchErr;
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 600));
          }
        }
      }

      if (!data || !data.mood_tag) {
        throw lastFetchErr || new Error("Gagal terhubung ke layanan AI Mood Scanner.");
      }

      // Pastikan efek theatrical loading berjalan minimal 2.2 detik agar terasa holistik
      const elapsed = Date.now() - startTime;
      const minTheatricalDelay = 2200;
      if (elapsed < minTheatricalDelay) {
        await new Promise((r) => setTimeout(r, minTheatricalDelay - elapsed));
      }

      const diagnosisData: MoodDiagnosisResult = {
        mood_tag: data.mood_tag as MoodTag,
        diagnosis_text: data.diagnosis_text,
      };

      setResult(diagnosisData);
      setScannerState("result");

      // Beritahu parent component jika ada callback
      if (onMoodScanned) {
        onMoodScanned(diagnosisData.mood_tag, diagnosisData.diagnosis_text);
      }
    } catch (err: any) {
      console.error("AI Mood Scanner Error:", err);
      setErrorMsg(err.message || "Gagal menganalisa ekspresi wajah. Periksa koneksi internet.");
      setScannerState("idle");
    }
  };

  // Reset kembali ke Siaga (UI State 1)
  const handleResetScan = () => {
    setScannerState("idle");
    setCapturedImage(null);
    setResult(null);
    setErrorMsg(null);
    setPhraseIndex(0);
  };

  // Filter 2-3 menu pilihan dari database yang ai_mood-nya cocok dengan mood_tag
  const recommendedProducts = useMemo(() => {
    if (!catalog?.products || !result?.mood_tag) return [];

    const tag = result.mood_tag.toLowerCase();
    const activeProducts = catalog.products;

    // 1. Prioritas Utama: Produk yang eksplisit memiliki kolom ai_mood cocok
    const directMatches = activeProducts.filter(
      (p) => p.aiMood && p.aiMood.toLowerCase().trim() === tag
    );

    if (directMatches.length >= 2) {
      return directMatches.slice(0, 3);
    }

    // 2. Prioritas Kedua: Pencocokan kontekstual nama / tagline jika ai_mood di DB belum diisi penuh
    const contextualMatches = activeProducts.filter((p) => {
      if (directMatches.some((m) => m.id === p.id)) return false;
      const text = `${p.name} ${p.tagline}`.toLowerCase();
      if (tag === "tegang") {
        return text.includes("tea") || text.includes("teh") || text.includes("matcha") || text.includes("chocolate") || text.includes("cokelat") || text.includes("lemon");
      }
      if (tag === "cemas") {
        return text.includes("latte") || text.includes("susu") || text.includes("caramel") || text.includes("vanilla") || text.includes("cappuccino");
      }
      if (tag === "lelah") {
        return text.includes("espresso") || text.includes("americano") || text.includes("aren") || text.includes("cold brew") || text.includes("kopi");
      }
      if (tag === "optimal") {
        return text.includes("v60") || text.includes("specialty") || text.includes("signature") || text.includes("manual") || text.includes("pour over");
      }
      return false;
    });

    const combined = [...directMatches, ...contextualMatches];
    if (combined.length >= 2) {
      return combined.slice(0, 3);
    }

    // 3. Fallback: Lengkapi dengan produk aktif lainnya agar selalu ada 2-3 rekomendasi menu
    const remaining = activeProducts.filter((p) => !combined.some((c) => c.id === p.id));
    return [...combined, ...remaining].slice(0, 3);
  }, [catalog, result]);

  // Tambahkan item menu rekomendasi langsung ke keranjang kasir
  const handleAddProduct = (product: CatalogDto["products"][number]) => {
    if (onAddToCart) {
      onAddToCart(product);
      setAddedIds((prev) => [...prev, product.id]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      {/* Container Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="relative w-full max-w-2xl rounded-3xl border border-line-2/70 bg-coal shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
      >
        {/* Theatrical CSS Keyframes untuk Garis Hijau Scanner */}
        <style jsx>{`
          @keyframes moodScanLine {
            0% {
              top: 2%;
              opacity: 0.2;
            }
            15% {
              opacity: 1;
            }
            50% {
              top: 94%;
              opacity: 1;
            }
            85% {
              opacity: 1;
            }
            100% {
              top: 2%;
              opacity: 0.2;
            }
          }
          .animate-theatrical-scan {
            position: absolute;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(
              90deg,
              transparent 0%,
              rgba(16, 185, 129, 0.4) 15%,
              #34d399 50%,
              rgba(16, 185, 129, 0.4) 85%,
              transparent 100%
            );
            box-shadow: 0 0 16px 3px rgba(52, 211, 153, 0.8),
              0 0 32px 6px rgba(16, 185, 129, 0.4);
            animation: moodScanLine 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            z-index: 30;
          }
          .scan-glow-backdrop {
            box-shadow: inset 0 0 60px rgba(16, 185, 129, 0.2);
          }
        `}</style>

        {/* --------------------------- HEADER MODAL --------------------------- */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-panel/80">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-brand/20 border border-emerald-500/40 text-emerald-400">
              <Sparkles className="size-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-cream">
                  AI Mood-to-Menu Scanner
                </h2>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                  Gemini Vision
                </span>
              </div>
              <p className="text-[11px] text-faint">
                Analisa kondisi energi wajah &amp; rekomendasi hidangan pemulih
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-press grid size-8 place-items-center rounded-lg border border-line text-faint hover:text-cream hover:bg-panel transition"
            aria-label="Tutup pemindai"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ----------------------------- CONTENT ----------------------------- */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* Pesan Kesalahan jika ada */}
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-300 text-xs"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Gagal Memindai: </span>
                <span>{errorMsg}</span>
              </div>
              <button
                onClick={() => setErrorMsg(null)}
                className="text-rose-400 hover:text-rose-200"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          )}

          {/* ---------------------- VIEWPORT WEBCAM / SCANNER ---------------------- */}
          <div className="relative w-full aspect-[4/3] max-h-[300px] sm:max-h-[340px] rounded-2xl overflow-hidden border border-line-2 bg-black flex items-center justify-center shadow-inner">
            {/* Live Webcam (hanya render jika modal aktif dan belum ada hasil foto) */}
            {scannerState !== "result" && (
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  facingMode: "user",
                  width: { ideal: 640 },
                  height: { ideal: 480 },
                }}
                mirrored={true}
                onUserMedia={() => setCameraReady(true)}
                onUserMediaError={() =>
                  setErrorMsg("Kamera tidak dapat diakses. Mohon beri izin akses kamera di browser.")
                }
                className="absolute inset-0 size-full object-cover"
              />
            )}

            {/* Frozen Snapshot saat Hasil Tampil */}
            {scannerState === "result" && capturedImage && (
              <img
                src={capturedImage}
                alt="Captured Face"
                className="absolute inset-0 size-full object-cover filter brightness-[0.88]"
              />
            )}

            {/* RETICLE / TARGET FACE GUIDE OVERLAY */}
            <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
              {/* Oval Panduan Wajah Biometrik */}
              <div
                className={`size-44 sm:size-52 rounded-full border-2 border-dashed transition-all duration-300 ${
                  scannerState === "scanning"
                    ? "border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.35)] scale-105"
                    : scannerState === "result"
                    ? "border-emerald-500/60"
                    : "border-white/30"
                }`}
              />

              {/* Pojok-pojok HUD Cyberpunk */}
              <div className="absolute top-4 left-4 size-5 border-t-2 border-l-2 border-emerald-400/70" />
              <div className="absolute top-4 right-4 size-5 border-t-2 border-r-2 border-emerald-400/70" />
              <div className="absolute bottom-4 left-4 size-5 border-b-2 border-l-2 border-emerald-400/70" />
              <div className="absolute bottom-4 right-4 size-5 border-b-2 border-r-2 border-emerald-400/70" />
            </div>

            {/* UI STATE 2: THEATRICAL SCANNING OVERLAY */}
            <AnimatePresence>
              {scannerState === "scanning" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 pointer-events-none scan-glow-backdrop"
                >
                  {/* Efek Garis Hijau Naik-Turun (Theatrical Scanner Line) */}
                  <div className="animate-theatrical-scan" />

                  {/* Grid Tekstur Hologram */}
                  <div
                    className="absolute inset-0 opacity-15"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(52, 211, 153, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(52, 211, 153, 0.2) 1px, transparent 1px)",
                      backgroundSize: "24px 24px",
                    }}
                  />

                  {/* Badge Status Scanning di Sudut */}
                  <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 px-3 py-1 text-[11px] font-bold text-emerald-300 backdrop-blur-md">
                    <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Neural Scanning Active</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Indikator Kamera Siap (State 1) */}
            {scannerState === "idle" && cameraReady && (
              <div className="absolute bottom-3 z-20 rounded-full bg-black/65 border border-white/10 px-3 py-1 text-[11px] text-sand/90 backdrop-blur-sm flex items-center gap-1.5">
                <Camera className="size-3.5 text-emerald-400" />
                <span>Posisikan wajah pelanggan di dalam lingkaran panduan</span>
              </div>
            )}
          </div>

          {/* -------------------- STATE 1: SIAGA (IDLE) -------------------- */}
          {scannerState === "idle" && (
            <div className="pt-2 flex flex-col items-center justify-center space-y-3">
              <button
                type="button"
                onClick={handleStartScan}
                className="btn-press group relative w-full sm:w-auto min-w-[280px] overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 px-6 py-3.5 text-center font-bold text-coal shadow-[0_10px_28px_-8px_rgba(16,185,129,0.7)] transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <div className="flex items-center justify-center gap-2 text-sm sm:text-base font-extrabold text-coal">
                  <Sparkles className="size-5 animate-spin-slow" />
                  <span>Pindai Energi Anda Hari Ini</span>
                </div>
              </button>
              <p className="text-[11px] text-faint text-center max-w-md">
                Kamera memproses foto mikro-ekspresi wajah secara aman ke server Gemini AI tanpa menyimpan foto ke penyimpanan publik.
              </p>
            </div>
          )}

          {/* ----------------- STATE 2: SCANNING (THEATRICAL) ----------------- */}
          {scannerState === "scanning" && (
            <div className="pt-2 flex flex-col items-center justify-center space-y-3">
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5">
                <RefreshCw className="size-4 animate-spin text-emerald-400" />
                <motion.span
                  key={phraseIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="font-bold text-xs sm:text-sm text-emerald-300 font-mono"
                >
                  {SCANNING_PHRASES[phraseIndex]}
                </motion.span>
              </div>

              {/* Bar animasi progress mikro */}
              <div className="w-48 h-1 rounded-full bg-emerald-950 overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-400 rounded-full"
                  animate={{
                    x: ["-100%", "100%"],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.2,
                    ease: "easeInOut",
                  }}
                />
              </div>
            </div>
          )}

          {/* ------------- STATE 3: RESULT & REKOMENDASI MENU ------------- */}
          {scannerState === "result" && result && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
              className="space-y-4 pt-1"
            >
              {/* DIAGNOSIS CARD DARI GEMINI */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5 relative overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <MoodBadge mood={result.mood_tag} />
                  </div>
                  <span className="text-[10px] text-faint uppercase font-bold tracking-wider">
                    Hasil Diagnosa Holistik
                  </span>
                </div>

                <div className="mt-3 text-xs sm:text-sm text-cream font-medium leading-relaxed italic border-l-2 border-emerald-500/50 pl-3 py-0.5">
                  “{result.diagnosis_text}”
                </div>
              </div>

              {/* REKOMENDASI MENU BERDASARKAN MOOD */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs sm:text-sm font-bold text-sand flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-brand" />
                    <span>Menu Rekomendasi Pemulih Energi:</span>
                  </h3>
                  <span className="text-[11px] text-faint">
                    {recommendedProducts.length} menu cocok
                  </span>
                </div>

                {/* GRID 2-3 KARTU MENU */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {recommendedProducts.map((p) => {
                    const Icon = productIcon(p.icon);
                    const isAdded = addedIds.includes(p.id);

                    return (
                      <div
                        key={p.id}
                        className="group relative flex flex-col justify-between rounded-2xl border border-line bg-panel p-3 transition-all hover:border-brand/40 hover:bg-panel-2"
                      >
                        <div>
                          <div className="flex items-center gap-2.5 mb-2">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="size-10 rounded-xl object-cover border border-line-2 bg-coal shrink-0"
                              />
                            ) : (
                              <div
                                className="grid size-10 place-items-center rounded-xl border border-line bg-coal shrink-0"
                                style={{ color: p.color }}
                              >
                                <Icon className="size-5" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-cream truncate">
                                {p.name}
                              </h4>
                              <p className="text-[10px] text-faint truncate">
                                {p.tagline || "Menu Pilihan"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-1 mb-2.5">
                            <span className="text-xs font-bold text-brand font-display">
                              {formatIDR(p.price)}
                            </span>
                            <span className="text-[9px] font-semibold rounded px-1.5 py-0.5 bg-brand/10 text-brand border border-brand/20 capitalize">
                              {p.aiMood || result.mood_tag}
                            </span>
                          </div>
                        </div>

                        {/* TOMBOL MASUKKAN KE KERANJANG KASIR */}
                        <button
                          type="button"
                          onClick={() => handleAddProduct(p)}
                          className={`btn-press w-full rounded-xl py-2 px-2.5 flex items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                            isAdded
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-brand text-coal hover:brightness-105 active:scale-95 shadow-sm"
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Check className="size-3.5 stroke-[2.5]" />
                              <span>Ditambahkan</span>
                            </>
                          ) : (
                            <>
                              <Plus className="size-3.5 stroke-[2.5]" />
                              <span>+ Keranjang</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ACTION FOOTER DI STATE 3 */}
              <div className="flex items-center justify-between pt-2 border-t border-line/70">
                <button
                  type="button"
                  onClick={handleResetScan}
                  className="btn-press flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-xs font-bold text-sand hover:text-cream hover:bg-panel transition"
                >
                  <RefreshCw className="size-3.5" />
                  <span>Pindai Ulang</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="btn-press rounded-xl bg-panel-2 border border-line-2 px-4 py-2 text-xs font-bold text-cream hover:bg-coal transition"
                >
                  Selesai &amp; Lanjut Transaksi
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Komponen Badge Indikator Mood/Energi
 */
function MoodBadge({ mood }: { mood: MoodTag }) {
  switch (mood) {
    case "tegang":
      return (
        <div className="flex items-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-amber-300">
          <Heart className="size-4 animate-pulse" />
          <span className="text-xs font-bold tracking-wide">
            Kondisi: TEGANG (Perlu Relaksasi Otot)
          </span>
        </div>
      );
    case "cemas":
      return (
        <div className="flex items-center gap-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 px-3 py-1.5 text-purple-300">
          <Wind className="size-4" />
          <span className="text-xs font-bold tracking-wide">
            Kondisi: CEMAS (Perlu Penenang Napas)
          </span>
        </div>
      );
    case "lelah":
      return (
        <div className="flex items-center gap-1.5 rounded-xl bg-orange-500/15 border border-orange-500/30 px-3 py-1.5 text-orange-300">
          <Zap className="size-4" />
          <span className="text-xs font-bold tracking-wide">
            Kondisi: LELAH (Perlu Pemulih Energi)
          </span>
        </div>
      );
    case "optimal":
    default:
      return (
        <div className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-emerald-300">
          <Smile className="size-4" />
          <span className="text-xs font-bold tracking-wide">
            Kondisi: OPTIMAL (Energi Seimbang &amp; Positif)
          </span>
        </div>
      );
  }
}
