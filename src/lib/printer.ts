/**
 * DOI TA POS — Master Thermal Printer Hardware Bridge
 * Arsitektur Integrasi Hardware Cetak Multi-Strategi:
 * 1. Web Bluetooth API (BLE GATT Direct Printing)
 * 2. Android Intent Scheme (RawBT Printer Bridge untuk TWA / Chrome Android)
 * 3. System Print Dialog (window.print() fallback untuk desktop / PDF spooler)
 */

import {
  formatReceipt,
  formatReceiptText,
  formatCalibrationReceipt,
  formatCalibrationReceiptText,
  type OrderDataForPrint,
  type StoreDataForPrint,
} from "./escpos";
import { printReceiptBluetooth } from "./bluetooth";
import type { OrderReceipt, StoreSettingDto } from "./types";

export { formatReceiptText, formatCalibrationReceiptText };

export type PrintStrategy = "auto" | "bluetooth" | "rawbt" | "browser";

export interface PrintResult {
  success: boolean;
  strategyUsed: PrintStrategy;
  message?: string;
  error?: string;
}

/**
 * Konversi Uint8Array ke format Base64 yang aman untuk intent URL
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Deteksi apakah aplikasi berjalan di perangkat Android (Chrome / TWA)
 */
export function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent || navigator.vendor || "");
}

/**
 * Deteksi dukungan browser terhadap Web Bluetooth API
 */
export function isWebBluetoothSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.bluetooth !== "undefined" &&
    typeof navigator.bluetooth.requestDevice === "function"
  );
}

/**
 * Ambil preferensi strategi cetak dari localStorage kasir
 */
export function getSavedPrintStrategy(): PrintStrategy {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return "auto";
  const saved = localStorage.getItem("doita_printer_strategy") as PrintStrategy;
  if (saved && ["auto", "bluetooth", "rawbt", "browser"].includes(saved)) {
    return saved;
  }
  return "auto";
}

/**
 * Simpan preferensi strategi cetak ke localStorage kasir
 */
export function setSavedPrintStrategy(strategy: PrintStrategy): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  localStorage.setItem("doita_printer_strategy", strategy);
}

/**
 * Skema URI RawBT untuk sistem cetak berbasis Teks (ESC/POS).
 * Langsung melempar data struk kasir yang sudah diformat dengan baris baru (\n)
 * ke aplikasi RawBT di Android / Samsung Tab tanpa dialog print browser.
 */
export const printToRawBT = (receiptString: string): { success: boolean; error?: string } => {
  try {
    if (typeof window === "undefined") {
      return { success: false, error: "Objek window peramban tidak tersedia." };
    }
    // receiptString berisi teks struk kasir yang sudah diformat dengan baris baru (\n)
    const encodedReceipt = encodeURIComponent(receiptString);
    window.location.href = "rawbt:" + encodedReceipt;
    return { success: true };
  } catch (err: any) {
    console.error("[Printer] Gagal mengirim ke skema URI RawBT:", err);
    return { success: false, error: err?.message || "Gagal memanggil RawBT" };
  }
};

/**
 * Fungsi cetak peramban bawaan jika sistem merender struk sebagai Dokumen/HTML.
 * Karena RawBT Print Service telah diaktifkan di Android, ini akan otomatis memanggil aplikasi RawBT.
 */
export const printStandard = (): { success: boolean } => {
  if (typeof window !== "undefined" && typeof window.print === "function") {
    window.print();
    return { success: true };
  }
  return { success: false };
};

/**
 * Pengiriman data ESC/POS via skema RawBT URI (mendukung string teks maupun byte array).
 */
export function printViaRawBT(receiptData: Uint8Array | string): { success: boolean; error?: string } {
  if (typeof receiptData === "string") {
    return printToRawBT(receiptData);
  }
  try {
    if (typeof window !== "undefined") {
      const base64Data = uint8ArrayToBase64(receiptData);
      window.location.href = `rawbt:base64,${base64Data}`;
      return { success: true };
    }
    return { success: false, error: "Objek browser (window) tidak tersedia." };
  } catch (err: any) {
    console.error("[Printer] Gagal meluncurkan RawBT:", err);
    return { success: false, error: err?.message || "Gagal memanggil RawBT" };
  }
}

/**
 * Pengiriman data ESC/POS via Web Bluetooth API (BLE)
 */
