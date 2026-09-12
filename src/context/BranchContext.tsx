"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { OutletDto } from "@/lib/types";

interface BranchContextType {
  outlets: OutletDto[];
  activeOutletId: number | "all";
  activeOutlet: OutletDto | null;
  isLoading: boolean;
  setActiveOutletId: (id: number | "all") => void;
  refreshOutlets: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

const STORAGE_KEY = "bm_active_outlet_id";

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [outlets, setOutlets] = useState<OutletDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeOutletId, setActiveOutletIdState] = useState<number | "all">("all");

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

    // Restore from localStorage if available
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        if (saved === "all") {
          setActiveOutletIdState("all");
        } else {
          const num = Number(saved);
          if (!isNaN(num)) {
            setActiveOutletIdState(num);
          }
        }
      }
    }
  }, [fetchOutlets]);

  const setActiveOutletId = useCallback((id: number | "all") => {
    setActiveOutletIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(id));
    }
  }, []);

  const activeOutlet = useMemo(() => {
    if (activeOutletId === "all") return null;
    return outlets.find((o) => o.id === activeOutletId) ?? null;
  }, [outlets, activeOutletId]);

  return (
    <BranchContext.Provider
      value={{
        outlets,
        activeOutletId,
        activeOutlet,
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
