import {
  pgTable,
  serial,
  integer,
  text,
  doublePrecision,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* --------------------------------- OUTLETS --------------------------------- */

export const outlets = pgTable("outlets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------------------------------- USERS ---------------------------------- */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pin: text("pin").notNull(),
  role: text("role", { enum: ["cashier", "manager", "owner"] }).notNull(),
  outletId: integer("outlet_id").references(() => outlets.id),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* --------------------------------- CATALOG --------------------------------- */

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("Coffee"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    name: text("name").notNull(),
    tagline: text("tagline").notNull().default(""),
    price: integer("price").notNull(), // IDR (base price)
    hpp: integer("hpp").notNull().default(0), // IDR (server-calculated from BOM recipe)
    color: text("color").notNull().default("#F59E0B"),
    icon: text("icon").notNull().default("Coffee"),
    imageUrl: text("image_url").default(""),
    isBundle: boolean("is_bundle").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("products_category_idx").on(t.categoryId)]
);

export const variants = pgTable(
  "variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    name: text("name").notNull(), // "Panas" | "Dingin"
    priceDelta: integer("price_delta").notNull().default(0),
  },
  (t) => [index("variants_product_idx").on(t.productId)]
);

export const modifiers = pgTable("modifiers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: integer("price").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

/* -------------------------------- INVENTORY -------------------------------- */

export const ingredients = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit", { enum: ["g", "ml", "pcs"] }).notNull(),
  stockQty: doublePrecision("stock_qty").notNull().default(0),
  lowThreshold: doublePrecision("low_threshold").notNull().default(0),
  costPerUnit: doublePrecision("cost_per_unit").notNull().default(0), // IDR per g/ml/pcs
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recipeItems = pgTable(
  "recipe_items",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    variantId: integer("variant_id").references(() => variants.id), // null = applies to all variants
    ingredientId: integer("ingredient_id")
      .notNull()
      .references(() => ingredients.id),
    qty: doublePrecision("qty").notNull(),
  },
  (t) => [index("recipe_product_idx").on(t.productId)]
);

export const bundleItems = pgTable(
  "bundle_items",
  {
    id: serial("id").primaryKey(),
    bundleProductId: integer("bundle_product_id")
      .notNull()
      .references(() => products.id),
    subProductId: integer("sub_product_id")
      .notNull()
      .references(() => products.id),
    qty: integer("qty").notNull().default(1),
  },
  (t) => [index("bundle_items_bundle_idx").on(t.bundleProductId)]
);

export const modifierIngredients = pgTable("modifier_ingredients", {
  id: serial("id").primaryKey(),
  modifierId: integer("modifier_id")
    .notNull()
    .references(() => modifiers.id),
  ingredientId: integer("ingredient_id")
    .notNull()
    .references(() => ingredients.id),
  qty: doublePrecision("qty").notNull(),
});

/* -------------------------------- CUSTOMERS -------------------------------- */

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    totalOrders: integer("total_orders").notNull().default(0),
    totalSpend: integer("total_spend").notNull().default(0),
    lastVisitAt: timestamp("last_visit_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("customers_phone_idx").on(t.phone),
    index("customers_orders_idx").on(t.totalOrders),
    index("customers_spend_idx").on(t.totalSpend),
  ]
);

