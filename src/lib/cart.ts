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
