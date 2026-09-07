"use client";

import type { CartLinePayload, CreateOrderPayload, OrderReceipt } from "./types";

export interface QueuedOrder {
  offlineId: string;
  queuedAt: number;
  lines: CartLinePayload[];
  paymentMethod: CreateOrderPayload["paymentMethod"];
  tendered?: number;
  paymentBreakdown?: import("./types").PaymentBreakdownItem[];
  /** Estimasi total sisi klien (untuk struk provisional) */
  estTotal: number;
  cashierName: string;
}

const KEY = "bm_offline_queue_v1";

export function newOfflineId(): string {
  return `off-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadQueue(): QueuedOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedOrder[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(items: QueuedOrder[]) {
  window.localStorage.setItem(KEY, JSON.stringify(items));
}

export function enqueueOrder(order: QueuedOrder) {
  const items = loadQueue();
  items.push(order);
  saveQueue(items);
  window.dispatchEvent(new CustomEvent("bm-queue-change"));
}

export function queueCount(): number {
  return loadQueue().length;
}

export interface FlushResult {
  synced: number;
  remaining: number;
  receipts: OrderReceipt[];
}

/** Sinkronkan antrean offline ke server — idempotent via offlineId. */
export async function flushQueue(): Promise<FlushResult> {
  const items = loadQueue();
  const receipts: OrderReceipt[] = [];
  let synced = 0;
  for (const item of items) {
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offlineId: item.offlineId,
          paymentMethod: item.paymentMethod,
          tendered: item.tendered,
          paymentBreakdown: item.paymentBreakdown,
          lines: item.lines,
        } satisfies CreateOrderPayload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Stok kurang saat sinkron — buang dari antrean agar tidak macet, catat gagal
        if ((data as { code?: string }).code === "INSUFFICIENT_STOCK") {
          const rest = loadQueue().filter((q) => q.offlineId !== item.offlineId);
          saveQueue(rest);
          continue;
        }
        break; // server menolak — coba lagi siklus berikutnya
      }
      const data = (await res.json()) as { receipt: OrderReceipt };
      receipts.push(data.receipt);
      synced += 1;
      const rest = loadQueue().filter((q) => q.offlineId !== item.offlineId);
      saveQueue(rest);
    } catch {
      break; // tetap offline — hentikan, coba lagi nanti
    }
  }
  window.dispatchEvent(new CustomEvent("bm-queue-change"));
  return { synced, remaining: loadQueue().length, receipts };
}
