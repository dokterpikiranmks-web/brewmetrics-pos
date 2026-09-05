import { db } from "@/db";
import { orders } from "@/db/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatDateDisplay(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDateFile(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

function formatPaymentMethod(m: string): string {
  switch (m) {
    case "cash":
      return "Tunai (Cash)";
    case "qris":
      return "QRIS";
    case "debit":
      return "Kartu Debit";
    default:
      return m.toUpperCase();
  }
}

/**
 * GET /api/reports/export
 * Mengekspor data penjualan orders ke spreadsheet Excel (.xlsx).
 * Parameter query:
 *  - preset: 'today' | 'last7days' | 'thisMonth'
 *  - startDate: YYYY-MM-DD (opsional jika menggunakan preset)
 *  - endDate: YYYY-MM-DD (opsional jika menggunakan preset)
 */
export async function GET(req: Request) {
  // Hanya role owner dan manager yang diizinkan mengunduh laporan keuangan
  const { error } = await requireRole(["owner", "manager"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const url = new URL(req.url);
    const preset = url.searchParams.get("preset");
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");

    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let labelPeriod = "";

    if (preset === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      labelPeriod = `Hari_Ini_${formatDateFile(now)}`;
    } else if (preset === "last7days") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      labelPeriod = `7_Hari_Terakhir_${formatDateFile(startDate)}_sd_${formatDateFile(endDate)}`;
    } else if (preset === "thisMonth") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      labelPeriod = `Bulan_Ini_${now.getFullYear()}_${pad2(now.getMonth() + 1)}`;
    } else if (startDateParam && endDateParam) {
      const [sy, sm, sd] = startDateParam.split("-").map(Number);
      const [ey, em, ed] = endDateParam.split("-").map(Number);
      startDate = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      labelPeriod = `${startDateParam}_sd_${endDateParam}`;
    } else {
      // Default jika tidak ada parameter: Hari ini
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      labelPeriod = `Hari_Ini_${formatDateFile(now)}`;
    }

    // Ambil seluruh order berstatus 'paid' dalam rentang tanggal
    const orderList = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        cashierName: orders.cashierName,
        paymentMethod: orders.paymentMethod,
        subtotal: orders.subtotal,
        tax: orders.tax,
        serviceCharge: orders.serviceCharge,
        total: orders.total,
        hpp: orders.hpp,
        profit: orders.profit,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(
        and(
          eq(orders.status, "paid"),
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, endDate)
        )
      )
      .orderBy(asc(orders.createdAt));

    // Hitung total akumulasi rekapitulasi
    let sumSubtotal = 0;
    let sumTax = 0;
    let sumService = 0;
    let sumTotal = 0;
    let sumHpp = 0;
    let sumProfit = 0;

    const dataRows = orderList.map((ord) => {
      const subtotal = ord.subtotal || 0;
      const tax = ord.tax || 0;
      const service = ord.serviceCharge || 0;
      const total = ord.total || 0;
      const hpp = ord.hpp || 0;
      const profit = ord.profit || 0;

      sumSubtotal += subtotal;
      sumTax += tax;
      sumService += service;
      sumTotal += total;
      sumHpp += hpp;
      sumProfit += profit;

      return {
        "Waktu Transaksi": formatDateDisplay(new Date(ord.createdAt)),
        "No Order": ord.orderNumber,
        "Kasir": ord.cashierName || "-",
        "Metode Bayar": formatPaymentMethod(ord.paymentMethod),
        "Subtotal": subtotal,
        "PB1": tax,
        "Service Charge": service,
        "Total Omzet": total,
        "Total HPP": hpp,
        "Profit": profit,
      };
    });

    // Baris total rekapitulasi di akhir tabel
    dataRows.push({
      "Waktu Transaksi": "TOTAL REKAPITULASI",
      "No Order": `${orderList.length} Transaksi`,
      "Kasir": "-",
      "Metode Bayar": "-",
      "Subtotal": sumSubtotal,
      "PB1": sumTax,
      "Service Charge": sumService,
      "Total Omzet": sumTotal,
      "Total HPP": sumHpp,
      "Profit": sumProfit,
    });

    // Buat Worksheet & Workbook menggunakan XLSX
    const worksheet = XLSX.utils.json_to_sheet(dataRows);

    // Konfigurasi lebar kolom otomatis agar rapi dan mudah dibaca
    worksheet["!cols"] = [
      { wch: 20 }, // Waktu Transaksi
      { wch: 22 }, // No Order
      { wch: 18 }, // Kasir
      { wch: 16 }, // Metode Bayar
      { wch: 15 }, // Subtotal
      { wch: 12 }, // PB1
      { wch: 16 }, // Service Charge
      { wch: 16 }, // Total Omzet
      { wch: 15 }, // Total HPP
      { wch: 15 }, // Profit
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Penjualan");

    // Output binary buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const filename = `Laporan_Penjualan_BREWMETRICS_${labelPeriod}.xlsx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("export sales report error:", err);
    return Response.json(
      { error: "Terjadi kesalahan saat memproses ekspor laporan Excel." },
      { status: 500 }
    );
  }
}
