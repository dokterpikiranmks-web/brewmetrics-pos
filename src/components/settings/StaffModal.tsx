"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Check, UserPlus, KeyRound, ShieldCheck, CircleUserRound,
  Crown, Delete, Eye, EyeOff, AlertCircle, Loader2, Lock,
} from "lucide-react";
import type { StaffUserDto, Role } from "@/lib/types";

interface StaffModalProps {
  open: boolean;
  initialData?: StaffUserDto | null;
  currentUserId?: number;
  onClose: () => void;
  onSave: (payload: {
    id?: number;
    name: string;
    role: Role;
    pin?: string;
    active?: boolean;
  }) => Promise<{ error?: string } | void>;
}

const ROLES_INFO: {
  role: Role;
  title: string;
  desc: string;
  icon: typeof CircleUserRound;
  badgeClass: string;
}[] = [
  {
    role: "cashier",
    title: "Kasir",
    desc: "Akses terminal POS, pencatatan pesanan, & pembayaran.",
    icon: CircleUserRound,
    badgeClass: "border-brand-2/30 bg-brand-2/10 text-brand-2",
  },
  {
    role: "manager",
    title: "Manajer",
    desc: "Akses POS, Manajemen Bahan Baku (Inventory), & Resep BOM.",
    icon: ShieldCheck,
    badgeClass: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  },
  {
    role: "owner",
    title: "Owner",
    desc: "Akses Penuh: Finansial, Analitik, & Pendaftaran Staf/PIN.",
    icon: Crown,
    badgeClass: "border-brand/40 bg-brand/15 text-brand",
  },
];

const KEYPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function StaffModal({
  open,
  initialData,
  currentUserId,
  onClose,
  onSave,
}: StaffModalProps) {
  const isEdit = Boolean(initialData);

  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("cashier");
  const [active, setActive] = useState(true);

  // PIN State
  const [pin, setPin] = useState("");
  const [resetPinMode, setResetPinMode] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Submission & Error State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.name);
        setRole(initialData.role);
        setActive(initialData.active);
        setPin("");
        setResetPinMode(false);
      } else {
        setName("");
        setRole("cashier");
        setActive(true);
        setPin("");
        setResetPinMode(true);
      }
      setShowPin(false);
      setError(null);
      setSubmitting(false);
    }
  }, [open, initialData]);

  // Touchscreen Virtual Keypad Handlers
  const handlePressDigit = useCallback((digit: string) => {
    setPin((prev) => {
      if (prev.length >= 4) return prev;
      return prev + digit;
    });
    setError(null);
  }, []);

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  }, []);

  const handleClearPin = useCallback(() => {
    setPin("");
    setError(null);
  }, []);

  // Dukungan Keyboard Fisik saat modal terbuka
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") {
        // Biarkan input nama bekerja normal
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        if (!isEdit || resetPinMode) {
          handlePressDigit(e.key);
        }
      } else if (e.key === "Backspace") {
        if (!isEdit || resetPinMode) {
          handleBackspace();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isEdit, resetPinMode, handlePressDigit, handleBackspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      setError("Nama staf minimal 2 karakter.");
      return;
    }

    if (!isEdit || resetPinMode) {
      if (!/^\d{4}$/.test(pin)) {
        setError("PIN wajib terdiri dari 4 digit angka numerik.");
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    const payload: {
      id?: number;
      name: string;
      role: Role;
      pin?: string;
      active?: boolean;
    } = {
      id: initialData?.id,
      name: cleanName,
      role,
      active,
    };

    if (!isEdit || (resetPinMode && pin.length === 4)) {
      payload.pin = pin;
    }

    const res = await onSave(payload);
    if (res?.error) {
      setError(res.error);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-coal/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="w-full max-w-xl rounded-3xl border border-line-2 bg-panel shadow-[0_28px_64px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden my-auto"
          >
            {/* =================================================================
                HEADER
               ================================================================= */}
            <div className="flex items-center justify-between border-b border-line px-5 sm:px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-2xl bg-brand/15 text-brand border border-brand/30">
                  {isEdit ? <ShieldCheck className="size-5" /> : <UserPlus className="size-5" />}
                </div>
                <div>
                  <h2 className="font-display text-base sm:text-lg font-bold text-cream">
                    {isEdit ? "Edit Akun & Hak Akses Staf" : "Daftarkan Staf Baru"}
                  </h2>
                  <p className="text-xs text-faint">
                    {isEdit
                      ? "Perbarui nama, peran, status, atau reset 4 digit PIN."
                      : "Buat akun login kasir, manajer, atau owner baru."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="btn-press grid size-9 place-items-center rounded-xl border border-line bg-coal text-faint hover:text-cream"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* =================================================================
                FORM CONTENT
               ================================================================= */}
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[80dvh]">
              {/* Error Alert */}
              {error && (
                <div className="flex items-center gap-2.5 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-xs font-semibold text-red-300">
                  <AlertCircle className="size-4 text-red-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* FIELD 1: NAMA STAF */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-sand mb-1.5">
                  Nama Lengkap Staf <span className="text-brand">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="cth: Bagas Pratama, Sinta Maharani"
                  className="input-dark text-sm w-full py-2.5"
                  autoFocus
                  required
                />
              </div>

              {/* FIELD 2: PERAN / ROLE SELECTOR (TOUCH-FRIENDLY BUTTONS) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-sand mb-2">
                  Pilih Hak Akses &amp; Peran <span className="text-brand">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {ROLES_INFO.map((item) => {
                    const isSelected = role === item.role;
                    const IconComp = item.icon;
                    return (
                      <button
                        key={item.role}
                        type="button"
                        onClick={() => setRole(item.role)}
                        className={`btn-press relative flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? "border-brand bg-brand/10 shadow-[0_0_20px_-8px] shadow-brand/50 ring-1 ring-brand"
                            : "border-line bg-coal hover:border-line-2 hover:bg-panel-2"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1.5">
                          <div className={`grid size-7 place-items-center rounded-xl ${item.badgeClass}`}>
                            <IconComp className="size-3.5" />
                          </div>
                          {isSelected && (
                            <span className="size-2 rounded-full bg-brand animate-pulse" />
                          )}
                        </div>
                        <p className={`font-display text-xs font-bold ${isSelected ? "text-brand" : "text-cream"}`}>
                          {item.title}
                        </p>
                        <p className="text-[10px] text-faint leading-tight mt-0.5">
                          {item.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* FIELD 3: STATUS AKTIF (KHUSUS MODE EDIT) */}
              {isEdit && (
                <div className="flex items-center justify-between rounded-2xl border border-line bg-coal p-3.5">
                  <div>
                    <p className="font-display text-xs font-bold text-cream">Status Akun Staf</p>
                    <p className="text-[11px] text-faint">
                      {active
                        ? "Aktif — Staf dapat masuk ke terminal POS menggunakan PIN."
                        : "Nonaktif — Akses login staf ini ditutup sementara."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActive(!active)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      active ? "bg-emerald-500" : "bg-line-2"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block size-5 transform rounded-full bg-cream shadow ring-0 transition duration-200 ease-in-out ${
                        active ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* FIELD 4: 4-DIGIT PIN ENTRY DENGAN NUMPAD LAYAR SENTUH */}
              <div className="rounded-2xl border border-line bg-coal/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-4 text-brand" />
                    <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-sand">
                      PIN Masuk POS (4 Digit Numerik)
                    </label>
                  </div>

                  {isEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setResetPinMode(!resetPinMode);
                        setPin("");
                      }}
                      className="text-xs text-brand hover:underline font-semibold"
                    >
                      {resetPinMode ? "Batal Reset PIN" : "Ganti / Reset PIN"}
                    </button>
                  )}
                </div>

                {isEdit && !resetPinMode ? (
                  <div className="flex items-center gap-2.5 rounded-xl border border-line bg-panel p-3 text-xs text-sand">
                    <Lock className="size-4 text-emerald-400 shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-cream">PIN tersimpan aman</p>
                      <p className="text-[11px] text-faint">
                        Klik &quot;Ganti / Reset PIN&quot; jika ingin memberikan PIN baru untuk staf ini.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* PIN Display Boxes */}
                    <div className="flex items-center justify-center gap-3 py-1">
                      {[0, 1, 2, 3].map((idx) => {
                        const char = pin[idx];
                        const isFilled = Boolean(char);
                        return (
                          <div
                            key={idx}
                            className={`grid size-12 sm:size-14 place-items-center rounded-2xl border-2 transition-all font-display text-lg sm:text-xl font-bold ${
                              isFilled
                                ? "border-brand bg-brand/15 text-brand shadow-[0_0_16px_-4px] shadow-brand/40 scale-105"
                                : "border-line bg-panel text-faint"
                            }`}
                          >
                            {isFilled ? (showPin ? char : "●") : "—"}
                          </div>
                        );
                      })}

                      {/* Toggle View PIN */}
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="btn-press grid size-10 place-items-center rounded-xl border border-line bg-panel text-faint hover:text-cream ml-1"
                        title={showPin ? "Sembunyikan digit PIN" : "Tampilkan digit PIN"}
                      >
                        {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>

                    <p className="text-center text-[10px] text-faint">
                      Sentuh tombol angka di bawah atau ketik langsung melalui keyboard
                    </p>

                    {/* VIRTUAL TOUCH KEYPAD (3x4) */}
                    <div className="max-w-[280px] mx-auto grid grid-cols-3 gap-2 pt-1">
                      {KEYPAD_DIGITS.map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handlePressDigit(num)}
                          disabled={pin.length >= 4}
                          className="btn-press h-12 rounded-xl border border-line-2 bg-panel font-display text-lg font-bold text-cream hover:bg-panel-2 hover:border-brand/40 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={handleClearPin}
                        disabled={pin.length === 0}
                        className="btn-press h-12 rounded-xl border border-line bg-coal font-display text-xs font-bold text-faint hover:text-red-300 hover:border-red-400/40 active:scale-95 disabled:opacity-30 transition-all"
                      >
                        CLEAR
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePressDigit("0")}
                        disabled={pin.length >= 4}
                        className="btn-press h-12 rounded-xl border border-line-2 bg-panel font-display text-lg font-bold text-cream hover:bg-panel-2 hover:border-brand/40 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={handleBackspace}
                        disabled={pin.length === 0}
                        className="btn-press h-12 rounded-xl border border-line bg-coal font-display text-xs font-bold text-faint hover:text-cream hover:border-line-2 active:scale-95 disabled:opacity-30 grid place-items-center transition-all"
                      >
                        <Delete className="size-4 text-sand" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ===============================================================
                  MODAL FOOTER (SUBMIT / CANCEL)
                 =============================================================== */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="btn-press rounded-xl border border-line bg-coal px-4 py-2.5 text-xs font-semibold text-sand hover:text-cream"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-press rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-coal hover:bg-brand-light shadow-lg shadow-brand/25 flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="size-4" strokeWidth={2.5} />
                      <span>{isEdit ? "Simpan Perubahan" : "Daftarkan Staf"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
