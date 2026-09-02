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
  manager: "/inventory",
  owner: "/analytics",
};

export interface NavTab {
  href: string;
  label: string;
  icon: "MonitorSmartphone" | "Boxes" | "ChartSpline";
  roles: Role[];
}

export const NAV_TABS: NavTab[] = [
  { href: "/pos", label: "POS Terminal", icon: "MonitorSmartphone", roles: ["cashier", "manager", "owner"] },
  { href: "/inventory", label: "Inventory Matrix", icon: "Boxes", roles: ["manager", "owner"] },
  { href: "/analytics", label: "Analytics", icon: "ChartSpline", roles: ["owner", "manager"] },
];
