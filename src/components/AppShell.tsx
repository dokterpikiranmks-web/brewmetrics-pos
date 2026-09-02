"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Coffee, MonitorSmartphone, Boxes, ChartSpline, LogOut, Loader2, CircleUserRound,
} from "lucide-react";
import { NAV_TABS, ROLE_ACCENT, ROLE_LABEL } from "@/lib/nav";
import type { SessionUser } from "@/lib/types";
import { formatDateID } from "@/lib/format";

const TAB_ICONS = { MonitorSmartphone, Boxes, ChartSpline };

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="text-faint text-xs">—</span>;
  return (
    <div className="text-right leading-tight hidden sm:block">
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
        if (!allowedRoles.includes(d.user.role)) {
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
  }, []);

  const tabs = useMemo(() => (user ? NAV_TABS.filter((t) => t.roles.includes(user.role)) : []), [user]);

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
      <header className="sticky top-0 z-40 border-b border-line bg-coal-2/85 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 lg:px-6 h-[68px]">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="grid size-9 place-items-center rounded-xl bg-brand text-coal shadow-[0_0_28px_-8px] shadow-brand/70">
              <Coffee className="size-5" strokeWidth={2.5} />
            </div>
            <div className="leading-none hidden md:block">
              <p className="font-display text-[15px] font-bold tracking-tight">
                BrewMetrics<span className="text-brand">.</span>
              </p>
              <p className="text-[9px] uppercase tracking-[0.24em] text-faint mt-0.5">POS &amp; Analytics</p>
            </div>
          </Link>

          <nav className="flex items-center gap-1.5 mx-auto">
            {tabs.map((tab) => {
              const Icon = TAB_ICONS[tab.icon];
              const active = pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`relative flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold transition-colors ${
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
                  <Icon className="size-4 relative z-10" strokeWidth={2.2} />
                  <span className="relative z-10 hidden sm:inline">{tab.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <LiveClock />
            <div className="h-8 w-px bg-line hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-full border border-line-2 bg-panel">
                <CircleUserRound className="size-5 text-brand" strokeWidth={1.8} />
              </div>
              <div className="leading-tight hidden lg:block">
                <p className="text-[13px] font-semibold text-cream">{user.name}</p>
                <span className={`inline-block mt-0.5 rounded-full border px-1.5 py-px text-[9px] font-bold uppercase tracking-wider ${ROLE_ACCENT[user.role]}`}>
                  {ROLE_LABEL[user.role]}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              title="Keluar / ganti shift"
              className="btn-press grid size-9 place-items-center rounded-xl border border-line bg-panel text-faint hover:text-red-400 hover:border-red-400/30"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

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
