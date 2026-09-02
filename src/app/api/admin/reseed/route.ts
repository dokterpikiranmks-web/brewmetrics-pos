import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { invalidateRecipeCache } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export async function POST() {
  const { error } = await requireRole(["owner"]);
  if (error) return error;
  try {
    await ensureSeeded(true);
    invalidateRecipeCache();
    return Response.json({ ok: true });
  } catch (e) {
    console.error("reseed error", e);
    return Response.json({ error: "Gagal reset data demo." }, { status: 500 });
  }
}
