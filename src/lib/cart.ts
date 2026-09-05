import type { CartLinePayload } from "./types";

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
  serviceCharge: number;
  tax: number;
  grandTotal: number;
}

/**
 * Kalkulasi Standar Pajak Restoran (PB1) & Biaya Layanan Kafe:
 * - Subtotal = total harga seluruh menu pesanan
 * - Service Charge = Subtotal * (serviceChargePercentage / 100)
 * - Pajak Restoran (PB1) = (Subtotal + Service Charge) * (taxPercentage / 100)
 * - Grand Total = Subtotal + Service Charge + Pajak Restoran
 */
export function calculateOrderTotals(
  subtotal: number,
  taxPercentage = 10,
  serviceChargePercentage = 0
): OrderTotals {
  const safeSubtotal = Math.max(0, Math.round(subtotal));
  const serviceCharge = Math.round((safeSubtotal * Math.max(0, serviceChargePercentage)) / 100);
  const taxableBase = safeSubtotal + serviceCharge;
  const tax = Math.round((taxableBase * Math.max(0, taxPercentage)) / 100);
  const grandTotal = safeSubtotal + serviceCharge + tax;

  return {
    subtotal: safeSubtotal,
    serviceCharge,
    tax,
    grandTotal,
  };
}
