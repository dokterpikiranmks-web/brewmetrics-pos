import { db } from "@/db";
import { storeSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import type { StoreSettingDto } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();

  try {
    const rows = await db.select().from(storeSettings).limit(1);
    let current = rows[0];

    if (!current) {
      const [inserted] = await db
        .insert(storeSettings)
        .values({
          id: 1,
          cafeName: "BREWMETRICS Specialty Coffee",
          logoUrl: "",
          address: "Jl. Metro Tanjung Bunga No. 8, Makassar",
          phone: "0812-4455-6677",
          taxPercentage: 10,
          serviceChargePercentage: 0,
          receiptFooterMessage:
            "Terima kasih atas kunjungan Anda!\nFollow IG: @brewmetrics.coffee",
        })
        .returning();
      current = inserted;
    }

    const dto: StoreSettingDto = {
      id: current.id,
      cafeName: current.cafeName,
      logoUrl: current.logoUrl,
      address: current.address,
      phone: current.phone,
      taxPercentage: Number(current.taxPercentage),
      serviceChargePercentage: Number(current.serviceChargePercentage),
      receiptFooterMessage: current.receiptFooterMessage,
      updatedAt: current.updatedAt?.toISOString(),
    };

    return Response.json({ settings: dto });
  } catch (err) {
    console.error("fetch settings error:", err);
    return Response.json({ error: "Gagal mengambil data pengaturan kafe." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const { error } = await requireRole(["manager", "owner"]);
  if (error) return error;

  await ensureSeeded();

  try {
    const body = (await req.json()) as Partial<StoreSettingDto>;

    const cafeName = (body.cafeName ?? "").trim();
    if (!cafeName) {
      return Response.json({ error: "Nama kafe wajib diisi." }, { status: 400 });
    }

    const address = (body.address ?? "").trim();
    const phone = (body.phone ?? "").trim();
    const logoUrl = (body.logoUrl ?? "").trim();
    const receiptFooterMessage = (body.receiptFooterMessage ?? "").trim();
    const taxPercentage = Math.max(0, Math.min(100, Number(body.taxPercentage) || 0));
    const serviceChargePercentage = Math.max(
      0,
      Math.min(100, Number(body.serviceChargePercentage) || 0)
    );

    const existing = await db.select({ id: storeSettings.id }).from(storeSettings).limit(1);

    let updated;
    if (existing.length > 0) {
      const [u] = await db
        .update(storeSettings)
        .set({
          cafeName,
          logoUrl,
          address,
          phone,
          taxPercentage,
          serviceChargePercentage,
          receiptFooterMessage,
          updatedAt: new Date(),
        })
        .where(eq(storeSettings.id, existing[0].id))
        .returning();
      updated = u;
    } else {
      const [i] = await db
        .insert(storeSettings)
        .values({
          id: 1,
          cafeName,
          logoUrl,
          address,
          phone,
          taxPercentage,
          serviceChargePercentage,
          receiptFooterMessage,
        })
        .returning();
      updated = i;
    }

    const dto: StoreSettingDto = {
      id: updated.id,
      cafeName: updated.cafeName,
      logoUrl: updated.logoUrl,
      address: updated.address,
      phone: updated.phone,
      taxPercentage: Number(updated.taxPercentage),
      serviceChargePercentage: Number(updated.serviceChargePercentage),
      receiptFooterMessage: updated.receiptFooterMessage,
      updatedAt: updated.updatedAt?.toISOString(),
    };

    return Response.json({ success: true, settings: dto });
  } catch (err) {
    console.error("update settings error:", err);
    return Response.json({ error: "Gagal menyimpan pengaturan kafe." }, { status: 500 });
  }
}
