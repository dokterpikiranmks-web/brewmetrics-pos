/* Client-safe formatting helpers. */

export function formatIDR(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1000000) {
    const jt = value / 1000000;
    return `Rp ${jt % 1 === 0 ? jt.toFixed(0) : jt.toFixed(1)}jt`;
  }
  if (compact && Math.abs(value) >= 100000) {
    return `Rp ${Math.round(value / 1000)}rb`;
  }
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function formatQty(qty: number, unit: string): string {
  if (unit === "pcs") return `${Math.round(qty)} pcs`;
  if (unit === "ml" && qty >= 1000) return `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 1)} L`;
  if (unit === "g" && qty >= 1000) return `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 2)} kg`;
  return `${Math.round(qty)} ${unit}`;
}

export function formatTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateID(d: Date): string {
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
