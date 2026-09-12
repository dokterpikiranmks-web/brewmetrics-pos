import { db } from "@/db";
import { orders, cashMovements, shiftReports } from "@/db/schema";
import { sql, desc, and, eq, gte, lte } from "drizzle-orm";
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

    // 2. Ambil transaksi penjualan sejak shift dibuka dengan rekonsiliasi Split Payment
    const paidOrders = await db
      .select({
        paymentMethod: orders.paymentMethod,
        paymentBreakdown: orders.paymentBreakdown,
        total: orders.total,
        subtotal: orders.subtotal,
        tax: orders.tax,
        serviceCharge: orders.serviceCharge,
      })
      .from(orders)
      .where(
        and(
          eq(orders.status, "paid"),
          gte(orders.createdAt, openedAt),
          lte(orders.createdAt, closedAt)
        )
      );

    let cashTotal = 0;
    let cashOrders = 0;
    let qrisTotal = 0;
    let debitTotal = 0;

    for (const ord of paidOrders) {
      const orderTotal = ord.total || (ord.subtotal + (ord.tax ?? 0) + (ord.serviceCharge ?? 0));
      const breakdown = (ord.paymentBreakdown as Array<{ method: string; amount: number }>) || [];

      if (ord.paymentMethod === "split" && breakdown.length > 0) {
        let hasCash = false;
        for (const item of breakdown) {
          const amt = Number(item.amount) || 0;
          if (item.method === "cash") {
            cashTotal += amt;
            hasCash = true;
          } else if (item.method === "qris") {
            qrisTotal += amt;
          } else if (item.method === "debit") {
            debitTotal += amt;
          }
        }
        if (hasCash) cashOrders++;
      } else {
        if (ord.paymentMethod === "cash") {
          cashTotal += orderTotal;
          cashOrders++;
        } else if (ord.paymentMethod === "qris") {
          qrisTotal += orderTotal;
        } else if (ord.paymentMethod === "debit") {
          debitTotal += orderTotal;
        }
      }
    }

    // 3. Hitung mutasi kas masuk dan keluar operasional sejak shift dibuka
    const cashStats = await db.execute(sql`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'in' THEN amount ELSE 0 END), 0)::int AS cash_in,
        COALESCE(SUM(CASE WHEN type = 'out' THEN amount ELSE 0 END), 0)::int AS cash_out
      FROM cash_movements
      WHERE created_at >= ${openedAt} AND created_at <= ${closedAt}
    `);

    interface CashStatsRow {
      cash_in: number;
      cash_out: number;
    }

    const cRow = ((cashStats as unknown as { rows: CashStatsRow[] }).rows[0] ?? {
      cash_in: 0,
      cash_out: 0,
    }) as CashStatsRow;

    // Expected cash di laci = Penjualan Tunai + Kas Masuk Operasional - Kas Keluar Operasional
    const expectedCash = Math.max(0, cashTotal + cRow.cash_in - cRow.cash_out);
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
        totalOrders: paidOrders.length,
        cashOrders,
        qrisTotal,
        debitTotal,
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
