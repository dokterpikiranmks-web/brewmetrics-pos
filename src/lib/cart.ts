import type { CartLinePayload, DiscountType } from "./types";

export interface CartLine {
  key: string;
  productId: number;
  variantId: number | null;
  name: string;
  variantName: string | null;
  color: string;
  unitPrice: number; // base + delta varian + modifiers
  qty: number;
  mods: { id: number; name: string; price: number }[];
}

export function cartLineKey(productId: number, variantId: number | null, modIds: number[]): string {
  return `${productId}:${variantId ?? "base"}:${[...modIds].sort((a, b) => a - b).join(",")}`;
}

export function toPayloadLines(lines: CartLine[]): CartLinePayload[] {
  return lines.map((l) => ({
    productId: l.productId,
    variantId: l.variantId,
    qty: l.qty,
    modifierIds: l.mods.map((m) => m.id),
  }));
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.qty, 0);
}

export interface OrderTotals {
  subtotal: number;
  discountType: DiscountType | null;
  discountValue: number;
  discountAmount: number;
  subtotalAfterDiscount: number;
  serviceCharge: number;
  tax: number;
  grandTotal: number;
}

/**
 * Kalkulasi Standar Pajak Restoran (PB1) & Biaya Layanan Kafe dengan Diskon:
 * - Subtotal = total harga seluruh menu pesanan
 * - Diskon:
 *   - Persentase: Subtotal * (discountValue / 100)
 *   - Nominal Tetap: discountValue
 * - Subtotal Setelah Diskon = max(0, Subtotal - Diskon)
 * - Service Charge = Subtotal Setelah Diskon * (serviceChargePercentage / 100)
 * - Pajak Restoran (PB1) = (Subtotal Setelah Diskon + Service Charge) * (taxPercentage / 100)
 * - Grand Total = Subtotal Setelah Diskon + Service Charge + Pajak Restoran
 */
export function calculateOrderTotals(
  subtotal: number,
  taxPercentage = 10,
  serviceChargePercentage = 0,
  discountType?: DiscountType | null,
  discountValue = 0
): OrderTotals {
  const safeSubtotal = Math.max(0, Math.round(subtotal));

  let discountAmount = 0;
  if (discountType === "percentage") {
    const pct = Math.max(0, Math.min(100, discountValue));
    discountAmount = Math.min(safeSubtotal, Math.round((safeSubtotal * pct) / 100));
  } else if (discountType === "fixed") {
    discountAmount = Math.min(safeSubtotal, Math.max(0, Math.round(discountValue)));
  }

  const subtotalAfterDiscount = Math.max(0, safeSubtotal - discountAmount);
  const serviceCharge = Math.round((subtotalAfterDiscount * Math.max(0, serviceChargePercentage)) / 100);
  const taxableBase = subtotalAfterDiscount + serviceCharge;
  const tax = Math.round((taxableBase * Math.max(0, taxPercentage)) / 100);
  const grandTotal = subtotalAfterDiscount + serviceCharge + tax;

  return {
    subtotal: safeSubtotal,
    discountType: discountType ?? null,
    discountValue,
    discountAmount,
    subtotalAfterDiscount,
    serviceCharge,
    tax,
    grandTotal,
  };
}