/* ---------------------------------- ORDERS --------------------------------- */

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNumber: text("order_number").notNull(),
    offlineId: text("offline_id"), // idempotency key for offline-synced orders
    cashierId: integer("cashier_id").references(() => users.id),
    cashierName: text("cashier_name").notNull().default(""),
    customerId: integer("customer_id").references(() => customers.id),
    customerPhone: text("customer_phone").default(""),
    status: text("status", { enum: ["paid", "void"] }).notNull().default("paid"),
    paymentMethod: text("payment_method", { enum: ["cash", "qris", "debit", "transfer", "split"] })
      .notNull()
      .default("cash"),
    paymentBreakdown: jsonb("payment_breakdown")
      .$type<{ method: string; amount: number; reference?: string }[]>()
      .notNull()
      .default([]),
    customerName: text("customer_name").notNull().default("Umum"),
    orderType: text("order_type", { enum: ["dine-in", "take-away"] })
      .notNull()
      .default("dine-in"),
    tableNumber: text("table_number").default(""),
    discountType: text("discount_type", { enum: ["percentage", "fixed"] }),
    discountValue: integer("discount_value").notNull().default(0),
    discountAmount: integer("discount_amount").notNull().default(0),
    discountName: text("discount_name").default(""),
    paymentReference: text("payment_reference").default(""),
    subtotal: integer("subtotal").notNull().default(0),
    tax: integer("tax").notNull().default(0),
    serviceCharge: integer("service_charge").notNull().default(0),
    total: integer("total").notNull().default(0),
    hpp: integer("hpp").notNull().default(0),
    profit: integer("profit").notNull().default(0),
    tendered: integer("tendered"),
    change: integer("change"),
    itemCount: integer("item_count").notNull().default(0),
    outletId: integer("outlet_id").references(() => outlets.id),
    isOfflineSync: boolean("is_offline_sync").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_idx").on(t.orderNumber),
    uniqueIndex("orders_offline_idx").on(t.offlineId),
    index("orders_outlet_idx").on(t.outletId),
    index("orders_created_idx").on(t.createdAt),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id),
    productId: integer("product_id").references(() => products.id),
    productName: text("product_name").notNull(),
    variantName: text("variant_name"),
    qty: integer("qty").notNull().default(1),
    unitPrice: integer("unit_price").notNull(),
    totalPrice: integer("total_price").notNull(),
    hpp: integer("hpp").notNull().default(0),
    modifiers: jsonb("modifiers").$type<{ name: string; price: number }[]>().notNull().default([]),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_created_idx").on(t.id)]
);

/* ------------------------------- CASH FLOW --------------------------------- */

export const cashMovements = pgTable(
  "cash_movements",
  {
    id: serial("id").primaryKey(),
    type: text("type", { enum: ["in", "out"] }).notNull(),
    amount: integer("amount").notNull(),
    note: text("note").notNull().default(""),
    userName: text("user_name").notNull().default(""),
    outletId: integer("outlet_id").references(() => outlets.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cash_created_idx").on(t.createdAt), index("cash_outlet_idx").on(t.outletId)]
);

/* ------------------------------ SHIFT REPORTS ------------------------------ */

export const shiftReports = pgTable(
  "shift_reports",
  {
    id: serial("id").primaryKey(),
    cashierId: integer("cashier_id").references(() => users.id),
    cashierName: text("cashier_name").notNull().default(""),
    outletId: integer("outlet_id").references(() => outlets.id),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }).notNull().defaultNow(),
    expectedCash: integer("expected_cash").notNull(),
    actualCash: integer("actual_cash").notNull(),
    variance: integer("variance").notNull(), // actualCash - expectedCash
    totalOrders: integer("total_orders").notNull().default(0),
    cashOrders: integer("cash_orders").notNull().default(0),
    qrisTotal: integer("qris_total").notNull().default(0),
    debitTotal: integer("debit_total").notNull().default(0),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("shift_reports_created_idx").on(t.createdAt),
    index("shift_reports_cashier_idx").on(t.cashierId),
    index("shift_reports_outlet_idx").on(t.outletId),
  ]
);

/* -------------------------------- DISCOUNTS -------------------------------- */

