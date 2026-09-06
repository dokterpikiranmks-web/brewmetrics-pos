import type { Role } from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  cashier: "Kasir",
  manager: "Manajer",
  owner: "Owner",
};

export const ROLE_ACCENT: Record<Role, string> = {
  cashier: "text-brand-2 bg-brand-2/10 border-brand-2/25",
  manager: "text-sky-300 bg-sky-400/10 border-sky-400/25",
  owner: "text-brand bg-brand/10 border-brand/30",
};

export const HOME_BY_ROLE: Record<Role, string> = {
  cashier: "/pos",
  manager: "/analytics",
  owner: "/analytics",
};

export interface NavTab {
  href: string;
  label: string;
  icon: "MonitorSmartphone" | "Boxes" | "ChartSpline" | "UtensilsCrossed" | "Settings" | "ReceiptText";
  roles: Role[];
  isAction?: boolean;
  actionKey?: string;
}

export const NAV_TABS: NavTab[] = [
  // 1. Navigasi Owner & Manager: Analytics, Menu & Resep, Inventory Matrix, Pengaturan (Tanpa POS Terminal)
  { href: "/analytics", label: "Analytics", icon: "ChartSpline", roles: ["owner", "manager"] },
  { href: "/products", label: "Menu & Resep", icon: "UtensilsCrossed", roles: ["owner", "manager"] },
  { href: "/inventory", label: "Inventory Matrix", icon: "Boxes", roles: ["owner", "manager"] },
  { href: "/settings", label: "Pengaturan", icon: "Settings", roles: ["owner", "manager"] },

  // 2. Navigasi Cashier: POS Terminal dan Riwayat Pesanan (Tanpa Akses Manajemen Kafe)
  { href: "/pos", label: "POS Terminal", icon: "MonitorSmartphone", roles: ["cashier"] },
  {
    href: "/pos?tab=history",
    label: "Riwayat Pesanan",
    icon: "ReceiptText",
    roles: ["cashier"],
    isAction: true,
    actionKey: "open-order-history",
  },
];
