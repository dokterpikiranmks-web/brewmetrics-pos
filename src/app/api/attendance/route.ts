import { NextResponse } from "next/server";
import { db } from "@/db";
import { attendances, users, outlets } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { ensureSeeded } from "@/lib/seed";
import { supabase } from "@/lib/supabase";
import { Buffer } from "node:buffer";
import type { AttendanceDto } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/attendance
 * Mengambil log riwayat absensi staf.
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

    return NextResponse.json({ attendances: dto });
  } catch (err) {
    console.error("GET /api/attendance error:", err);
    return NextResponse.json({ error: "Gagal memuat riwayat absensi staf." }, { status: 500 });
  }
}

/**
 * POST /api/attendance
 * Merekam absensi foto selfie (Masuk / Pulang) dari staf kasir dengan mekanisme Fail-Safe Dual Layer.
 */
export async function POST(req: Request) {
  await ensureSeeded();

  try {
    const body = (await req.json()) as Record<string, unknown>;

    const userId = body.userId ?? body.user_id;
    const outletId = body.outletId ?? body.outlet_id;
    const type = (typeof body.type === "string" ? body.type : "in").toLowerCase().trim();
    const photo = String(body.photo || body.photoUrl || body.photo_url || "");
    const notes = typeof body.notes === "string" ? body.notes : typeof body.note === "string" ? body.note : null;

    if (!userId) {
      return NextResponse.json({ error: "User ID diperlukan." }, { status: 400 });
    }

    if (!photo) {
      return NextResponse.json({ error: "Foto wajah selfie wajib dikirim." }, { status: 400 });
    }

    // 1. Mekanisme Fail-Safe Dual Layer untuk Foto
    let finalPhotoUrl = photo;

    try {
      const base64Data = photo.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const fileName = `attendances/${userId}_${Date.now()}.jpg`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("attendance-photos")
        .upload(fileName, buffer, { contentType: "image/jpeg", upsert: true });

      if (uploadError) {
        console.warn("Upload Storage Gagal (fallback base64):", uploadError.message);
      } else if (uploadData) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("attendance-photos").getPublicUrl(fileName);
        if (publicUrl) {
          finalPhotoUrl = publicUrl;
        }
      }
    } catch (storageErr: unknown) {
      console.warn("Storage exception (fallback base64):", storageErr);
      // Fallback otomatis: gunakan photo base64 langsung sebagai finalPhotoUrl
    }

    // 2. Simpan ke database via Drizzle ORM dengan sanitasi nilai null
    await db.insert(attendances).values({
      userId: Number(userId),
      outletId: Number(outletId) || 1,
      type: type === "out" ? "out" : "in",
      clockInAt: type === "in" ? new Date() : null,
      clockOutAt: type === "out" ? new Date() : null,
      photoUrl: finalPhotoUrl,
      status: "present",
      notes: notes || null,
      note: notes || null,
    });

    // 3. Selalu kembalikan respons sukses HTTP 200
    return NextResponse.json({ success: true, message: "Absensi berhasil disimpan" });
  } catch (err: unknown) {
    console.error("POST /api/attendance error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Terjadi kesalahan saat memproses absensi.",
      },
      { status: 500 }
    );
  }
}