export const discounts = pgTable("discounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["percentage", "fixed"] }).notNull(),
  value: integer("value").notNull(),
  minOrder: integer("min_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ----------------------------- STORE SETTINGS ------------------------------ */

export const storeSettings = pgTable("store_settings", {
  id: serial("id").primaryKey(),
  cafeName: text("cafe_name").notNull().default("BREWMETRICS Specialty Coffee"),
  logoUrl: text("logo_url").notNull().default(""),
  address: text("address").notNull().default("Jl. Metro Tanjung Bunga No. 8, Makassar"),
  phone: text("phone").notNull().default("0812-4455-6677"),
  taxPercentage: doublePrecision("tax_percentage").notNull().default(10), // Pajak PB1/Restoran (e.g. 10%)
  serviceChargePercentage: doublePrecision("service_charge_percentage").notNull().default(0), // Service Charge (e.g. 0%)
  printerPaperSize: text("printer_paper_size", { enum: ["58mm", "80mm"] })
    .notNull()
    .default("58mm"),
  autoPrintReceipt: boolean("auto_print_receipt").notNull().default(true),
  receiptFooterMessage: text("receipt_footer_message")
    .notNull()
    .default("Terima kasih atas kunjungan Anda!\nFollow IG: @brewmetrics.coffee"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------- ATTENDANCE -------------------------------- */

export const attendances = pgTable(
  "attendances",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    outletId: integer("outlet_id").references(() => outlets.id),
    type: text("type", { enum: ["clock_in", "clock_out"] }).notNull(),
    photoUrl: text("photo_url").notNull(),
    note: text("note").default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("attendances_user_idx").on(t.userId),
    index("attendances_outlet_idx").on(t.outletId),
    index("attendances_created_idx").on(t.createdAt),
  ]
);

/* -------------------------------- RELATIONS -------------------------------- */

export const outletsRelations = relations(outlets, ({ many }) => ({
  users: many(users),
  orders: many(orders),
  shiftReports: many(shiftReports),
  attendances: many(attendances),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  outlet: one(outlets, {
    fields: [users.outletId],
    references: [outlets.id],
  }),
  orders: many(orders),
  shiftReports: many(shiftReports),
  attendances: many(attendances),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(variants),
  recipeItems: many(recipeItems),
  orderItems: many(orderItems),
}));

export const variantsRelations = relations(variants, ({ one, many }) => ({
  product: one(products, {
    fields: [variants.productId],
    references: [products.id],
  }),
  recipeItems: many(recipeItems),
}));

export const modifiersRelations = relations(modifiers, ({ many }) => ({
  modifierIngredients: many(modifierIngredients),
}));

export const ingredientsRelations = relations(ingredients, ({ many }) => ({
  recipeItems: many(recipeItems),
  modifierIngredients: many(modifierIngredients),
}));

export const recipeItemsRelations = relations(recipeItems, ({ one }) => ({
  product: one(products, {
    fields: [recipeItems.productId],
    references: [products.id],
  }),
  variant: one(variants, {
    fields: [recipeItems.variantId],
    references: [variants.id],
  }),
  ingredient: one(ingredients, {
    fields: [recipeItems.ingredientId],
    references: [ingredients.id],
  }),
}));

export const modifierIngredientsRelations = relations(modifierIngredients, ({ one }) => ({
  modifier: one(modifiers, {
    fields: [modifierIngredients.modifierId],
    references: [modifiers.id],
  }),
  ingredient: one(ingredients, {
    fields: [modifierIngredients.ingredientId],
    references: [ingredients.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));

export const bundleItemsRelations = relations(bundleItems, ({ one }) => ({
  bundleProduct: one(products, {
    fields: [bundleItems.bundleProductId],
    references: [products.id],
    relationName: "bundle_parent",
  }),
  subProduct: one(products, {
    fields: [bundleItems.subProductId],
    references: [products.id],
    relationName: "bundle_sub",
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  cashier: one(users, {
    fields: [orders.cashierId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  outlet: one(outlets, {
    fields: [orders.outletId],
    references: [outlets.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const shiftReportsRelations = relations(shiftReports, ({ one }) => ({
  cashier: one(users, {
    fields: [shiftReports.cashierId],
    references: [users.id],
  }),
  outlet: one(outlets, {
    fields: [shiftReports.outletId],
    references: [outlets.id],
  }),
}));

export const attendancesRelations = relations(attendances, ({ one }) => ({
  user: one(users, {
    fields: [attendances.userId],
    references: [users.id],
  }),
  outlet: one(outlets, {
    fields: [attendances.outletId],
    references: [outlets.id],
  }),
}));

/* --------------------------------- TYPES ----------------------------------- */

export type Outlet = typeof outlets.$inferSelect;
export type OutletInsert = typeof outlets.$inferInsert;
export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type Modifier = typeof modifiers.$inferSelect;
export type Ingredient = typeof ingredients.$inferSelect;
export type RecipeItem = typeof recipeItems.$inferSelect;
export type BundleItem = typeof bundleItems.$inferSelect;
export type ModifierIngredient = typeof modifierIngredients.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type CashMovement = typeof cashMovements.$inferSelect;
export type ShiftReport = typeof shiftReports.$inferSelect;
export type StoreSetting = typeof storeSettings.$inferSelect;
export type Discount = typeof discounts.$inferSelect;
export type DiscountInsert = typeof discounts.$inferInsert;
export type Attendance = typeof attendances.$inferSelect;
export type AttendanceInsert = typeof attendances.$inferInsert;

