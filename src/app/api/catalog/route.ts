import { db } from "@/db";
import { categories, modifiers, products, variants } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import type { CatalogDto } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireRole(["cashier", "manager", "owner"]);
  if (error) return error;
  await ensureSeeded();

  const [cats, prods, vars, mods] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
    db.select().from(products).where(eq(products.isActive, true)),
    db.select().from(variants),
    db.select().from(modifiers).where(eq(modifiers.isActive, true)),
  ]);

  const dto: CatalogDto = {
    categories: cats.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
    products: prods.map((p) => ({
      id: p.id, categoryId: p.categoryId, name: p.name, tagline: p.tagline,
      price: p.price, color: p.color, icon: p.icon,
    })),
    variants: vars.map((v) => ({ id: v.id, productId: v.productId, name: v.name, priceDelta: v.priceDelta })),
    modifiers: mods.map((m) => ({ id: m.id, name: m.name, price: m.price })),
  };
  return Response.json(dto);
}
