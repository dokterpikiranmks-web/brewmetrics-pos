import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const body = (await req.json()) as { pin?: string; reason?: string };
    const pin = (body.pin ?? "").trim();

    if (!pin || pin.length < 4) {
      return Response.json(
        { error: "PIN otorisasi minimal 4 digit." },
        { status: 400 }
      );
    }

    // Hanya cari user aktif yang memiliki role 'manager' atau 'owner'
    const supervisor = await db.query.users.findFirst({
      where: and(
        eq(users.pin, pin),
        eq(users.active, true),
        inArray(users.role, ["manager", "owner"])
      ),
    });

    if (!supervisor) {
      // Cek apakah PIN ini milik kasir biasa untuk memberikan pesan yang edukatif
      const cashierUser = await db.query.users.findFirst({
        where: and(eq(users.pin, pin), eq(users.active, true), eq(users.role, "cashier")),
      });

      if (cashierUser) {
        return Response.json(
          {
            error: `Akses ditolak: ${cashierUser.name} memiliki role Kasir. Otorisasi Void hanya dapat disetujui oleh Manager atau Owner.`,
          },
          { status: 403 }
        );
      }

      return Response.json(
        { error: "PIN otorisasi salah atau akun tidak ditemukan." },
        { status: 401 }
      );
    }

    return Response.json({
      success: true,
      supervisor: {
        id: supervisor.id,
        name: supervisor.name,
        role: supervisor.role,
      },
    });
  } catch (error) {
    console.error("verify-void-pin error:", error);
    return Response.json(
      { error: "Terjadi kesalahan pada server saat verifikasi PIN." },
      { status: 500 }
    );
  }
}
