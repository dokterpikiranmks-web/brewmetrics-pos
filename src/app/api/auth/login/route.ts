import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { setSessionCookie } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import type { SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const body = (await req.json()) as { pin?: string };
    const pin = (body.pin ?? "").trim();
    if (pin.length < 4) {
      return Response.json({ error: "PIN minimal 4 digit." }, { status: 400 });
    }
    const user = await db.query.users.findFirst({ where: and(eq(users.pin, pin), eq(users.active, true)) });
    if (!user) {
      return Response.json({ error: "PIN salah atau akun nonaktif." }, { status: 401 });
    }
    const session: SessionUser = { id: user.id, name: user.name, role: user.role };
    await setSessionCookie(session);
    return Response.json({ user: session });
  } catch (e) {
    console.error("login error", e);
    return Response.json({ error: "Gagal memproses login." }, { status: 500 });
  }
}
