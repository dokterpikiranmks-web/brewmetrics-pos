import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and, ne, asc } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/users
 * Mengambil daftar staf / akun pengguna POS (khusus role 'owner').
 * PENTING: Kolom PIN tidak pernah diekspos secara mentah demi privasi & keamanan.
 */
export async function GET() {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const list = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        active: users.active,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.id));

    return Response.json({ users: list });
  } catch (err) {
    console.error("fetch users error:", err);
    return Response.json({ error: "Gagal mengambil data staf pengguna." }, { status: 500 });
  }
}

/**
 * POST /api/users
 * Mendaftarkan akun staf baru dengan Nama, Role, dan PIN 4 digit.
 * Memvalidasi agar PIN tidak boleh kembar dengan staf lain yang aktif.
 */
export async function POST(req: Request) {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const body = (await req.json()) as {
      name?: string;
      role?: Role;
      pin?: string;
    };

    const name = (body.name ?? "").trim();
    if (!name || name.length < 2) {
      return Response.json({ error: "Nama staf minimal 2 karakter." }, { status: 400 });
    }

    const role = body.role;
    if (!role || !["cashier", "manager", "owner"].includes(role)) {
      return Response.json({ error: "Role staf harus cashier, manager, atau owner." }, { status: 400 });
    }

    const pin = (body.pin ?? "").trim();
    if (!/^\d{4}$/.test(pin)) {
      return Response.json({ error: "PIN wajib berupa 4 digit angka (0-9)." }, { status: 400 });
    }

    // Validasi keunikan PIN: PIN tidak boleh kembar dengan staf lain yang masih aktif
    const existingUserWithPin = await db.query.users.findFirst({
      where: and(eq(users.pin, pin), eq(users.active, true)),
    });

    if (existingUserWithPin) {
      return Response.json(
        {
          error: `PIN "${pin}" sudah digunakan oleh staf aktif lain (${existingUserWithPin.name}). Gunakan PIN 4 digit lain.`,
        },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(users)
      .values({
        name,
        role,
        pin,
        active: true,
      })
      .returning({
        id: users.id,
        name: users.name,
        role: users.role,
        active: users.active,
        createdAt: users.createdAt,
      });

    return Response.json(
      {
        success: true,
        message: `Staf baru "${created.name}" berhasil didaftarkan.`,
        user: created,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("create user error:", err);
    return Response.json({ error: "Gagal mendaftarkan staf baru." }, { status: 500 });
  }
}

/**
 * PATCH /api/users
 * Memperbarui data staf (Nama, Role), mereset PIN, atau mengubah status aktif.
 */
export async function PATCH(req: Request) {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const body = (await req.json()) as {
      id?: number;
      name?: string;
      role?: Role;
      pin?: string;
      active?: boolean;
    };

    const id = Number(body.id);
    if (!id || isNaN(id)) {
      return Response.json({ error: "ID staf tidak valid." }, { status: 400 });
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!targetUser) {
      return Response.json({ error: "Staf tidak ditemukan." }, { status: 404 });
    }

    const updateData: {
      name?: string;
      role?: Role;
      pin?: string;
      active?: boolean;
    } = {};

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name || name.length < 2) {
        return Response.json({ error: "Nama staf minimal 2 karakter." }, { status: 400 });
      }
      updateData.name = name;
    }

    if (body.role !== undefined) {
      if (!["cashier", "manager", "owner"].includes(body.role)) {
        return Response.json({ error: "Role tidak valid." }, { status: 400 });
      }

      // Safety check: jika owner menurunkan role dirinya sendiri, pastikan masih ada owner aktif lain
      if (targetUser.role === "owner" && body.role !== "owner") {
        const otherOwners = await db.query.users.findMany({
          where: and(eq(users.role, "owner"), eq(users.active, true), ne(users.id, id)),
        });
        if (otherOwners.length === 0) {
          return Response.json(
            { error: "Tidak dapat mengubah role. Harus ada minimal satu Owner aktif di sistem kafe." },
            { status: 400 }
          );
        }
      }
      updateData.role = body.role;
    }

    if (body.active !== undefined) {
      const isActive = Boolean(body.active);
      // Safety check: jika menonaktifkan akun owner, pastikan ada owner aktif lain
      if (targetUser.role === "owner" && !isActive) {
        const otherOwners = await db.query.users.findMany({
          where: and(eq(users.role, "owner"), eq(users.active, true), ne(users.id, id)),
        });
        if (otherOwners.length === 0) {
          return Response.json(
            { error: "Tidak dapat menonaktifkan akun Owner terakhir. Harus ada minimal satu Owner aktif." },
            { status: 400 }
          );
        }
      }
      updateData.active = isActive;
    }

    if (body.pin !== undefined && body.pin.trim().length > 0) {
      const pin = body.pin.trim();
      if (!/^\d{4}$/.test(pin)) {
        return Response.json({ error: "PIN baru harus berupa 4 digit angka (0-9)." }, { status: 400 });
      }

      // Cek apakah PIN dipakai staf aktif lain
      const existingUserWithPin = await db.query.users.findFirst({
        where: and(eq(users.pin, pin), eq(users.active, true), ne(users.id, id)),
      });

      if (existingUserWithPin) {
        return Response.json(
          {
            error: `PIN "${pin}" sudah digunakan oleh staf aktif lain (${existingUserWithPin.name}). Gunakan PIN 4 digit lain.`,
          },
          { status: 400 }
        );
      }

      updateData.pin = pin;
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: "Tidak ada perubahan data yang dikirimkan." }, { status: 400 });
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        role: users.role,
        active: users.active,
        createdAt: users.createdAt,
      });

    return Response.json({
      success: true,
      message: `Data staf "${updated.name}" berhasil diperbarui.`,
      user: updated,
    });
  } catch (err) {
    console.error("update user error:", err);
    return Response.json({ error: "Gagal memperbarui data staf." }, { status: 500 });
  }
}
