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
    case "transfer":
      return "Transfer Bank";
    case "split":
      return "Split Bayar";
    default:
      return m ? m.toUpperCase() : "-";
  }
}

/**
 * GET /api/reports/export
 * Mengekspor data penjualan orders ke spreadsheet Excel (.xlsx) dengan rekonsiliasi Split Payment.
 * Kolom kanal pembayaran (Tunai, QRIS, Debit, Transfer) dipisahkan secara akurat
 * agar total laci kas dan mutasi rekening bank langsung klop saat diaudit.
 *
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

    const outletParam = url.searchParams.get("outletId");
    const outletId =
      outletParam && outletParam !== "all" && !isNaN(Number(outletParam))
        ? Number(outletParam)
        : null;

    // Ambil seluruh order berstatus 'paid' dalam rentang tanggal beserta payment_breakdown
    const whereConditions = [
      eq(orders.status, "paid"),
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate),
    ];
    if (outletId) {
      whereConditions.push(eq(orders.outletId, outletId));
    }

    const orderList = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        cashierName: orders.cashierName,
        paymentMethod: orders.paymentMethod,
        paymentBreakdown: orders.paymentBreakdown,
        subtotal: orders.subtotal,
        tax: orders.tax,
        serviceCharge: orders.serviceCharge,
        total: orders.total,
        hpp: orders.hpp,
        profit: orders.profit,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(...whereConditions))
      .orderBy(asc(orders.createdAt));

    // Hitung total akumulasi rekapitulasi termasuk pecahan per kanal bayar
    let sumCash = 0;
    let sumQris = 0;
    let sumDebit = 0;
    let sumTransfer = 0;
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
      const total = ord.total || (subtotal + tax + service);
      const hpp = ord.hpp || 0;
      const profit = ord.profit || 0;

      // Logika Rekonsiliasi Split Payment:
      // Bila metode 'split', baca array paymentBreakdown dan distribusikan nominalnya ke masing-masing pos
      let cashPortion = 0;
      let qrisPortion = 0;
      let debitPortion = 0;
      let transferPortion = 0;

      const breakdown = (ord.paymentBreakdown as Array<{ method: string; amount: number }>) || [];
      if (ord.paymentMethod === "split" && breakdown.length > 0) {
        for (const item of breakdown) {
          const amt = Number(item.amount) || 0;
          if (item.method === "cash") cashPortion += amt;
          else if (item.method === "qris") qrisPortion += amt;
          else if (item.method === "debit") debitPortion += amt;
          else if (item.method === "transfer") transferPortion += amt;
        }
      } else {
        if (ord.paymentMethod === "cash") cashPortion = total;
        else if (ord.paymentMethod === "qris") qrisPortion = total;
        else if (ord.paymentMethod === "debit") debitPortion = total;
        else if (ord.paymentMethod === "transfer") transferPortion = total;
      }

      sumCash += cashPortion;
      sumQris += qrisPortion;
      sumDebit += debitPortion;
      sumTransfer += transferPortion;
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
        "Tunai": cashPortion,
        "QRIS": qrisPortion,
        "Debit": debitPortion,
        "Transfer": transferPortion,
        "Subtotal": subtotal,
        "PB1": tax,
        "Service Charge": service,
        "Total Omzet": total,
        "Total HPP": hpp,
        "Profit": profit,
      };
    });

    // Baris total rekapitulasi di akhir tabel dengan rincian lengkap tiap kanal
    dataRows.push({
      "Waktu Transaksi": "TOTAL REKAPITULASI",
      "No Order": `${orderList.length} Transaksi`,
      "Kasir": "-",
      "Metode Bayar": "-",
      "Tunai": sumCash,
      "QRIS": sumQris,
      "Debit": sumDebit,
      "Transfer": sumTransfer,
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
      { wch: 18 }, // Metode Bayar
      { wch: 15 }, // Tunai
      { wch: 15 }, // QRIS
      { wch: 15 }, // Debit
      { wch: 15 }, // Transfer
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
