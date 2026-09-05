import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["manager", "owner"]);
  if (error) return error;

  await ensureSeeded();
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id || isNaN(id)) {
    return Response.json({ error: "ID kategori tidak valid." }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      name?: string;
      icon?: string;
      sortOrder?: number;
    };

    const name = (body.name ?? "").trim();
    if (!name) {
      return Response.json({ error: "Nama kategori wajib diisi." }, { status: 400 });
    }

    const icon = (body.icon ?? "Coffee").trim();
    const sortOrder = Number(body.sortOrder) || 1;

    const [updated] = await db
      .update(categories)
      .set({
        name,
        icon,
        sortOrder,
      })
      .where(eq(categories.id, id))
      .returning();

    if (!updated) {
      return Response.json({ error: "Kategori tidak ditemukan." }, { status: 404 });
    }

    return Response.json({ category: updated });
  } catch (err) {
    console.error("update category error:", err);
    return Response.json({ error: "Gagal memperbarui kategori." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["manager", "owner"]);
  if (error) return error;

  await ensureSeeded();
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id || isNaN(id)) {
    return Response.json({ error: "ID kategori tidak valid." }, { status: 400 });
  }

  try {
    // Cek apakah masih ada produk yang menggunakan kategori ini
    const referencingProducts = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.categoryId, id))
      .limit(5);

    if (referencingProducts.length > 0) {
      const names = referencingProducts.map((p) => p.name).join(", ");
      return Response.json(
        {
          error: `Kategori tidak dapat dihapus karena masih memiliki produk (${names}). Pindahkan atau hapus produk terlebih dahulu.`,
        },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning();

    if (!deleted) {
      return Response.json({ error: "Kategori tidak ditemukan." }, { status: 404 });
    }

    return Response.json({ success: true, deletedCategory: deleted });
  } catch (err) {
    console.error("delete category error:", err);
    return Response.json({ error: "Gagal menghapus kategori." }, { status: 500 });
  }
}
