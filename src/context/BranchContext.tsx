"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { OutletDto, BranchId } from "@/lib/types";
import { BRANCH_ENTITIES, normalizeBranchId } from "@/lib/types";

interface BranchContextType {
  outlets: OutletDto[];
  activeOutletId: number | "all";
  activeOutlet: OutletDto | null;
  currentBranch: BranchId;
  currentBranchEntity: (typeof BRANCH_ENTITIES)[number];
  setCurrentBranch: (branch: BranchId) => void;
  isLoading: boolean;
  setActiveOutletId: (id: number | "all") => void;
  refreshOutlets: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

const OUTLET_STORAGE_KEY = "bm_active_outlet_id";
const BRANCH_STORAGE_KEY = "current_branch";

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [outlets, setOutlets] = useState<OutletDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeOutletId, setActiveOutletIdState] = useState<number | "all">("all");
  const [currentBranch, setCurrentBranchState] = useState<BranchId>("KOPI_ASO");

  const fetchOutlets = useCallback(async () => {
    try {
      const res = await fetch("/api/outlets?activeOnly=true");
      if (res.ok) {
        const data = await res.json();
        setOutlets(data.outlets || []);
      }
    } catch (err) {
      console.error("Failed to load outlets:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOutlets();

    // Restore current_branch from localStorage
    if (typeof window !== "undefined") {
      const savedBranch = localStorage.getItem(BRANCH_STORAGE_KEY);
      if (savedBranch) {
        setCurrentBranchState(normalizeBranchId(savedBranch));
      }

      const savedOutlet = localStorage.getItem(OUTLET_STORAGE_KEY);
      if (savedOutlet) {
        if (savedOutlet === "all") {
          setActiveOutletIdState("all");
        } else {
          const num = Number(savedOutlet);
          if (!isNaN(num)) {
            setActiveOutletIdState(num);
          }
        }
      }
    }
  }, [fetchOutlets]);

  const setCurrentBranch = useCallback((branch: BranchId) => {
    const norm = normalizeBranchId(branch);
    setCurrentBranchState(norm);
    if (typeof window !== "undefined") {
      localStorage.setItem(BRANCH_STORAGE_KEY, norm);
      // Dispatch custom event so listeners can re-fetch immediately
      window.dispatchEvent(new CustomEvent("bm-branch-change", { detail: { branch: norm } }));
    }
  }, []);

  const setActiveOutletId = useCallback((id: number | "all") => {
    setActiveOutletIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(OUTLET_STORAGE_KEY, String(id));
    }
  }, []);

  const currentBranchEntity = useMemo(() => {
    return BRANCH_ENTITIES.find((b) => b.id === currentBranch) ?? BRANCH_ENTITIES[0];
  }, [currentBranch]);

  const activeOutlet = useMemo(() => {
    if (activeOutletId === "all") {
      // Find outlet matching current branch
      return outlets.find((o) => normalizeBranchId(o.branchId ?? o.name) === currentBranch) ?? null;
    }
    return outlets.find((o) => o.id === activeOutletId) ?? null;
  }, [outlets, activeOutletId, currentBranch]);

  return (
    <BranchContext.Provider
      value={{
        outlets,
        activeOutletId,
        activeOutlet,
        currentBranch,
        currentBranchEntity,
        setCurrentBranch,
        isLoading,
        setActiveOutletId,
        refreshOutlets: fetchOutlets,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return ctx;
}

