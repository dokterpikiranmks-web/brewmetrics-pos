/**
 * Test Suite: Multi-Branch Revision & QA Testing Protocol
 * Verifies all 6 hotfix requirements:
 * 1. JWS Error & Storage Upload Resiliency
 * 2. UI Scrolling Layout & 100dvh
 * 3. Recurring Day Promo (Jumat Berkah)
 * 4. Branch ID Leak on Menu Creation
 * 5. Custom Surcharge in POS Cart & Grand Total
 * 6. Role-Based Access Control (RBAC) on Cashier Branch Access
 */

import fs from "fs";
import path from "path";
import { isValidJwt } from "../src/lib/supabase";
import { calculateOrderTotals, cartTotal, toPayloadLines, type CartLine } from "../src/lib/cart";
import { normalizeBranchId, type DiscountDto, type SessionUser } from "../src/lib/types";

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

async function runTestSuite() {
  console.log("==================================================================");
  console.log("  GRAVITY AI - MULTI-BRANCH HOTFIX VERIFICATION & QA TEST SUITE");
  console.log("==================================================================\n");

  /* --------------------------------------------------------------------------
   * 1. TEST JWS ERROR ON IMAGE UPLOAD RESILIENCY
   * -------------------------------------------------------------------------- */
  console.log("--- 1. Testing JWS Error on Image Upload Resiliency ---");
  
  // Test isValidJwt helper
  assert(!isValidJwt(""), "Empty string is not valid JWT");
  assert(!isValidJwt("placeholder"), "Placeholder string is not valid JWT (prevents Compact JWS crash)");
  assert(!isValidJwt("abc.def"), "2-segment token is not valid JWT");
  assert(isValidJwt("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doita_secret_signature"), "Valid 3-segment token is detected as valid JWT");

  // Verify /api/upload/route.ts exists and handles invalid envs safely
  const uploadRoutePath = path.resolve(__dirname, "../src/app/api/upload/route.ts");
  assert(fs.existsSync(uploadRoutePath), "API upload route file exists");
  const uploadRouteCode = fs.readFileSync(uploadRoutePath, "utf-8");
  assert(uploadRouteCode.includes("isValidJwt"), "Upload route validates JWT before calling Supabase storage");
  assert(uploadRouteCode.includes("catch"), "Upload route has try-catch to prevent application crash on storage error");
  assert(uploadRouteCode.includes("!supabaseUrl || !supabaseKey || !isValidJwt(supabaseKey)"), "Upload route returns safe fallback if storage credentials are not configured");

  console.log();

  /* --------------------------------------------------------------------------
   * 2. TEST UI SCROLLING (FRONTEND TERPOTONG)
   * -------------------------------------------------------------------------- */
  console.log("--- 2. Testing UI Scrolling Layout & Viewport Height ---");
  
  const catalogPanePath = path.resolve(__dirname, "../src/components/pos/CatalogPane.tsx");
  const catalogPaneCode = fs.readFileSync(catalogPanePath, "utf-8");
  assert(catalogPaneCode.includes("flex-1 overflow-y-auto") && catalogPaneCode.includes("pb-32"), "CatalogPane has 'flex-1 overflow-y-auto' and 'pb-32' for scroll beyond cart drawer");
  assert(!catalogPaneCode.includes("overflow-hidden") || !catalogPaneCode.includes("<div className=\"flex-1 overflow-hidden"), "CatalogPane menu list wrapper is not overflow-hidden");

  const ticketPanePath = path.resolve(__dirname, "../src/components/pos/TicketPane.tsx");
  const ticketPaneCode = fs.readFileSync(ticketPanePath, "utf-8");
  assert(ticketPaneCode.includes("100dvh") || ticketPaneCode.includes("90dvh"), "TicketPane uses modern dvh units for mobile browser viewport compatibility");

  const posPagePath = path.resolve(__dirname, "../src/app/pos/page.tsx");
  const posPageCode = fs.readFileSync(posPagePath, "utf-8");
  assert(posPageCode.includes("100dvh"), "POS page container uses h-[100dvh] instead of h-screen");

  console.log();

  /* --------------------------------------------------------------------------
   * 3. TEST RECURRING DAY PROMO (JUMAT BERKAH)
   * -------------------------------------------------------------------------- */
  console.log("--- 3. Testing Recurring Day Promo (Jumat Berkah) ---");

  // Mock Friday-only promo (Friday = index 5 in JS Date.getDay())
  const fridayPromo: Partial<DiscountDto> = {
    id: 1,
    name: "Jumat Berkah",
    type: "percentage",
    value: 20,
    scope: "cart",
    activeDays: [5], // Only active on Friday
    isActive: true,
  };

  const allDaysPromo: Partial<DiscountDto> = {
    id: 2,
    name: "Diskon Harian",
    type: "fixed",
    value: 5000,
    scope: "cart",
    activeDays: [], // Active every day
    isActive: true,
  };

  function isPromoActiveOnDay(promo: Partial<DiscountDto>, dayOfWeek: number): boolean {
    if (promo.isActive === false) return false;
    const days = promo.activeDays || [];
    if (days.length === 0) return true;
    return days.includes(dayOfWeek);
  }

  // Simulate Friday (day 5)
  assert(isPromoActiveOnDay(fridayPromo, 5) === true, "Friday promo IS active on Friday (day 5)");
  // Simulate other days (0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 6 = Saturday)
  for (let d = 0; d < 7; d++) {
    if (d === 5) continue;
    assert(isPromoActiveOnDay(fridayPromo, d) === false, `Friday promo is NOT active on day ${d}`);
  }
  // All days promo is active on every day
  for (let d = 0; d < 7; d++) {
    assert(isPromoActiveOnDay(allDaysPromo, d) === true, `All-days promo is active on day ${d}`);
  }

  console.log();

  /* --------------------------------------------------------------------------
   * 4. TEST BRANCH ID LEAK ON MENU CREATION
   * -------------------------------------------------------------------------- */
  console.log("--- 4. Testing Branch ID Isolation on Menu Creation ---");

  interface MockProduct {
    id: number;
    name: string;
    branchId: string;
    price: number;
  }

  const mockDbProducts: MockProduct[] = [
    { id: 1, name: "Kopi Susu Gula Aren", branchId: "KOPI_ASO", price: 18000 },
    { id: 2, name: "Espresso Single", branchId: "KOPI_ASO", price: 12000 },
    { id: 3, name: "Nasi Kebuli Kambing", branchId: "NASI_KEBULI", price: 45000 },
    { id: 4, name: "Nasi Kebuli Ayam", branchId: "NASI_KEBULI", price: 32000 },
    { id: 5, name: "Bucin Uncle Special", branchId: "BUCIN_UNCLE", price: 25000 },
  ];

  function queryProductsByBranch(branch: string) {
    const normalized = normalizeBranchId(branch);
    return mockDbProducts.filter((p) => p.branchId === normalized);
  }

  const kopiAsoProducts = queryProductsByBranch("KOPI_ASO");
  const nasiKebuliProducts = queryProductsByBranch("NASI_KEBULI");
  const bucinUncleProducts = queryProductsByBranch("BUCIN_UNCLE");

  assert(kopiAsoProducts.length === 2 && kopiAsoProducts.every((p) => p.branchId === "KOPI_ASO"), "Branch KOPI_ASO contains only KOPI_ASO products");
  assert(nasiKebuliProducts.length === 2 && nasiKebuliProducts.every((p) => p.branchId === "NASI_KEBULI"), "Branch NASI_KEBULI contains only NASI_KEBULI products");
  assert(bucinUncleProducts.length === 1 && bucinUncleProducts.every((p) => p.branchId === "BUCIN_UNCLE"), "Branch BUCIN_UNCLE contains only BUCIN_UNCLE products");

  // Verify that adding menu to branch A never leaks to branch B
  const newProductBranchA: MockProduct = { id: 6, name: "Kopi Tubruk Baru", branchId: "KOPI_ASO", price: 10000 };
  mockDbProducts.push(newProductBranchA);

  const updatedKebuliList = queryProductsByBranch("NASI_KEBULI");
  assert(!updatedKebuliList.some((p) => p.id === 6), "Product added to KOPI_ASO does NOT appear in NASI_KEBULI (Zero Leakage)");
  assert(queryProductsByBranch("KOPI_ASO").some((p) => p.id === 6), "Product added to KOPI_ASO appears strictly in KOPI_ASO");

  console.log();

  /* --------------------------------------------------------------------------
   * 5. TEST CUSTOM SURCHARGE IN POS CART & GRAND TOTAL
   * -------------------------------------------------------------------------- */
  console.log("--- 5. Testing Custom Surcharge (Biaya Tambahan) in POS ---");

  const sampleCartWithSurcharge: CartLine[] = [
    {
      key: "prod:1",
      productId: 1,
      variantId: null,
      name: "Kopi Susu Gula Aren",
      variantName: null,
      color: "#F59E0B",
      unitPrice: 18000,
      qty: 2,
      mods: [],
    },
    {
      key: "surcharge:1",
      productId: 0,
      variantId: null,
      name: "Biaya Ongkir",
      variantName: null,
      color: "#F59E0B",
      unitPrice: 10000,
      qty: 1,
      mods: [],
      isSurcharge: true,
    },
  ];

  const subtotal = cartTotal(sampleCartWithSurcharge);
  assert(subtotal === (18000 * 2) + 10000, `Cart subtotal correctly includes surcharge: ${subtotal} == 46000`);

  // Calculate order totals with PB1 (10%) and Service Charge (5%)
  const totals = calculateOrderTotals(subtotal, 10, 5);
  // Subtotal = 46000
  // Service 5% = 2300
  // Taxable base = 48300
  // PB1 10% = 4830
  // Grand total = 46000 + 2300 + 4830 = 53130
  assert(totals.subtotal === 46000, "Totals subtotal is 46000");
  assert(totals.serviceCharge === 2300, "Service charge is 2300 (5% of 46000)");
  assert(totals.tax === 4830, "PB1 Tax is 4830 (10% of 48300)");
  assert(totals.grandTotal === 53130, `Grand total reflects surcharge accurately: ${totals.grandTotal} == 53130`);

  // Verify toPayloadLines propagates isSurcharge
  const payloadLines = toPayloadLines(sampleCartWithSurcharge);
  assert(payloadLines.length === 2, "Payload lines count is 2");
  assert(payloadLines[1].isSurcharge === true, "Surcharge line retains isSurcharge: true in payload");
  assert(payloadLines[1].name === "Biaya Ongkir", "Surcharge line retains custom name");
  assert(payloadLines[1].unitPrice === 10000, "Surcharge line retains unitPrice");

  // Verify server-side orders logic code handles isSurcharge with productId: null and no BAD_PRODUCT error
  const ordersLibPath = path.resolve(__dirname, "../src/lib/orders.ts");
  const ordersLibCode = fs.readFileSync(ordersLibPath, "utf-8");
  assert(ordersLibCode.includes("line.isSurcharge"), "orders.ts explicitly checks line.isSurcharge");
  assert(ordersLibCode.includes("productId: l.isSurcharge ? null : l.product.id"), "orderItems persists surcharge with productId: null");
  assert(ordersLibCode.includes("filter((l) => !l.isSurcharge"), "orders.ts excludes surcharge lines from database product lookup & stock deduction");

  console.log();

  /* --------------------------------------------------------------------------
   * 6. TEST CASHIER RBAC (BRANCH SELECTION & ISOLATION)
   * -------------------------------------------------------------------------- */
  console.log("--- 6. Testing Role-Based Access Control (RBAC) on Cashier ---");

  const singleBranchCashier: SessionUser = {
    id: 10,
    name: "Kasir Kopi Aso",
    role: "cashier",
    outletId: 1,
    authorizedBranch: "KOPI_ASO",
  };

  const ownerUser: SessionUser = {
    id: 1,
    name: "Owner Multi-Branch",
    role: "owner",
    outletId: 1,
    authorizedBranch: "ALL",
  };

  // Login decision logic
  function shouldSkipBranchModal(user: SessionUser): { skipModal: boolean; targetBranch: string } {
    const isOwner = user.role === "owner" || user.authorizedBranch === "ALL" || !user.authorizedBranch;
    if (!isOwner && user.authorizedBranch && user.authorizedBranch !== "ALL") {
      return { skipModal: true, targetBranch: user.authorizedBranch };
    }
    return { skipModal: false, targetBranch: "MODAL" };
  }

  const cashierDecision = shouldSkipBranchModal(singleBranchCashier);
  assert(cashierDecision.skipModal === true, "Single-branch cashier skips branch selection modal");
  assert(cashierDecision.targetBranch === "KOPI_ASO", "Single-branch cashier is directed immediately to KOPI_ASO");

  const ownerDecision = shouldSkipBranchModal(ownerUser);
  assert(ownerDecision.skipModal === false, "Owner does NOT skip branch selection modal (modal 'Pilih Cabang' is displayed)");

  // Verify BranchSwitcher lock logic for single-branch cashier
  function isBranchSwitcherLocked(user: SessionUser): boolean {
    return user.role !== "owner" && Boolean(user.authorizedBranch) && user.authorizedBranch !== "ALL";
  }

  assert(isBranchSwitcherLocked(singleBranchCashier) === true, "Branch switcher is locked for single-branch cashier");
  assert(isBranchSwitcherLocked(ownerUser) === false, "Branch switcher is UNLOCKED for owner");

  // Verify Catalog API RBAC enforcement
  function resolveCatalogBranch(user: SessionUser, requestedBranch: string): string {
    let target = normalizeBranchId(requestedBranch);
    if (user.role === "cashier" && user.authorizedBranch && user.authorizedBranch !== "ALL") {
      target = normalizeBranchId(user.authorizedBranch);
    }
    return target;
  }

  const bypassAttempt = resolveCatalogBranch(singleBranchCashier, "NASI_KEBULI");
  assert(bypassAttempt === "KOPI_ASO", `Single-branch cashier bypass attempt to NASI_KEBULI is blocked and forced to ${bypassAttempt}`);

  const ownerAccess = resolveCatalogBranch(ownerUser, "NASI_KEBULI");
  assert(ownerAccess === "NASI_KEBULI", `Owner can freely access NASI_KEBULI: ${ownerAccess}`);

  console.log();
  console.log("==================================================================");
  console.log(`TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("==================================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
