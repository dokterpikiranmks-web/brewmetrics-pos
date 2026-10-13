import { db } from "@/db";
import { categories, modifiers, products, variants } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import type { CatalogDto } from "@/lib/types";
import { normalizeBranchId } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { user, error } = await requireRole(["cashier", "manager", "owner"]);
  if (error) return error;
  await ensureSeeded();

  const url = new URL(req.url);
  const headerBranch = req.headers.get("x-branch-id");
  const branchParam = url.searchParams.get("branch_id") ?? url.searchParams.get("branchId") ?? headerBranch;
  const targetBranch = normalizeBranchId(branchParam);

  const catWhere = eq(categories.branchId, targetBranch);
  const prodWhere = and(
    eq(products.isActive, true),
    eq(products.branchId, targetBranch)
  );

  const [cats, prods, vars, mods] = await Promise.all([
    db.select().from(categories).where(catWhere).orderBy(asc(categories.sortOrder)),
    db.select().from(products).where(prodWhere).orderBy(asc(products.id)),
    db.select().from(variants),
    db.select().from(modifiers).where(eq(modifiers.isActive, true)),
  ]);

  const dto: CatalogDto = {
    categories: cats.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      outletId: c.outletId,
      branchId: c.branchId as any,
    })),
    products: prods.map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      name: p.name,
      tagline: p.tagline,
      price: p.price,
      color: p.color,
      icon: p.icon,
      imageUrl: p.imageUrl ?? "",
      isBundle: p.isBundle ?? false,
      outletId: p.outletId,
      branchId: p.branchId as any,
      aiMood: p.aiMood ?? "",
      isActive: p.isActive,
    })),
    variants: vars.map((v) => ({ id: v.id, productId: v.productId, name: v.name, priceDelta: v.priceDelta })),
    modifiers: mods.map((m) => ({ id: m.id, name: m.name, price: m.price })),
  };
  return Response.json(dto);
}
