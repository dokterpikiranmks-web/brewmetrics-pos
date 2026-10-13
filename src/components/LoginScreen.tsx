"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Coffee, Delete, Zap, Boxes, BrainCircuit, Fingerprint, Loader2,
  TrendingUp, Wifi, BadgeCheck, Camera, Building2, Store, Check, ArrowRight, UtensilsCrossed, Sparkles,
} from "lucide-react";
import { HOME_BY_ROLE } from "@/lib/nav";
import type { SessionUser } from "@/lib/types";
import { SelfieAttendanceModal } from "@/components/attendance/SelfieAttendanceModal";
import Logo from "@/components/Logo";

import { BRANCH_ENTITIES, type BranchId } from "@/lib/types";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function LoginScreen() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [userName, setUserName] = useState("");
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<SessionUser | null>(null);
  const [branchModalOpen, setBranchModalOpen] = useState(false);

  const handleSelectBranch = useCallback((branchId: BranchId) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("current_branch", branchId);
      window.dispatchEvent(new CustomEvent("bm-branch-change", { detail: { branch: branchId } }));
    }
    setBranchModalOpen(false);
    if (loggedInUser) {
      router.push(HOME_BY_ROLE[loggedInUser.role]);
    } else {
      router.push("/pos");
    }
  }, [loggedInUser, router]);

  const submit = useCallback(
    async (value: string) => {
      setStatus("loading");
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: value }),
        });
        const data = (await res.json()) as { user?: SessionUser; error?: string };
        if (!res.ok || !data.user) {
          setStatus("error");
          setErrorMsg(data.error ?? "PIN salah.");
          setTimeout(() => {
            setPin("");
            setStatus("idle");
          }, 650);
          return;
        }
        setStatus("success");
        setUserName(data.user.name);
        setLoggedInUser(data.user);

        // RBAC: JIKA staf hanya berhak mengakses 1 cabang, skip modal "Pilih Cabang" dan langsung arahkan.
        // JIKA staf adalah Owner / akses semua ("ALL"), barulah modal "Pilih Cabang" dimunculkan.
        const authBranch = data.user.authorizedBranch;
        const isOwner = data.user.role === "owner" || authBranch === "ALL" || !authBranch;

        if (!isOwner && authBranch && authBranch !== "ALL") {
          setTimeout(() => {
            handleSelectBranch(authBranch as BranchId);
          }, 400);
        } else {
          setTimeout(() => {
            setBranchModalOpen(true);
          }, 500);
        }
      } catch {
        setStatus("error");
        setErrorMsg("Tidak dapat terhubung ke server.");
        setTimeout(() => {
          setPin("");
          setStatus("idle");
        }, 650);
      }
    },
    [handleSelectBranch]
  );

  const pushDigit = useCallback(
    (d: string) => {
      if (status === "loading" || status === "success") return;
      setPin((prev) => {
        if (prev.length >= 4) return prev;
        const next = prev + d;
        if (next.length === 4) setTimeout(() => submit(next), 120);
        return next;
      });
    },
    [status, submit]
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user: SessionUser | null }) => {
        if (d.user) {
          router.replace(HOME_BY_ROLE[d.user.role]);
        }
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) pushDigit(e.key);
      if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pushDigit]);

  const padState = useMemo(() => ({ pin, status }), [pin, status]);

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.15fr_1fr]">
      {/* ------------------------------ HERO PANEL ------------------------------ */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 grain">
        <Image
          src="/images/login-hero.jpg"
          alt="DOI TA POS"
          fill
          priority
          className="object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-coal/70 via-coal/35 to-coal" />
        <div className="absolute inset-0 bg-gradient-to-t from-coal via-transparent to-coal/60" />

        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative flex items-center gap-3"
        >
          <Logo size="md" showText subtitle="Smart POS & Management" />
        </motion.div>

        <div className="relative max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-xs font-semibold text-brand mb-6"
          >
            <BadgeCheck className="size-3.5" />
            Lisensi Jual Putus — Tanpa Biaya Bulanan
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-display text-5xl xl:text-6xl font-bold leading-[1.04] tracking-tight text-cream"
          >
            Setiap tetes bahan,
            <br />
            <span className="text-brand text-glow">tersync ke rupiah.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="mt-5 text-sand text-[15px] leading-relaxed max-w-md"
          >
            POS tablet super cepat yang otomatis memotong stok biji kopi, susu, dan sirup
            per gram/ml setiap gelas terjual — lengkap dengan prediksi kehabisan stok berbasis AI.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
            className="mt-9 grid grid-cols-3 gap-3 max-w-lg"
          >
            {[
              { icon: Zap, label: "Fast-Tap POS", desc: "Checkout < 20 detik" },
              { icon: Boxes, label: "Recipe-Based", desc: "Stok presisi gram/ml" },
              { icon: BrainCircuit, label: "AI Forecast", desc: "Alert sebelum habis" },
            ].map((f) => (
              <div key={f.label} className="rounded-2xl border border-line bg-panel/70 backdrop-blur px-4 py-4">
                <f.icon className="size-5 text-brand mb-2.5" />
                <p className="text-[13px] font-semibold text-cream">{f.label}</p>
                <p className="text-[11px] text-faint mt-0.5">{f.desc}</p>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="relative flex items-center gap-6 text-[11px] text-faint"
        >
          <span className="flex items-center gap-1.5"><TrendingUp className="size-3.5 text-brand" /> Real-time owner dashboard</span>
          <span className="flex items-center gap-1.5"><Wifi className="size-3.5 text-brand" /> Offline tolerance sync</span>
          <span className="tabular font-display text-sand ml-auto text-xs">EST. 2026 — KOTA KASIH KOPI</span>
        </motion.div>
      </div>

      {/* ------------------------------ LOGIN PANEL ----------------------------- */}
      <div className="relative flex flex-col items-center justify-center px-6 py-10 bg-coal-2 overflow-hidden">
        <div className="absolute -top-40 right-[-120px] size-[420px] rounded-full bg-brand/10 blur-[120px]" />
        <div className="absolute bottom-[-160px] left-[-120px] size-[380px] rounded-full bg-brand-2/8 blur-[110px]" />

        {/* Mobile brand */}
        <div className="lg:hidden flex items-center mb-8 relative">
          <Logo size="sm" showText subtitle="Smart POS" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
          className="relative w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div className="inline-grid place-items-center size-14 rounded-2xl border border-line bg-panel mb-4">
              <Fingerprint className="size-7 text-brand" strokeWidth={1.8} />
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Masuk Shift</h2>
            <p className="text-sand text-sm mt-1.5">Ketuk PIN 4 digit untuk membuka terminal</p>
          </div>

          {/* PIN dots */}
          <motion.div
            animate={padState.status === "error" ? { x: [0, -12, 12, -8, 8, -3, 0] } : { x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center gap-4 mb-8"
          >
            {[0, 1, 2, 3].map((i) => {
              const filled = padState.pin.length > i;
              return (
                <div
                  key={i}
                  className={`size-4 rounded-full border-2 transition-all duration-150 ${
                    padState.status === "error"
                      ? "border-red-400 bg-red-400/80 shadow-[0_0_16px_-2px] shadow-red-400/60"
                      : padState.status === "success"
                        ? "border-emerald-400 bg-emerald-400 shadow-[0_0_16px_-2px] shadow-emerald-400/60"
                        : filled
                          ? "border-brand bg-brand shadow-[0_0_16px_-2px] shadow-brand/60 scale-110"
                          : "border-line-2 bg-transparent"
                  }`}
                />
              );
            })}
          </motion.div>

          <div className="h-6 text-center mb-2">
            <AnimatePresence mode="wait">
              {padState.status === "error" && (
                <motion.p key="err" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-red-400">
                  {errorMsg}
                </motion.p>
              )}
              {padState.status === "success" && (
                <motion.p key="ok" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-emerald-400">
                  Selamat bertugas, {userName}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {KEYS.map((k, i) => (
              <motion.button
                key={k}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.03 }}
                onClick={() => pushDigit(k)}
                disabled={status === "loading" || status === "success"}
                className="btn-press h-16 rounded-2xl border border-line bg-panel font-display text-2xl font-semibold text-cream hover:border-brand/40 hover:bg-panel-2 disabled:opacity-50"
              >
                {k}
              </motion.button>
            ))}
            <button
              onClick={() => setPin("")}
              className="btn-press h-16 rounded-2xl border border-transparent text-faint font-display text-sm font-semibold tracking-widest hover:text-red-400"
            >
              CLEAR
            </button>
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.46 }}
              onClick={() => pushDigit("0")}
              disabled={status === "loading" || status === "success"}
              className="btn-press h-16 rounded-2xl border border-line bg-panel font-display text-2xl font-semibold hover:border-brand/40 hover:bg-panel-2 disabled:opacity-50"
            >
              {status === "loading" ? <Loader2 className="size-6 animate-spin mx-auto text-brand" /> : "0"}
            </motion.button>
            <button
              onClick={() => setPin((p) => p.slice(0, -1))}
              className="btn-press h-16 grid place-items-center rounded-2xl border border-transparent text-faint hover:text-cream"
            >
              <Delete className="size-6" />
            </button>
          </div>

          {/* Tombol Absen Masuk / Pulang (Foto Wajah) */}
          <div className="pt-1 pb-1">
            <button
              type="button"
              onClick={() => setAttendanceModalOpen(true)}
              className="btn-press w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl border border-brand/30 bg-brand/10 hover:bg-brand/20 text-brand font-bold text-xs shadow-lg shadow-brand/10 transition-all group"
            >
              <Camera className="size-4 group-hover:scale-110 transition-transform" />
              <span>Absen Masuk / Pulang (Foto Wajah)</span>
            </button>
          </div>

          <p className="text-center text-[11px] text-faint mt-5">
            DOI TA v2.4 — build lisensi <span className="text-sand font-semibold">PERPETUAL</span>
          </p>

          <SelfieAttendanceModal
            isOpen={attendanceModalOpen}
            onClose={() => setAttendanceModalOpen(false)}
          />

          {/* ------------------------ MODAL SELECT BRANCH ------------------------ */}
          <AnimatePresence>
            {branchModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-coal/80 backdrop-blur-md">
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: 16 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="w-full max-w-md rounded-3xl border border-line-2 bg-panel-solid/95 p-6 shadow-2xl backdrop-blur-xl"
                >
                  <div className="text-center mb-6">
                    <div className="inline-grid place-items-center size-14 rounded-2xl border border-brand/40 bg-brand/10 mb-3 shadow-[0_0_24px_-4px] shadow-brand/30">
                      <Store className="size-7 text-brand" />
                    </div>
                    <h3 className="font-display text-2xl font-bold text-cream tracking-tight">
                      Pilih Cabang Operasional
                    </h3>
                    <p className="text-xs text-sand mt-1 max-w-xs mx-auto">
                      Pilih entitas bisnis yang aktif untuk shift kasir Anda. Data produk, resep HPP, dan promo akan diisolasi.
                    </p>
                  </div>

                  <div className="space-y-3 mb-6">
                    {BRANCH_ENTITIES.map((ent) => {
                      const isKopi = ent.id === "KOPI_ASO";
                      const isKebuli = ent.id === "NASI_KEBULI";
                      const Icon = isKopi ? Coffee : isKebuli ? UtensilsCrossed : Sparkles;
                      const accentColor = isKopi
                        ? "border-amber-500/40 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/15"
                        : isKebuli
                        ? "border-orange-500/40 hover:border-orange-500 bg-orange-500/5 hover:bg-orange-500/15"
                        : "border-red-500/40 hover:border-red-500 bg-red-500/5 hover:bg-red-500/15";
                      const badgeColor = isKopi
                        ? "text-amber-400 bg-amber-400/10 border-amber-400/30"
                        : isKebuli
                        ? "text-orange-400 bg-orange-400/10 border-orange-400/30"
                        : "text-red-400 bg-red-400/10 border-red-400/30";

                      return (
                        <button
                          key={ent.id}
                          type="button"
                          onClick={() => handleSelectBranch(ent.id)}
                          className={`btn-press w-full flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all text-left group ${accentColor}`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="grid size-12 place-items-center rounded-xl border border-line bg-panel shrink-0 group-hover:scale-105 transition-transform">
                              <Icon className="size-6 text-cream" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-display text-base font-bold text-cream truncate">
                                  {ent.name}
                                </h4>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                                  {ent.code}
                                </span>
                              </div>
                              <p className="text-[11px] text-faint truncate mt-0.5">
                                {ent.subtitle}
                              </p>
                            </div>
                          </div>
                          <div className="grid size-8 place-items-center rounded-xl bg-panel border border-line text-sand group-hover:text-cream group-hover:bg-brand group-hover:text-coal transition-colors shrink-0">
                            <ArrowRight className="size-4" />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-center text-[11px] text-faint">
                    Entitas bisnis dapat diganti sewaktu-waktu melalui tombol Switcher di pojok kanan atas.
                  </p>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
