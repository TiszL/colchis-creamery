import { SignJWT, jwtVerify } from "jose";

const TOKEN_EXPIRY = "7d";

/**
 * Resolve the HS256 key for session tokens. In production we REFUSE to fall
 * back to a hardcoded string — a known/committed secret would let anyone forge
 * a MASTER_ADMIN session that passes middleware + getSession. Fail loud
 * (Rule 12). Mirrors the ORDER_LOOKUP_SECRET handling in order-token.ts.
 */
export function getJwtSecret(): Uint8Array {
  const explicit = process.env.JWT_SECRET;
  if (explicit) return new TextEncoder().encode(explicit);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[auth] JWT_SECRET is required in production — refusing to sign/verify session tokens with a default key.",
    );
  }
  return new TextEncoder().encode("dev-secret-change-in-production");
}

export async function signToken(payload: {
  userId: string;
  role: string;
  email: string;
  name?: string;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getJwtSecret());
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as {
      userId: string;
      role: string;
      email: string;
      name?: string;
    };
  } catch {
    return null;
  }
}
