import { NextResponse } from "next/server";
import { getSession } from "@/backend/lib/auth/session";
import { queryOne, runStartupHealthChecks } from "@/backend/lib/db";
import { toUser, type UserRow } from "@/shared/types/user";

/**
 * GET /api/me
 * Return the current authenticated user's profile.
 */
export async function GET() {
  // Run startup health checks on first request (no-ops afterward)
  await runStartupHealthChecks();

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { data, error } = await queryOne<UserRow>(
      "SELECT id, lark_user_id, name, email, avatar_url, role, created_at, updated_at FROM users WHERE id = $1",
      [session.sub]
    );

    if (error || !data) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(toUser(data));
  } catch (error) {
    console.error("GET /api/me error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
