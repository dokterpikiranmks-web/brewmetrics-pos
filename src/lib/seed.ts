import "server-only";
import { db } from "@/db";
import { storeSettings } from "@/db/schema";
import { sql } from "drizzle-orm";

let schemaPromise: Promise<void> | null = null;

export async function ensureShiftReportsTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shift_reports (
        id serial PRIMARY KEY,
        cashier_id integer REFERENCES users(id),
        cashier_name text NOT NULL DEFAULT '',
        opened_at timestamp with time zone NOT NULL DEFAULT now(),
        closed_at timestamp with time zone NOT NULL DEFAULT now(),
        expected_cash integer NOT NULL,
        actual_cash integer NOT NULL,
        variance integer NOT NULL,
        total_orders integer NOT NULL DEFAULT 0,
        cash_orders integer NOT NULL DEFAULT 0,
        qris_total integer NOT NULL DEFAULT 0,
        debit_total integer NOT NULL DEFAULT 0,
        note text NOT NULL DEFAULT '',
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );
    `);
  } catch (err) {
    console.error("ensureShiftReportsTable error:", err);
  }
}

export async function ensureProductsHppColumn() {
  try {
    await db.execute(sql`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS hpp integer NOT NULL DEFAULT 0;
    `);
  } catch (err) {
    console.error("ensureProductsHppColumn error:", err);
  }
}

export async function ensureStoreSettingsTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS store_settings (
        id serial PRIMARY KEY,
        cafe_name text NOT NULL DEFAULT 'BREWMETRICS Specialty Coffee',
        logo_url text NOT NULL DEFAULT '',
        address text NOT NULL DEFAULT 'Jl. Metro Tanjung Bunga No. 8, Makassar',
        phone text NOT NULL DEFAULT '0812-4455-6677',
        tax_percentage double precision NOT NULL DEFAULT 10,
        service_charge_percentage double precision NOT NULL DEFAULT 0,
        receipt_footer_message text NOT NULL DEFAULT 'Terima kasih atas kunjungan Anda!\nFollow IG: @brewmetrics.coffee',
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax integer NOT NULL DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_charge integer NOT NULL DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS total integer NOT NULL DEFAULT 0;
    `);

    const existing = await db.select({ id: storeSettings.id }).from(storeSettings).limit(1);
    if (existing.length === 0) {
      await db.insert(storeSettings).values({
        id: 1,
        cafeName: "BREWMETRICS Specialty Coffee",
        logoUrl: "",
        address: "Jl. Metro Tanjung Bunga No. 8, Makassar",
        phone: "0812-4455-6677",
        taxPercentage: 10,
        serviceChargePercentage: 0,
        receiptFooterMessage: "Terima kasih atas kunjungan Anda!\nFollow IG: @brewmetrics.coffee",
      });
    }
  } catch (err) {
    console.error("ensureStoreSettingsTable error:", err);
  }
}

export async function ensureOrdersSchema() {
  try {
    await db.execute(sql`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name text NOT NULL DEFAULT 'Umum';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'dine-in';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number text NOT NULL DEFAULT '';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_type text DEFAULT NULL;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_value integer NOT NULL DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount integer NOT NULL DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference text DEFAULT '';
    `);
  } catch (err) {
    console.error("ensureOrdersSchema error:", err);
  }
}

export async function ensureBatch2Schema() {
  try {
    await db.execute(sql`
      ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS printer_paper_size text NOT NULL DEFAULT '58mm';
      ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS auto_print_receipt boolean NOT NULL DEFAULT true;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bundle boolean NOT NULL DEFAULT false;

      CREATE TABLE IF NOT EXISTS bundle_items (
        id serial PRIMARY KEY,
        bundle_product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        sub_product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        qty integer NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS customers (
        id serial PRIMARY KEY,
        name text NOT NULL,
        phone text NOT NULL UNIQUE,
        total_orders integer NOT NULL DEFAULT 0,
        total_spend integer NOT NULL DEFAULT 0,
        last_visit_at timestamp with time zone NOT NULL DEFAULT now(),
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );

      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id integer REFERENCES customers(id);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone text DEFAULT '';
    `);
  } catch (err) {
    console.error("ensureBatch2Schema error:", err);
  }
}

/**
 * Idempotent schema verifier — hanya memastikan tabel & kolom yang dibutuhkan aplikasi sudah ada di Supabase.
 * Tidak memasukkan data tiruan / auto-seed sama sekali.
 */
export async function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await ensureShiftReportsTable();
      await ensureProductsHppColumn();
      await ensureStoreSettingsTable();
      await ensureOrdersSchema();
      await ensureBatch2Schema();
    })().catch((e) => {
      schemaPromise = null;
      throw e;
    });
  }
  return schemaPromise;
}

/**
 * Alias untuk kompatibilitas mundur dengan rute API yang memanggil ensureSeeded.
 * Dipastikan tidak menyisipkan data tiruan apapun.
 */
export async function ensureSeeded(_force = false): Promise<void> {
  return ensureSchema();
}

