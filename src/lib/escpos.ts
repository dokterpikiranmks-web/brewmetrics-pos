/**
 * ESC/POS Binary Command Generator for Thermal Printers (58mm / 80mm)
 * Compatible with Web Bluetooth & Web Serial thermal printers.
 */

import { getTherapyText } from "./bluetooth";
export { getTherapyText };

// Basic ESC/POS command constants
export const CMD = {
  // Printer initialization
  INIT: new Uint8Array([0x1b, 0x40]),

  // Alignment
  ALIGN_LEFT: new Uint8Array([0x1b, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([0x1b, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([0x1b, 0x61, 0x02]),

  // Bold text
  BOLD_ON: new Uint8Array([0x1b, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([0x1b, 0x45, 0x00]),

  // Font sizing (GS ! n)
  FONT_NORMAL: new Uint8Array([0x1d, 0x21, 0x00]),
  FONT_DOUBLE_HEIGHT: new Uint8Array([0x1d, 0x21, 0x01]),
  FONT_DOUBLE_WIDTH: new Uint8Array([0x1d, 0x21, 0x10]),
  FONT_DOUBLE: new Uint8Array([0x1d, 0x21, 0x11]), // Double height & width

  // Line spacing
  LINE_SPACING_DEFAULT: new Uint8Array([0x1b, 0x32]),

  // Paper cut
  CUT_FULL: new Uint8Array([0x1d, 0x56, 0x00]),
  CUT_PARTIAL: new Uint8Array([0x1d, 0x56, 0x01]),
  CUT_FEED: new Uint8Array([0x1d, 0x56, 0x42, 0x00]), // Feed and cut
};

/**
 * Gabungkan beberapa Uint8Array menjadi satu Uint8Array tunggal.
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, curr) => acc + curr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Konversi teks string ke Uint8Array (Windows-1252 / ASCII fallback via TextEncoder).
 */
export function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Perintah inisialisasi printer (ESC @).
 */
export function initPrinter(): Uint8Array {
  return CMD.INIT;
}

/**
 * Atur perataan teks (rata kiri, tengah, kanan).
 */
export function setAlign(align: "left" | "center" | "right"): Uint8Array {
  switch (align) {
    case "center":
      return CMD.ALIGN_CENTER;
    case "right":
      return CMD.ALIGN_RIGHT;
    default:
      return CMD.ALIGN_LEFT;
  }
}

export function alignLeft(): Uint8Array {
  return CMD.ALIGN_LEFT;
}

export function alignCenter(): Uint8Array {
  return CMD.ALIGN_CENTER;
}

export function alignRight(): Uint8Array {
  return CMD.ALIGN_RIGHT;
}

/**
 * Atur teks tebal (bold).
 */
export function setBold(enable: boolean): Uint8Array {
  return enable ? CMD.BOLD_ON : CMD.BOLD_OFF;
}

/**
 * Atur ukuran font (normal, double, double-width, double-height).
 */
export function setFontSize(
  size: "normal" | "double" | "double-width" | "double-height"
): Uint8Array {
  switch (size) {
    case "double":
      return CMD.FONT_DOUBLE;
    case "double-width":
      return CMD.FONT_DOUBLE_WIDTH;
    case "double-height":
      return CMD.FONT_DOUBLE_HEIGHT;
    default:
      return CMD.FONT_NORMAL;
  }
}

/**
 * Cetak baris kosong / feed kertas beberapa baris.
 */
export function feedLines(lines = 1): Uint8Array {
  const safeLines = Math.max(1, Math.min(255, lines));
  return new Uint8Array([0x1b, 0x64, safeLines]);
}

/**
 * Perintah potong kertas thermal (Paper Cut).
 */
export function cutPaper(partial = true): Uint8Array {
  return partial ? CMD.CUT_PARTIAL : CMD.CUT_FULL;
}

/**
 * Format string 2 kolom (tepi kiri dan tepi kanan sejajar).
 * Berguna untuk mencetak daftar harga, subtotal, dan metode bayar.
 */
export function formatRow(left: string, right: string, width = 32): string {
  const cleanLeft = left.trim();
  const cleanRight = right.trim();
  const availableSpace = width - cleanRight.length;

  if (availableSpace <= 0) {
    return cleanLeft + "\n" + cleanRight.padStart(width, " ") + "\n";
  }

  if (cleanLeft.length > availableSpace - 1) {
    // Potong teks kiri atau wrap
    const truncatedLeft = cleanLeft.slice(0, Math.max(0, availableSpace - 1));
    const spaces = width - (truncatedLeft.length + cleanRight.length);
    return truncatedLeft + " ".repeat(Math.max(1, spaces)) + cleanRight + "\n";
  }

  const spaces = width - (cleanLeft.length + cleanRight.length);
  return cleanLeft + " ".repeat(Math.max(1, spaces)) + cleanRight + "\n";
}

/**
 * Garis pembatas (divider) tanda putus-putus.
 */
export function formatDivider(char = "-", width = 32): string {
  return char.repeat(width) + "\n";
}

function formatCurrency(amount: number): string {
  return `Rp ${Number(amount || 0).toLocaleString("id-ID")}`;
}

export interface OrderDataForPrint {
  orderNumber?: string;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string | null;
  orderType?: "dine-in" | "take-away" | string;
  tableNumber?: string | null;
  createdAt?: string | Date;
  outletId?: number | null;
  outletName?: string | null;
  outletBrandName?: string | null;
  outletReceiptHeader?: string | null;
  outletReceiptFooter?: string | null;
  subtotal?: number;
  discountAmount?: number;
  serviceCharge?: number;
  tax?: number;
  total?: number;
  paymentMethod?: string;
  paymentBreakdown?: Array<{ method: string; amount: number; reference?: string }>;
  tendered?: number | null;
  change?: number | null;
  paymentReference?: string | null;
  items?: Array<{
    name?: string;
    productName?: string;
    variantName?: string | null;
    qty: number;
    unitPrice: number;
    totalPrice: number;
    modifiers?: Array<{ name: string; price: number }>;
    mods?: Array<{ name: string; price: number }>;
  }>;
  mood?: string | null;
  therapyText?: string | null;
}

export interface StoreDataForPrint {
  cafeName?: string;
  brandName?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  address?: string;
  phone?: string;
  printerPaperSize?: "58mm" | "80mm" | string;
  receiptFooterMessage?: string;
}

/**
 * Mengubah data transaksi dan data toko menjadi byte buffer ESC/POS
 * biner siap kirim ke printer thermal fisik.
 */
export function formatReceipt(
  orderData: OrderDataForPrint,
  storeData?: StoreDataForPrint
): Uint8Array {
  const is80mm = storeData?.printerPaperSize === "80mm";
  const lineWidth = is80mm ? 48 : 32;

  // Prioritas Branding:
  // 1. Brand name khusus outlet (cth: Nasi Kebuli Mandhi)
  // 2. Brand name store settings
  // 3. Outlet name
  // 4. Cafe name store settings
  // 5. Default "DOI TA"
  const brandTitle = (
    orderData?.outletBrandName ||
    storeData?.brandName ||
    orderData?.outletName ||
    storeData?.cafeName ||
    "DOI TA"
  ).trim();

  const receiptHeader = (
    orderData?.outletReceiptHeader ||
    storeData?.receiptHeader ||
    ""
  ).trim();

  const address = (storeData?.address || "").trim();
  const phone = (storeData?.phone || "").trim();

  const footerMsg = (
    orderData?.outletReceiptFooter ||
    storeData?.receiptFooter ||
    storeData?.receiptFooterMessage ||
    "Terima kasih atas kunjungan Anda!"
  ).trim();

  const orderNumber = orderData?.orderNumber || "ORDER-000";
  const cashierName = orderData?.cashierName || "Kasir";
  const customerName = orderData?.customerName || "Umum";
  const orderType = orderData?.orderType === "take-away" ? "Take Away" : "Dine In";
  const table = orderData?.tableNumber ? ` (Meja ${orderData.tableNumber})` : "";

  const dateObj = orderData?.createdAt
    ? typeof orderData.createdAt === "string"
      ? new Date(orderData.createdAt)
      : orderData.createdAt
    : new Date();

  const formattedDate = dateObj.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const formattedTime = dateObj.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts: Uint8Array[] = [];

  // 1. Inisialisasi printer
  parts.push(initPrinter());

  // 2. HEADER TOKO (Rata Tengah, Bold & Double Font untuk Judul Brand)
  parts.push(alignCenter());
  parts.push(setBold(true));
  parts.push(setFontSize("double-height"));
  parts.push(textToBytes(`${brandTitle}\n`));

  parts.push(setFontSize("normal"));
  parts.push(setBold(false));
  if (receiptHeader) {
    parts.push(textToBytes(`${receiptHeader}\n`));
  }
  if (address) {
    parts.push(textToBytes(`${address}\n`));
  }
  if (phone) {
    parts.push(textToBytes(`Telp: ${phone}\n`));
  }

  // Divider
  parts.push(alignLeft());
  parts.push(textToBytes(formatDivider("=", lineWidth)));

  // 3. METADATA TRANSAKSI
  let meta = "";
  meta += formatRow("No. Struk:", orderNumber, lineWidth);
  meta += formatRow("Waktu:", `${formattedDate} ${formattedTime}`, lineWidth);
  meta += formatRow("Kasir:", cashierName, lineWidth);
  meta += formatRow("Pelanggan:", customerName, lineWidth);
  if (orderData.customerPhone) {
    meta += formatRow("No. HP:", orderData.customerPhone, lineWidth);
  }
  meta += formatRow("Tipe/Meja:", `${orderType}${table}`, lineWidth);
  parts.push(textToBytes(meta));

  parts.push(textToBytes(formatDivider("-", lineWidth)));

  // 4. DAFTAR ITEM PESANAN
  const items = orderData.items || [];
  let itemsText = "";

  for (const item of items) {
    const itemName = (item.productName || item.name || "Item").trim();
    const variantStr = item.variantName ? ` (${item.variantName})` : "";
    const fullName = `${itemName}${variantStr}`;
    const totalPriceFormatted = formatCurrency(item.totalPrice);

    // Baris Nama Produk & Total Harga
    itemsText += formatRow(fullName, totalPriceFormatted, lineWidth);

    // Baris Rincian Qty x Harga Satuan
    const qtyPriceStr = `  ${item.qty} x ${formatCurrency(item.unitPrice)}`;
    itemsText += qtyPriceStr + "\n";

    // Modifiers / Topping tambahan jika ada
    const mods = item.modifiers || item.mods || [];
    if (mods.length > 0) {
      const modNames = mods.map((m) => m.name).join(", ");
      itemsText += `  + ${modNames}\n`;
    }
  }

  if (items.length === 0) {
    itemsText += "  (Tidak ada item)\n";
  }

  parts.push(textToBytes(itemsText));
  parts.push(textToBytes(formatDivider("-", lineWidth)));

  // 5. TOTAL TAGIHAN & PEMBAYARAN
  let totalsText = "";
  const subtotal = orderData.subtotal ?? 0;
  const discount = orderData.discountAmount ?? 0;
  const serviceCharge = orderData.serviceCharge ?? 0;
  const tax = orderData.tax ?? 0;
  const total = orderData.total ?? (subtotal - discount + serviceCharge + tax);

  totalsText += formatRow("Subtotal:", formatCurrency(subtotal), lineWidth);
  if (discount > 0) {
    totalsText += formatRow("Diskon:", `- ${formatCurrency(discount)}`, lineWidth);
  }
  if (serviceCharge > 0) {
    totalsText += formatRow("Biaya Layanan:", formatCurrency(serviceCharge), lineWidth);
  }
  if (tax > 0) {
    totalsText += formatRow("Pajak PB1:", formatCurrency(tax), lineWidth);
  }

  parts.push(textToBytes(totalsText));
  parts.push(textToBytes(formatDivider("-", lineWidth)));

  // Grand Total (Bold)
  parts.push(setBold(true));
  parts.push(textToBytes(formatRow("TOTAL:", formatCurrency(total), lineWidth)));
  parts.push(setBold(false));

  // 6. METODE PEMBAYARAN (Single atau Split Payment)
  let payText = "";
  const method = (orderData.paymentMethod || "cash").toLowerCase();
  const breakdown = orderData.paymentBreakdown || [];

  if (method === "split" || breakdown.length > 0) {
    payText += formatRow("Metode Bayar:", "SPLIT PEMBAYARAN", lineWidth);
    for (const splitItem of breakdown) {
      const label =
        splitItem.method === "cash"
          ? "Tunai"
          : splitItem.method === "qris"
            ? "QRIS"
            : splitItem.method === "transfer"
              ? "Transfer"
              : "Debit";
      const refStr = splitItem.reference ? ` (${splitItem.reference})` : "";
      payText += formatRow(` • ${label}${refStr}:`, formatCurrency(splitItem.amount), lineWidth);
    }
    if (orderData.tendered !== undefined && orderData.tendered !== null) {
      payText += formatRow("Total Diterima:", formatCurrency(orderData.tendered), lineWidth);
    }
    if (orderData.change !== undefined && orderData.change !== null && orderData.change > 0) {
      payText += formatRow("Kembalian:", formatCurrency(orderData.change), lineWidth);
    }
  } else {
    const label =
      method === "cash"
        ? "TUNAI"
        : method === "qris"
          ? "QRIS"
          : method === "transfer"
            ? "TRANSFER BANK"
            : "KARTU DEBIT";
    payText += formatRow("Metode Bayar:", label, lineWidth);

    if (method === "transfer" && orderData.paymentReference) {
      payText += formatRow("Ref:", orderData.paymentReference, lineWidth);
    }
    if (method === "cash" && orderData.tendered !== undefined && orderData.tendered !== null) {
      payText += formatRow("Bayar Tunai:", formatCurrency(orderData.tendered), lineWidth);
      const chg = orderData.change ?? (orderData.tendered - total);
      payText += formatRow("Kembalian:", formatCurrency(Math.max(0, chg)), lineWidth);
    }
  }

  parts.push(textToBytes(payText));
  parts.push(textToBytes(formatDivider("=", lineWidth)));

  // Resep Pulih Personal (AI Mood-to-Menu Scanner)
  const therapy = orderData.therapyText || (orderData.mood ? getTherapyText(orderData.mood) : "");
  if (therapy && therapy.trim().length > 0) {
    parts.push(alignCenter());
    parts.push(setBold(true));
    parts.push(textToBytes(`${therapy.trim()}\n`));
    parts.push(setBold(false));
    parts.push(textToBytes(formatDivider("=", lineWidth)));
  }

  // 7. FOOTER
  parts.push(alignCenter());
  parts.push(setBold(true));
  parts.push(textToBytes("*** LUNAS / TERIMA KASIH ***\n"));
  parts.push(setBold(false));
  if (footerMsg) {
    parts.push(textToBytes(`${footerMsg}\n`));
  }
  parts.push(textToBytes("Powered by DOI TA POS\n"));

  // 8. Feed kertas beberapa baris & Potong Kertas
  parts.push(feedLines(4));
  parts.push(cutPaper(true));

  return concatBytes(...parts);
}

/**
 * Buat byte buffer ESC/POS untuk uji kalibrasi hardware (Ruler presisi & ketajaman thermal).
 */
export function formatCalibrationReceipt(storeData?: StoreDataForPrint): Uint8Array {
  const is80mm = storeData?.printerPaperSize === "80mm";
  const lineWidth = is80mm ? 48 : 32;
  const brandTitle = (storeData?.brandName || storeData?.cafeName || "DOI TA POS").trim();
  const address = (storeData?.address || "Jl. Pengayoman No. 12, Makassar").trim();

  const parts: Uint8Array[] = [];
  parts.push(initPrinter());

  // Header Kalibrasi
  parts.push(alignCenter());
  parts.push(setBold(true));
  parts.push(setFontSize("double-height"));
  parts.push(textToBytes("*** UJI KALIBRASI ***\n"));
  parts.push(setFontSize("normal"));
  parts.push(textToBytes(`${brandTitle}\n`));
  parts.push(setBold(false));
  parts.push(textToBytes(`${address}\n`));
  parts.push(textToBytes(`LEBAR KERTAS: ${is80mm ? "80MM (48 Karakter)" : "58MM (32 Karakter)"}\n`));

  parts.push(alignLeft());
  parts.push(textToBytes(formatDivider("=", lineWidth)));

  // Ruler alignment
  parts.push(alignCenter());
  parts.push(textToBytes(is80mm ? "|0mm............36mm............72mm|\n" : "|0mm......24mm......48mm|\n"));
  parts.push(textToBytes(is80mm ? "[ 1234567890123456789012345678901234567890 ]\n" : "[ 123456789012345678901234567890 ]\n"));
  parts.push(alignLeft());
  parts.push(textToBytes(formatDivider("-", lineWidth)));

  // Simulasi Dummy
  parts.push(textToBytes(formatRow("1x Kopi Kalibrasi", "Rp 25.000", lineWidth)));
  parts.push(textToBytes("  Subtotal: Rp 25.000\n"));
  parts.push(textToBytes("  Pajak PB1 (10%): Rp 2.500\n"));
  parts.push(textToBytes(formatDivider("-", lineWidth)));
  parts.push(setBold(true));
  parts.push(textToBytes(formatRow("TOTAL UJI:", "Rp 27.500", lineWidth)));
  parts.push(setBold(false));
  parts.push(textToBytes(formatDivider("=", lineWidth)));

  // Footer status
  parts.push(alignCenter());
  parts.push(setBold(true));
  parts.push(textToBytes("STATUS: HARDWARE SIAP DIGUNAKAN\n"));
  parts.push(setBold(false));
  parts.push(textToBytes(`Waktu: ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}\n`));
  parts.push(textToBytes("Powered by DOI TA POS\n"));

  parts.push(feedLines(4));
  parts.push(cutPaper(true));

  return concatBytes(...parts);
}

