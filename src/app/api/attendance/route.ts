import { NextResponse } from "next/server";
import { db } from "@/db";
import { attendances, users, outlets } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { ensureSeeded } from "@/lib/seed";
import { supabase } from "@/lib/supabase"; // KUNCI SOLUSI: Kita pakai Supabase API langsung
import type { AttendanceDto } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);
  const outletIdParam = searchParams.get("outletId") || searchParams.get("outlet_id");
  const period = searchParams.get("period") || "today";

  try {
    const conditions = [];
    if (outletIdParam && outletIdParam !== "all") {
      const oid = Number(outletIdParam);
      if (!isNaN(oid)) conditions.push(eq(attendances.outletId, oid));
    }

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
      userName: r.userName?.trim() || "Kasir Aktif",
      userRole: r.userRole ?? "cashier",
      outletId: r.outletId ?? null,
      outletName: r.outletName ?? "Cabang Pusat",
      type: r.type,
      status: r.status ?? "present",
      clockInAt: r.clockInAt ? r.clockInAt.toISOString() : null,
      clockOutAt: r.clockOutAt ? r.clockOutAt.toISOString() : null,
      photoUrl: r.photoUrl,
      notes: r.notes || "",
      note: r.notes || "",
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({ attendances: dto });
  } catch (err: unknown) {
    console.error("GET /api/attendance error:", err);
    return NextResponse.json({ error: "Gagal memuat riwayat absensi staf." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await ensureSeeded();
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const userId = Number(body.userId ?? body.user_id);
    const outletId = Number(body.outletId ?? body.outlet_id) || 1;
    const type = String(body.type || "in").toLowerCase().trim() === "out" ? "out" : "in";
    const photo = String(body.photo || body.photoUrl || body.photo_url || "");
    const notesValue = typeof body.notes === "string" ? body.notes : typeof body.note === "string" ? body.note : null;

    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: "User ID kasir wajib valid." }, { status: 400 });
    }
    if (!photo) {
      return NextResponse.json({ error: "Foto selfie wajib disertakan." }, { status: 400 });
    }

    // BYPASS DRIZZLE ORM: Gunakan Supabase API langsung yang 100% kebal terhadap error pemetaan parameter SQL
    const payload: Record<string, any> = {
      user_id: userId,
      outlet_id: outletId,
      type: type,
      status: "present",
      photo_url: photo,
    };

    // Format ISO string secara eksplisit yang pasti diterima Supabase API
    if (type === "in") {
      payload.clock_in_at = new Date().toISOString();
    } else {
      payload.clock_out_at = new Date().toISOString();
    }

    // Hanya kirim notes jika ada isinya
    if (notesValue) {
      payload.notes = notesValue;
    }

    const { error } = await supabase.from("attendances").insert([payload]);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true, message: "Absensi berhasil dicatat." });
  } catch (err: unknown) {
    console.error("POST /api/attendance error:", err);
    const rawError = err instanceof Error ? err.message : "Terjadi kesalahan pada database.";
    const cleanError = rawError.replace(/data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+/g, "[DATA_FOTO]");
    return NextResponse.json({ error: cleanError }, { status: 500 });
  }
}