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
import { sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { invalidateRecipeCache } from "@/lib/recipes";

export const dynamic = "force-dynamic";

// Helper untuk batch insert guna menghindari batasan parameter SQL
async function insertChunked<T extends Record<string, any>>(
  tx: any,
  table: any,
  records: T[],
  chunkSize = 100
) {
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    if (chunk.length > 0) {
      await tx.insert(table).values(chunk);
    }
  }
}

/**
 * POST /api/restore
 * Memulihkan data database dari payload backup JSON (khusus role 'owner').
 * Menjalankan transaksi atomik:
 * 1. Truncate tabel CASCADE & RESTART IDENTITY
 * 2. Insert data secara berurutan sesuai relasi foreign key
 * 3. Reset sequence PostgreSQL ke ID tertinggi + 1
 * 4. Invalidate recipe cache
 */
export async function POST(req: Request) {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  try {
    const payload = await req.json();

    // Validasi struktur data backup
    if (!payload || typeof payload !== "object") {
      return Response.json(
        { error: "Format payload cadangan (backup) tidak valid." },
        { status: 400 }
      );
    }

    const tables = payload.tables || payload;
    if (!tables || typeof tables !== "object") {
      return Response.json(
        { error: "Objek 'tables' tidak ditemukan dalam file cadangan." },
        { status: 400 }
      );
    }

    // Ekstraksi data dengan toleransi format camelCase / snake_case
    const usersData: any[] = tables.users || [];
    const categoriesData: any[] = tables.categories || [];
    const ingredientsData: any[] = tables.ingredients || [];
    const productsData: any[] = tables.products || [];
    const variantsData: any[] = tables.variants || [];
    const modifiersData: any[] = tables.modifiers || [];
    const modifierIngredientsData: any[] =
      tables.modifierIngredients || tables.modifier_ingredients || [];
    const recipeItemsData: any[] =
      tables.recipeItems || tables.recipe_items || [];
    const ordersData: any[] = tables.orders || [];
    const orderItemsData: any[] = tables.orderItems || tables.order_items || [];
    const cashMovementsData: any[] =
      tables.cashMovements || tables.cash_movements || [];
    const shiftReportsData: any[] =
      tables.shiftReports || tables.shift_reports || [];
    const storeSettingsData: any[] =
      tables.storeSettings || tables.store_settings || [];

    // Validasi minimal: setidaknya harus ada data pengguna atau kategori
    if (usersData.length === 0 && productsData.length === 0) {
      return Response.json(
        {
          error:
            "File backup tampaknya kosong atau tidak memiliki data esensial.",
        },
        { status: 400 }
      );
    }

    // Jalankan seluruh proses dalam satu Drizzle DB Transaction
    await db.transaction(async (tx) => {
      // 1. Bersihkan seluruh tabel secara berurutan dengan CASCADE
      await tx.execute(
        sql`TRUNCATE TABLE shift_reports, order_items, orders, cash_movements, recipe_items, modifier_ingredients, variants, products, modifiers, ingredients, categories, users, store_settings RESTART IDENTITY CASCADE;`
      );

      // 2. Insert tabel tanpa foreign key atau level pertama
      if (storeSettingsData.length > 0) {
        const rows = storeSettingsData.map((ss) => ({
          id: ss.id,
          cafeName: ss.cafeName || "BREWMETRICS Specialty Coffee",
          logoUrl: ss.logoUrl || "",
          address: ss.address || "",
          phone: ss.phone || "",
          taxPercentage: Number(ss.taxPercentage) ?? 10,
          serviceChargePercentage: Number(ss.serviceChargePercentage) ?? 0,
          receiptFooterMessage: ss.receiptFooterMessage || "",
          updatedAt: ss.updatedAt ? new Date(ss.updatedAt) : new Date(),
        }));
        await insertChunked(tx, storeSettings, rows);
      } else {
        // Jika tidak ada store settings di backup, buat default 1 baris
        await tx.insert(storeSettings).values({
          id: 1,
          cafeName: "BREWMETRICS Specialty Coffee",
          logoUrl: "",
          address: "Jl. Metro Tanjung Bunga No. 8, Makassar",
          phone: "0812-4455-6677",
          taxPercentage: 10,
          serviceChargePercentage: 0,
          receiptFooterMessage:
            "Terima kasih atas kunjungan Anda!\nFollow IG: @brewmetrics.coffee",
        });
      }

      if (usersData.length > 0) {
        const rows = usersData.map((u) => ({
          id: u.id,
          name: u.name,
          pin: String(u.pin),
          role: u.role,
          active: typeof u.active === "boolean" ? u.active : true,
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        }));
        await insertChunked(tx, users, rows);
      }

      if (categoriesData.length > 0) {
        const rows = categoriesData.map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon || "Coffee",
          sortOrder: Number(c.sortOrder) || 0,
        }));
        await insertChunked(tx, categories, rows);
      }

      if (ingredientsData.length > 0) {
        const rows = ingredientsData.map((i) => ({
          id: i.id,
          name: i.name,
          unit: i.unit,
          stockQty: Number(i.stockQty) || 0,
          lowThreshold: Number(i.lowThreshold) || 0,
          costPerUnit: Number(i.costPerUnit) || 0,
          updatedAt: i.updatedAt ? new Date(i.updatedAt) : new Date(),
        }));
        await insertChunked(tx, ingredients, rows);
      }

      if (modifiersData.length > 0) {
        const rows = modifiersData.map((m) => ({
          id: m.id,
          name: m.name,
          price: Number(m.price) || 0,
          isActive: typeof m.isActive === "boolean" ? m.isActive : true,
        }));
        await insertChunked(tx, modifiers, rows);
      }

      // 3. Insert tabel level kedua (tergantung kategori / produk / modifier)
      if (productsData.length > 0) {
        const rows = productsData.map((p) => ({
          id: p.id,
          categoryId: p.categoryId,
          name: p.name,
          tagline: p.tagline ?? "",
          price: Number(p.price) || 0,
          hpp: Number(p.hpp) || 0,
          color: p.color || "#F59E0B",
          icon: p.icon || "Coffee",
          imageUrl: p.imageUrl ?? "",
          isActive: typeof p.isActive === "boolean" ? p.isActive : true,
        }));
        await insertChunked(tx, products, rows);
      }

      if (variantsData.length > 0) {
        const rows = variantsData.map((v) => ({
          id: v.id,
          productId: v.productId,
          name: v.name,
          priceDelta: Number(v.priceDelta) || 0,
        }));
        await insertChunked(tx, variants, rows);
      }

      if (modifierIngredientsData.length > 0) {
        const rows = modifierIngredientsData.map((mi) => ({
          id: mi.id,
          modifierId: mi.modifierId,
          ingredientId: mi.ingredientId,
          qty: Number(mi.qty) || 0,
        }));
        await insertChunked(tx, modifierIngredients, rows);
      }

      if (recipeItemsData.length > 0) {
        const rows = recipeItemsData.map((r) => ({
          id: r.id,
          productId: r.productId,
          variantId: r.variantId ?? null,
          ingredientId: r.ingredientId,
          qty: Number(r.qty) || 0,
        }));
        await insertChunked(tx, recipeItems, rows);
      }

      // 4. Insert tabel transaksi dan arus kas
      if (ordersData.length > 0) {
        const rows = ordersData.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          offlineId: o.offlineId ?? null,
          cashierId: o.cashierId ?? null,
          cashierName: o.cashierName || "",
          status: o.status || "paid",
          paymentMethod: o.paymentMethod || "cash",
          subtotal: Number(o.subtotal) || 0,
          tax: Number(o.tax) || 0,
          serviceCharge: Number(o.serviceCharge) || 0,
          total: Number(o.total) || 0,
          hpp: Number(o.hpp) || 0,
          profit: Number(o.profit) || 0,
          tendered: o.tendered != null ? Number(o.tendered) : null,
          change: o.change != null ? Number(o.change) : null,
          itemCount: Number(o.itemCount) || 0,
          isOfflineSync: Boolean(o.isOfflineSync),
          createdAt: o.createdAt ? new Date(o.createdAt) : new Date(),
        }));
        await insertChunked(tx, orders, rows);
      }

      if (orderItemsData.length > 0) {
        const rows = orderItemsData.map((oi) => ({
          id: oi.id,
          orderId: oi.orderId,
          productId: oi.productId ?? null,
          productName: oi.productName || "",
          variantName: oi.variantName ?? null,
          qty: Number(oi.qty) || 1,
          unitPrice: Number(oi.unitPrice) || 0,
          totalPrice: Number(oi.totalPrice) || 0,
          hpp: Number(oi.hpp) || 0,
          modifiers: Array.isArray(oi.modifiers) ? oi.modifiers : [],
        }));
        await insertChunked(tx, orderItems, rows);
      }

      if (cashMovementsData.length > 0) {
        const rows = cashMovementsData.map((cm) => ({
          id: cm.id,
          type: cm.type,
          amount: Number(cm.amount) || 0,
          note: cm.note || "",
          userName: cm.userName || "",
          createdAt: cm.createdAt ? new Date(cm.createdAt) : new Date(),
        }));
        await insertChunked(tx, cashMovements, rows);
      }

      if (shiftReportsData.length > 0) {
        const rows = shiftReportsData.map((sr) => ({
          id: sr.id,
          cashierId: sr.cashierId ?? null,
          cashierName: sr.cashierName || "",
          openedAt: sr.openedAt ? new Date(sr.openedAt) : new Date(),
          closedAt: sr.closedAt ? new Date(sr.closedAt) : new Date(),
          expectedCash: Number(sr.expectedCash) || 0,
          actualCash: Number(sr.actualCash) || 0,
          variance: Number(sr.variance) || 0,
          totalOrders: Number(sr.totalOrders) || 0,
          cashOrders: Number(sr.cashOrders) || 0,
          qrisTotal: Number(sr.qrisTotal) || 0,
          debitTotal: Number(sr.debitTotal) || 0,
          note: sr.note || "",
          createdAt: sr.createdAt ? new Date(sr.createdAt) : new Date(),
        }));
        await insertChunked(tx, shiftReports, rows);
      }

      // 5. Reset sequence ID PostgreSQL pada seluruh tabel serial
      const tablesToResetSeq = [
        "store_settings",
        "users",
        "categories",
        "ingredients",
        "products",
        "variants",
        "modifiers",
        "modifier_ingredients",
        "recipe_items",
        "orders",
        "order_items",
        "cash_movements",
        "shift_reports",
      ];

      for (const tName of tablesToResetSeq) {
        await tx.execute(
          sql.raw(`
            SELECT setval(
              pg_get_serial_sequence('${tName}', 'id'),
              COALESCE((SELECT MAX(id) + 1 FROM ${tName}), 1),
              false
            );
          `)
        );
      }
    });

    // Reset recipe cache di memori server
    invalidateRecipeCache();

    return Response.json({
      ok: true,
      message: "Database berhasil dipulihkan dari file cadangan.",
      stats: {
        users: usersData.length,
        categories: categoriesData.length,
        products: productsData.length,
        ingredients: ingredientsData.length,
        orders: ordersData.length,
        orderItems: orderItemsData.length,
      },
    });
  } catch (err: any) {
    console.error("restore database error:", err);
    return Response.json(
      {
        error:
          "Gagal memulihkan database. Perubahan dibatalkan (rollback). Detail: " +
          (err?.message || "Kesalahan internal"),
      },
      { status: 500 }
    );
  }
}
