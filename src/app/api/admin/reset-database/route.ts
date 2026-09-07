import { db } from "@/db";
import { sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { invalidateRecipeCache } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export interface ResetDatabasePayload {
  confirmation: string;
  targets: {
    transactions?: boolean;
    customers?: boolean;
    inventory?: boolean;
    catalog?: boolean;
  };
}

export async function POST(req: Request) {
  const { user, error } = await requireRole(["owner"]);
  if (error || !user) return error!;

  try {
    const body = (await req.json()) as ResetDatabasePayload;

    // 1. Validasi kata kunci keamanan
    if (body.confirmation !== "HAPUS-PERMANEN") {
      return Response.json(
        {
          error:
            "Kata sandi konfirmasi tidak sesuai. Harap ketik persis 'HAPUS-PERMANEN' dengan huruf kapital.",
        },
        { status: 400 }
      );
    }

    const { transactions, customers, inventory, catalog } = body.targets || {};

    // 2. Validasi setidaknya satu opsi dipilih
    if (!transactions && !customers && !inventory && !catalog) {
      return Response.json(
        { error: "Pilih setidaknya satu jenis data yang ingin dikosongkan." },
        { status: 400 }
      );
    }

    const executedActions: string[] = [];

    // 3. Eksekusi TRUNCATE TABLE selektif secara aman dalam Drizzle Database Transaction
    await db.transaction(async (tx) => {
      // (1) Riwayat Transaksi & Laporan Shift
      if (transactions) {
        await tx.execute(
          sql`TRUNCATE TABLE shift_reports, order_items, orders, cash_movements RESTART IDENTITY CASCADE;`
        );
        // Reset counter statistik pada tabel customers jika customers tidak ikut dihapus
        if (!customers) {
          await tx.execute(
            sql`UPDATE customers SET total_orders = 0, total_spend = 0;`
          );
        }
        executedActions.push("Riwayat Transaksi & Laporan Shift");
      }

      // (2) Data Pelanggan CRM
      if (customers) {
        // Jika orders tidak dihapus, lepaskan FK customer_id terlebih dahulu agar tidak terjadi error foreign key
        if (!transactions) {
          await tx.execute(sql`UPDATE orders SET customer_id = NULL;`);
        }
        await tx.execute(sql`TRUNCATE TABLE customers RESTART IDENTITY CASCADE;`);
        executedActions.push("Data Pelanggan CRM");
      }

      // (4) Katalog Menu & Resep
      if (catalog) {
        // Jika orders/order_items tidak dihapus, lepaskan FK product_id agar data order historis tetap utuh
        if (!transactions) {
          await tx.execute(sql`UPDATE order_items SET product_id = NULL;`);
        }
        await tx.execute(
          sql`TRUNCATE TABLE bundle_items, recipe_items, modifier_ingredients, variants, products, categories, modifiers RESTART IDENTITY CASCADE;`
        );
        invalidateRecipeCache();
        executedActions.push("Katalog Menu & Resep");
      }

      // (3) Stok & Kartu Inventaris
      if (inventory) {
        // Jika catalog tidak ikut dihapus, recipe_items dan modifier_ingredients yang mereferensikan ingredients harus dibersihkan
        if (!catalog) {
          await tx.execute(
            sql`TRUNCATE TABLE recipe_items, modifier_ingredients, ingredients RESTART IDENTITY CASCADE;`
          );
        } else {
          // Jika catalog sudah di-truncate di atas, cukup bersihkan ingredients
          await tx.execute(
            sql`TRUNCATE TABLE ingredients RESTART IDENTITY CASCADE;`
          );
        }
        invalidateRecipeCache();
        executedActions.push("Stok & Kartu Inventaris");
      }
    });

    return Response.json({
      ok: true,
      message: `Berhasil mengosongkan data terpilih: ${executedActions.join(", ")}.`,
      actions: executedActions,
    });
  } catch (err: any) {
    console.error("reset database error:", err);
    return Response.json(
      { error: err.message || "Gagal mengeksekusi reset database selektif." },
      { status: 500 }
    );
  }
}
