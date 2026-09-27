"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCcw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root Error Boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-coal text-cream">
      <div className="max-w-md w-full rounded-3xl border border-line bg-panel p-6 sm:p-8 text-center space-y-5 shadow-2xl">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-red-400/40 bg-red-400/10 text-red-400 shadow-[0_0_30px_-5px_rgba(244,63,94,0.3)]">
          <AlertCircle className="size-7" />
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-cream">
            Terjadi Kesalahan Aplikasi
          </h2>
          <p className="text-xs sm:text-sm text-sand leading-relaxed">
            Aplikasi mengalami kendala teknis sementara. Tekan tombol muat ulang untuk melanjutkan sesi kasir Anda.
          </p>
          {error?.message && (
            <p className="text-[11px] text-faint font-mono bg-coal/80 p-2.5 rounded-xl border border-line mt-2 break-words text-left">
              {error.message}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => {
              reset();
              window.location.reload();
            }}
            className="btn-press w-full sm:w-auto flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs sm:text-sm font-bold text-coal shadow-md shadow-brand/20 hover:brightness-110"
          >
            <RefreshCcw className="size-4" />
            <span>Muat Ulang Halaman</span>
          </button>

          <Link
            href="/"
            className="btn-press w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-line bg-coal px-4 py-2.5 text-xs sm:text-sm font-semibold text-sand hover:text-cream"
          >
            <Home className="size-4" />
            <span>Beranda</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
