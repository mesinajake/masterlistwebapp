import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/backend/lib/auth/session";
import { execute } from "@/backend/lib/db";

/**
 * POST /api/auth/logout
 * Clear session cookie and log audit entry.
 */
export async function POST() {
  try {
    const session = await getSession();

    if (session) {
      // Write audit log
      const { error: auditError } = await execute(
        `INSERT INTO audit_log (user_id, action) VALUES ($1, $2)`,
        [session.sub, "logout"]
      );
      if (auditError) {
        console.error("Logout audit log error:", auditError);
      }
    }

    await clearSession();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    await clearSession();
    return NextResponse.json({ success: true });
  }
}
