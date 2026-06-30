import { SignJWT, jwtVerify } from "jose";

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

export async function verifySession(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { uid: Number(payload.uid), email: String(payload.email) };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "session";
