"use client";

import React from "react";
import type { CartLine } from "@/lib/cart";
import type { OrderReceipt, StoreSettingDto } from "@/lib/types";
import { formatIDR } from "@/lib/format";

export interface ReceiptPrintProps {
  orderNumber?: string;
  cashierName?: string;
  createdAt?: string | Date;
  lines?: CartLine[];
  receipt?: OrderReceipt | null;
  storeSettings?: StoreSettingDto | null;
  subtotal?: number;
  serviceCharge?: number;
  tax?: number;
  total?: number;
  paymentMethod?: string;
  tendered?: number;
  change?: number;
}

export default function ReceiptPrint({
  orderNumber,
  cashierName = "Kasir",
  createdAt = new Date(),
  lines = [],
  receipt,
  storeSettings,
  subtotal,
  serviceCharge,
  tax,
  total,
  paymentMethod,
  tendered,
  change,
}: ReceiptPrintProps) {
  // Jika ada data receipt resmi dari transaksi tersimpan, prioritaskan data tersebut
  const isFinalReceipt = Boolean(receipt);

  // Ambil profil toko dari receipt atau props fallback ke default
  const settings = receipt?.storeSettings ?? storeSettings;
  const cafeName = settings?.cafeName ?? "BREWMETRICS Specialty Coffee";
  const address = settings?.address ?? "Jl. Pengayoman No. 12, Panakkukang, Makassar";
  const phone = settings?.phone ?? "0812-3456-7890";
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
  const displayServiceCharge =
    receipt?.serviceCharge ??
    serviceCharge ??
    Math.round((displaySubtotal * Math.max(0, servicePct)) / 100);
  const displayTax =
    receipt?.tax ??
    tax ??
    Math.round(((displaySubtotal + displayServiceCharge) * Math.max(0, taxPct)) / 100);
  const displayTotal =
    receipt?.total ??
    total ??
    (displaySubtotal + displayServiceCharge + displayTax);

  const totalItemCount = displayItems.reduce((s, it) => s + it.qty, 0);

  const method = receipt?.paymentMethod ?? paymentMethod ?? (isFinalReceipt ? "cash" : null);
  const displayTendered = receipt?.tendered ?? tendered;
  const displayChange = receipt?.change ?? change;

  return (
    <div
      id="thermal-receipt"
      className="thermal-receipt hidden print:block text-black bg-white font-mono text-[11px] leading-tight w-[72mm] max-w-full p-2 mx-auto"
      style={{
        color: "#000000",
        backgroundColor: "#ffffff",
        fontFamily: "'Courier New', Courier, monospace",
      }}
    >
      {/* --------------------------- HEADER TOKO --------------------------- */}
      <div className="text-center pb-2">
        <h1 className="text-[14px] font-black tracking-wider uppercase leading-tight">{cafeName}</h1>
        <p className="text-[9.5px] mt-1 text-gray-700 leading-tight">{address}</p>
        <p className="text-[9px] text-gray-700 mt-0.5">Telp: {phone}</p>
      </div>

      <div className="border-b border-dashed border-black my-1" />

      {/* ------------------------- METADATA STRUK ------------------------- */}
      <div className="text-[9.5px] space-y-0.5 py-1">
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
            <div className="flex justify-between pt-1">
              <span>Metode Bayar:</span>
              <span className="uppercase font-bold">{method}</span>
            </div>
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
  );
}
