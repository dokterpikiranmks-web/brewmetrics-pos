import { db } from "@/db";
import {
  products,
  variants,
  recipeItems,
  ingredients,
  categories,
} from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { invalidateRecipeCache } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireRole(["cashier", "manager", "owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const [allProducts, allVariants, allRecipes, allIngredients, allCategories] =
      await Promise.all([
        db.select().from(products).orderBy(asc(products.id)),
        db.select().from(variants),
        db.select().from(recipeItems),
        db.select().from(ingredients),
        db.select().from(categories),
      ]);

    const ingMap = new Map(allIngredients.map((i) => [i.id, i]));
    const varMap = new Map(allVariants.map((v) => [v.id, v.name]));
    const catMap = new Map(allCategories.map((c) => [c.id, c.name]));

    // Group variants by productId
    const variantsByProd = new Map<number, typeof allVariants>();
    for (const v of allVariants) {
      const arr = variantsByProd.get(v.productId) ?? [];
      arr.push(v);
      variantsByProd.set(v.productId, arr);
    }

    // Group recipes by productId
    const recipesByProd = new Map<number, typeof allRecipes>();
    for (const r of allRecipes) {
      const arr = recipesByProd.get(r.productId) ?? [];
      arr.push(r);
      recipesByProd.set(r.productId, arr);
    }

    const result = allProducts.map((p) => {
      const pVariants = variantsByProd.get(p.id) ?? [];
      const pRecipes = recipesByProd.get(p.id) ?? [];

      let calculatedHpp = 0;
      const recipeDetail = pRecipes.map((r) => {
        const ing = ingMap.get(r.ingredientId);
        const costPerUnit = ing?.costPerUnit ?? 0;
        const lineCost = r.qty * costPerUnit;
        calculatedHpp += lineCost;

        return {
          id: r.id,
          ingredientId: r.ingredientId,
          ingredientName: ing?.name ?? "Bahan Baku",
          unit: ing?.unit ?? "g",
          costPerUnit: costPerUnit,
          qty: r.qty,
          variantId: r.variantId,
          variantName: r.variantId ? (varMap.get(r.variantId) ?? null) : null,
        };
      });

      return {
        id: p.id,
        categoryId: p.categoryId,
        categoryName: catMap.get(p.categoryId) ?? "Umum",
        name: p.name,
        tagline: p.tagline,
        price: p.price,
        hpp: p.hpp > 0 ? p.hpp : Math.round(calculatedHpp),
        color: p.color,
        icon: p.icon,
        imageUrl: p.imageUrl ?? "",
        isActive: p.isActive,
        variants: pVariants.map((v) => ({
          id: v.id,
          name: v.name,
          priceDelta: v.priceDelta,
        })),
        recipe: recipeDetail,
      };
    });

    return Response.json({ products: result });
  } catch (err) {
    console.error("fetch products error:", err);
    return Response.json({ error: "Gagal mengambil data produk dan resep." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { error } = await requireRole(["manager", "owner"]);
  if (error) return error;

  await ensureSeeded();

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
      variants?: { name: string; priceDelta: number }[];
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
    const rawVariants = Array.isArray(body.variants) ? body.variants : [];
    const rawRecipe = Array.isArray(body.recipe) ? body.recipe : [];

    // 1. Verifikasi Kategori Ada di Database
    const categoryExists = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (categoryExists.length === 0) {
      return Response.json({ error: "Kategori yang dipilih tidak ditemukan." }, { status: 400 });
    }

    // 2. SERVER-SIDE HPP CALCULATION & VALIDATION
    // Ambil data bahan baku dari database untuk menghitung HPP yang sebenarnya
    let serverCalculatedHpp = 0;
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

    const finalHpp = Math.round(serverCalculatedHpp);

    // 3. DATABASE TRANSACTION
    const createdProduct = await db.transaction(async (tx) => {
      // Simpan Produk
      const [newProduct] = await tx
        .insert(products)
        .values({
          categoryId,
          name,
          tagline,
          price,
          hpp: finalHpp,
          color,
          icon,
          imageUrl,
          isActive,
        })
        .returning();

      // Simpan Varian
      const variantMap = new Map<string, number>();
      if (rawVariants.length > 0) {
        const createdVariants = await tx
          .insert(variants)
          .values(
            rawVariants.map((v) => ({
              productId: newProduct.id,
              name: v.name.trim(),
              priceDelta: Number(v.priceDelta) || 0,
            }))
          )
          .returning();

        for (const cv of createdVariants) {
          variantMap.set(cv.name.toLowerCase(), cv.id);
        }
      }

      // Simpan Resep (Bill of Materials)
      if (rawRecipe.length > 0) {
        const recipeInserts = rawRecipe.map((r) => {
          let targetVariantId: number | null = null;
          if (r.variantName) {
            targetVariantId = variantMap.get(r.variantName.trim().toLowerCase()) ?? null;
          }
          return {
            productId: newProduct.id,
            variantId: targetVariantId,
            ingredientId: r.ingredientId,
            qty: Number(r.qty),
          };
        });

        await tx.insert(recipeItems).values(recipeInserts);
      }

      return newProduct;
    });

    // Reset in-memory cache resep untuk POS
    invalidateRecipeCache();

    return Response.json(
      {
        success: true,
        product: createdProduct,
        serverHpp: finalHpp,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("create product error:", err);
    return Response.json({ error: "Gagal menyimpan produk dan resep." }, { status: 500 });
  }
}
