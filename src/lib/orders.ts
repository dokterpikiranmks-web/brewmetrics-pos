import "server-only";
import { db } from "@/db";
import { ingredients, orderItems, orders, products, variants, modifiers, storeSettings, customers } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { buildRecipeIndex, hppPerUnit, mergeUsage, usageForLine } from "./recipes";
import type { CreateOrderPayload, OrderReceipt, SessionUser } from "./types";

export class OrderError extends Error {
  status: number;
  code: string;
  details?: { name: string; need: number; have: number; unit: string }[];
  constructor(message: string, status = 400, code = "ORDER_ERROR", details?: OrderError["details"]) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function nextOrderNumber(tx: Pick<typeof db, "execute">): Promise<string> {
  const res = await tx.execute(sql`
    SELECT COUNT(*)::int AS c FROM orders
    WHERE created_at >= date_trunc('day', now())
  `);
  const row = (res as unknown as { rows: { c: number }[] }).rows[0];
  const seq = (row?.c ?? 0) + 1;
  const now = new Date();
  const ymd = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `BM-${ymd}-${String(seq).padStart(3, "0")}`;
}

export async function getOrderReceiptById(orderId: number): Promise<OrderReceipt | null> {
  const found = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!found) return null;
  const [items, settingsRow] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, found.id)),
    db.query.storeSettings.findFirst({ where: eq(storeSettings.id, 1) }),
  ]);
  return {
    id: found.id,
    orderNumber: found.orderNumber,
    status: (found.status as "paid" | "void") ?? "paid",
    paymentMethod: found.paymentMethod as any,
    paymentBreakdown: (found.paymentBreakdown as any) ?? [],
    customerId: found.customerId ?? null,
    customerName: found.customerName ?? "Umum",
    customerPhone: found.customerPhone ?? "",
    orderType: (found.orderType as any) ?? "dine-in",
    tableNumber: found.tableNumber ?? "",
    discountType: (found.discountType as any) ?? null,
    discountValue: found.discountValue ?? 0,
    discountAmount: found.discountAmount ?? 0,
    paymentReference: found.paymentReference ?? "",
    subtotal: found.subtotal,
    tax: found.tax ?? 0,
    serviceCharge: found.serviceCharge ?? 0,
    total: found.total || (found.subtotal + (found.tax ?? 0) + (found.serviceCharge ?? 0)),
    tendered: found.tendered,
    change: found.change,
    itemCount: found.itemCount,
    hpp: found.hpp,
    profit: found.profit,
    cashierName: found.cashierName,
    createdAt: found.createdAt.toISOString(),
    items: items.map((i) => ({
      productName: i.productName,
      variantName: i.variantName,
      qty: i.qty,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
      modifiers: (i.modifiers as { name: string; price: number }[]) ?? [],
    })),
    storeSettings: settingsRow
      ? {
          id: settingsRow.id,
          cafeName: settingsRow.cafeName,
          logoUrl: settingsRow.logoUrl,
          address: settingsRow.address,
          phone: settingsRow.phone,
          taxPercentage: settingsRow.taxPercentage,
          serviceChargePercentage: settingsRow.serviceChargePercentage,
          printerPaperSize: (settingsRow.printerPaperSize as "58mm" | "80mm") ?? "58mm",
          autoPrintReceipt: settingsRow.autoPrintReceipt ?? true,
          receiptFooterMessage: settingsRow.receiptFooterMessage,
        }
      : null,
  };
}

export async function getReceiptByOfflineId(offlineId: string): Promise<OrderReceipt | null> {
  const found = await db.query.orders.findFirst({ where: eq(orders.offlineId, offlineId) });
  if (!found) return null;
  return getOrderReceiptById(found.id);
}


/**
 * Buat order: validasi harga dari server, hitung HPP dari resep,
 * hitung pajak PB1 & service charge sesuai profil toko,
 * lalu potong stok bahan baku secara transaksional (offline-tolerant via offlineId).
 */
