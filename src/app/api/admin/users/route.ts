import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, isPayload } from "@/backend/lib/auth/middleware";
import { query, execute } from "@/backend/lib/db";
import type { UserRole } from "@/shared/types/user";
import { isValidUUID } from "@/shared/utils/validators";

const VALID_ROLES: UserRole[] = ["super_admin", "da", "agent"];

/** GET /api/admin/users — List all users (super_admin only) */
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!isPayload(auth)) return auth;

  const { data, error } = await query<{
    id: string;
    name: string;
    email: string | null;
    avatar_url: string | null;
    role: UserRole;
    created_at: string;
  }>(
    `SELECT id, name, email, avatar_url, role, created_at
     FROM users
     ORDER BY created_at ASC`
  );

  if (error) {
    console.error("[admin/users] GET error:", error.message);
    return NextResponse.json(
      { error: "DB_ERROR", message: "Failed to fetch users" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}

/** PATCH /api/admin/users — Change a user's role (super_admin only) */
export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!isPayload(auth)) return auth;

  let body: { userId?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "Invalid JSON in request body" },
      { status: 400 }
    );
  }
  const { userId, role } = body;

  if (!userId || !role) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "userId and role are required" },
      { status: 400 }
    );
  }

  // H-7 fix: Validate UUID format
  if (!isValidUUID(userId)) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "Invalid userId format" },
      { status: 400 }
    );
  }

  if (!VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json(
      { error: "INVALID_ROLE", message: `Role must be one of: ${VALID_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  // Cannot change your own role
  if (userId === auth.sub) {
    return NextResponse.json(
      { error: "SELF_CHANGE", message: "You cannot change your own role" },
      { status: 400 }
    );
  }

  const { error } = await execute(
    `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`,
    [role, userId]
  );

  if (error) {
    console.error("[admin/users] PATCH error:", error.message);
    return NextResponse.json(
      { error: "DB_ERROR", message: "Failed to update user role" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
