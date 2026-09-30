import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { setSessionCookie } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import type { SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureSeeded();
  try {
    const body = await req.json().catch(() => ({}));
    const pin = String(body.pin || "").trim();

    if (!pin) {
      return NextResponse.json({ error: "PIN verifikasi wajib diisi." }, { status: 400 });
    }

    const envAdminPin = process.env.ADMIN_PIN || process.env.NEXT_PUBLIC_ADMIN_PIN || "1234";

    // 1. Cek apakah cocok dengan PIN user terdaftar dengan role owner atau manager
    const matchedUsers = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        pin: users.pin,
        outletId: users.outletId,
      })
      .from(users)
      .where(and(eq(users.pin, pin), eq(users.active, true)))
      .limit(1);

    let sessionUser: SessionUser | null = null;

    if (matchedUsers.length > 0) {
      const u = matchedUsers[0];
      if (u.role === "cashier") {
        return NextResponse.json(
          { error: "Akses ditolak: Akun Kasir tidak memiliki wewenang ke Portal Admin." },
          { status: 403 }
        );
      }
      sessionUser = {
        id: u.id,
        name: u.name,
        role: u.role,
        outletId: u.outletId ?? 1,
      };
    } else if (pin === envAdminPin) {
      // 2. Cocok dengan Environment Variable PIN statis / Master PIN
      // Ambil owner pertama sebagai representasi profil
      const [firstOwner] = await db
        .select({
          id: users.id,
          name: users.name,
          role: users.role,
          outletId: users.outletId,
        })
        .from(users)
        .where(eq(users.role, "owner"))
        .limit(1);

      sessionUser = {
        id: firstOwner?.id ?? 1,
        name: firstOwner?.name ?? "Owner Kopi Aso",
        role: "owner",
        outletId: firstOwner?.outletId ?? 1,
      };
    }

    if (!sessionUser) {
      return NextResponse.json({ error: "PIN Admin tidak valid. Silakan coba kembali." }, { status: 401 });
    }

    // Set cookie sesi terotentikasi HMAC
    await setSessionCookie(sessionUser);

    return NextResponse.json({
      success: true,
      message: "Verifikasi PIN Admin berhasil.",
      user: sessionUser,
    });
  } catch (err: unknown) {
    console.error("POST /api/admin/verify-pin error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan internal saat verifikasi PIN." }, { status: 500 });
  }
}
