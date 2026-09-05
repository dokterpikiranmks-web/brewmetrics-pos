import { db } from "@/db";
import { categories } from "@/db/schema";
import { asc } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireRole(["cashier", "manager", "owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const list = await db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.id));

    return Response.json({ categories: list });
  } catch (err) {
    console.error("fetch categories error:", err);
    return Response.json({ error: "Gagal mengambil data kategori." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { error } = await requireRole(["manager", "owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const body = (await req.json()) as {
      name?: string;
      icon?: string;
      sortOrder?: number;
    };

    const name = (body.name ?? "").trim();
    if (!name) {
      return Response.json({ error: "Nama kategori wajib diisi." }, { status: 400 });
    }

    const icon = (body.icon ?? "Coffee").trim();
    const sortOrder = Number(body.sortOrder) || 1;

    const [created] = await db
      .insert(categories)
      .values({
        name,
        icon,
        sortOrder,
      })
      .returning();

    return Response.json({ category: created }, { status: 201 });
  } catch (err) {
    console.error("create category error:", err);
    return Response.json({ error: "Gagal membuat kategori baru." }, { status: 500 });
  }
}
