import { db } from "@/db";
import { orders } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { buildForecastAlerts, buildIngredientDtos } from "@/lib/forecast";
import type { AnalyticsSummary, TodayOrderDto } from "@/lib/types";

export const dynamic = "force-dynamic";

async function query<T>(statement: ReturnType<typeof sql>): Promise<T[]> {
  const res = await db.execute(statement);
  return (res as unknown as { rows: T[] }).rows;
}

export async function GET() {
  const { error } = await requireRole(["owner", "manager"]);
  if (error) return error;

  const todayRows = await query<{ revenue: number; orders: number; hpp: number; profit: number }>(sql`
    SELECT COALESCE(SUM(subtotal),0)::int AS revenue, COUNT(*)::int AS orders,
           COALESCE(SUM(hpp),0)::int AS hpp, COALESCE(SUM(profit),0)::int AS profit
    FROM orders WHERE status='paid' AND created_at >= date_trunc('day', now())
  `);

  const yesterdayRows = await query<{ revenue: number }>(sql`
    SELECT COALESCE(SUM(subtotal),0)::int AS revenue FROM orders
    WHERE status='paid' AND created_at >= date_trunc('day', now()) - interval '1 day'
      AND created_at < date_trunc('day', now())
  `);

  const dailyRows = await query<{ date: string; revenue: number; profit: number; orders: number }>(sql`
    SELECT to_char(created_at::date, 'YYYY-MM-DD') AS date,
           COALESCE(SUM(subtotal),0)::int AS revenue,
           COALESCE(SUM(profit),0)::int AS profit,
           COUNT(*)::int AS orders
    FROM orders
    WHERE status='paid' AND created_at >= now() - interval '29 days'
    GROUP BY created_at::date
  `);

  const hourlyRows = await query<{ hour: number; revenue: number; orders: number }>(sql`
    SELECT extract(hour FROM created_at)::int AS hour,
           COALESCE(SUM(subtotal),0)::int AS revenue, COUNT(*)::int AS orders
    FROM orders WHERE status='paid' AND created_at >= date_trunc('day', now())
    GROUP BY 1
  `);

  const topRows = await query<{ name: string; qty: number; revenue: number }>(sql`
    SELECT oi.product_name AS name, SUM(oi.qty)::int AS qty, SUM(oi.total_price)::int AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status='paid' AND o.created_at >= now() - interval '14 days'
    GROUP BY 1 ORDER BY qty DESC LIMIT 6
  `);

  const payRows = await query<{ method: string; value: number }>(sql`
    SELECT payment_method AS method, COALESCE(SUM(subtotal),0)::int AS value
    FROM orders WHERE status='paid' AND created_at >= now() - interval '29 days'
    GROUP BY 1
  `);

  const cashRows = await query<{ type: string; total: number }>(sql`
    SELECT type, COALESCE(SUM(amount),0)::int AS total
    FROM cash_movements WHERE created_at >= date_trunc('day', now()) GROUP BY type
  `);

  const recent = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8);
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
    generatedAt: new Date().toISOString(),
  };
  return Response.json(summary);
}
