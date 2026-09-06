import "server-only";
import { db } from "@/db";
import { ingredients, modifierIngredients, recipeItems, bundleItems } from "@/db/schema";
import type { Ingredient, ModifierIngredient, RecipeItem, BundleItem } from "@/db/schema";

/**
 * RecipeIndex — peta Bill of Materials untuk meledakkan satu item menu
 * menjadi kebutuhan bahan baku (gram/ml/pcs) + HPP per porsi.
 */
export interface RecipeIndex {
  ingredientById: Map<number, Ingredient>;
  baseRows: Map<number, RecipeItem[]>; // productId -> rows (apply to every variant)
  variantRows: Map<number, RecipeItem[]>; // variantId -> rows (specific)
  modifierRows: Map<number, ModifierIngredient[]>; // modifierId -> rows
  bundleRows: Map<number, { subProductId: number; qty: number }[]>; // bundleProductId -> subProducts
}

let cached: { at: number; index: RecipeIndex } | null = null;

export async function buildRecipeIndex(force = false): Promise<RecipeIndex> {
  if (!force && cached && Date.now() - cached.at < 10_000) return cached.index;
  const [ings, rItems, mItems, bItems] = await Promise.all([
    db.select().from(ingredients),
    db.select().from(recipeItems),
    db.select().from(modifierIngredients),
    db.select().from(bundleItems),
  ]);
  const index: RecipeIndex = {
    ingredientById: new Map(ings.map((i) => [i.id, i])),
    baseRows: new Map(),
    variantRows: new Map(),
    modifierRows: new Map(),
    bundleRows: new Map(),
  };
  for (const b of bItems) {
    const arr = index.bundleRows.get(b.bundleProductId) ?? [];
    arr.push({ subProductId: b.subProductId, qty: b.qty });
    index.bundleRows.set(b.bundleProductId, arr);
  }
  for (const r of rItems) {
    if (r.variantId) {
      const arr = index.variantRows.get(r.variantId) ?? [];
      arr.push(r);
      index.variantRows.set(r.variantId, arr);
    } else {
      const arr = index.baseRows.get(r.productId) ?? [];
      arr.push(r);
      index.baseRows.set(r.productId, arr);
    }
  }
  for (const m of mItems) {
    const arr = index.modifierRows.get(m.modifierId) ?? [];
    arr.push(m);
    index.modifierRows.set(m.modifierId, arr);
  }
  cached = { at: Date.now(), index };
  return index;
}

export function invalidateRecipeCache() {
  cached = null;
}

export interface LineInput {
  productId: number;
  variantId: number | null;
  qty: number;
  modifierIds: number[];
}

/** Kebutuhan bahan untuk SATU line item (sudah dikali qty). */
export function usageForLine(line: LineInput, index: RecipeIndex): Map<number, number> {
  const usage = new Map<number, number>();
  const add = (ingredientId: number, qty: number) => {
    usage.set(ingredientId, (usage.get(ingredientId) ?? 0) + qty);
  };
  for (const r of index.baseRows.get(line.productId) ?? []) add(r.ingredientId, r.qty * line.qty);
  if (line.variantId) {
    for (const r of index.variantRows.get(line.variantId) ?? []) add(r.ingredientId, r.qty * line.qty);
  }
  for (const mid of line.modifierIds) {
    for (const m of index.modifierRows.get(mid) ?? []) add(m.ingredientId, m.qty * line.qty);
  }

  // Jika produk adalah paket bundling, ledakkan resep dari seluruh sub-produknya
  const bundles = index.bundleRows.get(line.productId);
  if (bundles && bundles.length > 0) {
    for (const b of bundles) {
      const subUsage = usageForLine(
        { productId: b.subProductId, variantId: null, qty: b.qty * line.qty, modifierIds: [] },
        index
      );
      mergeUsage(usage, subUsage);
    }
  }

  return usage;
}

/** HPP (modal) untuk SATU unit dari line item. */
export function hppPerUnit(line: LineInput, index: RecipeIndex): number {
  let cost = 0;
  const single: LineInput = { ...line, qty: 1 };
  const usage = usageForLine(single, index);
  for (const [ingredientId, qty] of usage) {
    const ing = index.ingredientById.get(ingredientId);
    if (ing) cost += qty * ing.costPerUnit;
  }
  return Math.round(cost);
}

/** Gabungkan pemakaian banyak line menjadi satu peta total. */
export function mergeUsage(target: Map<number, number>, source: Map<number, number>) {
  for (const [k, v] of source) target.set(k, (target.get(k) ?? 0) + v);
}
