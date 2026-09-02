import "server-only";
import { db } from "@/db";
import { orders, orderItems } from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import { buildRecipeIndex, usageForLine, mergeUsage, type RecipeIndex } from "./recipes";
import { modifiers as modifiersTable, variants as variantsTable, products as productsTable } from "@/db/schema";
import type { Ingredient } from "@/db/schema";
import type { IngredientDto, ForecastItem, StockStatus } from "./types";

export const FORECAST_WINDOW_DAYS = 14;

interface RawLine {
  productId: number | null;
  variantName: string | null;
  qty: number;
  mods: { name: string; price: number }[];
}

/** Agregasi pemakaian bahan baku selama N hari terakhir dari riwayat pesanan. */
export async function computeUsage(windowDays = FORECAST_WINDOW_DAYS): Promise<{
  usage: Map<number, number>;
  index: RecipeIndex;
  daysWithData: number;
}> {
  const index = await buildRecipeIndex();
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      productId: orderItems.productId,
      variantName: orderItems.variantName,
      qty: orderItems.qty,
      mods: orderItems.modifiers,
      createdAt: orders.createdAt,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.status, "paid"), gte(orders.createdAt, since)));

  // map nama -> id untuk meledakkan varian & modifier dari snapshot order
  const [allVariants, allModifiers, allProducts] = await Promise.all([
    db.select().from(variantsTable),
    db.select().from(modifiersTable),
    db.select().from(productsTable),
  ]);
  const variantIdByName = new Map(allVariants.map((v) => [`${v.productId}:${v.name}`, v.id]));
  const modifierIdByName = new Map(allModifiers.map((m) => [m.name, m.id]));
  const productIds = new Set(allProducts.map((p) => p.id));

  const usage = new Map<number, number>();
  for (const row of rows as (RawLine & { createdAt: Date })[]) {
    if (!row.productId || !productIds.has(row.productId)) continue;
    const variantId = row.variantName
      ? (variantIdByName.get(`${row.productId}:${row.variantName}`) ?? null)
      : null;
    const modifierIds = (row.mods ?? [])
      .map((m) => modifierIdByName.get(m.name))
      .filter((x): x is number => typeof x === "number");
    mergeUsage(usage, usageForLine({ productId: row.productId, variantId, qty: row.qty, modifierIds }, index));
  }

  const dayKeys = new Set(rows.map((r) => new Date(r.createdAt).toDateString()));
  return { usage, index, daysWithData: Math.max(1, Math.min(windowDays, dayKeys.size)) };
}

function statusFor(stock: number, threshold: number): StockStatus {
  if (stock <= 0) return "out";
  if (stock <= threshold) return "low";
  return "ok";
}

/** Daftar bahan baku dengan status warna + prediksi AI sederhana (velocity-based). */
export async function buildIngredientDtos(ingredients?: (Ingredient & Record<string, never>)[]): Promise<IngredientDto[]> {
  const { usage, daysWithData } = await computeUsage();
  const list = ingredients ?? (await db.query.ingredients.findMany());
  return list
    .map((ing) => {
      const total = usage.get(ing.id) ?? 0;
      const dailyUsage = total / daysWithData;
      const daysLeft = dailyUsage > 0 ? ing.stockQty / dailyUsage : null;
      return {
        id: ing.id,
        name: ing.name,
        unit: ing.unit,
        stockQty: ing.stockQty,
        lowThreshold: ing.lowThreshold,
        costPerUnit: ing.costPerUnit,
        status: statusFor(ing.stockQty, ing.lowThreshold),
        dailyUsage: Math.round(dailyUsage * 10) / 10,
        daysLeft: daysLeft === null ? null : Math.round(daysLeft * 10) / 10,
        predictedOut: daysLeft !== null && daysLeft <= 2,
        suggestedOrder: Math.max(0, Math.ceil(dailyUsage * 7 - ing.stockQty)),
      };
    })
    .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
}

/** Item untuk panel Low-Stock AI Alert (<= 5 hari). */
export async function buildForecastAlerts(): Promise<ForecastItem[]> {
  const dtos = await buildIngredientDtos();
  return dtos
    .filter((d) => d.daysLeft !== null && d.daysLeft <= 5)
    .map((d) => ({
      id: d.id,
      name: d.name,
      unit: d.unit,
      stockQty: d.stockQty,
      dailyUsage: d.dailyUsage,
      daysLeft: d.daysLeft ?? 0,
      severity: (d.daysLeft ?? 9) <= 2 ? ("critical" as const) : ("warning" as const),
    }));
}
