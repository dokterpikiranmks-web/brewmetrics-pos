import { db } from "@/db";
import { ingredients } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { buildIngredientDtos } from "@/lib/forecast";
import { invalidateRecipeCache } from "@/lib/recipes";
import { normalizeBranchId } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { error } = await requireRole(["cashier", "manager", "owner"]);
  if (error) return error;

  const url = new URL(req.url);
  const headerBranch = req.headers.get("x-branch-id");
  const branchParam = url.searchParams.get("branch_id") ?? url.searchParams.get("branchId") ?? headerBranch;
  const branchId = branchParam && branchParam !== "all" ? normalizeBranchId(branchParam) : null;

  const dtos = await buildIngredientDtos(undefined, branchId);
  return Response.json({ ingredients: dtos });
}

export async function POST(req: Request) {
  const { user, error } = await requireRole(["manager", "owner"]);
  if (error || !user) return error!;
  try {
    const body = (await req.json()) as {
      name?: string;
      unit?: "g" | "ml" | "pcs";
      stockQty?: number;
      lowThreshold?: number;
      costPerUnit?: number;
      branchId?: string;
      branch_id?: string;
    };
    if (!body.name?.trim() || !["g", "ml", "pcs"].includes(body.unit ?? "")) {
      return Response.json({ error: "Nama & satuan bahan wajib diisi (g/ml/pcs)." }, { status: 400 });
    }

    const branchId = normalizeBranchId(body.branchId || body.branch_id || req.headers.get("x-branch-id"));

    const [created] = await db
      .insert(ingredients)
      .values({
        name: body.name.trim(),
        unit: body.unit!,
        stockQty: Math.max(0, Number(body.stockQty) || 0),
        lowThreshold: Math.max(0, Number(body.lowThreshold) || 0),
        costPerUnit: Math.max(0, Number(body.costPerUnit) || 0),
        branchId,
      })
      .returning();
    invalidateRecipeCache();
    return Response.json({ ingredient: created });
  } catch (e) {
    console.error("add ingredient error", e);
    return Response.json({ error: "Gagal menambah bahan." }, { status: 500 });
  }
}
