"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useBranch } from "@/context/BranchContext";
import { Building2, ChevronDown, Check, Store, Coffee, UtensilsCrossed, Sparkles, Lock } from "lucide-react";
import type { SessionUser, BranchId } from "@/lib/types";
import { BRANCH_ENTITIES } from "@/lib/types";

const BRANCH_ICONS: Record<BranchId, typeof Coffee> = {
  KOPI_ASO: Coffee,
  NASI_KEBULI: UtensilsCrossed,
  BUCIN_UNCLE: Sparkles,
};

export function BranchSwitcher({ user }: { user: SessionUser }) {
  const { currentBranch, currentBranchEntity, setCurrentBranch, setActiveOutletId } = useBranch();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Staf non-owner dengan otorisasi cabang tunggal tidak dapat beralih cabang
  const isSingleBranch =
    user.role !== "owner" &&
    Boolean(user.authorizedBranch) &&
    user.authorizedBranch !== "ALL";

  // Pastikan cabang sinkron dengan izin staf saat dimuat
  useEffect(() => {
    if (isSingleBranch && user.authorizedBranch && currentBranch !== user.authorizedBranch) {
      setCurrentBranch(user.authorizedBranch as BranchId);
    }
  }, [isSingleBranch, user.authorizedBranch, currentBranch, setCurrentBranch]);

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

  const Icon = BRANCH_ICONS[currentBranch] ?? Store;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        disabled={Boolean(isSingleBranch)}
        onClick={() => !isSingleBranch && setOpen((prev) => !prev)}
        className={`flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-line-2 bg-panel text-xs font-semibold text-cream transition-all shadow-sm group ${
          isSingleBranch
            ? "cursor-default opacity-90"
            : "hover:bg-panel-2 hover:border-brand/40"
        }`}
        title={
          isSingleBranch
            ? `Otorisasi Terkunci: ${currentBranchEntity.name}`
            : "Ganti Cabang / Entitas Bisnis"
        }
      >
        <Icon className="size-3.5 sm:size-4 text-brand group-hover:scale-105 transition-transform" />
        <span className="truncate max-w-[110px] sm:max-w-[150px] font-bold">
          {currentBranchEntity.name}
        </span>
        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-brand/10 text-brand border border-brand/20 hidden sm:inline-block">
          {currentBranchEntity.code}
        </span>
        {isSingleBranch ? (
          <span title="Akses terkunci pada cabang ini">
            <Lock className="size-3 text-amber-400/80 shrink-0" />
          </span>
        ) : (
          <ChevronDown
            className={`size-3 text-faint group-hover:text-sand transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {open && (
        <div className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-72 rounded-2xl border border-line-2 bg-panel-solid/95 backdrop-blur-xl p-2 shadow-2xl z-50 animate-in fade-in-0 zoom-in-95">
          <div className="px-2.5 py-2 border-b border-line mb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand">
              Multi-Tenant Entitas Bisnis
            </p>
            <p className="text-[11px] text-faint truncate">
              Katalog, Bahan Baku, HPP &amp; Promo terisolasi
            </p>
          </div>

          <div className="space-y-1">
            {BRANCH_ENTITIES.map((ent) => {
              const isSelected = currentBranch === ent.id;
              const ItemIcon = BRANCH_ICONS[ent.id] ?? Store;
              return (
                <button
                  key={ent.id}
                  type="button"
                  onClick={() => {
                    startTransition(() => {
                      setCurrentBranch(ent.id);
                      setActiveOutletId(ent.outletId);
                      setOpen(false);
                    });
                  }}
                  className={`w-full flex items-center justify-between gap-2.5 p-2.5 rounded-xl text-xs font-medium transition-colors text-left ${
                    isSelected
                      ? "bg-brand text-coal font-bold shadow-sm"
                      : "text-sand hover:text-cream hover:bg-panel-2"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div
                      className={`grid size-8 place-items-center rounded-lg border shrink-0 ${
                        isSelected
                          ? "border-coal/20 bg-coal/10 text-coal"
                          : "border-line bg-panel text-brand"
                      }`}
                    >
                      <ItemIcon className="size-4" />
                    </div>
                    <div className="truncate">
                      <p className="truncate font-bold leading-tight">{ent.name}</p>
                      <p
                        className={`text-[10px] truncate mt-0.5 ${
                          isSelected ? "text-coal/80 font-medium" : "text-faint"
                        }`}
                      >
                        {ent.subtitle}
                      </p>
                    </div>
                  </div>
                  {isSelected && <Check className="size-4 shrink-0" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
