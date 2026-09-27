/**
 * Test Suite: DOI TA POS - RawBT URI Scheme & Print Standard Verification
 */

import {
  formatReceiptText,
  formatCalibrationReceiptText,
  printToRawBT,
  printStandard,
  printOrderReceipt,
  printTestCalibration,
  executePrintReceipt,
  orderReceiptToPrintData,
  isAndroidDevice,
} from "../src/lib/printer";
import type { OrderReceipt, StoreSettingDto } from "../src/lib/types";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    failCount++;
  }
}

async function runTests() {
  console.log("=================================================");
  console.log("   DOI TA POS - RAWBT URI SCHEME TEST SUITE");
  console.log("=================================================\n");

  // Sample Order Data
  const sampleReceipt: OrderReceipt = {
    id: 101,
    orderNumber: "ORD-20260927-001",
    customerName: "Ahmad",
    customerPhone: "081234567890",
    orderType: "dine-in",
    tableNumber: "04",
    createdAt: new Date().toISOString(),
    outletId: 1,
    outletName: "DOI TA Pettarani",
    outletBrandName: "DOI TA Coffee & Eatery",
    outletReceiptHeader: "Tempat Singgah dan Bercerita",
    outletReceiptFooter: "Terima kasih atas kunjungannya!",
    subtotal: 75000,
    discountAmount: 5000,
    serviceCharge: 3500,
    tax: 7350,
    total: 80850,
    paymentMethod: "cash",
    tendered: 100000,
    change: 19150,
    cashierName: "Nurul",
    itemCount: 3,
    hpp: 25000,
    profit: 50000,
    items: [
      {
        productName: "Kopi Susu Gula Aren",
        variantName: "Ice / Regular",
        qty: 2,
        unitPrice: 25000,
        totalPrice: 50000,
        modifiers: [{ name: "Extra Shot", price: 5000 }],
      },
      {
        productName: "Croissant Butter",
        variantName: "Warm",
        qty: 1,
        unitPrice: 25000,
        totalPrice: 25000,
        modifiers: [],
      },
    ],
  };

  const sampleStore: StoreSettingDto = {
    id: 1,
    cafeName: "DOI TA HQ",
    brandName: "DOI TA",
    address: "Jl. Pengayoman No. 12, Makassar",
    phone: "0812-3456-7890",
    logoUrl: null,
    receiptFooterMessage: "Terima kasih atas kunjungannya!",
    printerPaperSize: "58mm",
    autoPrintReceipt: true,
    taxPercentage: 10,
    serviceChargePercentage: 5,
  };

  // 1. Test formatReceiptText
  console.log("--- 1. Testing formatReceiptText ---");
  const printData = orderReceiptToPrintData(sampleReceipt, "lelah");
  const receiptString58 = formatReceiptText(printData, sampleStore);

  assert(typeof receiptString58 === "string", "Receipt string is generated as string");
  assert(receiptString58.includes("DOI TA Coffee & Eatery"), "Contains brand title");
  assert(receiptString58.includes("ORD-20260927-001"), "Contains order number");
  assert(receiptString58.includes("Kopi Susu Gula Aren"), "Contains item name");
  assert(receiptString58.includes("TOTAL:"), "Contains TOTAL");
  assert(receiptString58.includes("Rp 80.850"), "Contains formatted total price");
  assert(receiptString58.includes("Bayar Tunai:"), "Contains cash payment row");
  assert(receiptString58.includes("Kembalian:"), "Contains change row");
  assert(receiptString58.includes("RESEP PULIH PERSONAL"), "Contains AI therapy text");
  assert(receiptString58.includes("\n"), "Contains newlines for line feeds");

  // 2. Test formatCalibrationReceiptText
  console.log("\n--- 2. Testing formatCalibrationReceiptText ---");
  const calibText = formatCalibrationReceiptText(sampleStore);
  assert(typeof calibText === "string", "Calibration string is generated as string");
  assert(calibText.includes("*** UJI KALIBRASI ***"), "Contains calibration header");
  assert(calibText.includes("LEBAR KERTAS: 58MM"), "Contains 58mm width flag");
  assert(calibText.includes("STATUS: HARDWARE SIAP DIGUNAKAN"), "Contains status ready");

  // 3. Test printToRawBT URI generation
  console.log("\n--- 3. Testing printToRawBT URI generation ---");
  let assignedLocation = "";
  // Mock window and location
  (global as any).window = {
    location: {
      set href(val: string) {
        assignedLocation = val;
      },
      get href() {
        return assignedLocation;
      },
    },
    print: () => {},
  };

  const rawBtRes = printToRawBT(receiptString58);
  assert(rawBtRes.success === true, "printToRawBT returns success: true");
  assert(assignedLocation.startsWith("rawbt:"), "Redirects to rawbt: URI scheme");
  assert(
    assignedLocation.includes(encodeURIComponent("ORD-20260927-001")),
    "rawbt: URI contains URL-encoded receipt string"
  );

  // 4. Test printStandard (window.print)
  console.log("\n--- 4. Testing printStandard ---");
  let printCalled = false;
  (global as any).window.print = () => {
    printCalled = true;
  };

  const stdRes = printStandard();
  assert(stdRes.success === true, "printStandard returns success: true");
  assert(Boolean(printCalled), "printStandard calls window.print()");

  // 5. Test executePrintReceipt on Android (Samsung Tab simulation)
  console.log("\n--- 5. Testing executePrintReceipt on Android simulation ---");
  Object.defineProperty(global, "navigator", {
    value: {
      userAgent: "Mozilla/5.0 (Linux; Android 14; SM-X210) AppleWebKit/537.36 Chrome/128.0 Samsung Tab",
    },
    configurable: true,
  });

  assert(isAndroidDevice() === true, "isAndroidDevice correctly detects Samsung Tab Android user agent");

  assignedLocation = "";
  const execAutoRes = await executePrintReceipt(new Uint8Array([0x1b, 0x40]), receiptString58, "auto");
  assert(execAutoRes.success === true, "executePrintReceipt succeeds on Android");
  assert(execAutoRes.strategyUsed === "rawbt", "executePrintReceipt uses rawbt on Android");
  assert(assignedLocation.startsWith("rawbt:"), "executePrintReceipt threw rawbt: URI on Android");

  // 6. Test executePrintReceipt with explicit "browser" strategy
  console.log("\n--- 6. Testing executePrintReceipt with browser strategy ---");
  printCalled = false;
  const execBrowserRes = await executePrintReceipt(new Uint8Array([0x1b, 0x40]), receiptString58, "browser");
  assert(execBrowserRes.success === true, "executePrintReceipt succeeds with browser strategy");
  assert(execBrowserRes.strategyUsed === "browser", "executePrintReceipt uses browser strategy");
  assert(Boolean(printCalled), "executePrintReceipt calls window.print() for browser strategy");

  // 7. Test printOrderReceipt full pipeline
  console.log("\n--- 7. Testing printOrderReceipt full pipeline ---");
  assignedLocation = "";
  const orderRes = await printOrderReceipt(sampleReceipt, sampleStore, "lelah", "rawbt");
  assert(orderRes.success === true, "printOrderReceipt succeeds with rawbt strategy");
  assert(assignedLocation.startsWith("rawbt:"), "printOrderReceipt correctly triggers rawbt: URI");

  // 8. Test printTestCalibration full pipeline
  console.log("\n--- 8. Testing printTestCalibration full pipeline ---");
  assignedLocation = "";
  const calibRes = await printTestCalibration(sampleStore, "rawbt");
  assert(calibRes.success === true, "printTestCalibration succeeds with rawbt strategy");
  assert(assignedLocation.startsWith("rawbt:"), "printTestCalibration correctly triggers rawbt: URI");

  console.log("\n=================================================");
  console.log(`TOTAL TESTS: ${passCount + failCount}`);
  console.log(`PASSED: ${passCount}`);
  console.log(`FAILED: ${failCount}`);
  console.log("=================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
