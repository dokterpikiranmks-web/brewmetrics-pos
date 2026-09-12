import { db } from "@/db";
import { orders, shiftReports } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { buildForecastAlerts, buildIngredientDtos } from "@/lib/forecast";
import type {
  AnalyticsSummary,
  TodayOrderDto,
  ShiftReportDto,
  MenuQuadrant,
  MenuEngineeringItem,
  MenuEngineeringSummary,
} from "@/lib/types";

export const dynamic = "force-dynamic";

async function query<T>(statement: ReturnType<typeof sql>): Promise<T[]> {
  const res = await db.execute(statement);
  return (res as unknown as { rows: T[] }).rows;
}

export async function GET(req: Request) {
  const { error } = await requireRole(["owner", "manager"]);
  if (error) return error;

  const url = new URL(req.url);
  const outletParam = url.searchParams.get("outletId");
  const outletId =
    outletParam && outletParam !== "all" && !isNaN(Number(outletParam))
      ? Number(outletParam)
      : null;

  const outletOrderFilter = outletId ? sql`AND outlet_id = ${outletId}` : sql``;
  const outletJoinedOrderFilter = outletId ? sql`AND o.outlet_id = ${outletId}` : sql``;
  const outletCashFilter = outletId
    ? sql`WHERE outlet_id = ${outletId} AND created_at >= date_trunc('day', now())`
    : sql`WHERE created_at >= date_trunc('day', now())`;

  const todayRows = await query<{ revenue: number; orders: number; hpp: number; profit: number }>(sql`
    SELECT COALESCE(SUM(subtotal),0)::int AS revenue, COUNT(*)::int AS orders,
           COALESCE(SUM(hpp),0)::int AS hpp, COALESCE(SUM(profit),0)::int AS profit
    FROM orders WHERE status='paid' AND created_at >= date_trunc('day', now()) ${outletOrderFilter}
  `);

  const yesterdayRows = await query<{ revenue: number }>(sql`
    SELECT COALESCE(SUM(subtotal),0)::int AS revenue FROM orders
    WHERE status='paid' AND created_at >= date_trunc('day', now()) - interval '1 day'
      AND created_at < date_trunc('day', now()) ${outletOrderFilter}
  `);

  const dailyRows = await query<{ date: string; revenue: number; profit: number; orders: number }>(sql`
    SELECT to_char(created_at::date, 'YYYY-MM-DD') AS date,
           COALESCE(SUM(subtotal),0)::int AS revenue,
           COALESCE(SUM(profit),0)::int AS profit,
           COUNT(*)::int AS orders
    FROM orders
    WHERE status='paid' AND created_at >= now() - interval '29 days' ${outletOrderFilter}
    GROUP BY created_at::date
  `);

  const hourlyRows = await query<{ hour: number; revenue: number; orders: number }>(sql`
    SELECT extract(hour FROM created_at)::int AS hour,
           COALESCE(SUM(subtotal),0)::int AS revenue, COUNT(*)::int AS orders
    FROM orders WHERE status='paid' AND created_at >= date_trunc('day', now()) ${outletOrderFilter}
    GROUP BY 1
  `);

  const topRows = await query<{ name: string; qty: number; revenue: number }>(sql`
    SELECT oi.product_name AS name, SUM(oi.qty)::int AS qty, SUM(oi.total_price)::int AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status='paid' AND o.created_at >= now() - interval '14 days' ${outletJoinedOrderFilter}
    GROUP BY 1 ORDER BY qty DESC LIMIT 6
  `);

  const payRows = await query<{ method: string; value: number }>(sql`
    SELECT payment_method AS method, COALESCE(SUM(subtotal),0)::int AS value
    FROM orders WHERE status='paid' AND created_at >= now() - interval '29 days' ${outletOrderFilter}
    GROUP BY 1
  `);

  const cashRows = await query<{ type: string; total: number }>(sql`
    SELECT type, COALESCE(SUM(amount),0)::int AS total
    FROM cash_movements ${outletCashFilter} GROUP BY type
  `);

  // Query Menu Engineering (30 Hari Terakhir) dari seluruh produk aktif
  const menuEngineeringRows = await query<{
    id: number;
    name: string;
    category_name: string;
    price: number;
    hpp: number;
    image_url: string | null;
    total_qty: number;
    total_revenue: number;
    total_profit: number;
  }>(sql`
    SELECT
      p.id,
      p.name,
      COALESCE(c.name, 'Lainnya') AS category_name,
      p.price,
      p.hpp,
      p.image_url,
      COALESCE(SUM(oi.qty), 0)::int AS total_qty,
      COALESCE(SUM(oi.total_price), 0)::int AS total_revenue,
      COALESCE(SUM(oi.total_price - (oi.hpp * oi.qty)), 0)::int AS total_profit
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN order_items oi ON oi.product_id = p.id
    LEFT JOIN orders o ON o.id = oi.order_id AND o.status = 'paid' AND o.created_at >= now() - interval '30 days' ${outletJoinedOrderFilter}
    WHERE p.is_active = true
    GROUP BY p.id, p.name, c.name, p.price, p.hpp, p.image_url
    ORDER BY total_qty DESC, p.id ASC
  `);

  const recent = await db
    .select()
    .from(orders)
    .where(outletId ? eq(orders.outletId, outletId) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(8);
  const shiftList = await db
    .select()
    .from(shiftReports)
    .where(outletId ? eq(shiftReports.outletId, outletId) : undefined)
    .orderBy(desc(shiftReports.createdAt))
    .limit(10);
  const [forecast, ingredientDtos] = await Promise.all([buildForecastAlerts(), buildIngredientDtos()]);

  const today = todayRows[0] ?? { revenue: 0, orders: 0, hpp: 0, profit: 0 };
  const yesterdayRevenue = yesterdayRows[0]?.revenue ?? 0;
  const cashIn = cashRows.find((c) => c.type === "in")?.total ?? 0;
  const cashOut = cashRows.find((c) => c.type === "out")?.total ?? 0;

  // Lengkapi 30 hari (hari tanpa penjualan tetap muncul sebagai 0)
  const dailyMap = new Map(dailyRows.map((d) => [d.date, d]));
  const daily: AnalyticsSummary["daily"] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const row = dailyMap.get(key);
    daily.push({
      date: key,
      label: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      revenue: row?.revenue ?? 0,
      profit: row?.profit ?? 0,
      orders: row?.orders ?? 0,
    });
  }

  const hourlyMap = new Map(hourlyRows.map((h) => [h.hour, h]));
  const nowHour = new Date().getHours();
  const hourly: AnalyticsSummary["hourly"] = [];
  for (let h = 6; h <= Math.max(21, nowHour); h++) {
    const row = hourlyMap.get(h);
    hourly.push({
      hour: h,
      label: `${String(h).padStart(2, "0")}.00`,
      revenue: h <= nowHour ? (row?.revenue ?? 0) : 0,
      orders: h <= nowHour ? (row?.orders ?? 0) : 0,
    });
  }

  // ---------------- MENU ENGINEERING MATRIX (TRAILING 30 DAYS) ----------------
  const totalProducts = menuEngineeringRows.length;
  const sumVolume = menuEngineeringRows.reduce((acc, row) => acc + row.total_qty, 0);
  const avgVolume = totalProducts > 0 ? Math.round(sumVolume / totalProducts) : 0;

  // Rata-rata margin kontribusi per unit (Price - HPP)
  const sumMargin = menuEngineeringRows.reduce(
    (acc, row) => acc + Math.max(0, row.price - row.hpp),
    0
  );
  const avgMargin = totalProducts > 0 ? Math.round(sumMargin / totalProducts) : 0;

  // Rata-rata persentase margin
  const sumMarginPct = menuEngineeringRows.reduce((acc, row) => {
    const margin = Math.max(0, row.price - row.hpp);
    return acc + (row.price > 0 ? (margin / row.price) * 100 : 0);
  }, 0);
  const avgMarginPct =
    totalProducts > 0 ? Math.round((sumMarginPct / totalProducts) * 10) / 10 : 0;

  let countStar = 0;
  let countPlowhorse = 0;
  let countPuzzle = 0;
  let countDog = 0;

  const menuEngineeringItems: MenuEngineeringItem[] = menuEngineeringRows.map((row) => {
    const unitMargin = Math.max(0, row.price - row.hpp);
    const marginPct =
      row.price > 0 ? Math.round((unitMargin / row.price) * 1000) / 10 : 0;
    const isHighVolume = row.total_qty >= avgVolume;
    const isHighMargin = unitMargin >= avgMargin;

    let quadrant: MenuQuadrant = "dog";
    if (isHighMargin && isHighVolume) {
      quadrant = "star";
      countStar++;
    } else if (!isHighMargin && isHighVolume) {
      quadrant = "plowhorse";
      countPlowhorse++;
    } else if (isHighMargin && !isHighVolume) {
      quadrant = "puzzle";
      countPuzzle++;
    } else {
      quadrant = "dog";
      countDog++;
    }

    return {
      id: row.id,
      name: row.name,
      categoryName: row.category_name,
      imageUrl: row.image_url,
      price: row.price,
      hpp: row.hpp,
      unitMargin,
      marginPct,
      totalQty: row.total_qty,
      totalRevenue: row.total_revenue,
      totalProfit: row.total_profit,
      quadrant,
    };
  });

  const menuEngineering: MenuEngineeringSummary = {
    avgVolume,
    avgMargin,
    avgMarginPct,
    totalMenuItems: totalProducts,
    counts: {
      star: countStar,
      plowhorse: countPlowhorse,
      puzzle: countPuzzle,
      dog: countDog,
    },
    items: menuEngineeringItems,
  };

  const summary: AnalyticsSummary = {
    today: {
      revenue: today.revenue,
      orders: today.orders,
      avgTicket: today.orders > 0 ? Math.round(today.revenue / today.orders) : 0,
      hpp: today.hpp,
      grossProfit: today.profit,
      margin: today.revenue > 0 ? Math.round((today.profit / today.revenue) * 1000) / 10 : 0,
      cashIn,
      cashOut,
      netCash: today.revenue + cashIn - cashOut,
      vsYesterdayPct:
        yesterdayRevenue > 0 ? Math.round(((today.revenue - yesterdayRevenue) / yesterdayRevenue) * 1000) / 10 : 0,
    },
    daily,
    hourly,
    topProducts: topRows,
    paymentSplit: payRows,
    forecast,
    inventoryHealth: {
      ok: ingredientDtos.filter((i) => i.status === "ok").length,
      low: ingredientDtos.filter((i) => i.status === "low").length,
      out: ingredientDtos.filter((i) => i.status === "out").length,
      totalValue: Math.round(ingredientDtos.reduce((s, i) => s + i.stockQty * i.costPerUnit, 0)),
    },
    recentOrders: recent.map(
      (o): TodayOrderDto => ({
        id: o.id,
        orderNumber: o.orderNumber,
        cashierName: o.cashierName,
        paymentMethod: o.paymentMethod,
        total: o.subtotal,
        itemCount: o.itemCount,
        createdAt: o.createdAt.toISOString(),
        isOfflineSync: o.isOfflineSync,
      })
    ),
    latestShiftReport: shiftList[0]
      ? {
          id: shiftList[0].id,
          cashierId: shiftList[0].cashierId,
          cashierName: shiftList[0].cashierName,
          openedAt: shiftList[0].openedAt.toISOString(),
          closedAt: shiftList[0].closedAt.toISOString(),
          expectedCash: shiftList[0].expectedCash,
          actualCash: shiftList[0].actualCash,
          variance: shiftList[0].variance,
          totalOrders: shiftList[0].totalOrders,
          cashOrders: shiftList[0].cashOrders,
          qrisTotal: shiftList[0].qrisTotal,
          debitTotal: shiftList[0].debitTotal,
          note: shiftList[0].note,
          createdAt: shiftList[0].createdAt.toISOString(),
        }
      : null,
    recentShifts: shiftList.map((s): ShiftReportDto => ({
      id: s.id,
      cashierId: s.cashierId,
      cashierName: s.cashierName,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt.toISOString(),
      expectedCash: s.expectedCash,
      actualCash: s.actualCash,
      variance: s.variance,
      totalOrders: s.totalOrders,
      cashOrders: s.cashOrders,
      qrisTotal: s.qrisTotal,
      debitTotal: s.debitTotal,
      note: s.note,
      createdAt: s.createdAt.toISOString(),
    })),
    menuEngineering,
    generatedAt: new Date().toISOString(),
  };

  return Response.json(summary);
}
