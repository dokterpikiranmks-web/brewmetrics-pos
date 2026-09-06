import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { voidOrder, OrderError } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: currentUser, error } = await requireRole(["cashier", "manager", "owner"]);
  if (error || !currentUser) return error!;

  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId) || orderId <= 0) {
      return Response.json({ error: "ID pesanan tidak valid." }, { status: 400 });
    }

    const body = (await req.json()) as { pin?: string; reason?: string };
    const pin = (body.pin ?? "").trim();
    const reason = (body.reason ?? "").trim();

    if (!pin || pin.length < 4) {
      return Response.json({ error: "PIN otorisasi supervisor minimal 4 digit." }, { status: 400 });
    }

    // Otorisasi Supervisor (Manager atau Owner)
    const supervisor = await db.query.users.findFirst({
      where: and(
        eq(users.pin, pin),
        eq(users.active, true),
        inArray(users.role, ["manager", "owner"])
      ),
    });

    if (!supervisor) {
      // Cek apakah PIN milik kasir
      const cashier = await db.query.users.findFirst({
        where: and(eq(users.pin, pin), eq(users.active, true), eq(users.role, "cashier")),
      });
      if (cashier) {
        return Response.json(
          { error: `Akses ditolak: ${cashier.name} adalah Kasir. Void transaksi wajib disetujui Manager atau Owner.` },
          { status: 403 }
        );
      }
      return Response.json({ error: "PIN supervisor salah atau akun tidak aktif." }, { status: 401 });
    }

    const result = await voidOrder(
      orderId,
      { id: supervisor.id, name: supervisor.name, role: supervisor.role },
      reason
    );

    return Response.json({
      ok: true,
      message: `Pesanan ${result.orderNumber} berhasil dibatalkan oleh ${supervisor.name} (${supervisor.role}).`,
      orderNumber: result.orderNumber,
    });
  } catch (e) {
    if (e instanceof OrderError) {
      return Response.json({ error: e.message, code: e.code }, { status: e.status });
    }
    console.error("void order error", e);
    return Response.json({ error: "Gagal membatalkan pesanan." }, { status: 500 });
  }
}
