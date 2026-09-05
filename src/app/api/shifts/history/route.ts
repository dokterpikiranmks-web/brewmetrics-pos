import { db } from "@/db";
import { shiftReports } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import type { ShiftReportDto } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();
    const { error } = await requireRole(["owner", "manager", "cashier"]);
    if (error) return error;

    const reports = await db
      .select()
      .from(shiftReports)
      .orderBy(desc(shiftReports.createdAt))
      .limit(25);

    const data: ShiftReportDto[] = reports.map((r) => ({
      id: r.id,
      cashierId: r.cashierId,
      cashierName: r.cashierName,
      openedAt: r.openedAt.toISOString(),
      closedAt: r.closedAt.toISOString(),
      expectedCash: r.expectedCash,
      actualCash: r.actualCash,
      variance: r.variance,
      totalOrders: r.totalOrders,
      cashOrders: r.cashOrders,
      qrisTotal: r.qrisTotal,
      debitTotal: r.debitTotal,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    }));

    return Response.json({ reports: data });
  } catch (error) {
    console.error("fetch shift reports error:", error);
    return Response.json({ error: "Gagal mengambil data laporan shift." }, { status: 500 });
  }
}
