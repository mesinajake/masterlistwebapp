import { NextRequest, NextResponse } from "next/server";
import { buildLarkAuthUrl } from "@/backend/lib/lark/oauth";
import { cookies } from "next/headers";

/**
 * GET /api/auth/lark
 * Initiate Lark OAuth flow with PKCE — redirects to Lark authorization page.
 * Role assignment is handled server-side in the callback (no user choice).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const { url, state, codeVerifier } = buildLarkAuthUrl();

    // Store CSRF state and PKCE verifier in short-lived cookies
    const cookieStore = await cookies();
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 600, // 10 minutes
    };

    cookieStore.set("lark_oauth_state", state, cookieOpts);
    cookieStore.set("lark_pkce_verifier", codeVerifier, cookieOpts);

    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Lark OAuth init error:", error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${appUrl}/login?error=oauth_init_failed`
    );
  }
}
