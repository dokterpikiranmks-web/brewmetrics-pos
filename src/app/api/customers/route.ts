import { db } from "@/db";
import { customers } from "@/db/schema";
import { desc, ilike, or, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import type { CustomerDto } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { error } = await requireRole(["cashier", "manager", "owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const sort = url.searchParams.get("sortBy") ?? url.searchParams.get("sort") ?? "orders";
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));

    const pattern = q ? `%${q}%` : null;
    const whereClause = pattern
      ? or(ilike(customers.name, pattern), ilike(customers.phone, pattern))
      : undefined;

    const orderClause =
      sort === "spend"
        ? [desc(customers.totalSpend), desc(customers.totalOrders)]
        : sort === "recent"
        ? [desc(customers.lastVisitAt)]
        : [desc(customers.totalOrders), desc(customers.totalSpend)];

    const rows = await db
      .select()
      .from(customers)
      .where(whereClause)
      .orderBy(...orderClause)
      .limit(limit);

    const result: CustomerDto[] = rows.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      totalOrders: c.totalOrders,
      totalSpend: c.totalSpend,
      lastVisitAt: c.lastVisitAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
    }));

    return Response.json({ customers: result });
  } catch (err) {
    console.error("fetch customers error:", err);
    return Response.json({ error: "Gagal mengambil data pelanggan." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { error } = await requireRole(["cashier", "manager", "owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const body = (await req.json()) as { name?: string; phone?: string };
    const name = (body.name ?? "").trim();
    const phone = (body.phone ?? "").trim();

    if (!name) {
      return Response.json({ error: "Nama pelanggan wajib diisi." }, { status: 400 });
    }
    if (!phone || phone.length < 5) {
      return Response.json({ error: "Nomor kontak telepon minimal 5 digit." }, { status: 400 });
    }

    const existing = await db.query.customers.findFirst({
      where: eq(customers.phone, phone),
    });

    let saved;
    if (existing) {
      const [u] = await db
        .update(customers)
        .set({ name, lastVisitAt: new Date() })
        .where(eq(customers.id, existing.id))
        .returning();
      saved = u;
    } else {
      const [inserted] = await db
        .insert(customers)
        .values({
          name,
          phone,
          totalOrders: 0,
          totalSpend: 0,
          lastVisitAt: new Date(),
        })
        .returning();
      saved = inserted;
    }

    const dto: CustomerDto = {
      id: saved.id,
      name: saved.name,
      phone: saved.phone,
      totalOrders: saved.totalOrders,
      totalSpend: saved.totalSpend,
      lastVisitAt: saved.lastVisitAt.toISOString(),
      createdAt: saved.createdAt.toISOString(),
    };

    return Response.json({ success: true, customer: dto });
  } catch (err) {
    console.error("save customer error:", err);
    return Response.json({ error: "Gagal menyimpan data pelanggan." }, { status: 500 });
  }
}
