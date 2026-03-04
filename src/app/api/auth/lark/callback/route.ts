import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForToken } from "@/backend/lib/lark/oauth";
import { fetchLarkUserInfo } from "@/backend/lib/lark/user-info";
import { queryOne, execute } from "@/backend/lib/db";
import { setSession } from "@/backend/lib/auth/session";
import type { UserRole } from "@/shared/types/user";

/**
 * GET /api/auth/lark/callback
 * Handle Lark OAuth callback: exchange code, fetch user, upsert, issue session.
 * Role assignment:
 * - Existing users: keep their current DB role (managed by super_admin)
 * - First new user ever: super_admin (bootstrap)
 * - All other new users: agent (default, safest)
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    // Validate code
    if (!code) {
      return NextResponse.redirect(
        `${appUrl}/login?error=missing_code`
      );
    }

    // Validate CSRF state (timing-safe comparison)
    const cookieStore = await cookies();
    const storedState = cookieStore.get("lark_oauth_state")?.value;
    if (
      !storedState ||
      !state ||
      storedState.length !== state.length ||
      !crypto.timingSafeEqual(
        Buffer.from(storedState),
        Buffer.from(state)
      )
    ) {
      return NextResponse.redirect(
        `${appUrl}/login?error=invalid_state`
      );
    }

    // Clear the state cookie
    cookieStore.delete("lark_oauth_state");

    // Retrieve PKCE code_verifier
    const codeVerifier = cookieStore.get("lark_pkce_verifier")?.value;
    if (!codeVerifier) {
      return NextResponse.redirect(
        `${appUrl}/login?error=missing_pkce_verifier`
      );
    }
    cookieStore.delete("lark_pkce_verifier");

    // Exchange code for token (with PKCE)
    const tokenData = await exchangeCodeForToken(code, codeVerifier);

    // Fetch user info from Lark
    const larkUser = await fetchLarkUserInfo(tokenData.access_token);

    // Upsert user in PostgreSQL
    const { data: existingUser } = await queryOne<{
      id: string;
      role: string;
    }>(
      "SELECT id, role FROM users WHERE lark_user_id = $1",
      [larkUser.open_id]
    );

    let userId: string;
    let userRole: UserRole;

    if (existingUser) {
      // Update existing user — keep their admin-assigned role
      userId = existingUser.id;
      userRole = existingUser.role as UserRole;

      const { error: updateError } = await execute(
        `UPDATE users SET name = $1, email = $2, avatar_url = $3, updated_at = NOW()
         WHERE id = $4`,
        [
          larkUser.name || larkUser.en_name,
          larkUser.email || null,
          larkUser.avatar_url || null,
          userId,
        ]
      );

      if (updateError) {
        console.error("User update error:", updateError);
      }
    } else {
      // C-3 fix: Atomic first-user bootstrap — single INSERT statement
      // determines role based on existing user count, preventing TOCTOU race.
      const { data: newUser, error: insertError } = await queryOne<{
        id: string;
        role: string;
      }>(
        `INSERT INTO users (lark_user_id, name, email, avatar_url, role)
         VALUES (
           $1, $2, $3, $4,
           CASE WHEN (SELECT COUNT(*) FROM users) = 0 THEN 'super_admin' ELSE 'agent' END
         )
         RETURNING id, role`,
        [
          larkUser.open_id,
          larkUser.name || larkUser.en_name || "Unknown",
          larkUser.email || null,
          larkUser.avatar_url || null,
        ]
      );

      if (insertError || !newUser) {
        console.error("User insert error:", insertError);
        return NextResponse.redirect(
          `${appUrl}/login?error=user_creation_failed`
        );
      }

      userId = newUser.id;
      userRole = newUser.role as UserRole;
    }

    // Write audit log
    const { error: auditError } = await execute(
      `INSERT INTO audit_log (user_id, action, metadata) VALUES ($1, $2, $3)`,
      [userId, "login", JSON.stringify({ lark_open_id: larkUser.open_id })]
    );
    if (auditError) {
      console.error("Audit log insert error:", auditError);
    }

    // Issue JWT session
    await setSession({
      sub: userId,
      larkId: larkUser.open_id,
      role: userRole,
      name: larkUser.name || larkUser.en_name || "Unknown",
    });

    return NextResponse.redirect(`${appUrl}/`);
  } catch (error) {
    console.error("Lark OAuth callback error:", error);
    return NextResponse.redirect(
      `${appUrl}/login?error=auth_failed`
    );
  }
}
