import { SignJWT, jwtVerify } from "jose";

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production"
);

const TOKEN_EXPIRY = "7d";

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
    .sign(SECRET_KEY);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
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
