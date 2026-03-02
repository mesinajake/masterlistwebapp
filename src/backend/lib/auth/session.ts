import "server-only";

import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, JWT_EXPIRY_SECONDS } from "@/shared/utils/constants";
import { signJWT, verifyJWT, type AppJWTPayload } from "./jwt";

// ─── Set Session ──────────────────────────────────────────

/**
 * Create a JWT and store it in an httpOnly cookie.
 */
export async function setSession(
  payload: Omit<AppJWTPayload, "iat" | "exp">
): Promise<void> {
  const token = await signJWT(payload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: JWT_EXPIRY_SECONDS,
  });
}

// ─── Get Session ──────────────────────────────────────

/**
 * Read and verify the session cookie.
 * @returns JWT payload if valid, null otherwise
 */
export async function getSession(): Promise<AppJWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyJWT(token);
}

// ─── Clear Session ────────────────────────────────────

/**
 * Delete the session cookie.
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
