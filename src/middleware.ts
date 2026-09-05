import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/analytics", "/inventory", "/settings", "/products"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  if (!isProtected) {
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

    // RBAC: Jika role adalah cashier, redirect otomatis ke /pos
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
    "/analytics/:path*",
    "/inventory/:path*",
    "/settings/:path*",
    "/products/:path*",
  ],
};
