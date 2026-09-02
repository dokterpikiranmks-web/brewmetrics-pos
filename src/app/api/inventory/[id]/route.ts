import { db } from "@/db";
import { cashMovements, ingredients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { invalidateRecipeCache } from "@/lib/recipes";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Params) {
  const { user, error } = await requireRole(["manager", "owner"]);
  if (error || !user) return error!;

  const { id } = await ctx.params;
  const ingId = Number(id);
  if (!Number.isFinite(ingId)) {
    return Response.json({ error: "ID tidak valid." }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      mode?: "restock" | "set";
      qty?: number;
      costPerUnit?: number;
      lowThreshold?: number;
      name?: string;
      recordExpense?: boolean;
      expenseAmount?: number;
    };
    const current = await db.query.ingredients.findFirst({ where: eq(ingredients.id, ingId) });
    if (!current) return Response.json({ error: "Bahan tidak ditemukan." }, { status: 404 });

    const qty = Number(body.qty);
    let newStock = current.stockQty;
    if (body.mode === "restock") {
      if (!Number.isFinite(qty) || qty <= 0) {
        return Response.json({ error: "Jumlah restock harus lebih dari nol." }, { status: 400 });
      }
      newStock = current.stockQty + qty;
    } else if (body.mode === "set") {
      if (!Number.isFinite(qty) || qty < 0) {
        return Response.json({ error: "Jumlah stok tidak valid." }, { status: 400 });
      }
      newStock = qty;
    }

    const updates: Partial<typeof ingredients.$inferInsert> = { updatedAt: new Date() };
    if (body.mode === "restock" || body.mode === "set") updates.stockQty = newStock;
    if (body.costPerUnit !== undefined && Number.isFinite(Number(body.costPerUnit))) {
      updates.costPerUnit = Math.max(0, Number(body.costPerUnit));
    }
    if (body.lowThreshold !== undefined && Number.isFinite(Number(body.lowThreshold))) {
      updates.lowThreshold = Math.max(0, Number(body.lowThreshold));
    }
    if (body.name?.trim()) updates.name = body.name.trim();

    const [updated] = await db.update(ingredients).set(updates).where(eq(ingredients.id, ingId)).returning();

    // Opsional: catat pengeluaran kas untuk restock
    const expense = Number(body.expenseAmount);
    if (body.recordExpense && Number.isFinite(expense) && expense > 0 && body.mode === "restock") {
      await db.insert(cashMovements).values({
        type: "out",
        amount: Math.round(expense),
        note: `Restock ${current.name} (+${body.qty} ${current.unit})`,
        userName: user.name,
      });
    }

    invalidateRecipeCache();
    return Response.json({ ingredient: updated });
  } catch (e) {
    console.error("update ingredient error", e);
    return Response.json({ error: "Gagal memperbarui bahan." }, { status: 500 });
  }
}
