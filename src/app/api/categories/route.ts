import { db } from "@/db";
import { categories } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { user, error } = await requireRole(["cashier", "manager", "owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const url = new URL(req.url);
    const headerOutlet = req.headers.get("x-outlet-id");
    const outletParam = url.searchParams.get("outlet_id") ?? url.searchParams.get("outletId") ?? headerOutlet;
    const role = user?.role ?? (req.headers.get("x-user-role") as any);

    // Tangkap userOutletId dari token sesi user atau default 1
    const userOutletId = user?.outletId ?? 1;

    let targetOutletId: number | null = null;

    if (role === "cashier") {
      // STRICT OUTLET ISOLATION:
      // Jika role === 'cashier', paksa kueri Drizzle untuk SELALU memfilter categories.outletId = userOutletId.
      // Kasir DILARANG dan TIDAK BISA melakukan bypass (parameter outletParam diabaikan).
      targetOutletId = userOutletId;
    } else {
      // Role 'owner', 'manager', atau 'admin'
      if (outletParam && outletParam !== "all") {
        const parsed = Number(outletParam);
        if (!isNaN(parsed)) {
          targetOutletId = parsed;
        }
      } else if (outletParam === "all") {
        // Jika role === 'owner' atau 'admin', dan outlet_id === 'all', tampilkan semua kategori
        targetOutletId = null;
      } else {
        // Default untuk owner/manager jika tidak ada parameter spesifik: tampilkan semua
        targetOutletId = null;
      }
    }

    const whereClause = targetOutletId !== null ? eq(categories.outletId, targetOutletId) : undefined;

    const list = await db
      .select()
      .from(categories)
      .where(whereClause)
      .orderBy(asc(categories.sortOrder), asc(categories.id));

    return Response.json({ categories: list });
  } catch (err) {
    console.error("fetch categories error:", err);
    return Response.json({ error: "Gagal mengambil data kategori." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { user, error } = await requireRole(["manager", "owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const body = (await req.json()) as {
      name?: string;
      icon?: string;
      sortOrder?: number;
      outletId?: number | null;
      outlet_id?: number | null;
    };

    const name = (body.name ?? "").trim();
    if (!name) {
      return Response.json({ error: "Nama kategori wajib diisi." }, { status: 400 });
    }

    const icon = (body.icon ?? "Coffee").trim();
    const sortOrder = Number(body.sortOrder) || 1;

    const rawOutletId = body.outletId ?? body.outlet_id;
    const outletId =
      rawOutletId !== undefined && rawOutletId !== null && !isNaN(Number(rawOutletId))
        ? Number(rawOutletId)
        : (user?.outletId ?? 1);

    const [created] = await db
      .insert(categories)
      .values({
        name,
        icon,
        sortOrder,
        outletId,
      })
      .returning();

    return Response.json({ category: created }, { status: 201 });
  } catch (err) {
    console.error("create category error:", err);
    return Response.json({ error: "Gagal membuat kategori baru." }, { status: 500 });
  }
}
