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

/* ---------------------------------- USERS ---------------------------------- */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pin: text("pin").notNull(),
  role: text("role", { enum: ["cashier", "manager", "owner"] }).notNull(),
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
    color: text("color").notNull().default("#F59E0B"),
    icon: text("icon").notNull().default("Coffee"),
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

/* ---------------------------------- ORDERS --------------------------------- */

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNumber: text("order_number").notNull(),
    offlineId: text("offline_id"), // idempotency key for offline-synced orders
    cashierId: integer("cashier_id").references(() => users.id),
    cashierName: text("cashier_name").notNull().default(""),
    status: text("status", { enum: ["paid", "void"] }).notNull().default("paid"),
    paymentMethod: text("payment_method", { enum: ["cash", "qris", "debit"] })
      .notNull()
      .default("cash"),
    subtotal: integer("subtotal").notNull().default(0),
    hpp: integer("hpp").notNull().default(0),
    profit: integer("profit").notNull().default(0),
    tendered: integer("tendered"),
    change: integer("change"),
    itemCount: integer("item_count").notNull().default(0),
    isOfflineSync: boolean("is_offline_sync").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_idx").on(t.orderNumber),
    uniqueIndex("orders_offline_idx").on(t.offlineId),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cash_created_idx").on(t.createdAt)]
);

/* --------------------------------- TYPES ----------------------------------- */

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type Modifier = typeof modifiers.$inferSelect;
export type Ingredient = typeof ingredients.$inferSelect;
export type RecipeItem = typeof recipeItems.$inferSelect;
export type ModifierIngredient = typeof modifierIngredients.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type CashMovement = typeof cashMovements.$inferSelect;