export async function printViaBluetooth(
  receiptBytes: Uint8Array
): Promise<{ success: boolean; error?: string }> {
  try {
    const ok = await printReceiptBluetooth(receiptBytes);
    return {
      success: ok,
      error: ok ? undefined : "Koneksi Bluetooth dibatalkan atau terputus.",
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Bluetooth error" };
  }
}

/**
 * Pengiriman cetak via browser print spooler (window.print / printStandard)
 */
export function printViaBrowser(): { success: boolean } {
  return printStandard();
}

/**
 * Fungsi Eksekusi Cetak Utama Terpadu (Unified Print Orchestrator)
 */
export async function executePrintReceipt(
  receiptBytes: Uint8Array,
  receiptText?: string,
  strategy: PrintStrategy = "auto"
): Promise<PrintResult> {
  const chosenStrategy = strategy === "auto" ? getSavedPrintStrategy() : strategy;
  const isAndroid = isAndroidDevice();

  // 1. Eksekusi Strategi Eksplisit
  if (chosenStrategy === "rawbt") {
    const textToPrint = receiptText || new TextDecoder().decode(receiptBytes);
    const res = printToRawBT(textToPrint);
    return {
      success: res.success,
      strategyUsed: "rawbt",
      error: res.error,
      message: res.success ? "Struk dikirim ke RawBT thermal printer." : res.error,
    };
  }

  if (chosenStrategy === "bluetooth") {
    const res = await printViaBluetooth(receiptBytes);
    return {
      success: res.success,
      strategyUsed: "bluetooth",
      error: res.error,
      message: res.success ? "Struk berhasil dicetak via Bluetooth!" : res.error,
    };
  }

  if (chosenStrategy === "browser") {
    printStandard();
    return {
      success: true,
      strategyUsed: "browser",
      message: "Dialog cetak dokumen standar dibuka.",
    };
  }

  // 2. Strategi Otomatis (AUTO)
  if (isAndroid) {
    // Pada Android / Samsung Tab: Utamakan langsung lempar teks struk ke RawBT via skema URI "rawbt:"
    // Struk langsung keluar seketika tanpa perantara dialog cetak browser
    const textToPrint = receiptText || new TextDecoder().decode(receiptBytes);
    const rawBtRes = printToRawBT(textToPrint);
    if (rawBtRes.success) {
      return {
        success: true,
        strategyUsed: "rawbt",
        message: "Struk langsung dialihkan ke RawBT printer bridge.",
      };
    }

    // Fallback: cetak dokumen HTML standar (RawBT Print Service)
    printStandard();
    return {
      success: true,
      strategyUsed: "browser",
      message: "Menggunakan dialog cetak dokumen standar.",
    };
  }

  // Pada Desktop: coba Bluetooth jika ada, lalu fallback ke printStandard()
  if (isWebBluetoothSupported()) {
    try {
      const btRes = await printViaBluetooth(receiptBytes);
      if (btRes.success) {
        return {
          success: true,
          strategyUsed: "bluetooth",
          message: "Struk berhasil dicetak via Bluetooth!",
        };
      }
    } catch (_) {}
  }

  printStandard();
  return {
    success: true,
    strategyUsed: "browser",
    message: "Dialog cetak dibuka.",
  };
}

/**
 * Konversi DTO OrderReceipt ke format data struk ESC/POS
 */
export function orderReceiptToPrintData(
  receipt: OrderReceipt | any,
  moodTag?: string | null
): OrderDataForPrint {
  return {
    orderNumber: receipt.orderNumber,
    cashierName: receipt.cashierName,
    customerName: receipt.customerName,
    customerPhone: receipt.customerPhone,
    orderType: receipt.orderType,
    tableNumber: receipt.tableNumber,
    createdAt: receipt.createdAt,
    outletId: receipt.outletId,
    outletName: receipt.outletName,
    outletBrandName: receipt.outletBrandName,
    outletReceiptHeader: receipt.outletReceiptHeader,
    outletReceiptFooter: receipt.outletReceiptFooter,
    subtotal: receipt.subtotal,
    discountAmount: receipt.discountAmount,
    serviceCharge: receipt.serviceCharge,
    tax: receipt.tax,
    total: receipt.total,
    paymentMethod: receipt.paymentMethod,
    paymentBreakdown: receipt.paymentBreakdown,
    tendered: receipt.tendered,
    change: receipt.change,
    paymentReference: receipt.paymentReference,
    items: receipt.items?.map((it: any) => ({
      productName: it.productName || it.name,
      variantName: it.variantName,
      qty: it.qty,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice,
      modifiers: it.modifiers || it.mods || [],
    })),
    mood: moodTag || receipt.mood,
    therapyText: receipt.therapyText,
  };
}

/**
 * Eksekusi pencetakan struk transaksi transaksi lengkap
 */
export async function printOrderReceipt(
  receipt: OrderReceipt,
  storeSettings?: Partial<StoreSettingDto> | null,
  moodTag?: string | null,
  strategy?: PrintStrategy
): Promise<PrintResult> {
  const printData = orderReceiptToPrintData(receipt, moodTag);
  const storeData: StoreDataForPrint = {
    cafeName: storeSettings?.cafeName,
    brandName: receipt.outletBrandName || storeSettings?.brandName,
    receiptHeader: receipt.outletReceiptHeader || (storeSettings as any)?.receiptHeader,
    receiptFooter:
      receipt.outletReceiptFooter ||
      storeSettings?.receiptFooterMessage ||
      (storeSettings as any)?.receiptFooter,
    address: storeSettings?.address,
    phone: storeSettings?.phone,
    printerPaperSize: storeSettings?.printerPaperSize || "58mm",
  };

  const receiptText = formatReceiptText(printData, storeData);
  const bytes = formatReceipt(printData, storeData);
  return await executePrintReceipt(bytes, receiptText, strategy || "auto");
}

/**
 * Eksekusi uji kalibrasi printer thermal
 */
export async function printTestCalibration(
  storeSettings?: Partial<StoreSettingDto> | null,
  strategy?: PrintStrategy
): Promise<PrintResult> {
  const storeData: StoreDataForPrint = {
    cafeName: storeSettings?.cafeName || "DOI TA",
    brandName: storeSettings?.brandName,
    address: storeSettings?.address,
    phone: storeSettings?.phone,
    printerPaperSize: storeSettings?.printerPaperSize || "58mm",
  };

  const calibText = formatCalibrationReceiptText(storeData);
  const bytes = formatCalibrationReceipt(storeData);
  return await executePrintReceipt(bytes, calibText, strategy || "auto");
}
