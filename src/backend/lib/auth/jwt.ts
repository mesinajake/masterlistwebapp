import { SignJWT, jwtVerify } from "jose";
import { JWT_EXPIRY_SECONDS } from "@/shared/utils/constants";
import type { UserRole } from "@/shared/types/user";

// ─── JWT Payload ──────────────────────────────────────

export interface AppJWTPayload {
  /** User UUID (primary key in users table) */
  sub: string;
  /** Lark user ID */
  larkId: string;
  /** User role */
  role: UserRole;
  /** Display name */
  name: string;
  /** Issued at (auto-set) */
  iat?: number;
  /** Expiry (auto-set) */
  exp?: number;
}

// ─── Helpers ──────────────────────────────────────────

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set");
  return new TextEncoder().encode(secret);
}

// ─── Sign ─────────────────────────────────────────────

/**
 * Create a signed JWT token.
 * @param payload – user info to embed in the token
 * @returns signed JWT string
 */
export async function signJWT(
  payload: Omit<AppJWTPayload, "iat" | "exp">
): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${JWT_EXPIRY_SECONDS}s`)
    .sign(getSecret());
}

// ─── Verify ───────────────────────────────────────────

/**
 * Verify and decode a JWT token.
 * @param token – JWT string from cookie
 * @returns decoded payload, or null if invalid/expired
 */
export async function verifyJWT(
  token: string
): Promise<AppJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as AppJWTPayload;
  } catch {
    return null;
  }
}
