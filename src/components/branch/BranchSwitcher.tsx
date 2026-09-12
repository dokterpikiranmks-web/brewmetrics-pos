"use client";

import { useState, useRef, useEffect } from "react";
import { useBranch } from "@/context/BranchContext";
import { Building2, ChevronDown, Check, Store } from "lucide-react";
import type { SessionUser } from "@/lib/types";

export function BranchSwitcher({ user }: { user: SessionUser }) {
  const { outlets, activeOutletId, setActiveOutletId, activeOutlet } = useBranch();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isOwnerOrManager = user.role === "owner" || user.role === "manager";

  // Cashier is locked to their assigned outlet
  if (!isOwnerOrManager) {
    const branchLabel = user.outletName || activeOutlet?.name || "Cabang Kasir";
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-line bg-panel text-xs text-sand font-medium shadow-sm">
        <Store className="size-3.5 text-brand shrink-0" />
        <span className="truncate max-w-[120px] sm:max-w-[160px] text-cream font-semibold">
          {branchLabel}
        </span>
      </div>
    );
  }

  const currentLabel =
    activeOutletId === "all"
      ? "Semua Cabang"
      : activeOutlet?.name || `Cabang #${activeOutletId}`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-line-2 bg-panel hover:bg-panel-2 hover:border-brand/40 text-xs font-semibold text-cream transition-all shadow-sm group"
        title="Pilih Cabang / Outlet"
      >
        <Building2 className="size-3.5 sm:size-4 text-brand group-hover:scale-105 transition-transform" />
        <span className="truncate max-w-[110px] sm:max-w-[150px]">{currentLabel}</span>
        <ChevronDown
          className={`size-3 text-faint group-hover:text-sand transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-64 rounded-2xl border border-line-2 bg-panel-solid/95 backdrop-blur-xl p-1.5 shadow-2xl z-50 animate-in fade-in-0 zoom-in-95">
          <div className="px-2.5 py-2 border-b border-line mb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-faint">
              Pilih Filter Outlet
            </p>
            <p className="text-[11px] text-sand truncate">
              Analitik &amp; Laporan akan disesuaikan
            </p>
          </div>

          <div className="space-y-0.5 max-h-60 overflow-y-auto custom-scroll">
            <button
              type="button"
              onClick={() => {
                setActiveOutletId("all");
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeOutletId === "all"
                  ? "bg-brand text-coal font-bold shadow-sm"
                  : "text-sand hover:text-cream hover:bg-panel-2"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Building2 className="size-3.5 shrink-0" />
                <span className="truncate">Semua Cabang (Konsolidasi)</span>
              </div>
              {activeOutletId === "all" && <Check className="size-3.5 shrink-0" strokeWidth={3} />}
            </button>

            {outlets.map((outlet) => {
              const isSelected = activeOutletId === outlet.id;
              return (
                <button
                  key={outlet.id}
                  type="button"
                  onClick={() => {
                    setActiveOutletId(outlet.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                    isSelected
                      ? "bg-brand text-coal font-bold shadow-sm"
                      : "text-sand hover:text-cream hover:bg-panel-2"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Store className="size-3.5 shrink-0 text-brand" />
                    <div className="truncate">
                      <p className="truncate font-semibold">{outlet.name}</p>
                      <p
                        className={`text-[10px] truncate ${
                          isSelected ? "text-coal/80" : "text-faint"
                        }`}
                      >
                        {outlet.code} • {outlet.address || "Tanpa alamat"}
                      </p>
                    </div>
                  </div>
                  {isSelected && <Check className="size-3.5 shrink-0" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
