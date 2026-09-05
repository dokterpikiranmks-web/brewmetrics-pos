import { db } from "@/db";
import { orders, cashMovements, shiftReports } from "@/db/schema";
import { sql, desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Sesi telah berakhir. Silakan login kembali." }, { status: 401 });
    }

    const body = (await req.json()) as { actualCash?: number; note?: string };
    if (body.actualCash === undefined || body.actualCash === null || isNaN(Number(body.actualCash))) {
      return Response.json({ error: "Total uang tunai fisik harus diisi." }, { status: 400 });
    }

    const actualCash = Math.max(0, Math.round(Number(body.actualCash)));
    const note = (body.note ?? "").trim();

    // 1. Tentukan batas awal shift (openedAt) dari laporan tutup shift terakhir
    const lastReport = await db
      .select({ closedAt: shiftReports.closedAt })
      .from(shiftReports)
      .orderBy(desc(shiftReports.closedAt))
      .limit(1);

    const openedAt = lastReport[0]?.closedAt ?? new Date(new Date().setHours(0, 0, 0, 0));
    const closedAt = new Date();

    // 2. Hitung transaksi penjualan sejak shift dibuka
    const orderStats = await db.execute(sql`
      SELECT 
        COUNT(*)::int AS total_orders,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN COALESCE(NULLIF(total, 0), subtotal) ELSE 0 END), 0)::int AS cash_total,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN 1 ELSE 0 END), 0)::int AS cash_orders,
        COALESCE(SUM(CASE WHEN payment_method = 'qris' THEN COALESCE(NULLIF(total, 0), subtotal) ELSE 0 END), 0)::int AS qris_total,
        COALESCE(SUM(CASE WHEN payment_method = 'debit' THEN COALESCE(NULLIF(total, 0), subtotal) ELSE 0 END), 0)::int AS debit_total
      FROM orders
      WHERE status = 'paid' AND created_at >= ${openedAt} AND created_at <= ${closedAt}
    `);

    // 3. Hitung mutasi kas masuk dan keluar operasional sejak shift dibuka
    const cashStats = await db.execute(sql`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'in' THEN amount ELSE 0 END), 0)::int AS cash_in,
        COALESCE(SUM(CASE WHEN type = 'out' THEN amount ELSE 0 END), 0)::int AS cash_out
      FROM cash_movements
      WHERE created_at >= ${openedAt} AND created_at <= ${closedAt}
    `);

    interface OrderStatsRow {
      total_orders: number;
      cash_total: number;
      cash_orders: number;
      qris_total: number;
      debit_total: number;
    }

    interface CashStatsRow {
      cash_in: number;
      cash_out: number;
    }

    const oRow = ((orderStats as unknown as { rows: OrderStatsRow[] }).rows[0] ?? {
      total_orders: 0,
      cash_total: 0,
      cash_orders: 0,
      qris_total: 0,
      debit_total: 0,
    }) as OrderStatsRow;

    const cRow = ((cashStats as unknown as { rows: CashStatsRow[] }).rows[0] ?? {
      cash_in: 0,
      cash_out: 0,
    }) as CashStatsRow;

    // Expected cash di laci = Penjualan Tunai + Kas Masuk Operasional - Kas Keluar Operasional
    const expectedCash = Math.max(0, oRow.cash_total + cRow.cash_in - cRow.cash_out);
    const variance = actualCash - expectedCash;

    // 4. Simpan hasil Blind Z-Report ke tabel shift_reports
    const [savedReport] = await db
      .insert(shiftReports)
      .values({
        cashierId: user.id,
        cashierName: user.name,
        openedAt,
        closedAt,
        expectedCash,
        actualCash,
        variance,
        totalOrders: oRow.total_orders,
        cashOrders: oRow.cash_orders,
        qrisTotal: oRow.qris_total,
        debitTotal: oRow.debit_total,
        note,
      })
      .returning();

    return Response.json({
      success: true,
      report: {
        id: savedReport.id,
        cashierId: savedReport.cashierId,
        cashierName: savedReport.cashierName,
        openedAt: savedReport.openedAt.toISOString(),
        closedAt: savedReport.closedAt.toISOString(),
        expectedCash: savedReport.expectedCash,
        actualCash: savedReport.actualCash,
        variance: savedReport.variance,
        totalOrders: savedReport.totalOrders,
        cashOrders: savedReport.cashOrders,
        qrisTotal: savedReport.qrisTotal,
        debitTotal: savedReport.debitTotal,
        note: savedReport.note,
        createdAt: savedReport.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("close shift error:", error);
    return Response.json({ error: "Gagal memproses tutup shift." }, { status: 500 });
  }
}
