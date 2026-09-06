import { db } from "@/db";
import {
  products,
  variants,
  recipeItems,
  ingredients,
  categories,
  orderItems,
  bundleItems,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { invalidateRecipeCache } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["cashier", "manager", "owner"]);
  if (error) return error;

  await ensureSeeded();
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id || isNaN(id)) {
    return Response.json({ error: "ID produk tidak valid." }, { status: 400 });
  }

  try {
    const [p] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!p) {
      return Response.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    const [allVariants, allRecipes, allIngredients, [cat], allBundleItems, allProds] = await Promise.all([
      db.select().from(variants).where(eq(variants.productId, id)),
      db.select().from(recipeItems).where(eq(recipeItems.productId, id)),
      db.select().from(ingredients),
      db.select().from(categories).where(eq(categories.id, p.categoryId)).limit(1),
      db.select().from(bundleItems).where(eq(bundleItems.bundleProductId, id)),
      db.select().from(products),
    ]);

    const ingMap = new Map(allIngredients.map((i) => [i.id, i]));
    const varMap = new Map(allVariants.map((v) => [v.id, v.name]));
    const prodMap = new Map(allProds.map((pr) => [pr.id, pr]));

    let calculatedHpp = 0;
    const recipeDetail = allRecipes.map((r) => {
      const ing = ingMap.get(r.ingredientId);
      const costPerUnit = ing?.costPerUnit ?? 0;
      calculatedHpp += r.qty * costPerUnit;

      return {
        id: r.id,
        ingredientId: r.ingredientId,
        ingredientName: ing?.name ?? "Bahan Baku",
        unit: ing?.unit ?? "g",
        costPerUnit,
        qty: r.qty,
        variantId: r.variantId,
        variantName: r.variantId ? (varMap.get(r.variantId) ?? null) : null,
      };
    });

    return Response.json({
      product: {
        id: p.id,
        categoryId: p.categoryId,
        categoryName: cat?.name ?? "Umum",
        name: p.name,
        tagline: p.tagline,
        price: p.price,
        hpp: p.hpp > 0 ? p.hpp : Math.round(calculatedHpp),
        color: p.color,
        icon: p.icon,
        imageUrl: p.imageUrl ?? "",
        isActive: p.isActive,
        isBundle: p.isBundle ?? false,
        bundleItems: allBundleItems.map((b) => ({
          productId: b.subProductId,
          productName: prodMap.get(b.subProductId)?.name ?? "Produk",
          qty: b.qty,
        })),
        variants: allVariants.map((v) => ({
          id: v.id,
          name: v.name,
          priceDelta: v.priceDelta,
        })),
        recipe: recipeDetail,
      },
    });
  } catch (err) {
    console.error("get product error:", err);
    return Response.json({ error: "Gagal mengambil data produk." }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["manager", "owner"]);
  if (error) return error;

  await ensureSeeded();
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id || isNaN(id)) {
    return Response.json({ error: "ID produk tidak valid." }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      categoryId?: number;
      name?: string;
      tagline?: string;
      price?: number;
      color?: string;
      icon?: string;
      imageUrl?: string;
      isActive?: boolean;
      isBundle?: boolean;
      bundleItems?: { productId: number; qty: number }[];
      variants?: { id?: number; name: string; priceDelta: number }[];
      recipe?: {
        ingredientId: number;
        qty: number;
        variantName?: string | null;
      }[];
    };

    const name = (body.name ?? "").trim();
    if (!name) {
      return Response.json({ error: "Nama produk wajib diisi." }, { status: 400 });
    }

    const categoryId = Number(body.categoryId);
    if (!categoryId || isNaN(categoryId)) {
      return Response.json({ error: "Kategori produk wajib dipilih." }, { status: 400 });
    }

    const price = Number(body.price);
    if (isNaN(price) || price < 0) {
      return Response.json({ error: "Harga jual produk tidak valid." }, { status: 400 });
    }

    const color = (body.color ?? "#F59E0B").trim();
    const icon = (body.icon ?? "Coffee").trim();
    const imageUrl = (body.imageUrl ?? "").trim();
    const tagline = (body.tagline ?? "").trim();
    const isActive = body.isActive ?? true;
    const isBundle = Boolean(body.isBundle);
    const rawBundleItems = Array.isArray(body.bundleItems) ? body.bundleItems : [];
    const rawVariants = Array.isArray(body.variants) ? body.variants : [];
    const rawRecipe = Array.isArray(body.recipe) ? body.recipe : [];

    // 1. Verifikasi Produk Ada
    const [existingProduct] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!existingProduct) {
      return Response.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    // 2. Verifikasi Kategori Ada
    const [categoryExists] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (!categoryExists) {
      return Response.json({ error: "Kategori tidak ditemukan." }, { status: 400 });
    }

    // 3. SERVER-SIDE HPP RE-CALCULATION & VALIDATION
    let serverCalculatedHpp = 0;

    if (isBundle) {
      if (rawBundleItems.length === 0) {
        return Response.json({ error: "Paket bundling harus memiliki minimal 1 produk penyusun." }, { status: 400 });
      }
      const subProdIds = rawBundleItems.map((b) => Number(b.productId)).filter(Boolean);
      const subProds = await db.select().from(products).where(inArray(products.id, subProdIds));
      const subMap = new Map(subProds.map((sp) => [sp.id, sp]));

      for (const item of rawBundleItems) {
        const sp = subMap.get(Number(item.productId));
        if (!sp) {
          return Response.json({ error: `Sub-produk ID ${item.productId} tidak ditemukan.` }, { status: 400 });
        }
        const qty = Math.max(1, Number(item.qty) || 1);
        serverCalculatedHpp += sp.hpp * qty;
      }
    } else {
      const ingIds = rawRecipe.map((r) => r.ingredientId);

      if (ingIds.length > 0) {
        const dbIngredients = await db
          .select()
          .from(ingredients)
          .where(inArray(ingredients.id, ingIds));

        const ingMap = new Map(dbIngredients.map((i) => [i.id, i]));

        for (const item of rawRecipe) {
          const ing = ingMap.get(item.ingredientId);
          if (!ing) {
            return Response.json(
              { error: `Bahan baku dengan ID ${item.ingredientId} tidak ditemukan di database.` },
              { status: 400 }
            );
          }
          if (item.qty <= 0) {
            return Response.json(
              { error: `Takaran untuk bahan ${ing.name} harus lebih besar dari 0.` },
              { status: 400 }
            );
          }
          serverCalculatedHpp += item.qty * ing.costPerUnit;
        }
      }
    }

    const finalHpp = Math.round(serverCalculatedHpp);

    // 4. DATABASE TRANSACTION
    const updated = await db.transaction(async (tx) => {
      // Update data produk
      const [pUpdated] = await tx
        .update(products)
        .set({
          categoryId,
          name,
          tagline,
          price,
          hpp: finalHpp,
          color,
          icon,
          imageUrl,
          isActive,
          isBundle,
        })
        .where(eq(products.id, id))
        .returning();

      // Hapus bundleItems lama & masukkan bundleItems baru jika isBundle
      await tx.delete(bundleItems).where(eq(bundleItems.bundleProductId, id));
      if (isBundle && rawBundleItems.length > 0) {
        await tx.insert(bundleItems).values(
          rawBundleItems.map((b) => ({
            bundleProductId: id,
            subProductId: Number(b.productId),
            qty: Math.max(1, Number(b.qty) || 1),
          }))
        );
      }

      // Hapus varian lama & masukkan varian baru jika bukan bundle
      await tx.delete(variants).where(eq(variants.productId, id));

      const variantMap = new Map<string, number>();
      if (!isBundle && rawVariants.length > 0) {
        const createdVariants = await tx
          .insert(variants)
          .values(
            rawVariants.map((v) => ({
              productId: id,
              name: v.name.trim(),
              priceDelta: Number(v.priceDelta) || 0,
            }))
          )
          .returning();

        for (const cv of createdVariants) {
          variantMap.set(cv.name.toLowerCase(), cv.id);
        }
      }

      // Hapus resep lama & masukkan resep baru jika bukan bundle
      await tx.delete(recipeItems).where(eq(recipeItems.productId, id));

      if (!isBundle && rawRecipe.length > 0) {
        const recipeInserts = rawRecipe.map((r) => {
          let targetVariantId: number | null = null;
          if (r.variantName) {
            targetVariantId = variantMap.get(r.variantName.trim().toLowerCase()) ?? null;
          }
          return {
            productId: id,
            variantId: targetVariantId,
            ingredientId: r.ingredientId,
            qty: Number(r.qty),
          };
        });

        await tx.insert(recipeItems).values(recipeInserts);
      }

      return pUpdated;
    });

    // Reset cache resep
    invalidateRecipeCache();

    return Response.json({
      success: true,
      product: updated,
      serverHpp: finalHpp,
    });
  } catch (err) {
    console.error("update product error:", err);
    return Response.json({ error: "Gagal memperbarui produk dan resep." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["manager", "owner"]);
  if (error) return error;

  await ensureSeeded();
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id || isNaN(id)) {
    return Response.json({ error: "ID produk tidak valid." }, { status: 400 });
  }

  try {
    // Cek apakah produk pernah digunakan di order history (order_items)
    const referencedInOrders = await db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.productId, id))
      .limit(1);

    if (referencedInOrders.length > 0) {
      // Jika pernah digunakan di pesanan terdahulu, lakukan soft delete (nonaktifkan)
      // agar integritas riwayat transaksi dan laporan keuangan masa lalu tidak korup
      await db
        .update(products)
        .set({ isActive: false })
        .where(eq(products.id, id));

      invalidateRecipeCache();
      return Response.json({
        success: true,
        message: "Produk dinonaktifkan dari katalog POS karena memiliki riwayat transaksi.",
        softDeleted: true,
      });
    }

    // Jika produk baru atau belum pernah dipesan, hapus resep, varian, bundleItems, dan produk secara permanen
    await db.transaction(async (tx) => {
      await tx.delete(bundleItems).where(eq(bundleItems.bundleProductId, id));
      await tx.delete(bundleItems).where(eq(bundleItems.subProductId, id));
      await tx.delete(recipeItems).where(eq(recipeItems.productId, id));
      await tx.delete(variants).where(eq(variants.productId, id));
      await tx.delete(products).where(eq(products.id, id));
    });

    invalidateRecipeCache();
    return Response.json({ success: true, softDeleted: false });
  } catch (err) {
    console.error("delete product error:", err);
    return Response.json({ error: "Gagal menghapus produk." }, { status: 500 });
  }
}
