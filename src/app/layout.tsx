import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BrewMetrics — POS & Analytics",
  description:
    "Sistem kasir F&B tanpa langganan: POS cepat, resep Bill of Materials, stok bahan presisi gram/ml, dan AI sales forecasting.",
};

export const viewport: Viewport = {
  themeColor: "#0b0a08",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={`${jakarta.variable} ${grotesk.variable}`}>
      <body className="bg-coal text-cream antialiased min-h-dvh">{children}</body>
    </html>
  );
}
