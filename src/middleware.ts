import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPos = pathname.startsWith("/pos");
  const isProtectedAdmin = ["/analytics", "/inventory", "/settings", "/products"].some(
    (route) => pathname.startsWith(route)
  );

  if (!isPos && !isProtectedAdmin) {
    return NextResponse.next();
  }

  const token = request.cookies.get("bm_session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    const [payloadB64] = token.split(".");
    if (!payloadB64) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const jsonStr = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const user = JSON.parse(jsonStr) as { id: number; name: string; role: string; exp?: number };

    // Cek kadaluarsa sesi
    if (user.exp && user.exp < Date.now()) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // 1. Proteksi Rute Kasir (/pos):
    // Halaman /pos HANYA boleh diakses oleh user dengan role 'cashier'.
    // Jika user dengan role 'owner' atau 'manager' mencoba mengakses /pos, lakukan redirect paksa langsung ke /analytics.
    if (isPos) {
      if (user.role !== "cashier") {
        return NextResponse.redirect(new URL("/analytics", request.url));
      }
      return NextResponse.next();
    }

    // 2. Proteksi Rute Manajemen Kafe:
    // Jika user dengan role 'cashier' mencoba mengakses /analytics, /inventory, /settings, atau /products, redirect ke /pos.
    if (user.role === "cashier") {
      return NextResponse.redirect(new URL("/pos", request.url));
    }
  } catch (err) {
    console.error("Middleware auth check failed:", err);
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/pos/:path*",
    "/analytics/:path*",
    "/inventory/:path*",
    "/settings/:path*",
    "/products/:path*",
  ],
};
