import { db } from "@/db";
import { users, outlets } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

/**
 * GET /api/attendance/staff-list
 * Endpoint publik / staf untuk modul absensi kasir.
 * Mengembalikan daftar staf yang aktif (active = true) dengan kolom aman:
 * id, name, role, outlet_id (tanpa field PIN).
 * Mendukung filter opsional ?outlet_id=... atau ?outletId=...
 */
export async function GET(req: Request) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);
  const outletIdParam = searchParams.get("outlet_id") || searchParams.get("outletId");

  try {
    const conditions = [eq(users.active, true)];

    if (outletIdParam && outletIdParam !== "all") {
      const oid = Number(outletIdParam);
      if (!isNaN(oid)) {
        conditions.push(eq(users.outletId, oid));
      }
    }

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        outletId: users.outletId,
        outletName: outlets.name,
        active: users.active,
      })
      .from(users)
      .leftJoin(outlets, eq(outlets.id, users.outletId))
      .where(and(...conditions))
      .orderBy(asc(users.name));

    const staffData = rows.map((u) => {
      // Penanganan nilai kosong (Defensive Handling)
      const rawName = u.name?.trim() || "";
      const rawUsername = (u as Record<string, unknown>).username as string | undefined;
      const fallbackName = rawUsername?.trim() || "Kasir Aktif";
      const finalName = rawName || fallbackName;

      return {
        id: u.id,
        name: finalName,
        role: u.role,
        outlet_id: u.outletId ?? null,
        outletId: u.outletId ?? null,
        outletName: u.outletName ?? null,
        is_active: u.active,
        active: u.active,
      };
    });

    // Mengembalikan response berformat { data: [...] } sesuai spesifikasi
    return Response.json({
      data: staffData,
    });
  } catch (err) {
    console.error("GET /api/attendance/staff-list error:", err);
    return Response.json({ error: "Gagal memuat daftar staf absensi." }, { status: 500 });
  }
}
