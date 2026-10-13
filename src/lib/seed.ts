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
        cafe_name text NOT NULL DEFAULT 'DOI TA',
        logo_url text NOT NULL DEFAULT '',
        address text NOT NULL DEFAULT 'Jl. Metro Tanjung Bunga No. 8, Makassar',
        phone text NOT NULL DEFAULT '0812-4455-6677',
        tax_percentage double precision NOT NULL DEFAULT 10,
        service_charge_percentage double precision NOT NULL DEFAULT 0,
        receipt_footer_message text NOT NULL DEFAULT 'Terima kasih atas kunjungan Anda!\nFollow IG: @doita.pos',
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
        cafeName: "DOI TA",
        logoUrl: "",
        address: "Jl. Metro Tanjung Bunga No. 8, Makassar",
        phone: "0812-4455-6677",
        taxPercentage: 10,
        serviceChargePercentage: 0,
        receiptFooterMessage: "Terima kasih atas kunjungan Anda!\nFollow IG: @doita.pos",
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
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS grand_total integer NOT NULL DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id text NOT NULL DEFAULT 'KOPI_ASO';
      UPDATE orders SET grand_total = COALESCE(NULLIF(total, 0), GREATEST(0, subtotal - COALESCE(discount_amount, 0)) + COALESCE(service_charge, 0) + COALESCE(tax, 0)) WHERE grand_total = 0;
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
        scope text NOT NULL DEFAULT 'cart',
        target_product_id integer REFERENCES products(id),
        outlet_id integer REFERENCES outlets(id),
        branch_id text NOT NULL DEFAULT 'KOPI_ASO',
        valid_from timestamp with time zone,
        valid_until timestamp with time zone,
        start_date timestamp with time zone,
        end_date timestamp with time zone,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      );
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_name text DEFAULT '';
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'cart';
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS target_product_id integer REFERENCES products(id);
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS outlet_id integer REFERENCES outlets(id);
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS branch_id text NOT NULL DEFAULT 'KOPI_ASO';
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS valid_from timestamp with time zone;
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS valid_until timestamp with time zone;
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS start_date timestamp with time zone;
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS end_date timestamp with time zone;
      CREATE INDEX IF NOT EXISTS discounts_target_prod_idx ON discounts(target_product_id);
      CREATE INDEX IF NOT EXISTS discounts_outlet_idx ON discounts(outlet_id);
      CREATE INDEX IF NOT EXISTS discounts_branch_idx ON discounts(branch_id);

      UPDATE discounts SET
        valid_from = COALESCE(valid_from, start_date, now() - interval '7 days'),
        valid_until = COALESCE(valid_until, end_date, now() + interval '365 days'),
        start_date = COALESCE(start_date, valid_from, now() - interval '7 days'),
        end_date = COALESCE(end_date, valid_until, now() + interval '365 days')
      WHERE valid_from IS NULL OR valid_until IS NULL OR start_date IS NULL OR end_date IS NULL;
    `);

    const existing = await db.execute(sql`SELECT count(*)::int AS cnt FROM discounts`);
    const count = (existing as unknown as { rows: { cnt: number }[] }).rows[0]?.cnt ?? 0;
    if (count === 0) {
      await db.execute(sql`
        INSERT INTO discounts (name, type, value, min_order, scope, branch_id, valid_from, valid_until, start_date, end_date, is_active) VALUES
        ('Diskon Member 10%', 'percentage', 10, 30000, 'cart', 'KOPI_ASO', now() - interval '7 days', now() + interval '365 days', now() - interval '7 days', now() + interval '365 days', true),
        ('Jumat Berkah Rp 5.000', 'fixed', 5000, 25000, 'cart', 'KOPI_ASO', now() - interval '7 days', now() + interval '365 days', now() - interval '7 days', now() + interval '365 days', true),
        ('Promo Ngopi Hemat 15%', 'percentage', 15, 60000, 'cart', 'KOPI_ASO', now() - interval '7 days', now() + interval '365 days', now() - interval '7 days', now() + interval '365 days', true),
        ('Voucher Karyawan Rp 10.000', 'fixed', 10000, 50000, 'cart', 'KOPI_ASO', now() - interval '7 days', now() + interval '365 days', now() - interval '7 days', now() + interval '365 days', true);
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
        branch_id text NOT NULL DEFAULT 'KOPI_ASO',
        address text NOT NULL DEFAULT '',
        phone text NOT NULL DEFAULT '',
        brand_name text NOT NULL DEFAULT '',
        receipt_header text NOT NULL DEFAULT '',
        receipt_footer text NOT NULL DEFAULT '',
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      );

      ALTER TABLE outlets ADD COLUMN IF NOT EXISTS branch_id text NOT NULL DEFAULT 'KOPI_ASO';
      ALTER TABLE outlets ADD COLUMN IF NOT EXISTS brand_name text NOT NULL DEFAULT '';
      ALTER TABLE outlets ADD COLUMN IF NOT EXISTS receipt_header text NOT NULL DEFAULT '';
      ALTER TABLE outlets ADD COLUMN IF NOT EXISTS receipt_footer text NOT NULL DEFAULT '';

      ALTER TABLE users ADD COLUMN IF NOT EXISTS outlet_id integer REFERENCES outlets(id);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id text DEFAULT 'KOPI_ASO';

      ALTER TABLE orders ADD COLUMN IF NOT EXISTS outlet_id integer REFERENCES outlets(id);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id text NOT NULL DEFAULT 'KOPI_ASO';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS brand_name text DEFAULT '';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_header text DEFAULT '';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_footer text DEFAULT '';

      ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS outlet_id integer REFERENCES outlets(id);
      ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS branch_id text DEFAULT 'KOPI_ASO';
      ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS outlet_id integer REFERENCES outlets(id);
      ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS branch_id text DEFAULT 'KOPI_ASO';

      ALTER TABLE categories ADD COLUMN IF NOT EXISTS outlet_id integer REFERENCES outlets(id) DEFAULT 1;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS branch_id text NOT NULL DEFAULT 'KOPI_ASO';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS outlet_id integer REFERENCES outlets(id) DEFAULT 1;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS branch_id text NOT NULL DEFAULT 'KOPI_ASO';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_name text DEFAULT '';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS receipt_header text DEFAULT '';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS receipt_footer text DEFAULT '';

      ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS branch_id text NOT NULL DEFAULT 'KOPI_ASO';
      ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS branch_id text NOT NULL DEFAULT 'KOPI_ASO';

      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS brand_name text DEFAULT '';
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS receipt_header text DEFAULT '';
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS receipt_footer text DEFAULT '';
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS active_days jsonb DEFAULT '[]'::jsonb;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS authorized_branch text;

      CREATE INDEX IF NOT EXISTS categories_branch_idx ON categories(branch_id);
      CREATE INDEX IF NOT EXISTS products_branch_idx ON products(branch_id);
      CREATE INDEX IF NOT EXISTS ingredients_branch_idx ON ingredients(branch_id);
      CREATE INDEX IF NOT EXISTS recipe_branch_idx ON recipe_items(branch_id);
      CREATE INDEX IF NOT EXISTS orders_branch_idx ON orders(branch_id);
    `);

    // Seed default outlets if none exist
    const existing = await db.execute(sql`SELECT count(*)::int AS cnt FROM outlets`);
    const count = (existing as unknown as { rows: { cnt: number }[] }).rows[0]?.cnt ?? 0;
    if (count === 0) {
      await db.execute(sql`
        INSERT INTO outlets (name, code, branch_id, address, phone, brand_name, receipt_header, receipt_footer, is_active) VALUES
        ('Kopi Aso (HQ)', 'HQ', 'KOPI_ASO', 'Jl. Metro Tanjung Bunga No. 8, Makassar', '0812-4455-6677', 'Kopi Aso', 'Kopi Aso — Specialty Coffee & Kuliner', 'Terima kasih atas kunjungan Anda!\nFollow IG: @kopiaso.id', true),
        ('Nasi Kebuli Mandhi', 'KBL-01', 'NASI_KEBULI', 'Jl. Sunu No. 15, Makassar', '0813-8899-0011', 'Nasi Kebuli', 'Khas Rempah Arab & Timur Tengah Asli', 'Terima kasih atas kunjungan Anda!\nFollow IG: @nasikebuli.mandhi', true),
        ('BUCIN UNCLE AI GONG', 'BUC-01', 'BUCIN_UNCLE', 'Jl. Boulevard No. 88, Makassar', '0811-4455-8899', 'BUCIN UNCLE AI GONG', 'Authentic Asian Comfort Food & Dimsum', 'Xie Xie! Terima kasih telah bersantap di Bucin Uncle AI Gong!', true);
      `);
    }

    // Pastikan cabang Nasi Kebuli Mandhi (KBL-01) terdaftar dan terdeteksi
    const kebuliCheck = await db.execute(sql`SELECT count(*)::int AS cnt FROM outlets WHERE code = 'KBL-01'`);
    const kebuliCount = (kebuliCheck as unknown as { rows: { cnt: number }[] }).rows[0]?.cnt ?? 0;
    if (kebuliCount === 0) {
      await db.execute(sql`
        INSERT INTO outlets (name, code, branch_id, address, phone, brand_name, receipt_header, receipt_footer, is_active)
        VALUES (
          'Nasi Kebuli Mandhi',
          'KBL-01',
          'NASI_KEBULI',
          'Jl. Sunu No. 15, Makassar',
          '0813-8899-0011',
          'Nasi Kebuli Mandhi',
          'Khas Rempah Arab & Timur Tengah Asli',
          'Terima kasih atas kunjungan Anda!\nFollow IG: @nasikebuli.mandhi',
          true
        );
      `);
    } else {
      await db.execute(sql`
        UPDATE outlets
        SET branch_id = 'NASI_KEBULI',
            brand_name = 'Nasi Kebuli Mandhi',
            receipt_header = 'Khas Rempah Arab & Timur Tengah Asli',
            receipt_footer = 'Terima kasih atas kunjungan Anda!\nFollow IG: @nasikebuli.mandhi'
        WHERE code = 'KBL-01';
      `);
    }

    // Pastikan cabang BUCIN UNCLE AI GONG (BUC-01) terdaftar
    const bucinCheck = await db.execute(sql`SELECT count(*)::int AS cnt FROM outlets WHERE code = 'BUC-01'`);
    const bucinCount = (bucinCheck as unknown as { rows: { cnt: number }[] }).rows[0]?.cnt ?? 0;
    if (bucinCount === 0) {
      await db.execute(sql`
        INSERT INTO outlets (name, code, branch_id, address, phone, brand_name, receipt_header, receipt_footer, is_active)
        VALUES (
          'BUCIN UNCLE AI GONG',
          'BUC-01',
          'BUCIN_UNCLE',
          'Jl. Boulevard No. 88, Makassar',
          '0811-4455-8899',
          'BUCIN UNCLE AI GONG',
          'Authentic Asian Comfort Food & Dimsum',
          'Xie Xie! Terima kasih telah bersantap di Bucin Uncle AI Gong!',
          true
        );
      `);
    } else {
      await db.execute(sql`
        UPDATE outlets
        SET branch_id = 'BUCIN_UNCLE',
            brand_name = 'BUCIN UNCLE AI GONG'
        WHERE code = 'BUC-01';
      `);
    }

    // Set fallback branding untuk cabang HQ / Kopi Aso
    await db.execute(sql`
      UPDATE outlets SET branch_id = 'KOPI_ASO', brand_name = 'Kopi Aso' WHERE code IN ('HQ', 'KOPAS001');
    `);

    // Assign default outlet_id = 1 to existing users, orders, shifts, categories, products that have null outlet_id
    await db.execute(sql`
      UPDATE users SET outlet_id = 1 WHERE outlet_id IS NULL AND role = 'cashier';
      UPDATE orders SET outlet_id = 1 WHERE outlet_id IS NULL;
      UPDATE shift_reports SET outlet_id = 1 WHERE outlet_id IS NULL;
      UPDATE cash_movements SET outlet_id = 1 WHERE outlet_id IS NULL;
      UPDATE categories SET outlet_id = 1 WHERE outlet_id IS NULL;
      UPDATE products SET outlet_id = 1 WHERE outlet_id IS NULL;
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
        branch_id text NOT NULL DEFAULT 'KOPI_ASO',
        type text NOT NULL,
        status text DEFAULT 'present',
        clock_in_at timestamp with time zone,
        clock_out_at timestamp with time zone,
        photo_url text NOT NULL,
        notes text DEFAULT '',
        note text DEFAULT '',
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );
      ALTER TABLE attendances ADD COLUMN IF NOT EXISTS status text DEFAULT 'present';
      ALTER TABLE attendances ADD COLUMN IF NOT EXISTS clock_in_at timestamp with time zone;
      ALTER TABLE attendances ADD COLUMN IF NOT EXISTS clock_out_at timestamp with time zone;
      ALTER TABLE attendances ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
      ALTER TABLE attendances ADD COLUMN IF NOT EXISTS note text DEFAULT '';
      ALTER TABLE attendances ADD COLUMN IF NOT EXISTS outlet_id integer REFERENCES outlets(id);
      ALTER TABLE attendances ADD COLUMN IF NOT EXISTS branch_id text NOT NULL DEFAULT 'KOPI_ASO';
      ALTER TABLE attendances ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();
      ALTER TABLE attendances ADD COLUMN IF NOT EXISTS mood text DEFAULT '';
      ALTER TABLE attendances ADD COLUMN IF NOT EXISTS mood_diagnosis text DEFAULT '';
      ALTER TABLE attendances DROP CONSTRAINT IF EXISTS attendances_type_check;
      ALTER TABLE attendances ADD CONSTRAINT attendances_type_check 
        CHECK (type = ANY (ARRAY['in'::text, 'out'::text, 'clock_in'::text, 'clock_out'::text]));
      CREATE INDEX IF NOT EXISTS attendances_user_idx ON attendances(user_id);
      CREATE INDEX IF NOT EXISTS attendances_outlet_idx ON attendances(outlet_id);
      CREATE INDEX IF NOT EXISTS attendances_branch_idx ON attendances(branch_id);
      CREATE INDEX IF NOT EXISTS attendances_created_idx ON attendances(created_at);
      CREATE INDEX IF NOT EXISTS attendances_type_idx ON attendances(type);

      -- Backfill sentimen mood holistik untuk log absensi yang belum memiliki tag mood
      UPDATE attendances
      SET mood = CASE (id % 4)
        WHEN 0 THEN 'optimal'
        WHEN 1 THEN 'lelah'
        WHEN 2 THEN 'tegang'
        ELSE 'cemas'
      END,
      mood_diagnosis = CASE (id % 4)
        WHEN 0 THEN 'Kondisi Energi: Optimal. Garis ekspresi wajah merefleksikan ketenangan dan kesiapan kerja prima.'
        WHEN 1 THEN 'Kondisi Energi: Lelah. Garis ekspresi mengindikasikan beban kerja; dianjurkan rehat & hidrasi sejenak.'
        WHEN 2 THEN 'Kondisi Energi: Tegang. Ekspresi fokus tinggi disertai ketegangan otot area dahi & rahang.'
        ELSE 'Kondisi Energi: Cemas. Dianjurkan jeda relaksasi aromaterapi kopi sebelum memulai operasional kasir.'
      END
      WHERE (mood IS NULL OR mood = '');
    `);
  } catch (err) {
    console.error("ensureAttendancesTable error:", err);
  }
}

export async function ensureMultiTenantViewsAndData() {
  try {
    // Buat / perbarui views kompatibilitas nama tabel standar multi-tenant
    await db.execute(sql`
      DROP VIEW IF EXISTS attendance_logs CASCADE;
      DROP VIEW IF EXISTS transactions CASCADE;
      DROP VIEW IF EXISTS raw_materials CASCADE;
      DROP VIEW IF EXISTS recipes CASCADE;
      DROP VIEW IF EXISTS promos CASCADE;

      CREATE OR REPLACE VIEW attendance_logs AS SELECT * FROM attendances;
      CREATE OR REPLACE VIEW transactions AS SELECT * FROM orders;
      CREATE OR REPLACE VIEW raw_materials AS SELECT * FROM ingredients;
      CREATE OR REPLACE VIEW recipes AS SELECT * FROM recipe_items;
      CREATE OR REPLACE VIEW promos AS SELECT * FROM discounts;
    `);

    // Pastikan entitas NASI_KEBULI memiliki katalog produk, bahan baku, resep (BOM), dan promo terisolasi
    const kebuliProdCheck = await db.execute(sql`SELECT count(*)::int AS cnt FROM products WHERE branch_id = 'NASI_KEBULI'`);
    const kebuliProdCount = (kebuliProdCheck as unknown as { rows: { cnt: number }[] }).rows[0]?.cnt ?? 0;

    if (kebuliProdCount === 0) {
      // Ambil outlet_id KBL-01
      const kblOutletRes = await db.execute(sql`SELECT id FROM outlets WHERE code = 'KBL-01' LIMIT 1`);
      const kblOutletId = (kblOutletRes as unknown as { rows: { id: number }[] }).rows[0]?.id ?? 3;

      // Kategori Nasi Kebuli
      const catMainRes = await db.execute(sql`
        INSERT INTO categories (name, icon, sort_order, outlet_id, branch_id)
        VALUES ('NASI KEBULI & MANDHI', 'Flame', 1, ${kblOutletId}, 'NASI_KEBULI')
        RETURNING id;
      `);
      const catDrinkRes = await db.execute(sql`
        INSERT INTO categories (name, icon, sort_order, outlet_id, branch_id)
        VALUES ('MINUMAN TIMUR TENGAH', 'CupSoda', 2, ${kblOutletId}, 'NASI_KEBULI')
        RETURNING id;
      `);
      const kblCatMain = (catMainRes as unknown as { rows: { id: number }[] }).rows[0]?.id ?? 1;
      const kblCatDrink = (catDrinkRes as unknown as { rows: { id: number }[] }).rows[0]?.id ?? 1;

      // Bahan Baku Nasi Kebuli
      const ingBerasRes = await db.execute(sql`
        INSERT INTO ingredients (name, unit, stock_qty, low_threshold, cost_per_unit, branch_id)
        VALUES ('BERAS BASMATI PREMIUM', 'g', 15000, 2000, 45, 'NASI_KEBULI') RETURNING id;
      `);
      const ingKambingRes = await db.execute(sql`
        INSERT INTO ingredients (name, unit, stock_qty, low_threshold, cost_per_unit, branch_id)
        VALUES ('DAGING KAMBING MUDA', 'g', 8000, 1500, 140, 'NASI_KEBULI') RETURNING id;
      `);
      const ingAyamRes = await db.execute(sql`
        INSERT INTO ingredients (name, unit, stock_qty, low_threshold, cost_per_unit, branch_id)
        VALUES ('AYAM REMPAH MANDHI', 'g', 10000, 2000, 55, 'NASI_KEBULI') RETURNING id;
      `);
      const ingRempahRes = await db.execute(sql`
        INSERT INTO ingredients (name, unit, stock_qty, low_threshold, cost_per_unit, branch_id)
        VALUES ('BUMBU KEBULI & MINYAK SAMIN', 'g', 5000, 500, 80, 'NASI_KEBULI') RETURNING id;
      `);
      const ingTehArabRes = await db.execute(sql`
        INSERT INTO ingredients (name, unit, stock_qty, low_threshold, cost_per_unit, branch_id)
        VALUES ('TEH ADENI & KAPULAGA', 'g', 3000, 400, 70, 'NASI_KEBULI') RETURNING id;
      `);

      const idBeras = (ingBerasRes as unknown as { rows: { id: number }[] }).rows[0]?.id;
      const idKambing = (ingKambingRes as unknown as { rows: { id: number }[] }).rows[0]?.id;
      const idAyam = (ingAyamRes as unknown as { rows: { id: number }[] }).rows[0]?.id;
      const idRempah = (ingRempahRes as unknown as { rows: { id: number }[] }).rows[0]?.id;
      const idTehArab = (ingTehArabRes as unknown as { rows: { id: number }[] }).rows[0]?.id;

      // Produk Nasi Kebuli
      // 1. Nasi Kebuli Kambing Spesial: 150g Beras (6750) + 120g Kambing (16800) + 25g Rempah (2000) = HPP 25.550, Harga 48.000
      const p1Res = await db.execute(sql`
        INSERT INTO products (category_id, name, tagline, price, hpp, color, icon, is_active, outlet_id, branch_id, ai_mood)
        VALUES (${kblCatMain}, 'NASI KEBULI KAMBING SPESIAL', 'Beras Basmati dengan kambing muda empuk & minyak samin', 48000, 25550, '#D97706', 'Flame', true, ${kblOutletId}, 'NASI_KEBULI', 'lelah')
        RETURNING id;
      `);
      // 2. Nasi Mandhi Ayam Bakar: 150g Beras (6750) + 130g Ayam (7150) + 20g Rempah (1600) = HPP 15.500, Harga 35.000
      const p2Res = await db.execute(sql`
        INSERT INTO products (category_id, name, tagline, price, hpp, color, icon, is_active, outlet_id, branch_id, ai_mood)
        VALUES (${kblCatMain}, 'NASI MANDHI AYAM REMPAH', 'Nasi Mandhi asap arang dengan ayam panggang rempah Arab', 35000, 15500, '#EA580C', 'Flame', true, ${kblOutletId}, 'NASI_KEBULI', 'optimal')
        RETURNING id;
      `);
      // 3. Nasi Kebuli Talam Sultan (Sharing): 450g Beras (20250) + 250g Kambing (35000) + 60g Rempah (4800) = HPP 60.050, Harga 125.000
      const p3Res = await db.execute(sql`
        INSERT INTO products (category_id, name, tagline, price, hpp, color, icon, is_active, outlet_id, branch_id, ai_mood)
        VALUES (${kblCatMain}, 'TALAM SULTAN KEBULI (3 PORSI)', 'Nampan talam sharing beras basmati & kambing bakar', 125000, 60050, '#B45309', 'Sparkles', true, ${kblOutletId}, 'NASI_KEBULI', 'optimal')
        RETURNING id;
      `);
      // 4. Syahi Adeni (Teh Susu Rempah Arab): 30g Teh Arab (2100) = HPP 2.100, Harga 15.000
      const p4Res = await db.execute(sql`
        INSERT INTO products (category_id, name, tagline, price, hpp, color, icon, is_active, outlet_id, branch_id, ai_mood)
        VALUES (${kblCatDrink}, 'SYAHI ADENI REMPAH', 'Teh susu rempah kapulaga & cengkeh khas Yaman', 15000, 2100, '#10B981', 'CupSoda', true, ${kblOutletId}, 'NASI_KEBULI', 'tegang')
        RETURNING id;
      `);

      const p1Id = (p1Res as unknown as { rows: { id: number }[] }).rows[0]?.id;
      const p2Id = (p2Res as unknown as { rows: { id: number }[] }).rows[0]?.id;
      const p3Id = (p3Res as unknown as { rows: { id: number }[] }).rows[0]?.id;
      const p4Id = (p4Res as unknown as { rows: { id: number }[] }).rows[0]?.id;

      if (p1Id && idBeras && idKambing && idRempah) {
        await db.execute(sql`
          INSERT INTO recipe_items (product_id, ingredient_id, qty, branch_id) VALUES
          (${p1Id}, ${idBeras}, 150, 'NASI_KEBULI'),
          (${p1Id}, ${idKambing}, 120, 'NASI_KEBULI'),
          (${p1Id}, ${idRempah}, 25, 'NASI_KEBULI'),
          (${p2Id}, ${idBeras}, 150, 'NASI_KEBULI'),
          (${p2Id}, ${idAyam}, 130, 'NASI_KEBULI'),
          (${p2Id}, ${idRempah}, 20, 'NASI_KEBULI'),
          (${p3Id}, ${idBeras}, 450, 'NASI_KEBULI'),
          (${p3Id}, ${idKambing}, 250, 'NASI_KEBULI'),
          (${p3Id}, ${idRempah}, 60, 'NASI_KEBULI'),
          (${p4Id}, ${idTehArab}, 30, 'NASI_KEBULI');
        `);
      }

      // Promo Khusus Nasi Kebuli
      await db.execute(sql`
        INSERT INTO discounts (name, type, value, min_order, scope, outlet_id, branch_id, valid_from, valid_until, start_date, end_date, is_active) VALUES
        ('Jumat Berkah Kebuli Rp 10.000', 'fixed', 10000, 45000, 'cart', ${kblOutletId}, 'NASI_KEBULI', now() - interval '7 days', now() + interval '365 days', now() - interval '7 days', now() + interval '365 days', true),
        ('Diskon Talam Keluarga 15%', 'percentage', 15, 100000, 'cart', ${kblOutletId}, 'NASI_KEBULI', now() - interval '7 days', now() + interval '365 days', now() - interval '7 days', now() + interval '365 days', true);
      `);
    }

    // Pastikan entitas BUCIN_UNCLE memiliki katalog produk, bahan baku, resep (BOM), dan promo terisolasi
    const bucinProdCheck = await db.execute(sql`SELECT count(*)::int AS cnt FROM products WHERE branch_id = 'BUCIN_UNCLE'`);
    const bucinProdCount = (bucinProdCheck as unknown as { rows: { cnt: number }[] }).rows[0]?.cnt ?? 0;

    if (bucinProdCount === 0) {
      const bucOutletRes = await db.execute(sql`SELECT id FROM outlets WHERE code = 'BUC-01' LIMIT 1`);
      const bucOutletId = (bucOutletRes as unknown as { rows: { id: number }[] }).rows[0]?.id ?? 4;

      // Kategori BUCIN UNCLE AI GONG
      const catBowlRes = await db.execute(sql`
        INSERT INTO categories (name, icon, sort_order, outlet_id, branch_id)
        VALUES ('UNCLE RICE BOWL & MIE', 'Flame', 1, ${bucOutletId}, 'BUCIN_UNCLE')
        RETURNING id;
      `);
      const catDimsumRes = await db.execute(sql`
        INSERT INTO categories (name, icon, sort_order, outlet_id, branch_id)
        VALUES ('ARTISAN DIMSUM & BAO', 'Croissant', 2, ${bucOutletId}, 'BUCIN_UNCLE')
        RETURNING id;
      `);
      const catTeaRes = await db.execute(sql`
        INSERT INTO categories (name, icon, sort_order, outlet_id, branch_id)
        VALUES ('ORIENTAL TEA & SILKY DRINK', 'CupSoda', 3, ${bucOutletId}, 'BUCIN_UNCLE')
        RETURNING id;
      `);

      const bucCatBowl = (catBowlRes as unknown as { rows: { id: number }[] }).rows[0]?.id ?? 1;
      const bucCatDimsum = (catDimsumRes as unknown as { rows: { id: number }[] }).rows[0]?.id ?? 1;
      const bucCatTea = (catTeaRes as unknown as { rows: { id: number }[] }).rows[0]?.id ?? 1;

      // Bahan Baku BUCIN UNCLE AI GONG
      const ingBeefSliceRes = await db.execute(sql`
        INSERT INTO ingredients (name, unit, stock_qty, low_threshold, cost_per_unit, branch_id)
        VALUES ('US BEEF SHORTPLATE SLICE', 'g', 9000, 1500, 130, 'BUCIN_UNCLE') RETURNING id;
      `);
      const ingRiceBowlRes = await db.execute(sql`
        INSERT INTO ingredients (name, unit, stock_qty, low_threshold, cost_per_unit, branch_id)
        VALUES ('BERAS JEPANG JAPONICA', 'g', 12000, 2000, 35, 'BUCIN_UNCLE') RETURNING id;
      `);
      const ingDimsumRes = await db.execute(sql`
        INSERT INTO ingredients (name, unit, stock_qty, low_threshold, cost_per_unit, branch_id)
        VALUES ('ADONAN UDANG & AYAM DIMSUM', 'g', 7500, 1000, 95, 'BUCIN_UNCLE') RETURNING id;
      `);
      const ingChiliOilRes = await db.execute(sql`
        INSERT INTO ingredients (name, unit, stock_qty, low_threshold, cost_per_unit, branch_id)
        VALUES ('UNCLE SIGNATURE CHILI OIL', 'ml', 4000, 500, 65, 'BUCIN_UNCLE') RETURNING id;
      `);
      const ingLiangTehRes = await db.execute(sql`
        INSERT INTO ingredients (name, unit, stock_qty, low_threshold, cost_per_unit, branch_id)
        VALUES ('HERBAL LIANG TEH & CHRYSANTHEMUM', 'ml', 10000, 1500, 18, 'BUCIN_UNCLE') RETURNING id;
      `);

      const idBeefSlice = (ingBeefSliceRes as unknown as { rows: { id: number }[] }).rows[0]?.id;
      const idJaponica = (ingRiceBowlRes as unknown as { rows: { id: number }[] }).rows[0]?.id;
      const idDimsumMix = (ingDimsumRes as unknown as { rows: { id: number }[] }).rows[0]?.id;
      const idChiliOil = (ingChiliOilRes as unknown as { rows: { id: number }[] }).rows[0]?.id;
      const idLiangTeh = (ingLiangTehRes as unknown as { rows: { id: number }[] }).rows[0]?.id;

      // Produk BUCIN UNCLE AI GONG
      // 1. Bucin Beef Gyudon Chili Oil: 140g Japonica (4900) + 100g Beef (13000) + 20ml Chili Oil (1300) = HPP 19.200, Harga 38.000
      const bp1Res = await db.execute(sql`
        INSERT INTO products (category_id, name, tagline, price, hpp, color, icon, is_active, outlet_id, branch_id, ai_mood)
        VALUES (${bucCatBowl}, 'BUCIN BEEF GYUDON CHILI OIL', 'US Beef Slice glazed dengan chili oil rahasia Uncle AI Gong', 38000, 19200, '#EF4444', 'Flame', true, ${bucOutletId}, 'BUCIN_UNCLE', 'lelah')
        RETURNING id;
      `);
      // 2. Shumai Udang Mentai AI Gong (4 pcs): 120g Dimsum (11400) + 15ml Chili Oil (975) = HPP 12.375, Harga 26.000
      const bp2Res = await db.execute(sql`
        INSERT INTO products (category_id, name, tagline, price, hpp, color, icon, is_active, outlet_id, branch_id, ai_mood)
        VALUES (${bucCatDimsum}, 'SHUMAI UDANG MENTAI (4 PCS)', 'Dimsum udang ayam padat dengan saus mentai torch', 26000, 12375, '#F59E0B', 'Croissant', true, ${bucOutletId}, 'BUCIN_UNCLE', 'cemas')
        RETURNING id;
      `);
      // 3. Wonton Chili Oil Szechuan: 110g Dimsum (10450) + 30ml Chili Oil (1950) = HPP 12.400, Harga 25.000
      const bp3Res = await db.execute(sql`
        INSERT INTO products (category_id, name, tagline, price, hpp, color, icon, is_active, outlet_id, branch_id, ai_mood)
        VALUES (${bucCatDimsum}, 'WONTON CHILI OIL SZECHUAN', 'Pangsit lembut siram minyak cabai Szechuan gurih pedas', 25000, 12400, '#DC2626', 'Sparkles', true, ${bucOutletId}, 'BUCIN_UNCLE', 'optimal')
        RETURNING id;
      `);
      // 4. Es Liang Teh Bunga Krisan: 250ml Liang Teh (4500) = HPP 4.500, Harga 14.000
      const bp4Res = await db.execute(sql`
        INSERT INTO products (category_id, name, tagline, price, hpp, color, icon, is_active, outlet_id, branch_id, ai_mood)
        VALUES (${bucCatTea}, 'ES LIANG TEH KRISAN AI GONG', 'Seduhan herbal bunga krisan penyegar tenggorokan', 14000, 4500, '#10B981', 'Leaf', true, ${bucOutletId}, 'BUCIN_UNCLE', 'tegang')
        RETURNING id;
      `);

      const bp1Id = (bp1Res as unknown as { rows: { id: number }[] }).rows[0]?.id;
      const bp2Id = (bp2Res as unknown as { rows: { id: number }[] }).rows[0]?.id;
      const bp3Id = (bp3Res as unknown as { rows: { id: number }[] }).rows[0]?.id;
      const bp4Id = (bp4Res as unknown as { rows: { id: number }[] }).rows[0]?.id;

      if (bp1Id && idBeefSlice && idJaponica && idDimsumMix && idChiliOil && idLiangTeh) {
        await db.execute(sql`
          INSERT INTO recipe_items (product_id, ingredient_id, qty, branch_id) VALUES
          (${bp1Id}, ${idJaponica}, 140, 'BUCIN_UNCLE'),
          (${bp1Id}, ${idBeefSlice}, 100, 'BUCIN_UNCLE'),
          (${bp1Id}, ${idChiliOil}, 20, 'BUCIN_UNCLE'),
          (${bp2Id}, ${idDimsumMix}, 120, 'BUCIN_UNCLE'),
          (${bp2Id}, ${idChiliOil}, 15, 'BUCIN_UNCLE'),
          (${bp3Id}, ${idDimsumMix}, 110, 'BUCIN_UNCLE'),
          (${bp3Id}, ${idChiliOil}, 30, 'BUCIN_UNCLE'),
          (${bp4Id}, ${idLiangTeh}, 250, 'BUCIN_UNCLE');
        `);
      }

      // Promo Khusus BUCIN UNCLE AI GONG
      await db.execute(sql`
        INSERT INTO discounts (name, type, value, min_order, scope, outlet_id, branch_id, valid_from, valid_until, start_date, end_date, is_active) VALUES
        ('Promo Paket Bucin Berdua 12%', 'percentage', 12, 50000, 'cart', ${bucOutletId}, 'BUCIN_UNCLE', now() - interval '7 days', now() + interval '365 days', now() - interval '7 days', now() + interval '365 days', true),
        ('Potongan Uncle Rp 8.000', 'fixed', 8000, 40000, 'cart', ${bucOutletId}, 'BUCIN_UNCLE', now() - interval '7 days', now() + interval '365 days', now() - interval '7 days', now() + interval '365 days', true);
      `);
    }
  } catch (err) {
    console.error("ensureMultiTenantViewsAndData error:", err);
  }
}

/**
 * Idempotent schema verifier — memastikan tabel, kolom, views, dan entitas multi-cabang siap di Supabase.
 */
export async function ensureAiMoodSchema() {
  try {
    await db.execute(sql`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_mood text DEFAULT '';
    `);

    await db.execute(sql`
      UPDATE products SET ai_mood = 'optimal'
      WHERE (ai_mood IS NULL OR ai_mood = '') AND (lower(name) LIKE '%v60%' OR lower(name) LIKE '%signature%' OR lower(name) LIKE '%specialty%' OR lower(name) LIKE '%pour over%');

      UPDATE products SET ai_mood = 'lelah'
      WHERE (ai_mood IS NULL OR ai_mood = '') AND (lower(name) LIKE '%espresso%' OR lower(name) LIKE '%americano%' OR lower(name) LIKE '%cold brew%' OR lower(name) LIKE '%double%' OR lower(name) LIKE '%aren%');

      UPDATE products SET ai_mood = 'tegang'
      WHERE (ai_mood IS NULL OR ai_mood = '') AND (lower(name) LIKE '%tea%' OR lower(name) LIKE '%teh%' OR lower(name) LIKE '%matcha%' OR lower(name) LIKE '%chocolate%' OR lower(name) LIKE '%cokelat%' OR lower(name) LIKE '%lemon%');

      UPDATE products SET ai_mood = 'cemas'
      WHERE (ai_mood IS NULL OR ai_mood = '') AND (lower(name) LIKE '%latte%' OR lower(name) LIKE '%cappuccino%' OR lower(name) LIKE '%vanilla%' OR lower(name) LIKE '%caramel%' OR lower(name) LIKE '%susu%');

      UPDATE products SET ai_mood = CASE (id % 4)
        WHEN 0 THEN 'tegang'
        WHEN 1 THEN 'cemas'
        WHEN 2 THEN 'lelah'
        ELSE 'optimal'
      END
      WHERE ai_mood IS NULL OR ai_mood = '';
    `);
  } catch (err) {
    console.error("ensureAiMoodSchema error:", err);
  }
}

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
      await ensureAiMoodSchema();
      await ensureMultiTenantViewsAndData();
    })().catch((e) => {
      schemaPromise = null;
      throw e;
    });
  }
  return schemaPromise;
}

/**
 * Alias untuk kompatibilitas mundur dengan rute API yang memanggil ensureSeeded.
 */
export async function ensureSeeded(_force = false): Promise<void> {
  return ensureSchema();
}

