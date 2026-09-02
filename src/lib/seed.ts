import "server-only";
import { db } from "@/db";
import {
  users, categories, products, variants, modifiers, ingredients,
  recipeItems, modifierIngredients, orders, orderItems, cashMovements,
} from "@/db/schema";
import { sql } from "drizzle-orm";

/* Deterministic RNG supaya grafik analitik selalu bagus di setiap fresh seed. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let seedPromise: Promise<void> | null = null;

/** Idempotent — hanya seed ketika tabel users masih kosong. force=true me-reset seluruh data demo. */
export function ensureSeeded(force = false): Promise<void> {
  if (force) {
    seedPromise = null;
  }
  if (!seedPromise) {
    seedPromise = runSeed(force).catch((e) => {
      seedPromise = null;
      throw e;
    });
  }
  return seedPromise;
}

async function runSeed(force: boolean) {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0 && !force) return;

  if (force) {
    await db.execute(sql`TRUNCATE TABLE order_items, orders, cash_movements, recipe_items, modifier_ingredients, variants, products, modifiers, ingredients, categories, users RESTART IDENTITY CASCADE`);
  }

  /* ---------------------------------- USERS --------------------------------- */
  const [ayu, rizky, sinta, bagas] = await db
    .insert(users)
    .values([
      { name: "Ayu Paramita", pin: "1234", role: "owner" as const },
      { name: "Rizky Ramadhan", pin: "2468", role: "manager" as const },
      { name: "Sinta Maharani", pin: "1111", role: "cashier" as const },
      { name: "Bagas Pratama", pin: "3333", role: "cashier" as const },
    ])
    .returning();

  /* -------------------------------- CATEGORIES ------------------------------- */
  const cats = await db
    .insert(categories)
    .values([
      { name: "Espresso Bar", icon: "Coffee", sortOrder: 1 },
      { name: "Manual Brew", icon: "Filter", sortOrder: 2 },
      { name: "Non-Coffee", icon: "CupSoda", sortOrder: 3 },
      { name: "Pastry & Bites", icon: "Croissant", sortOrder: 4 },
    ])
    .returning();
  const cat = (name: string) => cats.find((c) => c.name === name)!.id;

  /* -------------------------------- INGREDIENTS ------------------------------ */
  const ingDefs = [
    { key: "biji", name: "Biji Kopi House Blend", unit: "g", cost: 220, threshold: 600 },
    { key: "susu", name: "Susu Full Cream", unit: "ml", cost: 22, threshold: 2500 },
    { key: "oat", name: "Susu Oat", unit: "ml", cost: 48, threshold: 500 },
    { key: "gula", name: "Gula Aren Cair", unit: "ml", cost: 28, threshold: 700 },
    { key: "vanilla", name: "Sirup Vanila", unit: "ml", cost: 190, threshold: 200 },
    { key: "caramel", name: "Sirup Karamel", unit: "ml", cost: 190, threshold: 200 },
    { key: "matcha", name: "Bubuk Matcha Premium", unit: "g", cost: 780, threshold: 150 },
    { key: "cokelat", name: "Bubuk Cokelat Signature", unit: "g", cost: 260, threshold: 500 },
    { key: "es", name: "Es Batu Kristal", unit: "g", cost: 4, threshold: 3000 },
    { key: "cup12", name: "Cup Panas 8oz", unit: "pcs", cost: 850, threshold: 30 },
    { key: "cup16", name: "Cup Dingin 16oz", unit: "pcs", cost: 1000, threshold: 40 },
    { key: "tea", name: "Teh Earl Grey (tea bag)", unit: "pcs", cost: 1500, threshold: 10 },
    { key: "crois", name: "Butter Croissant (pcs)", unit: "pcs", cost: 11500, threshold: 8 },
    { key: "pain", name: "Pain au Chocolat (pcs)", unit: "pcs", cost: 14500, threshold: 6 },
    { key: "banana", name: "Banana Bread (slice)", unit: "pcs", cost: 9500, threshold: 8 },
  ] as const;
  const ingRows = await db
    .insert(ingredients)
    .values(
      ingDefs.map((d) => ({
        name: d.name,
        unit: d.unit as "g" | "ml" | "pcs",
        stockQty: 0, // diisi final di akhir seed
        lowThreshold: d.threshold,
        costPerUnit: d.cost,
      }))
    )
    .returning();
  const ingId = new Map<string, number>(ingRows.map((r, i) => [ingDefs[i].key as string, r.id]));
  const ingCost = new Map<string, number>(ingDefs.map((d) => [d.key as string, d.cost]));

  /* --------------------------------- MODIFIERS ------------------------------- */
  const modDefs = [
    { name: "Extra Shot Espresso", price: 6000, uses: [{ ing: "biji", qty: 18 }] },
    { name: "Ganti Susu Oat", price: 8000, uses: [{ ing: "oat", qty: 100 }] },
    { name: "Sirup Vanila", price: 5000, uses: [{ ing: "vanilla", qty: 10 }] },
    { name: "Sirup Karamel", price: 5000, uses: [{ ing: "caramel", qty: 10 }] },
    { name: "Extra Gula Aren", price: 3000, uses: [{ ing: "gula", qty: 10 }] },
  ] as const;
  const modRows = await db
    .insert(modifiers)
    .values(modDefs.map((m) => ({ name: m.name, price: m.price })))
    .returning();
  const modId = new Map<string, number>(modRows.map((m) => [m.name, m.id]));
  await db.insert(modifierIngredients).values(
    modDefs.flatMap((m) =>
      m.uses.map((u) => ({ modifierId: modId.get(m.name)!, ingredientId: ingId.get(u.ing)!, qty: u.qty }))
    )
  );

  /* --------------------------------- PRODUCTS -------------------------------- */
  type VKey = "Panas" | "Dingin";
  interface PDef {
    name: string; tagline: string; price: number; color: string; icon: string;
    cat: string; variants: { name: VKey; delta: number }[];
    base: { ing: string; qty: number }[];
    perVariant?: Partial<Record<VKey, { ing: string; qty: number }[]>>;
    weight: number; // bobot popularitas utk generator transaksi
  }
  const HOT_CUP = [{ ing: "cup12", qty: 1 }];
  const COLD_SET = (es: number) => [{ ing: "cup16", qty: 1 }, { ing: "es", qty: es }];

  const pDefs: PDef[] = [
    { name: "Espresso", tagline: "Double shot, bold & pekat", price: 18000, color: "#D97706", icon: "Coffee", cat: "Espresso Bar",
      variants: [{ name: "Panas", delta: 0 }], base: [{ ing: "biji", qty: 18 }], perVariant: { Panas: HOT_CUP }, weight: 6 },
    { name: "Americano", tagline: "Espresso + air, clean finish", price: 21000, color: "#B45309", icon: "Coffee", cat: "Espresso Bar",
      variants: [{ name: "Panas", delta: 0 }, { name: "Dingin", delta: 2000 }], base: [{ ing: "biji", qty: 18 }], weight: 10 },
    { name: "Kopi Susu Gula Aren", tagline: "Signature — susu segar & gula aren asli", price: 23000, color: "#F59E0B", icon: "Milk", cat: "Espresso Bar",
      variants: [{ name: "Dingin", delta: 0 }], base: [{ ing: "biji", qty: 18 }, { ing: "susu", qty: 90 }, { ing: "gula", qty: 15 }], weight: 30 },
    { name: "Caffe Latte", tagline: "Susu steamed lembut, double shot", price: 27000, color: "#FBBF24", icon: "Coffee", cat: "Espresso Bar",
      variants: [{ name: "Panas", delta: 0 }, { name: "Dingin", delta: 2000 }], base: [{ ing: "biji", qty: 18 }, { ing: "susu", qty: 150 }], weight: 12 },
    { name: "Cappuccino", tagline: "Foam tebal, taburan kakao", price: 26000, color: "#EAB308", icon: "Coffee", cat: "Espresso Bar",
      variants: [{ name: "Panas", delta: 0 }, { name: "Dingin", delta: 2000 }], base: [{ ing: "biji", qty: 18 }, { ing: "susu", qty: 130 }], weight: 6 },
    { name: "Vanilla Latte", tagline: "Latte dengan sirup vanila house-made", price: 29000, color: "#FDE68A", icon: "Coffee", cat: "Espresso Bar",
      variants: [{ name: "Panas", delta: 0 }, { name: "Dingin", delta: 2000 }], base: [{ ing: "biji", qty: 18 }, { ing: "susu", qty: 140 }, { ing: "vanilla", qty: 12 }], weight: 4 },
    { name: "Caramel Macchiato", tagline: "Layered susu, espresso & drizzle karamel", price: 31000, color: "#FB923C", icon: "Coffee", cat: "Espresso Bar",
      variants: [{ name: "Panas", delta: 0 }, { name: "Dingin", delta: 2000 }], base: [{ ing: "biji", qty: 18 }, { ing: "susu", qty: 140 }, { ing: "caramel", qty: 15 }], weight: 5 },
    { name: "Mocha", tagline: "Espresso bertemu cokelat pekat", price: 30000, color: "#92400E", icon: "Coffee", cat: "Espresso Bar",
      variants: [{ name: "Panas", delta: 0 }, { name: "Dingin", delta: 2000 }], base: [{ ing: "biji", qty: 18 }, { ing: "susu", qty: 140 }, { ing: "cokelat", qty: 20 }], weight: 5 },
    { name: "Butterscotch Sea Salt Latte", tagline: "Manis gurih, signature musiman", price: 33000, color: "#FDBA74", icon: "Sparkles", cat: "Espresso Bar",
      variants: [{ name: "Dingin", delta: 0 }], base: [{ ing: "biji", qty: 18 }, { ing: "susu", qty: 120 }, { ing: "caramel", qty: 20 }, { ing: "gula", qty: 5 }], weight: 5 },
    { name: "V60 Single Origin", tagline: "Biji gayo wine process, seduh manual", price: 30000, color: "#A16207", icon: "Filter", cat: "Manual Brew",
      variants: [{ name: "Panas", delta: 0 }], base: [{ ing: "biji", qty: 15 }], perVariant: { Panas: HOT_CUP }, weight: 4 },
    { name: "Japanese Iced Coffee", tagline: "Flash-brewed langsung ke es, aromatik", price: 32000, color: "#CA8A04", icon: "Filter", cat: "Manual Brew",
      variants: [{ name: "Dingin", delta: 0 }], base: [{ ing: "biji", qty: 15 }], weight: 3 },
    { name: "Vietnam Drip", tagline: "Drip pelan, manis legit klasik", price: 25000, color: "#854D0E", icon: "Filter", cat: "Manual Brew",
      variants: [{ name: "Panas", delta: 0 }, { name: "Dingin", delta: 1000 }], base: [{ ing: "biji", qty: 16 }, { ing: "gula", qty: 20 }], weight: 3 },
    { name: "Matcha Latte", tagline: "Matcha premium grade upacara", price: 30000, color: "#84CC16", icon: "Leaf", cat: "Non-Coffee",
      variants: [{ name: "Panas", delta: 0 }, { name: "Dingin", delta: 2000 }], base: [{ ing: "matcha", qty: 10 }, { ing: "susu", qty: 150 }, { ing: "gula", qty: 10 }], weight: 8 },
    { name: "Signature Chocolate", tagline: "Cokelat dark 64%, creamy", price: 27000, color: "#78350F", icon: "CupSoda", cat: "Non-Coffee",
      variants: [{ name: "Panas", delta: 0 }, { name: "Dingin", delta: 2000 }], base: [{ ing: "cokelat", qty: 25 }, { ing: "susu", qty: 150 }, { ing: "gula", qty: 10 }], weight: 6 },
    { name: "Earl Grey Tea", tagline: "Bergamot wanginya khas", price: 18000, color: "#A3A3A3", icon: "Leaf", cat: "Non-Coffee",
      variants: [{ name: "Panas", delta: 0 }, { name: "Dingin", delta: 1000 }], base: [{ ing: "tea", qty: 1 }], weight: 4 },
    { name: "Butter Croissant", tagline: "83 lapis, butter Prancis", price: 20000, color: "#FCD34D", icon: "Croissant", cat: "Pastry & Bites",
      variants: [], base: [{ ing: "crois", qty: 1 }], weight: 8 },
    { name: "Pain au Chocolat", tagline: "Croissant cokelat batang ganda", price: 24000, color: "#B45309", icon: "Croissant", cat: "Pastry & Bites",
      variants: [], base: [{ ing: "pain", qty: 1 }], weight: 7 },
    { name: "Banana Bread", tagline: "Pisang karamelisasi, moist", price: 18000, color: "#EAB308", icon: "CakeSlice", cat: "Pastry & Bites",
      variants: [], base: [{ ing: "banana", qty: 1 }], weight: 7 },
  ];

  const prodRows = await db
    .insert(products)
    .values(pDefs.map((p) => ({
      categoryId: cat(p.cat), name: p.name, tagline: p.tagline, price: p.price, color: p.color, icon: p.icon,
    })))
    .returning();
  const prodId = new Map(prodRows.map((r) => [r.name, r.id]));

  /* --------------------------------- VARIANTS -------------------------------- */
  const varRows = await db.insert(variants).values(
    pDefs.flatMap((p) => p.variants.map((v) => ({ productId: prodId.get(p.name)!, name: v.name, priceDelta: v.delta })))
  ).returning();
  const varId = new Map(varRows.map((v) => [`${v.productId}:${v.name}`, v.id]));

  /* ---------------------------------- RECIPES -------------------------------- */
  const recipeRows: { productId: number; variantId: number | null; ingredientId: number; qty: number }[] = [];
  for (const p of pDefs) {
    const pid = prodId.get(p.name)!;
    for (const b of p.base) recipeRows.push({ productId: pid, variantId: null, ingredientId: ingId.get(b.ing)!, qty: b.qty });
    for (const [vName, rows] of Object.entries(p.perVariant ?? {})) {
      const vid = varId.get(`${pid}:${vName}`)!;
      for (const r of rows) recipeRows.push({ productId: pid, variantId: vid, ingredientId: ingId.get(r.ing)!, qty: r.qty });
    }
    // Aturan cup default untuk minuman
    if (p.variants.length > 0 && p.cat !== "Pastry & Bites") {
      for (const v of p.variants) {
        const vid = varId.get(`${pid}:${v.name}`)!;
        const extras = p.perVariant?.[v.name];
        if (!extras) {
          for (const r of v.name === "Panas" ? HOT_CUP : COLD_SET(p.cat === "Manual Brew" ? 150 : 120)) {
            recipeRows.push({ productId: pid, variantId: vid, ingredientId: ingId.get(r.ing)!, qty: r.qty });
          }
        }
      }
    }
  }
  await db.insert(recipeItems).values(recipeRows);

  /* ------------------------- GENERATOR RIWAYAT ORDER ------------------------- */
  const rng = mulberry32(20260214);
  const drinkDefs = pDefs.filter((p) => p.variants.length > 0);
  const pastryDefs = pDefs.filter((p) => p.variants.length === 0);
  const totalWeight = drinkDefs.reduce((s2, p) => s2 + p.weight, 0);

  const pickDrink = (): PDef => {
    let roll = rng() * totalWeight;
    for (const p of drinkDefs) { roll -= p.weight; if (roll <= 0) return p; }
    return drinkDefs[0];
  };
  const pickPastry = (): PDef => pastryDefs[Math.floor(rng() * pastryDefs.length)];
  const pickMod = (): string => {
    const roll = rng();
    if (roll < 0.28) return "Ganti Susu Oat";
    if (roll < 0.52) return "Extra Shot Espresso";
    if (roll < 0.7) return "Sirup Vanila";
    if (roll < 0.86) return "Sirup Karamel";
    return "Extra Gula Aren";
  };
  const pickPayment = (): "cash" | "qris" | "debit" => {
    const roll = rng();
    return roll < 0.55 ? "cash" : roll < 0.88 ? "qris" : "debit";
  };

  // Peta HPP per unit (produk+varian+mod) dihitung langsung dari definisi di atas
  const lineCost = (p: PDef, vName: VKey | null, modsUsed: string[]): number => {
    let cost = 0;
    const addUses = (uses: readonly { ing: string; qty: number }[]) => {
      for (const u of uses) cost += u.qty * (ingCost.get(u.ing) ?? 0);
    };
    addUses(p.base);
    if (vName) {
      const extras = p.perVariant?.[vName];
      if (extras) addUses(extras);
      else addUses(vName === "Panas" ? HOT_CUP : COLD_SET(p.cat === "Manual Brew" ? 150 : 120));
    }
    for (const m of modsUsed) {
      const def = modDefs.find((d) => d.name === m)!;
      addUses(def.uses);
    }
    return Math.round(cost);
  };

  const orderBatch: (typeof orders.$inferInsert)[] = [];
  interface ItemDraft { seedKey: string; productId: number; productName: string; variantName: string | null; qty: number; unitPrice: number; totalPrice: number; hpp: number; mods: { name: string; price: number }[] }
  const itemDrafts: ItemDraft[] = [];
  let seqGlobal = 0;

  const pushOrder = (when: Date) => {
    const lines: { p: PDef; v: VKey | null; qty: number; mods: string[] }[] = [];
    const nLines = rng() < 0.72 ? 1 : rng() < 0.8 ? 2 : 3;
    for (let i = 0; i < nLines; i++) {
      const p = pickDrink();
      const v = p.variants.length === 1 ? p.variants[0].name : rng() < 0.35 ? "Panas" : "Dingin";
      const vDef = p.variants.find((x) => x.name === v) ?? p.variants[0];
      const modsUsed = rng() < 0.24 ? [pickMod()] : [];
      lines.push({ p, v: vDef.name, qty: rng() < 0.85 ? 1 : 2, mods: modsUsed });
    }
    if (rng() < 0.3) {
      const p = pickPastry();
      lines.push({ p, v: null, qty: 1, mods: [] });
    }

    seqGlobal += 1;
    const ymd = `${String(when.getFullYear()).slice(2)}${String(when.getMonth() + 1).padStart(2, "0")}${String(when.getDate()).padStart(2, "0")}`;
    const numPerDay = orderBatch.reduce((acc, o) => acc + (o.orderNumber?.startsWith(`BM-${ymd}`) ? 1 : 0), 0);
    const orderNumber = `BM-${ymd}-${String(numPerDay + 1).padStart(3, "0")}`;
    const key = `seed-${seqGlobal}`;

    let subtotal = 0; let hpp = 0; let itemCount = 0;
    for (const l of lines) {
      const vDef = l.p.variants.find((x) => x.name === l.v);
      const modPrice = l.mods.reduce((s2, m) => s2 + modDefs.find((d) => d.name === m)!.price, 0);
      const unit = l.p.price + (vDef?.delta ?? 0) + modPrice;
      const unitHpp = lineCost(l.p, l.v, l.mods);
      subtotal += unit * l.qty;
      hpp += unitHpp * l.qty;
      itemCount += l.qty;
      itemDrafts.push({
        seedKey: key, productId: prodId.get(l.p.name)!, productName: l.p.name, variantName: l.v,
        qty: l.qty, unitPrice: unit, totalPrice: unit * l.qty, hpp: unitHpp * l.qty,
        mods: l.mods.map((m) => ({ name: m, price: modDefs.find((d) => d.name === m)!.price })),
      });
    }
    const tendered = Math.ceil(subtotal / 10000) * 10000 + (rng() < 0.3 ? 10000 : 0);
    orderBatch.push({
      orderNumber, offlineId: key, cashierId: rng() < 0.6 ? sinta.id : bagas.id,
      cashierName: rng() < 0.6 ? sinta.name : bagas.name, status: "paid", paymentMethod: pickPayment(),
      subtotal, hpp, profit: subtotal - hpp, tendered, change: tendered - subtotal,
      itemCount, isOfflineSync: false, createdAt: when,
    });
  };

  // 30 hari ke belakang
  const now = new Date();
  for (let d = 29; d >= 0; d--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d, 0, 0, 0);
    const weekend = [0, 6].includes(day.getDay()) ? 1.34 : 1;
    const growth = 0.74 + ((29 - d) / 29) * 0.3; // tren bisnis bertumbuh
    const nOrders = d === 0 ? 9 : Math.round((24 + rng() * 8) * weekend * growth);
    for (let i = 0; i < nOrders; i++) {
      let when: Date;
      if (d === 0) {
        when = new Date(now.getTime() - (12 + rng() * 300) * 60000); // live: menit-menit terakhir
      } else {
        const roll = rng();
        const hour = roll < 0.38 ? 7 + rng() * 4 : roll < 0.68 ? 11 + rng() * 4 : 15 + rng() * 6;
        when = new Date(day.getTime() + hour * 3600000 + rng() * 3600000);
      }
      pushOrder(when);
    }
  }

  // Insert orders per chunk + ambil id berdasarkan offlineId (seed key)
  const insertedIds = new Map<string, number>();
  for (let i = 0; i < orderBatch.length; i += 400) {
    const chunk = orderBatch.slice(i, i + 400);
    const ret = await db.insert(orders).values(chunk).returning({ id: orders.id, offlineId: orders.offlineId });
    for (const r of ret) if (r.offlineId) insertedIds.set(r.offlineId, r.id);
  }
  const itemBatch: (typeof orderItems.$inferInsert)[] = itemDrafts.map((d) => ({
    orderId: insertedIds.get(d.seedKey)!, productId: d.productId, productName: d.productName,
    variantName: d.variantName, qty: d.qty, unitPrice: d.unitPrice, totalPrice: d.totalPrice,
    hpp: d.hpp, modifiers: d.mods,
  }));
  for (let i = 0; i < itemBatch.length; i += 600) {
    await db.insert(orderItems).values(itemBatch.slice(i, i + 600));
  }

  /* ------------------------------- CASH MOVEMENTS ----------------------------- */
  const cashSeed: (typeof cashMovements.$inferInsert)[] = [];
  const expenseNotes = [
    { note: "Belanja susu & dairy (supplier)", min: 180000, max: 260000 },
    { note: "Gas LPG 12kg bar", min: 145000, max: 160000 },
    { note: "Cup, lid & packaging", min: 280000, max: 380000 },
    { note: "Es batu kristal mingguan", min: 90000, max: 120000 },
    { note: "Tisu, sedotan & sabun cuci", min: 60000, max: 95000 },
  ];
  for (let d = 27; d >= 1; d -= 3) {
    const e = expenseNotes[(d / 3) % expenseNotes.length];
    cashSeed.push({
      type: "out", amount: Math.round(e.min + rng() * (e.max - e.min)), note: e.note,
      userName: rizky.name, createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - d, 9, 30),
    });
  }
  cashSeed.push({ type: "in", amount: 500000, note: "Modal laci kasir pagi", userName: ayu.name, createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 45) });
  cashSeed.push({ type: "out", amount: 115000, note: "Isi ulang galon & air mineral bar", userName: rizky.name, createdAt: new Date(now.getTime() - 95 * 60000) });
  await db.insert(cashMovements).values(cashSeed);

  /* --------------------- FINAL STOCK (disetel utk AI alert) ------------------- */
  const finalStock: Record<string, number> = {
    biji: 820, susu: 4300, oat: 540, gula: 760, vanilla: 235, caramel: 265,
    matcha: 640, cokelat: 2350, es: 9200, cup12: 84, cup16: 96, tea: 26,
    crois: 15, pain: 9, banana: 19,
  };
  for (const [key, qty] of Object.entries(finalStock)) {
    await db.execute(sql`UPDATE ingredients SET stock_qty = ${qty}, updated_at = now() WHERE id = ${ingId.get(key)}`);
  }
}
