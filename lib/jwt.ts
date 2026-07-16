import { SignJWT, jwtVerify } from "jose";
import { sql } from "@/lib/db";

const secret = () =>
  new TextEncoder().encode(process.env.AUTH_SECRET || "dev-insecure-secret");

export type SessionPayload = { uid: number; email: string };

export async function signSession(payload: SessionPayload): Promise<string> {
  return await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

async function sessionEpoch(): Promise<number> {
  try {
    const rows = await sql`select value from app_config where key = 'session_epoch' limit 1`;
    if ((rows as any[]).length) return Number((rows as any[])[0].value) || 0;
  } catch {}
  return 0;
}

export async function verifySession(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const iat = Number(payload.iat || 0);
    const epoch = await sessionEpoch();
    if (epoch && iat && iat < epoch) return null;
    return { uid: Number(payload.uid), email: String(payload.email) };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "session";
