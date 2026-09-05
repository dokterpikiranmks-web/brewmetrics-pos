/* Shared DTO types between API routes and client components. */

export type Role = "cashier" | "manager" | "owner";

export interface SessionUser {
  id: number;
  name: string;
  role: Role;
}

export interface StaffUserDto {
  id: number;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface CatalogDto {
  categories: { id: number; name: string; icon: string }[];
  products: {
    id: number;
    categoryId: number;
    name: string;
    tagline: string;
    price: number;
    color: string;
    icon: string;
    imageUrl?: string | null;
  }[];
  variants: { id: number; productId: number; name: string; priceDelta: number }[];
  modifiers: { id: number; name: string; price: number }[];
}

export interface CartLinePayload {
  productId: number;
  variantId: number | null;
  qty: number;
  modifierIds: number[];
}

export interface CreateOrderPayload {
  offlineId?: string;
  paymentMethod: "cash" | "qris" | "debit";
  tendered?: number;
  lines: CartLinePayload[];
}

export interface OrderReceiptItem {
  productName: string;
  variantName: string | null;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  modifiers: { name: string; price: number }[];
}

export interface StoreSettingDto {
  id: number;
  cafeName: string;
  logoUrl: string | null;
  address: string;
  phone: string;
  taxPercentage: number;
  serviceChargePercentage: number;
  receiptFooterMessage: string;
  updatedAt?: string;
}

export interface OrderReceipt {
  id: number;
  orderNumber: string;
  paymentMethod: "cash" | "qris" | "debit";
  subtotal: number;
  tax?: number;
  serviceCharge?: number;
  total?: number;
  tendered: number | null;
  change: number | null;
  itemCount: number;
  hpp: number;
  profit: number;
  cashierName: string;
  createdAt: string;
  items: OrderReceiptItem[];
  storeSettings?: StoreSettingDto | null;
}

export interface TodayOrderDto {
  id: number;
  orderNumber: string;
  cashierName: string;
  paymentMethod: string;
  total: number;
  itemCount: number;
  createdAt: string;
  isOfflineSync: boolean;
}

export type StockStatus = "ok" | "low" | "out";

export interface IngredientDto {
  id: number;
  name: string;
  unit: "g" | "ml" | "pcs";
  stockQty: number;
  lowThreshold: number;
  costPerUnit: number;
  status: StockStatus;
  dailyUsage: number; // avg usage / day over trailing 14 days
  daysLeft: number | null; // null if no usage
  predictedOut: boolean; // daysLeft <= 2
  suggestedOrder: number; // recommended qty to reach 7 days of buffer
}

export interface ForecastItem {
  id: number;
  name: string;
  unit: string;
  stockQty: number;
  dailyUsage: number;
  daysLeft: number;
  severity: "critical" | "warning";
}

export interface ShiftReportDto {
  id: number;
  cashierId: number | null;
  cashierName: string;
  openedAt: string;
  closedAt: string;
  expectedCash: number;
  actualCash: number;
  variance: number;
  totalOrders: number;
  cashOrders: number;
  qrisTotal: number;
  debitTotal: number;
  note: string;
  createdAt: string;
}

export type MenuQuadrant = "star" | "plowhorse" | "puzzle" | "dog";

export interface MenuEngineeringItem {
  id: number;
  name: string;
  categoryName: string;
  imageUrl?: string | null;
  price: number;
  hpp: number;
  unitMargin: number;
  marginPct: number;
  totalQty: number;
  totalRevenue: number;
  totalProfit: number;
  quadrant: MenuQuadrant;
}

export interface MenuEngineeringSummary {
  avgVolume: number;
  avgMargin: number;
  avgMarginPct: number;
  totalMenuItems: number;
  counts: {
    star: number;
    plowhorse: number;
    puzzle: number;
    dog: number;
  };
  items: MenuEngineeringItem[];
}

export interface AnalyticsSummary {
  today: {
    revenue: number;
    orders: number;
    avgTicket: number;
    hpp: number;
    grossProfit: number;
    margin: number;
    cashIn: number;
    cashOut: number;
    netCash: number;
    vsYesterdayPct: number;
  };
  daily: { date: string; label: string; revenue: number; profit: number; orders: number }[];
  hourly: { hour: number; label: string; revenue: number; orders: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  paymentSplit: { method: string; value: number }[];
  forecast: ForecastItem[];
  inventoryHealth: { ok: number; low: number; out: number; totalValue: number };
  recentOrders: TodayOrderDto[];
  latestShiftReport?: ShiftReportDto | null;
  recentShifts?: ShiftReportDto[];
  menuEngineering?: MenuEngineeringSummary;
  generatedAt: string;
}
