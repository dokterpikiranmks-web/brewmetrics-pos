import { db } from "@/db";
import { outlets, users, orders } from "@/db/schema";
import { eq, desc, asc, and, count } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import type { CreateOutletPayload, UpdateOutletPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/outlets
 * Mengambil daftar seluruh cabang / outlet kafe.
 * Dapat diakses oleh kasir, manager, dan owner.
 */
export async function GET(req: Request) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("activeOnly") === "true";

  try {
    const query = db
      .select({
        id: outlets.id,
        name: outlets.name,
        code: outlets.code,
        address: outlets.address,
        phone: outlets.phone,
        isActive: outlets.isActive,
        createdAt: outlets.createdAt,
        updatedAt: outlets.updatedAt,
      })
      .from(outlets);

    const rows = activeOnly
      ? await query.where(eq(outlets.isActive, true)).orderBy(asc(outlets.id))
      : await query.orderBy(asc(outlets.id));

    const dto = rows.map((o) => ({
      id: o.id,
      name: o.name,
      code: o.code,
      address: o.address,
      phone: o.phone,
      isActive: o.isActive,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    }));

    return Response.json({ outlets: dto });
  } catch (err) {
    console.error("GET /api/outlets error:", err);
    return Response.json({ error: "Gagal memuat data cabang." }, { status: 500 });
  }
}

/**
 * POST /api/outlets
 * Menambah cabang / outlet baru (Khusus Role 'owner').
 */
export async function POST(req: Request) {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const body = (await req.json()) as CreateOutletPayload;
    const name = (body.name ?? "").trim();
    const code = (body.code ?? "").trim().toUpperCase();
    const address = (body.address ?? "").trim();
    const phone = (body.phone ?? "").trim();
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

    if (!name || name.length < 2) {
      return Response.json({ error: "Nama cabang minimal 2 karakter." }, { status: 400 });
    }

    if (!code || code.length < 2) {
      return Response.json({ error: "Kode cabang wajib diisi (minimal 2 karakter, cth: 'CBG-01')." }, { status: 400 });
    }

    // Periksa keunikan kode cabang
    const existingCode = await db.query.outlets.findFirst({
      where: eq(outlets.code, code),
    });

    if (existingCode) {
      return Response.json(
        { error: `Kode cabang "${code}" sudah digunakan oleh cabang "${existingCode.name}". Gunakan kode unik lain.` },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(outlets)
      .values({
        name,
        code,
        address,
        phone,
        isActive,
      })
      .returning();

    return Response.json(
      {
        success: true,
        message: `Cabang baru "${created.name}" (${created.code}) berhasil ditambahkan.`,
        outlet: {
          id: created.id,
          name: created.name,
          code: created.code,
          address: created.address,
          phone: created.phone,
          isActive: created.isActive,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/outlets error:", err);
    return Response.json({ error: "Gagal menambahkan cabang baru." }, { status: 500 });
  }
}

/**
 * PATCH /api/outlets
 * Memperbarui informasi cabang atau switch toggle status aktif (Khusus Role 'owner').
 */
export async function PATCH(req: Request) {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const body = (await req.json()) as UpdateOutletPayload;
    const id = Number(body.id);

    if (!id || isNaN(id)) {
      return Response.json({ error: "ID cabang tidak valid." }, { status: 400 });
    }

    const target = await db.query.outlets.findFirst({
      where: eq(outlets.id, id),
    });

    if (!target) {
      return Response.json({ error: "Cabang tidak ditemukan." }, { status: 404 });
    }

    const updateData: Partial<typeof outlets.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name || name.length < 2) {
        return Response.json({ error: "Nama cabang minimal 2 karakter." }, { status: 400 });
      }
      updateData.name = name;
    }

    if (body.code !== undefined) {
      const code = body.code.trim().toUpperCase();
      if (!code || code.length < 2) {
        return Response.json({ error: "Kode cabang minimal 2 karakter." }, { status: 400 });
      }

      // Validasi keunikan kode jika berubah
      if (code !== target.code) {
        const existing = await db.query.outlets.findFirst({
          where: eq(outlets.code, code),
        });
        if (existing && existing.id !== id) {
          return Response.json({ error: `Kode cabang "${code}" sudah digunakan cabang lain.` }, { status: 400 });
        }
      }
      updateData.code = code;
    }

    if (body.address !== undefined) {
      updateData.address = body.address.trim();
    }

    if (body.phone !== undefined) {
      updateData.phone = body.phone.trim();
    }

    if (body.isActive !== undefined) {
      updateData.isActive = Boolean(body.isActive);
    }

    const [updated] = await db
      .update(outlets)
      .set(updateData)
      .where(eq(outlets.id, id))
      .returning();

    return Response.json({
      success: true,
      message: `Cabang "${updated.name}" berhasil diperbarui.`,
      outlet: {
        id: updated.id,
        name: updated.name,
        code: updated.code,
        address: updated.address,
        phone: updated.phone,
        isActive: updated.isActive,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("PATCH /api/outlets error:", err);
    return Response.json({ error: "Gagal memperbarui cabang." }, { status: 500 });
  }
}

/**
 * DELETE /api/outlets
 * Menghapus cabang jika tidak memiliki data order atau staf terikat (Khusus Role 'owner').
 */
export async function DELETE(req: Request) {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      return Response.json({ error: "ID cabang tidak valid." }, { status: 400 });
    }

    const target = await db.query.outlets.findFirst({
      where: eq(outlets.id, id),
    });

    if (!target) {
      return Response.json({ error: "Cabang tidak ditemukan." }, { status: 404 });
    }

    // Cek apakah cabang ini memiliki transaksi pesanan
    const orderCountRes = await db
      .select({ count: count() })
      .from(orders)
      .where(eq(orders.outletId, id));
    const orderCount = Number(orderCountRes[0]?.count ?? 0);

    if (orderCount > 0) {
      return Response.json(
        {
          error: `Cabang "${target.name}" sudah memiliki ${orderCount} data transaksi. Demi integritas audit finansial, cabang tidak boleh dihapus. Silakan nonaktifkan status cabang.`,
        },
        { status: 400 }
      );
    }

    // Cek apakah cabang ini memiliki staf kasir terdaftar
    const staffCountRes = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.outletId, id));
    const staffCount = Number(staffCountRes[0]?.count ?? 0);

    if (staffCount > 0) {
      return Response.json(
        {
          error: `Cabang "${target.name}" masih memiliki ${staffCount} staf terdaftar. Pindahkan staf ke cabang lain sebelum menghapus.`,
        },
        { status: 400 }
      );
    }

    await db.delete(outlets).where(eq(outlets.id, id));

    return Response.json({
      success: true,
      message: `Cabang "${target.name}" berhasil dihapus.`,
    });
  } catch (err) {
    console.error("DELETE /api/outlets error:", err);
    return Response.json({ error: "Gagal menghapus cabang." }, { status: 500 });
  }
}
