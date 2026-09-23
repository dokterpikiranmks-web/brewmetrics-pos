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
 * Mendukung filter ?outletId=... (atau ?outlet_id=...) dan ?period=today|last7days|thisMonth|all
 */
export async function GET(req: Request) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);
  const outletIdParam = searchParams.get("outletId") || searchParams.get("outlet_id");
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
        status: attendances.status,
        clockInAt: attendances.clockInAt,
        clockOutAt: attendances.clockOutAt,
        photoUrl: attendances.photoUrl,
        notes: attendances.notes,
        note: attendances.note,
        createdAt: attendances.createdAt,
      })
      .from(attendances)
      .leftJoin(users, eq(users.id, attendances.userId))
      .leftJoin(outlets, eq(outlets.id, attendances.outletId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(attendances.createdAt))
      .limit(100);

    const dto: AttendanceDto[] = rows.map((r) => {
      const rawName = r.userName?.trim() || "";
      const rawUsername = (r as Record<string, unknown>).username as string | undefined;
      const finalName = rawName || rawUsername?.trim() || "Kasir Aktif";

      return {
        id: r.id,
        userId: r.userId,
        userName: finalName,
        userRole: r.userRole ?? "cashier",
        outletId: r.outletId ?? null,
        outletName: r.outletName ?? "Cabang Pusat",
        type: r.type,
        status: r.status ?? "present",
        clockInAt: r.clockInAt ? r.clockInAt.toISOString() : null,
        clockOutAt: r.clockOutAt ? r.clockOutAt.toISOString() : null,
        photoUrl: r.photoUrl,
        notes: r.notes || r.note || "",
        note: r.notes || r.note || "",
        createdAt: r.createdAt.toISOString(),
      };
    });

    return Response.json({ attendances: dto });
  } catch (err) {
    console.error("GET /api/attendance error:", err);
    return Response.json({ error: "Gagal memuat riwayat absensi staf." }, { status: 500 });
  }
}

/**
 * POST /api/attendance
 * Merekam absensi foto selfie (Masuk / Pulang) dari staf kasir.
 * Menerima payload snake_case (user_id, outlet_id, photo_url, notes) maupun camelCase.
 */
export async function POST(req: Request) {
  await ensureSeeded();

  try {
    const body = (await req.json()) as CreateAttendancePayload;

    // Ambil userId baik dari user_id maupun userId
    const rawUserId = body.user_id ?? body.userId;
    const userId = Number(rawUserId);
    const rawType = (body.type ?? "").toLowerCase().trim();
    const status = (body.status ?? "present").trim();
    let photoUrl = (body.photo_url ?? body.photoUrl ?? "").trim();
    const notes = (body.notes ?? body.note ?? "").trim();

    if (!userId || isNaN(userId)) {
      return Response.json({ error: "Pilih identitas staf yang akan absen." }, { status: 400 });
    }

    if (!["in", "out", "clock_in", "clock_out"].includes(rawType)) {
      return Response.json(
        { error: "Tipe absensi harus 'in' (Masuk) atau 'out' (Pulang)." },
        { status: 400 }
      );
    }

    if (!photoUrl) {
      return Response.json({ error: "Foto wajah selfie wajib diambil untuk verifikasi absensi." }, { status: 400 });
    }

    // Verifikasi user di database
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!targetUser) {
      return Response.json({ error: "Staf tidak ditemukan dalam sistem." }, { status: 404 });
    }

    const rawName = targetUser.name?.trim() || "";
    const rawUsername = (targetUser as Record<string, unknown>).username as string | undefined;
    const finalUserName = rawName || rawUsername?.trim() || "Kasir Aktif";

    // Tentukan outletId: prioritas dari payload, lalu dari targetUser.outletId, lalu default 1
    const rawOutletId = body.outlet_id ?? body.outletId;
    const outletId = rawOutletId ? Number(rawOutletId) : targetUser.outletId ?? 1;

    // Logika Absen Masuk vs Pulang:
    // - Jika Absen Masuk: clock_in_at = new Date() & type = 'in'
    // - Jika Absen Pulang: clock_out_at = new Date() & type = 'out'
    const isClockIn = rawType === "in" || rawType === "clock_in";
    const normalizedType: "in" | "out" = isClockIn ? "in" : "out";
    const now = new Date();
    const clockInAt = isClockIn ? now : null;
    const clockOutAt = !isClockIn ? now : null;

    // Jika photoUrl berupa data URL base64, unggah ke Supabase Storage bucket 'attendance-photos'
    if (photoUrl.startsWith("data:")) {
      const uploadRes = await uploadAttendancePhoto(photoUrl, userId);
      if (uploadRes.error) {
        return Response.json(
          {
            error: `Gagal mengunggah foto absensi ke penyimpanan: ${uploadRes.error}`,
            details: uploadRes.error,
          },
          { status: 400 }
        );
      }
      if (uploadRes.url) {
        photoUrl = uploadRes.url;
      }
    }

    const [created] = await db
      .insert(attendances)
      .values({
        userId,
        outletId,
        type: normalizedType,
        status,
        clockInAt,
        clockOutAt,
        photoUrl,
        notes,
        note: notes,
      })
      .returning();

    // Ambil detail cabang
    const outletInfo = await db.query.outlets.findFirst({
      where: eq(outlets.id, outletId),
    });

    const dto: AttendanceDto = {
      id: created.id,
      userId: created.userId,
      userName: finalUserName,
      userRole: targetUser.role,
      outletId: created.outletId ?? null,
      outletName: outletInfo?.name ?? "Cabang Pusat",
      type: created.type,
      status: created.status,
      clockInAt: created.clockInAt ? created.clockInAt.toISOString() : null,
      clockOutAt: created.clockOutAt ? created.clockOutAt.toISOString() : null,
      photoUrl: created.photoUrl,
      notes: created.notes ?? "",
      note: created.note ?? "",
      createdAt: created.createdAt.toISOString(),
    };

    const typeLabel = isClockIn ? "Masuk" : "Pulang";

    return Response.json(
      {
        success: true,
        message: `Absensi ${typeLabel} untuk ${finalUserName} berhasil direkam.`,
        attendance: dto,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("POST /api/attendance error:", err);
    const detailMsg = err instanceof Error ? err.message : "";
    return Response.json(
      { error: "Gagal menyimpan absensi staf.", details: detailMsg },
      { status: 500 }
    );
  }
}
