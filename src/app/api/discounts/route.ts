import { db } from "@/db";
import { discounts, products, outlets } from "@/db/schema";
import { desc, eq, and, or, isNull } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import type { DiscountDto, DiscountType, DiscountScope } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/discounts
 * Mengambil daftar promo/diskon master.
 * Kasir, manajer, dan owner berhak mengakses.
 * Parameter query:
 *   - activeOnly: "true" | "false" (jika true, hanya mengambil promo yang is_active = true)
 *   - outletId: number (jika diberikan, hanya tampilkan promo global (outletId IS NULL) atau cabang tersebut)
 */
export async function GET(req: Request) {
  const { error } = await requireRole(["cashier", "manager", "owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const url = new URL(req.url);
    const activeOnly = url.searchParams.get("activeOnly") === "true" || url.searchParams.get("active") === "true";
    const outletIdParam = url.searchParams.get("outletId") ?? url.searchParams.get("outlet_id");
    const parsedOutletId = outletIdParam && outletIdParam !== "all" ? Number(outletIdParam) : null;

    let conditions: any[] = [];
    if (activeOnly) {
      conditions.push(eq(discounts.isActive, true));
    }
    if (parsedOutletId && !isNaN(parsedOutletId)) {
      conditions.push(or(isNull(discounts.outletId), eq(discounts.outletId, parsedOutletId)));
    }

    const whereClause = conditions.length > 1
      ? and(...conditions)
      : conditions.length === 1
        ? conditions[0]
        : undefined;

    const rows = whereClause
      ? await db.select().from(discounts).where(whereClause).orderBy(desc(discounts.id))
      : await db.select().from(discounts).orderBy(desc(discounts.id));

    // Ambil metadata produk & outlet untuk memperkaya DTO
    const productIds = rows.map((r) => r.targetProductId).filter((id): id is number => typeof id === "number");
    const outletIds = rows.map((r) => r.outletId).filter((id): id is number => typeof id === "number");

    const [allProducts, allOutlets] = await Promise.all([
      productIds.length > 0
        ? db.select({ id: products.id, name: products.name }).from(products)
        : Promise.resolve([]),
      outletIds.length > 0
        ? db.select({ id: outlets.id, name: outlets.name }).from(outlets)
        : Promise.resolve([]),
    ]);

    const productMap = new Map(allProducts.map((p) => [p.id, p.name]));
    const outletMap = new Map(allOutlets.map((o) => [o.id, o.name]));

    const dtoList: DiscountDto[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type as DiscountType,
      value: r.value,
      minOrder: r.minOrder,
      scope: (r.scope as DiscountScope) || "cart",
      targetProductId: r.targetProductId ?? null,
      targetProductName: r.targetProductId ? (productMap.get(r.targetProductId) ?? null) : null,
      outletId: r.outletId ?? null,
      outletName: r.outletId ? (outletMap.get(r.outletId) ?? null) : null,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return Response.json({ discounts: dtoList, data: dtoList });
  } catch (err) {
    console.error("fetch discounts error:", err);
    return Response.json({ error: "Gagal memuat master diskon." }, { status: 500 });
  }
}

/**
 * POST /api/discounts
 * Membuat promo/diskon baru (Khusus Manajer & Owner).
 */
export async function POST(req: Request) {
  const { error } = await requireRole(["manager", "owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const body = (await req.json()) as {
      name?: string;
      type?: DiscountType;
      value?: number;
      minOrder?: number;
      scope?: DiscountScope;
      targetProductId?: number | null;
      outletId?: number | null;
      isActive?: boolean;
    };

    const name = (body.name ?? "").trim();
    if (!name || name.length < 2) {
      return Response.json({ error: "Nama promo minimal 2 karakter." }, { status: 400 });
    }

    const type = body.type;
    if (!type || !["percentage", "fixed"].includes(type)) {
      return Response.json({ error: "Tipe promo harus 'percentage' atau 'fixed'." }, { status: 400 });
    }

    const rawValue = Number(body.value);
    if (isNaN(rawValue) || rawValue <= 0) {
      return Response.json({ error: "Nilai diskon harus lebih besar dari 0." }, { status: 400 });
    }

    if (type === "percentage" && rawValue > 100) {
      return Response.json({ error: "Diskon persentase maksimal 100%." }, { status: 400 });
    }

    const scope: DiscountScope = body.scope === "product" ? "product" : "cart";
    let targetProductId: number | null = null;
    if (scope === "product") {
      const prodId = Number(body.targetProductId);
      if (!prodId || isNaN(prodId)) {
        return Response.json({ error: "Pilih produk target untuk promo bertipe unit/menu." }, { status: 400 });
      }
      targetProductId = prodId;
    }

    let outletId: number | null = null;
    if (body.outletId !== undefined && body.outletId !== null) {
      const parsedOutId = Number(body.outletId);
      if (!isNaN(parsedOutId) && parsedOutId > 0) {
        outletId = parsedOutId;
      }
    }

    const value = Math.round(rawValue);
    const minOrder = Math.max(0, Math.round(Number(body.minOrder) || 0));
    const isActive = body.isActive ?? true;

    const [created] = await db
      .insert(discounts)
      .values({
        name,
        type,
        value,
        minOrder,
        scope,
        targetProductId,
        outletId,
        isActive,
      })
      .returning();

    // Ambil nama produk dan outlet jika terhubung
    let targetProductName: string | null = null;
    if (created.targetProductId) {
      const p = await db.query.products.findFirst({
        where: eq(products.id, created.targetProductId),
      });
      targetProductName = p?.name ?? null;
    }

    let outletName: string | null = null;
    if (created.outletId) {
      const o = await db.query.outlets.findFirst({
        where: eq(outlets.id, created.outletId),
      });
      outletName = o?.name ?? null;
    }

    const dto: DiscountDto = {
      id: created.id,
      name: created.name,
      type: created.type as DiscountType,
      value: created.value,
      minOrder: created.minOrder,
      scope: (created.scope as DiscountScope) || "cart",
      targetProductId: created.targetProductId ?? null,
      targetProductName,
      outletId: created.outletId ?? null,
      outletName,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };

    return Response.json({ success: true, discount: dto }, { status: 201 });
  } catch (err) {
    console.error("create discount error:", err);
    return Response.json({ error: "Gagal membuat promo baru." }, { status: 500 });
  }
}

/**
 * PATCH /api/discounts
 * Memperbarui promo atau toggle aktif/nonaktif (Khusus Manajer & Owner).
 */
export async function PATCH(req: Request) {
  const { error } = await requireRole(["manager", "owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const body = (await req.json()) as {
      id?: number;
      name?: string;
      type?: DiscountType;
      value?: number;
      minOrder?: number;
      scope?: DiscountScope;
      targetProductId?: number | null;
      outletId?: number | null;
      isActive?: boolean;
    };

    const id = Number(body.id);
    if (!id || isNaN(id)) {
      return Response.json({ error: "ID promo tidak valid." }, { status: 400 });
    }

    const existing = await db.query.discounts.findFirst({
      where: eq(discounts.id, id),
    });

    if (!existing) {
      return Response.json({ error: "Promo tidak ditemukan." }, { status: 404 });
    }

    const updateData: {
      name?: string;
      type?: DiscountType;
      value?: number;
      minOrder?: number;
      scope?: "cart" | "product";
      targetProductId?: number | null;
      outletId?: number | null;
      isActive?: boolean;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name || name.length < 2) {
        return Response.json({ error: "Nama promo minimal 2 karakter." }, { status: 400 });
      }
      updateData.name = name;
    }

    if (body.type !== undefined) {
      if (!["percentage", "fixed"].includes(body.type)) {
        return Response.json({ error: "Tipe promo harus 'percentage' atau 'fixed'." }, { status: 400 });
      }
      updateData.type = body.type;
    }

    if (body.value !== undefined) {
      const rawVal = Number(body.value);
      if (isNaN(rawVal) || rawVal <= 0) {
        return Response.json({ error: "Nilai diskon harus lebih besar dari 0." }, { status: 400 });
      }
      const targetType = updateData.type || existing.type;
      if (targetType === "percentage" && rawVal > 100) {
        return Response.json({ error: "Diskon persentase maksimal 100%." }, { status: 400 });
      }
      updateData.value = Math.round(rawVal);
    }

    if (body.minOrder !== undefined) {
      const minOrd = Number(body.minOrder);
      if (isNaN(minOrd) || minOrd < 0) {
        return Response.json({ error: "Syarat minimal belanja minimal 0." }, { status: 400 });
      }
      updateData.minOrder = Math.round(minOrd);
    }

    if (body.scope !== undefined) {
      const scopeVal: DiscountScope = body.scope === "product" ? "product" : "cart";
      updateData.scope = scopeVal;
      if (scopeVal === "product") {
        const prodId = Number(body.targetProductId ?? existing.targetProductId);
        if (!prodId || isNaN(prodId)) {
          return Response.json({ error: "Pilih produk target untuk promo bertipe unit/menu." }, { status: 400 });
        }
        updateData.targetProductId = prodId;
      } else {
        updateData.targetProductId = null;
      }
    } else if (body.targetProductId !== undefined) {
      const prodId = Number(body.targetProductId);
      updateData.targetProductId = isNaN(prodId) || prodId <= 0 ? null : prodId;
    }

    if (body.outletId !== undefined) {
      const outId = Number(body.outletId);
      updateData.outletId = isNaN(outId) || outId <= 0 ? null : outId;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = Boolean(body.isActive);
    }

    const [updated] = await db
      .update(discounts)
      .set(updateData)
      .where(eq(discounts.id, id))
      .returning();

    let targetProductName: string | null = null;
    if (updated.targetProductId) {
      const p = await db.query.products.findFirst({
        where: eq(products.id, updated.targetProductId),
      });
      targetProductName = p?.name ?? null;
    }

    let outletName: string | null = null;
    if (updated.outletId) {
      const o = await db.query.outlets.findFirst({
        where: eq(outlets.id, updated.outletId),
      });
      outletName = o?.name ?? null;
    }

    const dto: DiscountDto = {
      id: updated.id,
      name: updated.name,
      type: updated.type as DiscountType,
      value: updated.value,
      minOrder: updated.minOrder,
      scope: (updated.scope as DiscountScope) || "cart",
      targetProductId: updated.targetProductId ?? null,
      targetProductName,
      outletId: updated.outletId ?? null,
      outletName,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };

    return Response.json({ success: true, discount: dto });
  } catch (err) {
    console.error("patch discount error:", err);
    return Response.json({ error: "Gagal memperbarui promo." }, { status: 500 });
  }
}

/**
 * DELETE /api/discounts
 * Menghapus promo dari sistem (Khusus Manajer & Owner).
 */
export async function DELETE(req: Request) {
  const { error } = await requireRole(["manager", "owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const url = new URL(req.url);
    const paramId = url.searchParams.get("id");
    let targetId = paramId ? Number(paramId) : null;

    if (!targetId || isNaN(targetId)) {
      try {
        const body = await req.json();
        targetId = Number(body?.id);
      } catch {
        /* tidak ada body */
      }
    }

    if (!targetId || isNaN(targetId)) {
      return Response.json({ error: "ID promo yang akan dihapus tidak valid." }, { status: 400 });
    }

    await db.delete(discounts).where(eq(discounts.id, targetId));
    return Response.json({ success: true, message: "Promo berhasil dihapus." });
  } catch (err) {
    console.error("delete discount error:", err);
    return Response.json({ error: "Gagal menghapus promo." }, { status: 500 });
  }
}
