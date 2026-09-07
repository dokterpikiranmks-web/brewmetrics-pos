"use client";

import React from "react";
import type { CartLine } from "@/lib/cart";
import type { OrderReceipt, StoreSettingDto, OrderType, DiscountType, PaymentBreakdownItem } from "@/lib/types";
import { formatIDR } from "@/lib/format";

export interface ReceiptPrintProps {
  orderNumber?: string;
  cashierName?: string;
  createdAt?: string | Date;
  lines?: CartLine[];
  receipt?: OrderReceipt | null;
  storeSettings?: StoreSettingDto | null;
  customerName?: string;
  customerPhone?: string;
  orderType?: OrderType;
  tableNumber?: string;
  subtotal?: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount?: number;
  serviceCharge?: number;
  tax?: number;
  total?: number;
  paymentMethod?: string;
  paymentBreakdown?: PaymentBreakdownItem[];
  tendered?: number;
  change?: number;
  paymentReference?: string;
  isCalibration?: boolean;
}

export default function ReceiptPrint({
  orderNumber,
  cashierName = "Kasir",
  createdAt = new Date(),
  lines = [],
  receipt,
  storeSettings,
  customerName = "Umum",
  customerPhone = "",
  orderType = "dine-in",
  tableNumber = "",
  subtotal,
  discountType,
  discountValue,
  discountAmount,
  serviceCharge,
  tax,
  total,
  paymentMethod,
  paymentBreakdown,
  tendered,
  change,
  paymentReference,
  isCalibration = false,
}: ReceiptPrintProps) {
  // Jika ada data receipt resmi dari transaksi tersimpan, prioritaskan data tersebut
  const isFinalReceipt = Boolean(receipt);

  // Ambil profil toko dari receipt atau props fallback ke default
  const settings = receipt?.storeSettings ?? storeSettings;
  const cafeName = settings?.cafeName ?? "BREWMETRICS Specialty Coffee";
  const address = settings?.address ?? "Jl. Pengayoman No. 12, Panakkukang, Makassar";
  const phone = settings?.phone ?? "0812-3456-7890";
  const paperSize = settings?.printerPaperSize ?? "58mm";
  const is58mm = paperSize === "58mm";
  const taxPct = settings?.taxPercentage ?? 10;
  const servicePct = settings?.serviceChargePercentage ?? 0;
  const footerMessage =
    settings?.receiptFooterMessage ??
    "Terima kasih atas kunjungan Anda!\nFollow IG kami @brewmetrics.coffee";

  const displayOrderNumber =
    receipt?.orderNumber ??
    orderNumber ??
    `DRAFT-${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;

  const displayCashier = receipt?.cashierName ?? cashierName;
  const displayCustomer = receipt?.customerName ?? customerName;
  const displayCustomerPhone = receipt?.customerPhone ?? customerPhone;
  const displayOrderType = receipt?.orderType ?? orderType;
  const displayTable = receipt?.tableNumber ?? tableNumber;

  const displayDate = receipt
    ? new Date(receipt.createdAt)
    : createdAt instanceof Date
      ? createdAt
      : new Date(createdAt);

  const formattedDate = displayDate.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const formattedTime = displayDate.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Normalisasi daftar item
  const displayItems = receipt
    ? receipt.items.map((it) => ({
        name: it.productName,
        variantName: it.variantName,
        qty: it.qty,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
        mods: it.modifiers ?? [],
      }))
    : lines.map((l) => ({
        name: l.name,
        variantName: l.variantName,
        qty: l.qty,
        unitPrice: l.unitPrice,
        totalPrice: l.unitPrice * l.qty,
        mods: l.mods ?? [],
      }));

  const calculatedSubtotal = displayItems.reduce((s, it) => s + it.totalPrice, 0);
  const displaySubtotal = receipt?.subtotal ?? subtotal ?? calculatedSubtotal;
  const displayDiscount = receipt?.discountAmount ?? discountAmount ?? 0;
  const subtotalAfterDiscount = Math.max(0, displaySubtotal - displayDiscount);

  const displayServiceCharge =
    receipt?.serviceCharge ??
    serviceCharge ??
    Math.round((subtotalAfterDiscount * Math.max(0, servicePct)) / 100);

  const displayTax =
    receipt?.tax ??
    tax ??
    Math.round(((subtotalAfterDiscount + displayServiceCharge) * Math.max(0, taxPct)) / 100);

  const displayTotal =
    receipt?.total ??
    total ??
    (subtotalAfterDiscount + displayServiceCharge + displayTax);

  const totalItemCount = displayItems.reduce((s, it) => s + it.qty, 0);

  const method = receipt?.paymentMethod ?? paymentMethod ?? (isFinalReceipt ? "cash" : null);
  const breakdownList: PaymentBreakdownItem[] =
    receipt?.paymentBreakdown && receipt.paymentBreakdown.length > 0
      ? receipt.paymentBreakdown
      : paymentBreakdown && paymentBreakdown.length > 0
        ? paymentBreakdown
        : [];

  const displayTendered = receipt?.tendered ?? tendered;
  const displayChange = receipt?.change ?? change;
  const displayRef = receipt?.paymentReference ?? paymentReference;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: ${is58mm ? "58mm" : "80mm"} auto;
                margin: 0mm !important;
              }
            }
          `,
        }}
      />

      {/* JIKA MODE KALIBRASI: TAMPILKAN STRUK DUMMY UJI PRESISI HARDWARE */}
      {isCalibration ? (
        <div
          id="thermal-receipt"
          className={`thermal-receipt hidden print:block text-black bg-white font-mono leading-tight mx-auto ${
            is58mm
              ? "thermal-receipt-58mm w-[48mm] max-w-[200px] text-[9px] p-1"
              : "thermal-receipt-80mm w-[72mm] max-w-[280px] text-[10.5px] p-2"
          }`}
          style={{
            color: "#000000",
            backgroundColor: "#ffffff",
            fontFamily: "'Courier New', Courier, monospace",
          }}
        >
          {/* Header Kalibrasi */}
          <div className="text-center pb-1">
            <p className="font-black tracking-widest text-[13px] uppercase">
              *** KALIBRASI PRINTER ***
            </p>
            <p className="font-bold text-[10.5px] mt-0.5">{cafeName}</p>
            <p className="text-[8.5px] text-gray-700">{address}</p>
            <div className="mt-1 inline-block border border-black px-1.5 py-0.5 font-bold text-[8.5px]">
              MODE: {is58mm ? "58MM (LEBAR 200px / 48mm)" : "80MM (LEBAR 280px / 72mm)"}
            </div>
          </div>

          <div className="border-b border-dashed border-black my-1" />

          {/* RULER PRESI ALIGNMENT TEPI KIRI - TEPI KANAN */}
          <div className="py-1 text-center font-bold text-[8px] tracking-tighter">
            <p className="uppercase text-[8.5px] mb-0.5">UJI PRESI BATAS TEPI (RULER)</p>
            <div className="border border-black px-0.5 py-0.5">
              {is58mm ? (
                <>
                  <p>|0mm......24mm......48mm|</p>
                  <p>[ 123456789012345678901234567890 ]</p>
                </>
              ) : (
                <>
                  <p>|0mm............36mm............72mm|</p>
                  <p>[ 1234567890123456789012345678901234567890 ]</p>
                </>
              )}
            </div>
            <p className="text-[7.5px] text-gray-600 mt-0.5">
              Pastikan tanda pagar "|" menyentuh batas kertas fisik tanpa terpotong.
            </p>
          </div>

          <div className="border-b border-dashed border-black my-1" />

          {/* TES TIPOGRAFI & KETAJAMAN FONT */}
          <div className="space-y-0.5 py-1 text-[8.5px]">
            <p className="font-bold uppercase text-[9px] mb-0.5">TES KETAJAMAN TEKS:</p>
            <p>Font Reguler: ABCDEF 1234567890</p>
            <p className="font-bold">Font Tebal (Bold): BREWMETRICS POS</p>
            <div className="bg-black text-white px-1 py-0.5 text-center font-bold text-[8px] my-1">
              *** BLOK HITAM PEKAT (INVERT TEST) ***
            </div>
          </div>

          <div className="border-b border-dashed border-black my-1" />

          {/* SIMULASI TRANSAKSI KALIBRASI */}
          <div className="py-1 space-y-1 text-[9px]">
            <p className="font-bold uppercase text-[8.5px]">SIMULASI TRANSAKSI DUMMY:</p>
            <div className="flex justify-between font-bold">
              <span>1x Kopi Uji Presisi (Hot)</span>
              <span>Rp 25.000</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>1x Croissant Kalibrasi</span>
              <span>Rp 28.000</span>
            </div>
            <div className="border-t border-dotted border-black pt-1 space-y-0.5">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>Rp 53.000</span>
              </div>
              <div className="flex justify-between">
                <span>PB1 Restoran (10%):</span>
                <span>Rp 5.300</span>
              </div>
              <div className="flex justify-between font-bold text-[10.5px] pt-0.5 border-t border-black">
                <span>TOTAL UJI:</span>
                <span>Rp 58.300</span>
              </div>
            </div>
          </div>

          <div className="border-b border-dashed border-black my-1" />

          {/* CHECKLIST KALIBRASI */}
          <div className="py-1 text-[8px] space-y-0.5">
            <p className="font-bold uppercase">CHECKLIST KUALITAS CETAK:</p>
            <p>[ ] Teks terbaca jelas &amp; tidak buram</p>
            <p>[ ] Tepi kiri &amp; kanan tidak terpotong</p>
            <p>[ ] Pengumpan kertas (feed) lancar</p>
          </div>

          <div className="border-b border-dashed border-black my-1.5" />

          {/* FOOTER & CUT MARKS */}
          <div className="text-center pt-1 pb-2 space-y-1 text-[8.5px]">
            <p className="font-bold">Waktu Uji: {formattedDate} {formattedTime}</p>
            <p className="text-[7.5px] text-gray-600">Hardware Calibration Pass • BrewMetrics POS</p>
            <div className="mt-2 text-[8px] tracking-widest font-mono">
              --- [ GUNTING / POTONG DISINI ] ---
            </div>
          </div>
        </div>
      ) : (
        /* MODE STANDAR: STRUK TRANSAKSI POS RESMI */
        <div
          id="thermal-receipt"
          className={`thermal-receipt hidden print:block text-black bg-white font-mono leading-tight mx-auto ${
            is58mm
              ? "thermal-receipt-58mm w-[48mm] max-w-[200px] text-[9.5px] p-1"
              : "thermal-receipt-80mm w-[72mm] max-w-[280px] text-[11px] p-2"
          }`}
          style={{
            color: "#000000",
            backgroundColor: "#ffffff",
            fontFamily: "'Courier New', Courier, monospace",
          }}
        >
          {/* --------------------------- HEADER TOKO --------------------------- */}
          <div className="text-center pb-1.5">
            <h1
              className={`font-black tracking-wider uppercase leading-tight ${
                is58mm ? "text-[12px]" : "text-[14px]"
              }`}
            >
              {cafeName}
            </h1>
            <p className="text-[9px] mt-1 text-gray-700 leading-tight">{address}</p>
            <p className="text-[8.5px] text-gray-700 mt-0.5">Telp: {phone}</p>
            <div className="inline-block mt-1 px-1.5 py-0.2 bg-gray-100 rounded text-[7.5px] text-gray-500 font-sans">
              Ukuran Kertas: {paperSize}
            </div>
          </div>

          <div className="border-b border-dashed border-black my-1" />

          {/* ------------------------- METADATA STRUK ------------------------- */}
          <div className="text-[9px] space-y-0.5 py-1">
            <div className="flex justify-between">
              <span>No. Struk:</span>
              <span className="font-bold">{displayOrderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Waktu:</span>
              <span>
                {formattedDate} {formattedTime}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Kasir:</span>
              <span className="capitalize">{displayCashier}</span>
            </div>
            <div className="flex justify-between">
              <span>Pelanggan:</span>
              <span className="font-bold">{displayCustomer}</span>
            </div>
            {displayCustomerPhone && (
              <div className="flex justify-between">
                <span>No. HP:</span>
                <span>{displayCustomerPhone}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Tipe / Meja:</span>
              <span className="uppercase font-bold">
                {displayOrderType === "take-away" ? "Take Away" : "Dine In"}
                {displayTable ? ` (Meja ${displayTable})` : ""}
              </span>
            </div>
          </div>

          <div className="border-b border-dashed border-black my-1" />

          {/* ------------------------- DAFTAR PESANAN ------------------------- */}
          <div className="py-1 space-y-1.5">
            {displayItems.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between font-bold text-[10.5px]">
                  <span className="truncate pr-2">
                    {item.name}
                    {item.variantName && ` (${item.variantName})`}
                  </span>
                  <span className="shrink-0">{formatIDR(item.totalPrice)}</span>
                </div>
                {item.mods && item.mods.length > 0 && (
                  <p className="text-[9px] text-gray-700 pl-2 italic">
                    + {item.mods.map((m) => m.name).join(", ")}
                  </p>
                )}
                <div className="text-[9.5px] text-gray-800 pl-2">
                  <span>
                    {item.qty} x {formatIDR(item.unitPrice)}
                  </span>
                </div>
              </div>
            ))}

            {displayItems.length === 0 && (
              <div className="text-center py-2 text-gray-500 italic text-[10px]">
                (Tidak ada item dalam pesanan)
              </div>
            )}
          </div>

          <div className="border-b border-dashed border-black my-1" />

          {/* ----------------------- RINGKASAN TAGIHAN ----------------------- */}
          <div className="space-y-1 py-1 text-[10px]">
            <div className="flex justify-between">
              <span>Total Item:</span>
              <span>{totalItemCount} item</span>
            </div>

            <div className="flex justify-between pt-0.5">
              <span>Subtotal:</span>
              <span>{formatIDR(displaySubtotal)}</span>
            </div>

            {displayDiscount > 0 && (
              <>
                <div className="flex justify-between text-gray-800">
                  <span>Diskon:</span>
                  <span>- {formatIDR(displayDiscount)}</span>
                </div>
                <div className="flex justify-between text-gray-800 font-medium">
                  <span>Subtotal Stlh Diskon:</span>
                  <span>{formatIDR(subtotalAfterDiscount)}</span>
                </div>
              </>
            )}

            {displayServiceCharge > 0 && (
              <div className="flex justify-between text-gray-800">
                <span>Biaya Layanan ({servicePct}%):</span>
                <span>{formatIDR(displayServiceCharge)}</span>
              </div>
            )}

            {displayTax > 0 && (
              <div className="flex justify-between text-gray-800">
                <span>Pajak Restoran (PB1 {taxPct}%):</span>
                <span>{formatIDR(displayTax)}</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-[12px] pt-1 border-t border-dotted border-black mt-1">
              <span>TOTAL:</span>
              <span>{formatIDR(displayTotal)}</span>
            </div>

            {method ? (
              <>
                {/* JIKA SPLIT PEMBAYARAN: TAMPILKAN RINCIAN PEMBAGIAN METODE BAYAR */}
                {method === "split" || breakdownList.length > 0 ? (
                  <div className="pt-1 space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>Metode Bayar:</span>
                      <span className="uppercase font-bold">SPLIT PEMBAYARAN</span>
                    </div>
                    <div className="pl-2 border-l-2 border-black/30 space-y-0.5 my-1">
                      {breakdownList.map((splitItem, sIdx) => {
                        const methodLabel =
                          splitItem.method === "cash"
                            ? "Tunai"
                            : splitItem.method === "qris"
                              ? "QRIS"
                              : splitItem.method === "transfer"
                                ? "Transfer Bank"
                                : "Debit";
                        return (
                          <div key={sIdx} className="flex justify-between text-[9px]">
                            <span>
                              • {methodLabel}
                              {splitItem.reference ? ` (${splitItem.reference})` : ""}:
                            </span>
                            <span className="font-semibold">{formatIDR(splitItem.amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                    {displayTendered !== undefined && (
                      <div className="flex justify-between pt-0.5">
                        <span>Total Diterima:</span>
                        <span>{formatIDR(displayTendered)}</span>
                      </div>
                    )}
                    {displayChange !== undefined && displayChange > 0 && (
                      <div className="flex justify-between font-bold">
                        <span>Kembalian:</span>
                        <span>{formatIDR(displayChange)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* METODE TUNGGAL */
                  <>
                    <div className="flex justify-between pt-1">
                      <span>Metode Bayar:</span>
                      <span className="uppercase font-bold">
                        {method === "cash"
                          ? "Tunai"
                          : method === "qris"
                            ? "QRIS"
                            : method === "transfer"
                              ? "Transfer Bank"
                              : "Debit"}
                      </span>
                    </div>
                    {method === "transfer" && displayRef && (
                      <div className="flex justify-between text-gray-700">
                        <span>Ref / Pengirim:</span>
                        <span className="font-bold">{displayRef}</span>
                      </div>
                    )}
                    {method === "cash" && displayTendered !== undefined && (
                      <>
                        <div className="flex justify-between">
                          <span>Tunai:</span>
                          <span>{formatIDR(displayTendered)}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span>Kembalian:</span>
                          <span>{formatIDR(displayChange ?? 0)}</span>
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="text-center py-1 mt-1 border border-black font-bold uppercase text-[9px]">
                *** BILL SEMENTARA (BELUM DIBAYAR) ***
              </div>
            )}
          </div>

          <div className="border-b border-dashed border-black my-1" />

          {/* ----------------------------- FOOTER ----------------------------- */}
          <div className="text-center pt-2 pb-2 space-y-1 text-[9px] text-gray-800">
            <p className="font-bold uppercase tracking-wider">
              {isFinalReceipt ? "*** LUNAS / TERIMA KASIH ***" : "*** STRUK PESANAN ***"}
            </p>
            <div className="whitespace-pre-line leading-relaxed text-gray-700">
              {footerMessage}
            </div>
            <p className="text-[8px] pt-1 text-gray-500">
              Powered by BrewMetrics POS System
            </p>
          </div>
        </div>
      )}
    </>
  );
}
