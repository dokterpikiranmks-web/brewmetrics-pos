import { requireRole } from "@/lib/auth";
import { getOrderReceiptById } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["cashier", "manager", "owner"]);
  if (error) return error;

  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId) || orderId <= 0) {
      return Response.json({ error: "ID pesanan tidak valid." }, { status: 400 });
    }

    const receipt = await getOrderReceiptById(orderId);
    if (!receipt) {
      return Response.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    }

    return Response.json({ receipt });
  } catch (err) {
    console.error("fetch order receipt error:", err);
    return Response.json({ error: "Gagal mengambil rincian struk pesanan." }, { status: 500 });
  }
}
