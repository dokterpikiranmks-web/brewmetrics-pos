"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coffee,
  MonitorSmartphone,
  Boxes,
  ChartSpline,
  UtensilsCrossed,
  Settings,
  LogOut,
  Loader2,
  CircleUserRound,
  Menu,
  X,
} from "lucide-react";
import { NAV_TABS, ROLE_ACCENT, ROLE_LABEL } from "@/lib/nav";
import type { SessionUser } from "@/lib/types";
import { formatDateID } from "@/lib/format";

const TAB_ICONS = { MonitorSmartphone, Boxes, ChartSpline, UtensilsCrossed, Settings };

function LiveClock({ mobile = false }: { mobile?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) return <span className="text-faint text-xs">—</span>;

  if (mobile) {
    return (
      <span className="font-display text-xs font-semibold tabular text-sand">
        {now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  }

  return (
    <div className="text-right leading-tight hidden md:block">
      <p className="font-display text-sm font-semibold tabular text-cream">
        {now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>
      <p className="text-[10px] text-faint">{formatDateID(now)}</p>
    </div>
  );
}

export default function AppShell({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles: SessionUser["role"][];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user: SessionUser | null }) => {
        if (!alive) return;
        if (!d.user) {
          router.replace("/");
          return;
        }
        // Proteksi RBAC Client-Side: Jika cashier mencoba akses halaman terlarang, paksa redirect ke /pos
        if (
          d.user.role === "cashier" &&
          (pathname.startsWith("/inventory") ||
            pathname.startsWith("/analytics") ||
            pathname.startsWith("/settings") ||
            pathname.startsWith("/products"))
        ) {
          router.replace("/pos");
          return;
        }

        if (!allowedRoles.includes(d.user.role)) {
          if (d.user.role === "cashier") {
            router.replace("/pos");
            return;
          }
          const fallback = NAV_TABS.find((t) => t.roles.includes(d.user!.role));
          router.replace(fallback?.href ?? "/");
          return;
        }
        setUser(d.user);
        setChecking(false);
      })
      .catch(() => router.replace("/"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Saring navigasi sesuai role user
  const tabs = useMemo(() => {
    if (!user) return [];
    if (user.role === "cashier") {
      return NAV_TABS.filter((t) => t.href === "/pos");
    }
    return NAV_TABS.filter((t) => t.roles.includes(user.role));
  }, [user]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  };

  if (checking || !user) {
    return (
      <div className="min-h-dvh grid place-items-center bg-coal">
        <div className="flex flex-col items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-brand text-coal animate-pulse-soft">
            <Coffee className="size-7" strokeWidth={2.4} />
          </div>
          <Loader2 className="size-5 animate-spin text-faint" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-coal">
      {/* ---------------------------- MAIN HEADER ---------------------------- */}
      <header className="sticky top-0 z-40 border-b border-line bg-coal-2/90 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 lg:px-6 h-[58px] sm:h-[68px]">
          {/* Sisi Kiri: Logo Ringkas */}
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <div className="grid size-8 sm:size-9 place-items-center rounded-xl bg-brand text-coal shadow-[0_0_24px_-8px] shadow-brand/70">
              <Coffee className="size-4 sm:size-5" strokeWidth={2.5} />
            </div>
            <div className="leading-none">
              <p className="font-display text-[15px] font-bold tracking-tight text-cream">
                BrewMetrics<span className="text-brand">.</span>
              </p>
              <p className="text-[9px] uppercase tracking-[0.22em] text-faint mt-0.5 hidden sm:block">
                POS &amp; Analytics
              </p>
            </div>
          </Link>

          {/* Sisi Tengah: Tab Navigasi Desktop (HANYA tampil di layar >= md) */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-1.5 mx-auto">
            {tabs.map((tab) => {
              const Icon = TAB_ICONS[tab.icon];
              const active = pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`relative flex items-center gap-1.5 sm:gap-2 rounded-xl px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-[13px] font-semibold transition-colors ${
                    active ? "text-coal" : "text-sand hover:text-cream hover:bg-panel-2"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl bg-brand shadow-[0_10px_30px_-10px] shadow-brand/60"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <Icon className="size-3.5 sm:size-4 relative z-10" strokeWidth={2.2} />
                  <span className="relative z-10">{tab.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Sisi Kanan Desktop (>= md): Jam, Profil Lengkap, & Tombol Logout */}
          <div className="hidden md:flex items-center gap-2.5 sm:gap-3 shrink-0">
            <LiveClock />
            <div className="h-8 w-px bg-line" />
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 sm:size-9 place-items-center rounded-full border border-line-2 bg-panel">
                <CircleUserRound className="size-4 sm:size-5 text-brand" strokeWidth={1.8} />
              </div>
              <div className="leading-tight">
                <p className="text-[13px] font-semibold text-cream">{user.name}</p>
                <span className={`inline-block mt-0.5 rounded-full border px-1.5 py-px text-[9px] font-bold uppercase tracking-wider ${ROLE_ACCENT[user.role]}`}>
                  {ROLE_LABEL[user.role]}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              title="Keluar / ganti shift"
              className="btn-press grid size-8 sm:size-9 place-items-center rounded-xl border border-line bg-panel text-faint hover:text-red-400 hover:border-red-400/30"
            >
              <LogOut className="size-3.5 sm:size-4" />
            </button>
          </div>

          {/* Sisi Kanan Mobile (< md): Indikator Jam/Kasir Ringkas + Tombol Hamburger */}
          <div className="flex md:hidden items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-panel border border-line text-xs">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
              <span className="font-semibold text-cream truncate max-w-[80px]">
                {user.name.split(" ")[0]}
              </span>
              <span className="text-line-2">|</span>
              <LiveClock mobile />
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="btn-press grid size-8 place-items-center rounded-xl border border-line bg-panel text-sand hover:text-cream"
              aria-label="Buka Menu"
            >
              <Menu className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ---------------------- MOBILE NAVIGATION DRAWER ---------------------- */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex justify-end">
            {/* Backdrop Gelap */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-coal/80 backdrop-blur-sm"
            />

            {/* Slide-over Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="relative z-10 w-4/5 max-w-xs h-full bg-panel-2 border-l border-line-2 shadow-2xl flex flex-col justify-between p-5 overflow-y-auto"
            >
              <div>
                {/* Header Drawer */}
                <div className="flex items-center justify-between pb-4 border-b border-line mb-4">
                  <div className="flex items-center gap-2">
                    <div className="grid size-8 place-items-center rounded-xl bg-brand text-coal">
                      <Coffee className="size-4" strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="font-display text-sm font-bold text-cream">BrewMetrics</p>
                      <p className="text-[9px] uppercase tracking-widest text-faint">Navigasi Utama</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn-press grid size-8 place-items-center rounded-xl border border-line bg-coal text-faint hover:text-cream"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* Kartu Profil User */}
                <div className="p-3.5 rounded-2xl bg-coal border border-line mb-4 flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-full border border-line-2 bg-panel shrink-0">
                    <CircleUserRound className="size-5 text-brand" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-cream truncate">{user.name}</p>
                    <span className={`inline-block mt-0.5 rounded-full border px-2 py-0.2 text-[9px] font-bold uppercase tracking-wider ${ROLE_ACCENT[user.role]}`}>
                      {ROLE_LABEL[user.role]}
                    </span>
                  </div>
                </div>

                {/* List Tab Navigasi */}
                <div className="space-y-1.5">
                  {tabs.map((tab) => {
                    const Icon = TAB_ICONS[tab.icon];
                    const active = pathname.startsWith(tab.href);
                    return (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-xs font-bold transition-colors ${
                          active
                            ? "bg-brand text-coal shadow-sm"
                            : "text-sand hover:text-cream hover:bg-panel"
                        }`}
                      >
                        <Icon className="size-4 shrink-0" strokeWidth={2.2} />
                        <span>{tab.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Tombol Logout */}
              <div className="pt-4 border-t border-line mt-6">
                <button
                  type="button"
                  onClick={logout}
                  className="btn-press flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-red-400/10 py-3 text-xs font-bold text-red-300 hover:bg-red-400/20"
                >
                  <LogOut className="size-4" />
                  <span>Keluar / Ganti Shift</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 flex flex-col min-h-0"
      >
        {children}
      </motion.main>
    </div>
  );
}
