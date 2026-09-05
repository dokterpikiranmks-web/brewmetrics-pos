import { db } from "@/db";
import { cashMovements } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/cash-movements
 * Mengambil 30 riwayat mutasi kas terakhir (Owner, Manajer, Kasir).
 */
export async function GET() {
  const { error } = await requireRole(["owner", "manager", "cashier"]);
  if (error) return error;

  try {
    const rows = await db
      .select()
      .from(cashMovements)
      .orderBy(desc(cashMovements.createdAt))
      .limit(30);

    return Response.json({
      movements: rows.map((m) => ({
        id: m.id,
        type: m.type,
        amount: m.amount,
        note: m.note,
        userName: m.userName,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("fetch cash movements error:", err);
    return Response.json(
      { error: "Gagal mengambil riwayat mutasi kas." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cash-movements
 * Mencatat transaksi kas masuk atau kas keluar operasional / petty cash.
 * Dapat diakses oleh Owner, Manajer, dan Kasir POS.
 */
export async function POST(req: Request) {
  const { user, error } = await requireRole(["owner", "manager", "cashier"]);
  if (error || !user) return error!;

  try {
    const body = (await req.json()) as {
      type?: "in" | "out";
      amount?: number;
      note?: string;
    };

    if (!["in", "out"].includes(body.type ?? "")) {
      return Response.json(
        { error: "Tipe mutasi kas harus 'in' (kas masuk) atau 'out' (kas keluar)." },
        { status: 400 }
      );
    }

    const amount = Math.round(Number(body.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json(
        { error: "Nominal kas harus berupa angka positif lebih dari nol." },
        { status: 400 }
      );
    }

    const note = (body.note ?? "").trim() || "Catatan kas operasional";

    const [created] = await db
      .insert(cashMovements)
      .values({
        type: body.type!,
        amount,
        note,
        userName: user.name,
      })
      .returning();

    return Response.json({ movement: created });
  } catch (e) {
    console.error("cash movement error", e);
    return Response.json(
      { error: "Gagal mencatat mutasi kas operasional." },
      { status: 500 }
    );
  }
}
