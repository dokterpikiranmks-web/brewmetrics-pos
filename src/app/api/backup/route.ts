import { db } from "@/db";
import {
  users,
  categories,
  products,
  variants,
  modifiers,
  ingredients,
  recipeItems,
  modifierIngredients,
  orders,
  orderItems,
  cashMovements,
  shiftReports,
  storeSettings,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function getTimestampString(): string {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}

/**
 * GET /api/backup
 * Mengekspor seluruh data tabel inti ke format file JSON (khusus role 'owner').
 */
export async function GET() {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const [
      allUsers,
      allCategories,
      allIngredients,
      allProducts,
      allVariants,
      allModifiers,
      allModifierIngredients,
      allRecipeItems,
      allOrders,
      allOrderItems,
      allCashMovements,
      allShiftReports,
      allStoreSettings,
    ] = await Promise.all([
      db.select().from(users).orderBy(asc(users.id)),
      db.select().from(categories).orderBy(asc(categories.id)),
      db.select().from(ingredients).orderBy(asc(ingredients.id)),
      db.select().from(products).orderBy(asc(products.id)),
      db.select().from(variants).orderBy(asc(variants.id)),
      db.select().from(modifiers).orderBy(asc(modifiers.id)),
      db.select().from(modifierIngredients).orderBy(asc(modifierIngredients.id)),
      db.select().from(recipeItems).orderBy(asc(recipeItems.id)),
      db.select().from(orders).orderBy(asc(orders.id)),
      db.select().from(orderItems).orderBy(asc(orderItems.id)),
      db.select().from(cashMovements).orderBy(asc(cashMovements.id)),
      db.select().from(shiftReports).orderBy(asc(shiftReports.id)),
      db.select().from(storeSettings).orderBy(asc(storeSettings.id)),
    ]);

    const backupPayload = {
      version: "1.0",
      appName: "BrewMetrics POS",
      exportedAt: new Date().toISOString(),
      metadata: {
        totalUsers: allUsers.length,
        totalCategories: allCategories.length,
        totalProducts: allProducts.length,
        totalIngredients: allIngredients.length,
        totalOrders: allOrders.length,
      },
      tables: {
        storeSettings: allStoreSettings,
        users: allUsers,
        categories: allCategories,
        ingredients: allIngredients,
        products: allProducts,
        variants: allVariants,
        modifiers: allModifiers,
        modifierIngredients: allModifierIngredients,
        recipeItems: allRecipeItems,
        orders: allOrders,
        orderItems: allOrderItems,
        cashMovements: allCashMovements,
        shiftReports: allShiftReports,
      },
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const filename = `brewmetrics-backup-${getTimestampString()}.json`;

    return new Response(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("backup database error:", err);
    return Response.json(
      { error: "Gagal membuat file cadangan (backup) database." },
      { status: 500 }
    );
  }
}
