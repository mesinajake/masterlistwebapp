import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, type AppJWTPayload } from "./jwt";
import { SESSION_COOKIE_NAME } from "@/shared/utils/constants";
import {
  UnauthorizedError,
  ForbiddenError,
  errorToResponse,
} from "@/backend/lib/utils/errors";

/**
 * Extract and verify the session from a Next.js API request.
 * @returns verified JWT payload
 * @throws returns a 401 NextResponse if session is missing or invalid
 */
export async function requireAuth(
  request: NextRequest
): Promise<AppJWTPayload | NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json(
      errorToResponse(new UnauthorizedError("Authentication required")),
      { status: 401 }
    );
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json(
      errorToResponse(new UnauthorizedError("Invalid or expired session")),
      { status: 401 }
    );
  }

  return payload;
}

/**
 * Require the user to have DA or Super Admin role.
 * Super Admin inherits all DA permissions.
 * @returns verified JWT payload
 * @throws returns a 403 NextResponse if user is not DA or Super Admin
 */
export async function requireDA(
  request: NextRequest
): Promise<AppJWTPayload | NextResponse> {
  const result = await requireAuth(request);
  if (result instanceof NextResponse) return result;

  if (result.role !== "da" && result.role !== "super_admin") {
    return NextResponse.json(
      errorToResponse(new ForbiddenError("DA role required")),
      { status: 403 }
    );
  }

  return result;
}

/**
 * Require the user to have Super Admin role.
 * @returns verified JWT payload
 * @throws returns a 403 NextResponse if user is not Super Admin
 */
export async function requireSuperAdmin(
  request: NextRequest
): Promise<AppJWTPayload | NextResponse> {
  const result = await requireAuth(request);
  if (result instanceof NextResponse) return result;

  if (result.role !== "super_admin") {
    return NextResponse.json(
      errorToResponse(new ForbiddenError("Super Admin role required")),
      { status: 403 }
    );
  }

  return result;
}

/** Type guard: check if requireAuth returned a payload (not a response) */
export function isPayload(
  result: AppJWTPayload | NextResponse
): result is AppJWTPayload {
  return !(result instanceof NextResponse);
}
