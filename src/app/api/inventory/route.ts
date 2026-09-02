import { db } from "@/db";
import { ingredients } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { buildIngredientDtos } from "@/lib/forecast";
import { invalidateRecipeCache } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireRole(["cashier", "manager", "owner"]);
  if (error) return error;
  const dtos = await buildIngredientDtos();
  return Response.json({ ingredients: dtos });
}

export async function POST(req: Request) {
  const { user, error } = await requireRole(["manager", "owner"]);
  if (error || !user) return error!;
  try {
    const body = (await req.json()) as {
      name?: string; unit?: "g" | "ml" | "pcs"; stockQty?: number;
      lowThreshold?: number; costPerUnit?: number;
    };
    if (!body.name?.trim() || !["g", "ml", "pcs"].includes(body.unit ?? "")) {
      return Response.json({ error: "Nama & satuan bahan wajib diisi (g/ml/pcs)." }, { status: 400 });
    }
    const [created] = await db
      .insert(ingredients)
      .values({
        name: body.name.trim(),
        unit: body.unit!,
        stockQty: Math.max(0, Number(body.stockQty) || 0),
        lowThreshold: Math.max(0, Number(body.lowThreshold) || 0),
        costPerUnit: Math.max(0, Number(body.costPerUnit) || 0),
      })
      .returning();
    invalidateRecipeCache();
    return Response.json({ ingredient: created });
  } catch (e) {
    console.error("add ingredient error", e);
    return Response.json({ error: "Gagal menambah bahan." }, { status: 500 });
  }
}
