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

export async function ensureDiscountsTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS discounts (
        id serial PRIMARY KEY,
        name text NOT NULL,
        type text NOT NULL,
        value integer NOT NULL,
        min_order integer NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      );
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_name text DEFAULT '';
    `);

    const existing = await db.execute(sql`SELECT count(*)::int AS cnt FROM discounts`);
    const count = (existing as unknown as { rows: { cnt: number }[] }).rows[0]?.cnt ?? 0;
    if (count === 0) {
      await db.execute(sql`
        INSERT INTO discounts (name, type, value, min_order, is_active) VALUES
        ('Diskon Member 10%', 'percentage', 10, 30000, true),
        ('Jumat Berkah Rp 5.000', 'fixed', 5000, 25000, true),
        ('Promo Ngopi Hemat 15%', 'percentage', 15, 60000, true),
        ('Voucher Karyawan Rp 10.000', 'fixed', 10000, 50000, true);
      `);
    }
  } catch (err) {
    console.error("ensureDiscountsTable error:", err);
  }
}

export async function ensureOutletsAndMultiBranchSchema() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS outlets (
        id serial PRIMARY KEY,
        name text NOT NULL,
        code text NOT NULL UNIQUE,
        address text NOT NULL DEFAULT '',
        phone text NOT NULL DEFAULT '',
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS outlet_id integer REFERENCES outlets(id);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS outlet_id integer REFERENCES outlets(id);
      ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS outlet_id integer REFERENCES outlets(id);
      ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS outlet_id integer REFERENCES outlets(id);
    `);

    // Seed default outlets if none exist
    const existing = await db.execute(sql`SELECT count(*)::int AS cnt FROM outlets`);
    const count = (existing as unknown as { rows: { cnt: number }[] }).rows[0]?.cnt ?? 0;
    if (count === 0) {
      await db.execute(sql`
        INSERT INTO outlets (name, code, address, phone, is_active) VALUES
        ('Cabang Pusat (HQ)', 'HQ', 'Jl. Metro Tanjung Bunga No. 8, Makassar', '0812-4455-6677', true),
        ('Cabang Pettarani', 'CBG-PTR', 'Jl. A.P. Pettarani No. 24, Makassar', '0812-9988-7766', true);
      `);
    }

    // Assign default outlet_id = 1 to existing users, orders, shifts that have null outlet_id
    await db.execute(sql`
      UPDATE users SET outlet_id = 1 WHERE outlet_id IS NULL AND role = 'cashier';
      UPDATE orders SET outlet_id = 1 WHERE outlet_id IS NULL;
      UPDATE shift_reports SET outlet_id = 1 WHERE outlet_id IS NULL;
      UPDATE cash_movements SET outlet_id = 1 WHERE outlet_id IS NULL;
    `);
  } catch (err) {
    console.error("ensureOutletsAndMultiBranchSchema error:", err);
  }
}

export async function ensureAttendancesTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS attendances (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        outlet_id integer REFERENCES outlets(id),
        type text NOT NULL,
        photo_url text NOT NULL,
        note text DEFAULT '',
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS attendances_user_idx ON attendances(user_id);
      CREATE INDEX IF NOT EXISTS attendances_outlet_idx ON attendances(outlet_id);
      CREATE INDEX IF NOT EXISTS attendances_created_idx ON attendances(created_at);
    `);
  } catch (err) {
    console.error("ensureAttendancesTable error:", err);
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
      await ensureDiscountsTable();
      await ensureOutletsAndMultiBranchSchema();
      await ensureAttendancesTable();
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

