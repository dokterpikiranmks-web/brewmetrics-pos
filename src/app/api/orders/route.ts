import { db } from "@/db";
import { orders } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { createOrder, OrderError } from "@/lib/orders";
import type { CreateOrderPayload, TodayOrderDto } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { user, error } = await requireRole(["cashier", "manager", "owner"]);
  if (error || !user) return error!;

  const url = new URL(req.url);
  const headerOutlet = req.headers.get("x-outlet-id");
  const outletParam = url.searchParams.get("outlet_id") ?? url.searchParams.get("outletId") ?? headerOutlet;

  let targetOutletId: number | null = null;
  if (user.role === "cashier") {
    // STRICT OUTLET ISOLATION:
    // Kasir hanya boleh melihat riwayat pesanan dari cabangnya sendiri
    targetOutletId = user.outletId ?? 1;
  } else {
    // Owner atau Manager
    if (outletParam && outletParam !== "all") {
      const parsed = Number(outletParam);
      if (!isNaN(parsed)) {
        targetOutletId = parsed;
      }
    }
  }

  const scope = url.searchParams.get("scope") || url.searchParams.get("all");
  const whereConditions: any[] = [];
  if (scope !== "all" && scope !== "true") {
    whereConditions.push(sql`${orders.createdAt} >= date_trunc('day', now())`);
  }
  if (targetOutletId !== null) {
    whereConditions.push(eq(orders.outletId, targetOutletId));
  }

  let rows = await db
    .select()
    .from(orders)
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(60);

  // Fallback: jika belum ada pesanan hari ini dan scope bukan 'today_only',
  // tampilkan riwayat pesanan terbaru dari cabang ini agar kasir tetap dapat melihat data & cetak ulang
  if (rows.length === 0 && scope !== "today_only") {
    const fallbackConditions: any[] = [];
    if (targetOutletId !== null) {
      fallbackConditions.push(eq(orders.outletId, targetOutletId));
    }
    rows = await db
      .select()
      .from(orders)
      .where(fallbackConditions.length > 0 ? and(...fallbackConditions) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(30);
  }

  const dto: (TodayOrderDto & { outletId?: number | null })[] = rows.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    cashierName: o.cashierName,
    paymentMethod: o.paymentMethod,
    paymentBreakdown: (o.paymentBreakdown as any) ?? [],
    customerName: o.customerName ?? "Umum",
    orderType: (o.orderType as any) ?? "dine-in",
    tableNumber: o.tableNumber ?? "",
    discountAmount: o.discountAmount ?? 0,
    discountName: o.discountName ?? "",
    total: o.total || (o.subtotal + (o.tax ?? 0) + (o.serviceCharge ?? 0)),
    itemCount: o.itemCount,
    status: o.status as "paid" | "void",
    createdAt: o.createdAt.toISOString(),
    isOfflineSync: o.isOfflineSync,
    outletId: o.outletId ?? null,
  }));
  return Response.json({ orders: dto });
}

export async function POST(req: Request) {
  const { user, error } = await requireRole(["cashier", "manager", "owner"]);
  if (error || !user) return error!;

  try {
    const payload = (await req.json()) as CreateOrderPayload;
    if (!["cash", "qris", "debit", "transfer", "split"].includes(payload.paymentMethod)) {
      return Response.json({ error: "Metode pembayaran tidak valid." }, { status: 400 });
    }
    if (payload.paymentMethod === "split") {
      if (!Array.isArray(payload.paymentBreakdown) || payload.paymentBreakdown.length < 2) {
        return Response.json(
          { error: "Split pembayaran membutuhkan minimal 2 metode bayar." },
          { status: 400 }
        );
      }
      for (const item of payload.paymentBreakdown) {
        if (!["cash", "qris", "debit", "transfer"].includes(item.method) || item.amount <= 0) {
          return Response.json(
            { error: "Setiap rincian split pembayaran harus memiliki metode valid dan nominal di atas 0." },
            { status: 400 }
          );
        }
      }
    }

    // STRICT OUTLET ISOLATION:
    // Pastikan pesanan tercatat dengan outletId cabang kasir yang login
    if (user.role === "cashier") {
      payload.outletId = user.outletId ?? 1;
    } else {
      payload.outletId = payload.outletId ?? user.outletId ?? 1;
    }

    const receipt = await createOrder(payload, user);
    return Response.json({ receipt });
  } catch (e) {
    if (e instanceof OrderError) {
      return Response.json({ error: e.message, code: e.code, details: e.details ?? null }, { status: e.status });
    }
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505") {
      return Response.json({ error: "Order duplikat terdeteksi (sudah tersinkron)." }, { status: 409 });
    }
    console.error("create order error", e);
    return Response.json({ error: "Gagal menyimpan pesanan." }, { status: 500 });
  }
}
