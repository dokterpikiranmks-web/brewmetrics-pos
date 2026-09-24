import { db } from "@/db";
import { categories, modifiers, products, variants } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import type { CatalogDto } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { user, error } = await requireRole(["cashier", "manager", "owner"]);
  if (error) return error;
  await ensureSeeded();

  const url = new URL(req.url);
  const headerOutlet = req.headers.get("x-outlet-id");
  const outletParam = url.searchParams.get("outlet_id") ?? url.searchParams.get("outletId") ?? headerOutlet;
  const role = user?.role ?? (req.headers.get("x-user-role") as any);

  const userOutletId = user?.outletId ?? 1;

  let targetOutletId: number | null = null;
  if (role === "cashier") {
    // STRICT OUTLET ISOLATION: Kasir tidak boleh bypass
    targetOutletId = userOutletId;
  } else if (outletParam && outletParam !== "all") {
    const parsed = Number(outletParam);
    if (!isNaN(parsed)) {
      targetOutletId = parsed;
    }
  }

  const catWhere = targetOutletId !== null ? eq(categories.outletId, targetOutletId) : undefined;
  const prodWhere = targetOutletId !== null
    ? and(eq(products.isActive, true), eq(products.outletId, targetOutletId))
    : eq(products.isActive, true);

  const [cats, prods, vars, mods] = await Promise.all([
    catWhere
      ? db.select().from(categories).where(catWhere).orderBy(asc(categories.sortOrder))
      : db.select().from(categories).orderBy(asc(categories.sortOrder)),
    db.select().from(products).where(prodWhere).orderBy(asc(products.id)),
    db.select().from(variants),
    db.select().from(modifiers).where(eq(modifiers.isActive, true)),
  ]);

  const dto: CatalogDto = {
    categories: cats.map((c) => ({ id: c.id, name: c.name, icon: c.icon, outletId: c.outletId })),
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
      aiMood: p.aiMood ?? "",
    })),
    variants: vars.map((v) => ({ id: v.id, productId: v.productId, name: v.name, priceDelta: v.priceDelta })),
    modifiers: mods.map((m) => ({ id: m.id, name: m.name, price: m.price })),
  };
  return Response.json(dto);
}
