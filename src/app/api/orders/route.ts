import { db } from "@/db";
import { orders } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { createOrder, OrderError } from "@/lib/orders";
import type { CreateOrderPayload, TodayOrderDto } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireRole(["cashier", "manager", "owner"]);
  if (error) return error;

  const rows = await db
    .select()
    .from(orders)
    .where(sql`${orders.createdAt} >= date_trunc('day', now())`)
    .orderBy(desc(orders.createdAt))
    .limit(60);

  const dto: TodayOrderDto[] = rows.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    cashierName: o.cashierName,
    paymentMethod: o.paymentMethod,
    customerName: o.customerName ?? "Umum",
    orderType: (o.orderType as any) ?? "dine-in",
    tableNumber: o.tableNumber ?? "",
    discountAmount: o.discountAmount ?? 0,
    total: o.total || (o.subtotal + (o.tax ?? 0) + (o.serviceCharge ?? 0)),
    itemCount: o.itemCount,
    status: o.status as "paid" | "void",
    createdAt: o.createdAt.toISOString(),
    isOfflineSync: o.isOfflineSync,
  }));
  return Response.json({ orders: dto });
}

export async function POST(req: Request) {
  const { user, error } = await requireRole(["cashier", "manager", "owner"]);
  if (error || !user) return error!;

  try {
    const payload = (await req.json()) as CreateOrderPayload;
    if (!["cash", "qris", "debit", "transfer"].includes(payload.paymentMethod)) {
      return Response.json({ error: "Metode pembayaran tidak valid." }, { status: 400 });
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
