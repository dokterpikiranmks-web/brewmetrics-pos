import { db } from "@/db";
import { orders } from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import type { PaymentChannelMetric, ProductSalesMetric, SalesSummaryPeriodDto } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports/sales-summary
 * Mengembalikan dua agregasi finansial utama dengan filter rentang tanggal:
 *   1. Ringkasan Metode Bayar (Total Tunai, Total QRIS, Total Debit, Total Transfer) dengan kalkulasi transaksi Split.
 *   2. Ringkasan Penjualan Produk (Peringkat, Nama, Kategori, Qty, Omzet, dan % Kontribusi Penjualan).
 *
 * Query params:
 *   - period: 'today' | 'last7days' | 'thisMonth' (default 'today')
 */
export async function GET(req: Request) {
  const { error } = await requireRole(["cashier", "manager", "owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const url = new URL(req.url);
    const periodParam = url.searchParams.get("period") || "today";
    const period: "today" | "last7days" | "thisMonth" =
      periodParam === "last7days" || periodParam === "thisMonth" ? periodParam : "today";

    const outletParam = url.searchParams.get("outletId");
    const outletId =
      outletParam && outletParam !== "all" && !isNaN(Number(outletParam))
        ? Number(outletParam)
        : null;

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (period === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === "last7days") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else {
      // thisMonth
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // 1. Ambil seluruh pesanan lunas untuk agregasi kanal pembayaran (termasuk pecahan split)
    const whereConditions = [
      eq(orders.status, "paid"),
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate),
    ];
    if (outletId) {
      whereConditions.push(eq(orders.outletId, outletId));
    }

    const paidOrders = await db
      .select({
        id: orders.id,
        paymentMethod: orders.paymentMethod,
        paymentBreakdown: orders.paymentBreakdown,
        subtotal: orders.subtotal,
        tax: orders.tax,
        serviceCharge: orders.serviceCharge,
        total: orders.total,
      })
      .from(orders)
      .where(and(...whereConditions));

    const channels = {
      cash: 0,
      qris: 0,
      debit: 0,
      transfer: 0,
      total: 0,
      counts: {
        cash: 0,
        qris: 0,
        debit: 0,
        transfer: 0,
        split: 0,
        total: paidOrders.length,
      },
    };

    let totalGrossSales = 0;

    for (const ord of paidOrders) {
      const orderTotal = ord.total || (ord.subtotal + (ord.tax ?? 0) + (ord.serviceCharge ?? 0));
      totalGrossSales += orderTotal;

      const breakdown = (ord.paymentBreakdown as Array<{ method: string; amount: number }>) || [];
      if (ord.paymentMethod === "split" && breakdown.length > 0) {
        channels.counts.split++;
        for (const item of breakdown) {
          const amt = Number(item.amount) || 0;
          if (item.method === "cash") {
            channels.cash += amt;
            channels.counts.cash++;
          } else if (item.method === "qris") {
            channels.qris += amt;
            channels.counts.qris++;
          } else if (item.method === "debit") {
            channels.debit += amt;
            channels.counts.debit++;
          } else if (item.method === "transfer") {
            channels.transfer += amt;
            channels.counts.transfer++;
          }
        }
      } else {
        if (ord.paymentMethod === "cash") {
          channels.cash += orderTotal;
          channels.counts.cash++;
        } else if (ord.paymentMethod === "qris") {
          channels.qris += orderTotal;
          channels.counts.qris++;
        } else if (ord.paymentMethod === "debit") {
          channels.debit += orderTotal;
          channels.counts.debit++;
        } else if (ord.paymentMethod === "transfer") {
          channels.transfer += orderTotal;
          channels.counts.transfer++;
        }
      }
    }

    channels.total = channels.cash + channels.qris + channels.debit + channels.transfer;

    const metrics: PaymentChannelMetric[] = [
      {
        channel: "cash",
        label: "Total Kas Tunai",
        total: channels.cash,
        ordersCount: channels.counts.cash,
        pctOfTotal: channels.total > 0 ? Math.round((channels.cash / channels.total) * 1000) / 10 : 0,
      },
      {
        channel: "qris",
        label: "Total QRIS",
        total: channels.qris,
        ordersCount: channels.counts.qris,
        pctOfTotal: channels.total > 0 ? Math.round((channels.qris / channels.total) * 1000) / 10 : 0,
      },
      {
        channel: "debit",
        label: "Total Kartu Debit",
        total: channels.debit,
        ordersCount: channels.counts.debit,
        pctOfTotal: channels.total > 0 ? Math.round((channels.debit / channels.total) * 1000) / 10 : 0,
      },
      {
        channel: "transfer",
        label: "Total Transfer Bank",
        total: channels.transfer,
        ordersCount: channels.counts.transfer,
        pctOfTotal: channels.total > 0 ? Math.round((channels.transfer / channels.total) * 1000) / 10 : 0,
      },
    ];

    // 2. Agregasi Penjualan Produk (Menu Performance)
    const outletFilterSql = outletId ? sql`AND o.outlet_id = ${outletId}` : sql``;

    const productRows = await db.execute(sql`
      SELECT
        p.id AS product_id,
        oi.product_name AS name,
        COALESCE(c.name, 'Lainnya') AS category,
        COALESCE(SUM(oi.qty), 0)::int AS qty,
        COALESCE(SUM(oi.total_price), 0)::int AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE o.status = 'paid'
        AND o.created_at >= ${startDate}
        AND o.created_at <= ${endDate}
        ${outletFilterSql}
      GROUP BY p.id, oi.product_name, c.name
      ORDER BY revenue DESC, qty DESC
    `);

    interface RawProductRow {
      product_id: number | null;
      name: string;
      category: string;
      qty: number;
      revenue: number;
    }

    const rows = ((productRows as unknown as { rows: RawProductRow[] }).rows || []) as RawProductRow[];
    const totalMenuRevenue = rows.reduce((acc, r) => acc + (Number(r.revenue) || 0), 0);

    const products: ProductSalesMetric[] = rows.map((r, index) => {
      const rev = Number(r.revenue) || 0;
      const pct = totalMenuRevenue > 0 ? Math.round((rev / totalMenuRevenue) * 1000) / 10 : 0;
      return {
        rank: index + 1,
        productId: r.product_id ? Number(r.product_id) : null,
        name: r.name,
        category: r.category,
        qty: Number(r.qty) || 0,
        revenue: rev,
        contributionPct: pct,
      };
    });

    const summary: SalesSummaryPeriodDto = {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalGrossSales,
      totalOrders: paidOrders.length,
      channels,
      metrics,
      products,
    };

    return Response.json({ success: true, summary });
  } catch (err) {
    console.error("fetch sales-summary error:", err);
    return Response.json({ error: "Gagal memproses ringkasan penjualan." }, { status: 500 });
  }
}