export async function createOrder(payload: CreateOrderPayload, user: SessionUser): Promise<OrderReceipt> {
  if (payload.offlineId) {
    const existing = await getReceiptByOfflineId(payload.offlineId);
    if (existing) return existing;
  }
  if (!payload.lines || payload.lines.length === 0) {
    throw new OrderError("Keranjang kosong.", 400, "EMPTY_CART");
  }

  const [index, settingsRow] = await Promise.all([
    buildRecipeIndex(),
    db.query.storeSettings.findFirst({ where: eq(storeSettings.id, 1) }),
  ]);

  const taxPercentage = settingsRow?.taxPercentage ?? 10;
  const serviceChargePercentage = settingsRow?.serviceChargePercentage ?? 0;

  const productIds = [...new Set(payload.lines.map((l) => l.productId))];
  const variantIds = [...new Set(payload.lines.map((l) => l.variantId).filter((v): v is number => v !== null))];
  const modifierIds = [...new Set(payload.lines.flatMap((l) => l.modifierIds))];

  const [prods, vars, mods] = await Promise.all([
    db.select().from(products).where(and(inArray(products.id, productIds), eq(products.isActive, true))),
    variantIds.length ? db.select().from(variants).where(inArray(variants.id, variantIds)) : Promise.resolve([]),
    modifierIds.length
      ? db.select().from(modifiers).where(and(inArray(modifiers.id, modifierIds), eq(modifiers.isActive, true)))
      : Promise.resolve([]),
  ]);
  const prodById = new Map(prods.map((p) => [p.id, p]));
  const varById = new Map(vars.map((v) => [v.id, v]));
  const modById = new Map(mods.map((m) => [m.id, m]));

  // Bangun line ternormalisasi (harga dihitung ulang dari DB — tidak percaya klien)
  const normalized = payload.lines.map((line, i) => {
    const product = prodById.get(line.productId);
    if (!product) throw new OrderError(`Produk #${line.productId} tidak ditemukan / nonaktif.`, 400, "BAD_PRODUCT");
    const variant = line.variantId ? varById.get(line.variantId) : null;
    if (line.variantId && (!variant || variant.productId !== product.id)) {
      throw new OrderError(`Varian tidak cocok untuk ${product.name}.`, 400, "BAD_VARIANT");
    }
    const qty = Math.max(1, Math.min(20, Math.floor(line.qty || 1)));
    const pickedMods = line.modifierIds.map((id) => {
      const m = modById.get(id);
      if (!m) throw new OrderError(`Modifier #${id} tidak tersedia.`, 400, "BAD_MODIFIER");
      return m;
    });
    const unitPrice = product.price + (variant?.priceDelta ?? 0) + pickedMods.reduce((s, m) => s + m.price, 0);
    const lineInput = { productId: product.id, variantId: variant?.id ?? null, qty, modifierIds: pickedMods.map((m) => m.id) };
    const unitHpp = hppPerUnit(lineInput, index);
    return {
      key: i,
      lineInput,
      product,
      variant,
      qty,
      unitPrice,
      totalPrice: unitPrice * qty,
      hpp: unitHpp * qty,
      mods: pickedMods.map((m) => ({ name: m.name, price: m.price })),
    };
  });

  const subtotal = normalized.reduce((s, l) => s + l.totalPrice, 0);

  // Kalkulasi Diskon Transaksi
  let discountAmount = 0;
  if (payload.discountType === "percentage") {
    const pct = Math.max(0, Math.min(100, Math.floor(payload.discountValue ?? 0)));
    discountAmount = Math.min(subtotal, Math.round((subtotal * pct) / 100));
  } else if (payload.discountType === "fixed") {
    discountAmount = Math.min(subtotal, Math.max(0, Math.floor(payload.discountValue ?? 0)));
  }

  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
  const serviceCharge = Math.round((subtotalAfterDiscount * Math.max(0, serviceChargePercentage)) / 100);
  const tax = Math.round(((subtotalAfterDiscount + serviceCharge) * Math.max(0, taxPercentage)) / 100);
  const grandTotal = subtotalAfterDiscount + serviceCharge + tax;

  const totalHpp = normalized.reduce((s, l) => s + l.hpp, 0);
  const itemCount = normalized.reduce((s, l) => s + l.qty, 0);
  const tendered = payload.paymentMethod === "cash" ? Math.max(grandTotal, Math.floor(payload.tendered ?? grandTotal)) : grandTotal;
  const change = payload.paymentMethod === "cash" ? tendered - grandTotal : 0;

  // Total pemakaian bahan seluruh order
  const totalUsage = new Map<number, number>();
  for (const l of normalized) mergeUsage(totalUsage, usageForLine(l.lineInput, index));

  const receipt = await db.transaction(async (tx) => {
    // Lock baris bahan agar potongan stok aman dari race condition
    const ids = [...totalUsage.keys()];
    if (ids.length) {
      await tx.execute(sql`SELECT id FROM ingredients WHERE id IN ${ids} ORDER BY id FOR UPDATE`);
    }
    const current = ids.length
      ? await tx.select().from(ingredients).where(inArray(ingredients.id, ids))
      : [];
    const byId = new Map(current.map((c) => [c.id, c]));

    // Cek kecukupan stok
    const shortage: { name: string; need: number; have: number; unit: string }[] = [];
    for (const [ingId, qty] of totalUsage) {
      const ing = byId.get(ingId);
      if (!ing) continue;
      if (ing.stockQty < qty) {
        shortage.push({ name: ing.name, need: Math.ceil(qty), have: Math.floor(ing.stockQty), unit: ing.unit });
      }
    }
    if (shortage.length) {
      throw new OrderError("Stok bahan baku tidak mencukupi.", 409, "INSUFFICIENT_STOCK", shortage);
    }

    // Potong stok
    for (const [ingId, qty] of totalUsage) {
      await tx.execute(sql`
        UPDATE ingredients SET stock_qty = stock_qty - ${qty}, updated_at = now() WHERE id = ${ingId}
      `);
    }

    // Sinkronisasi Mini CRM Pelanggan
    let customerId: number | null = null;
    const phone = (payload.customerPhone ?? "").trim();
    if (phone) {
      const existingCustomer = await tx.query.customers.findFirst({
        where: eq(customers.phone, phone),
      });
      if (existingCustomer) {
        customerId = existingCustomer.id;
        await tx
          .update(customers)
          .set({
            name: (payload.customerName ?? "").trim() || existingCustomer.name,
            totalOrders: sql`total_orders + 1`,
            totalSpend: sql`total_spend + ${grandTotal}`,
            lastVisitAt: new Date(),
          })
          .where(eq(customers.id, existingCustomer.id));
      } else {
        const [newCust] = await tx
          .insert(customers)
          .values({
            name: (payload.customerName ?? "").trim() || "Pelanggan",
            phone,
            totalOrders: 1,
            totalSpend: grandTotal,
            lastVisitAt: new Date(),
          })
          .returning();
        customerId = newCust.id;
      }
    }

    const orderNumber = await nextOrderNumber(tx);
    const [inserted] = await tx
      .insert(orders)
      .values({
        orderNumber,
        offlineId: payload.offlineId ?? null,
        cashierId: user.id,
        cashierName: user.name,
        customerId,
        customerName: (payload.customerName ?? "").trim() || "Umum",
        customerPhone: phone,
        orderType: payload.orderType === "take-away" ? "take-away" : "dine-in",
        tableNumber: (payload.tableNumber ?? "").trim(),
        discountType: payload.discountType ?? null,
        discountValue: payload.discountValue ?? 0,
        discountAmount,
        paymentReference: (payload.paymentReference ?? "").trim(),
        status: "paid",
        paymentMethod: payload.paymentMethod,
        paymentBreakdown: payload.paymentBreakdown ?? [],
        subtotal,
        tax,
        serviceCharge,
        total: grandTotal,
        hpp: totalHpp,
        profit: subtotalAfterDiscount - totalHpp,
        tendered,
        change,
        itemCount,
        isOfflineSync: Boolean(payload.offlineId),
      })
      .returning();

    await tx.insert(orderItems).values(
      normalized.map((l) => ({
        orderId: inserted.id,
        productId: l.product.id,
        productName: l.product.name,
        variantName: l.variant?.name ?? null,
        qty: l.qty,
        unitPrice: l.unitPrice,
        totalPrice: l.totalPrice,
        hpp: l.hpp,
        modifiers: l.mods,
      }))
    );

    return inserted;
  });

  return {
    id: receipt.id,
    orderNumber: receipt.orderNumber,
    status: "paid",
    paymentMethod: receipt.paymentMethod as any,
    paymentBreakdown: (receipt.paymentBreakdown as any) ?? [],
    customerId: receipt.customerId ?? null,
    customerName: receipt.customerName ?? "Umum",
    customerPhone: receipt.customerPhone ?? "",
    orderType: (receipt.orderType as any) ?? "dine-in",
    tableNumber: receipt.tableNumber ?? "",
    discountType: (receipt.discountType as any) ?? null,
    discountValue: receipt.discountValue ?? 0,
    discountAmount: receipt.discountAmount ?? 0,
    paymentReference: receipt.paymentReference ?? "",
    subtotal: receipt.subtotal,
    tax: receipt.tax,
    serviceCharge: receipt.serviceCharge,
    total: receipt.total,
    tendered: receipt.tendered,
    change: receipt.change,
    itemCount: receipt.itemCount,
    hpp: receipt.hpp,
    profit: receipt.profit,
    cashierName: receipt.cashierName,
    createdAt: receipt.createdAt.toISOString(),
    items: normalized.map((l) => ({
      productName: l.product.name,
      variantName: l.variant?.name ?? null,
      qty: l.qty,
      unitPrice: l.unitPrice,
      totalPrice: l.totalPrice,
      modifiers: l.mods,
    })),
    storeSettings: settingsRow
      ? {
          id: settingsRow.id,
          cafeName: settingsRow.cafeName,
          logoUrl: settingsRow.logoUrl,
          address: settingsRow.address,
          phone: settingsRow.phone,
          taxPercentage: settingsRow.taxPercentage,
          serviceChargePercentage: settingsRow.serviceChargePercentage,
          printerPaperSize: (settingsRow.printerPaperSize as "58mm" | "80mm") ?? "58mm",
          autoPrintReceipt: settingsRow.autoPrintReceipt ?? true,
          receiptFooterMessage: settingsRow.receiptFooterMessage,
        }
      : null,
  };
}

