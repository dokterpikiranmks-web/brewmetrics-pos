import { db } from "@/db";
import { cashMovements } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireRole(["owner", "manager"]);
  if (error) return error;
  const rows = await db.select().from(cashMovements).orderBy(desc(cashMovements.createdAt)).limit(30);
  return Response.json({
    movements: rows.map((m) => ({
      id: m.id, type: m.type, amount: m.amount, note: m.note, userName: m.userName,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const { user, error } = await requireRole(["owner", "manager"]);
  if (error || !user) return error!;
  try {
    const body = (await req.json()) as { type?: "in" | "out"; amount?: number; note?: string };
    if (!["in", "out"].includes(body.type ?? "")) {
      return Response.json({ error: "Tipe harus in/out." }, { status: 400 });
    }
    const amount = Math.round(Number(body.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: "Nominal harus lebih dari nol." }, { status: 400 });
    }
    const [created] = await db
      .insert(cashMovements)
      .values({ type: body.type!, amount, note: (body.note ?? "").trim() || "Catatan kas manual", userName: user.name })
      .returning();
    return Response.json({ movement: created });
  } catch (e) {
    console.error("cash movement error", e);
    return Response.json({ error: "Gagal mencatat kas." }, { status: 500 });
  }
}
