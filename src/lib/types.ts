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
    isBundle?: boolean;
    bundleItems?: { productId: number; productName?: string; qty: number }[];
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

export type OrderType = "dine-in" | "take-away";
export type DiscountType = "percentage" | "fixed";
export type PaymentMethod = "cash" | "qris" | "debit" | "transfer";

export interface CreateOrderPayload {
  offlineId?: string;
  paymentMethod: PaymentMethod;
  tendered?: number;
  customerName?: string;
  customerPhone?: string;
  customerId?: number;
  orderType?: OrderType;
  tableNumber?: string;
  discountType?: DiscountType | null;
  discountValue?: number;
  paymentReference?: string;
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
  printerPaperSize?: "58mm" | "80mm";
  autoPrintReceipt?: boolean;
  receiptFooterMessage: string;
  updatedAt?: string;
}

export interface OrderReceipt {
  id: number;
  orderNumber: string;
  paymentMethod: PaymentMethod;
  customerId?: number | null;
  customerName?: string;
  customerPhone?: string | null;
  orderType?: OrderType;
  tableNumber?: string | null;
  discountType?: DiscountType | null;
  discountValue?: number;
  discountAmount?: number;
  paymentReference?: string | null;
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
  customerId?: number | null;
  customerName?: string;
  customerPhone?: string | null;
  orderType?: OrderType;
  tableNumber?: string | null;
  discountAmount?: number;
  total: number;
  itemCount: number;
  status?: "paid" | "void";
  createdAt: string;
  isOfflineSync: boolean;
}

export interface CustomerDto {
  id: number;
  name: string;
  phone: string;
  totalOrders: number;
  totalSpend: number;
  lastVisitAt: string;
  createdAt: string;
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