/**
 * Void transaksi yang sudah tersimpan di database:
 * - Wajib diotorisasi oleh Supervisor (Manager atau Owner)
 * - Mengubah status order menjadi 'void'
 * - Mengembalikan (refund) stok bahan baku yang telah terpotong ke tabel ingredients
 */
export async function voidOrder(
  orderId: number,
  supervisor: { id: number; name: string; role: string },
  reason = ""
): Promise<{ ok: boolean; orderNumber: string }> {
  const target = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!target) {
    throw new OrderError("Pesanan tidak ditemukan.", 404, "ORDER_NOT_FOUND");
  }
  if (target.status === "void") {
    throw new OrderError("Pesanan ini sudah dibatalkan sebelumnya.", 400, "ALREADY_VOID");
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, target.id));
  const index = await buildRecipeIndex();

  // Hitung balik total bahan baku yang digunakan untuk direfund
  const totalRefund = new Map<number, number>();
  const [allVariants, allModifiers] = await Promise.all([
    db.select().from(variants),
    db.select().from(modifiers),
  ]);
  const variantIdByName = new Map(allVariants.map((v) => [`${v.productId}:${v.name}`, v.id]));
  const modifierIdByName = new Map(allModifiers.map((m) => [m.name, m.id]));

  for (const it of items) {
    if (!it.productId) continue;
    const variantId = it.variantName
      ? (variantIdByName.get(`${it.productId}:${it.variantName}`) ?? null)
      : null;
    const modifierIds = ((it.modifiers as { name: string; price: number }[]) ?? [])
      .map((m) => modifierIdByName.get(m.name))
      .filter((x): x is number => typeof x === "number");

    mergeUsage(totalRefund, usageForLine({ productId: it.productId, variantId, qty: it.qty, modifierIds }, index));
  }

  await db.transaction(async (tx) => {
    // Refund stok bahan baku
    for (const [ingId, qty] of totalRefund) {
      await tx.execute(sql`
        UPDATE ingredients SET stock_qty = stock_qty + ${qty}, updated_at = now() WHERE id = ${ingId}
      `);
    }

    // Update status order menjadi void
    await tx
      .update(orders)
      .set({
        status: "void",
      })
      .where(eq(orders.id, orderId));
  });

  return { ok: true, orderNumber: target.orderNumber };
}

