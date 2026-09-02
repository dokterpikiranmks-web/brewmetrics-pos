import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { SessionUser, Role } from "./types";

const COOKIE_NAME = "bm_session";
const SECRET = process.env.SESSION_SECRET || "brewmetrics-local-dev-secret";
const MAX_AGE = 60 * 60 * 14; // 14 jam shift

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createSessionToken(user: SessionUser): string {
  const payload = b64url(JSON.stringify({ ...user, exp: Date.now() + MAX_AGE * 1000 }));
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionUser & { exp: number };
    if (!data.exp || data.exp < Date.now()) return null;
    return { id: data.id, name: data.name, role: data.role };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(COOKIE_NAME)?.value);
}

/** Returns the session user or null; API routes handle the 401 themselves. */
export async function requireRole(roles: Role[]): Promise<{ user: SessionUser | null; error: Response | null }> {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, error: Response.json({ error: "Belum masuk. Silakan login PIN." }, { status: 401 }) };
  }
  if (!roles.includes(user.role)) {
    return { user: null, error: Response.json({ error: "Akses ditolak untuk peran ini." }, { status: 403 }) };
  }
  return { user, error: null };
}
