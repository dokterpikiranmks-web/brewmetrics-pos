import { db } from "@/db";
import { attendances, users, outlets } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { ensureSeeded } from "@/lib/seed";
import { uploadAttendancePhoto } from "@/lib/supabase";
import type { AttendanceDto, CreateAttendancePayload } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/attendance
 * Mengambil log absensi foto wajah staf.
 * Mendukung filter ?outletId=... dan ?period=today|last7days|thisMonth|all
 */
export async function GET(req: Request) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);
  const outletIdParam = searchParams.get("outletId");
  const period = searchParams.get("period") || "today";

  try {
    const conditions = [];

    // Filter Outlet
    if (outletIdParam && outletIdParam !== "all") {
      const oid = Number(outletIdParam);
      if (!isNaN(oid)) {
        conditions.push(eq(attendances.outletId, oid));
      }
    }

    // Filter Periode Waktu
    if (period === "today") {
      conditions.push(sql`${attendances.createdAt} >= date_trunc('day', now())`);
    } else if (period === "last7days") {
      conditions.push(sql`${attendances.createdAt} >= now() - interval '7 days'`);
    } else if (period === "thisMonth") {
      conditions.push(sql`${attendances.createdAt} >= date_trunc('month', now())`);
    }

    const rows = await db
      .select({
        id: attendances.id,
        userId: attendances.userId,
        userName: users.name,
        userRole: users.role,
        outletId: attendances.outletId,
        outletName: outlets.name,
        type: attendances.type,
        photoUrl: attendances.photoUrl,
        note: attendances.note,
        createdAt: attendances.createdAt,
      })
      .from(attendances)
      .leftJoin(users, eq(users.id, attendances.userId))
      .leftJoin(outlets, eq(outlets.id, attendances.outletId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(attendances.createdAt))
      .limit(100);

    const dto: AttendanceDto[] = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.userName ?? "Staf",
      userRole: r.userRole ?? "cashier",
      outletId: r.outletId ?? null,
      outletName: r.outletName ?? "Cabang Pusat",
      type: r.type as "clock_in" | "clock_out",
      photoUrl: r.photoUrl,
      note: r.note ?? "",
      createdAt: r.createdAt.toISOString(),
    }));

    return Response.json({ attendances: dto });
  } catch (err) {
    console.error("GET /api/attendance error:", err);
    return Response.json({ error: "Gagal memuat riwayat absensi staf." }, { status: 500 });
  }
}

/**
 * POST /api/attendance
 * Merekam absensi foto selfie (Masuk / Pulang) dari staf kasir.
 */
export async function POST(req: Request) {
  await ensureSeeded();

  try {
    const body = (await req.json()) as CreateAttendancePayload;
    const userId = Number(body.userId);
    const type = body.type;
    let photoUrl = (body.photoUrl ?? "").trim();
    const note = (body.note ?? "").trim();

    if (!userId || isNaN(userId)) {
      return Response.json({ error: "Pilih identitas staf yang akan absen." }, { status: 400 });
    }

    if (!["clock_in", "clock_out"].includes(type)) {
      return Response.json({ error: "Tipe absensi harus 'clock_in' (Masuk) atau 'clock_out' (Pulang)." }, { status: 400 });
    }

    if (!photoUrl) {
      return Response.json({ error: "Foto wajah selfie wajib diambil untuk verifikasi absensi." }, { status: 400 });
    }

    // Verifikasi user
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!targetUser) {
      return Response.json({ error: "Staf tidak ditemukan dalam sistem." }, { status: 404 });
    }

    // Tentukan outletId: prioritas dari payload, lalu dari user.outletId, lalu fallback ke default 1
    const outletId = body.outletId ? Number(body.outletId) : targetUser.outletId ?? 1;

    // Jika photoUrl berupa data URL base64, unggah ke Supabase Storage bucket 'attendance-photos'
    if (photoUrl.startsWith("data:")) {
      const uploadRes = await uploadAttendancePhoto(photoUrl, userId);
      if (uploadRes.url) {
        photoUrl = uploadRes.url;
      }
    }

    const [created] = await db
      .insert(attendances)
      .values({
        userId,
        outletId,
        type,
        photoUrl,
        note,
      })
      .returning();

    // Ambil detail cabang
    const outletInfo = await db.query.outlets.findFirst({
      where: eq(outlets.id, outletId),
    });

    const dto: AttendanceDto = {
      id: created.id,
      userId: created.userId,
      userName: targetUser.name,
      userRole: targetUser.role,
      outletId: created.outletId ?? null,
      outletName: outletInfo?.name ?? "Cabang Pusat",
      type: created.type as "clock_in" | "clock_out",
      photoUrl: created.photoUrl,
      note: created.note ?? "",
      createdAt: created.createdAt.toISOString(),
    };

    const typeLabel = type === "clock_in" ? "Masuk" : "Pulang";

    return Response.json(
      {
        success: true,
        message: `Absensi ${typeLabel} untuk ${targetUser.name} berhasil direkam.`,
        attendance: dto,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/attendance error:", err);
    return Response.json({ error: "Gagal menyimpan absensi staf." }, { status: 500 });
  }
}
