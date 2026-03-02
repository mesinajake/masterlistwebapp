import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/backend/lib/auth/jwt";
import { SESSION_COOKIE_NAME } from "@/shared/utils/constants";

const PUBLIC_PATHS = ["/login", "/api/auth/lark", "/api/auth/lark/callback"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  const STATIC_EXTENSIONS = /\.(css|js|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|map)$/;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    STATIC_EXTENSIONS.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    // API routes return 401, pages redirect to login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Verify JWT
  try {
    const payload = await verifyJWT(token);

    if (!payload) {
      throw new Error("Invalid token");
    }

    // Admin-only page routes (super_admin only)
    const ADMIN_PATHS = ["/admin"];
    if (ADMIN_PATHS.some((p) => pathname.startsWith(p)) && payload.role !== "super_admin") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "FORBIDDEN", message: "Super Admin role required" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/", request.url));
    }

    // DA-only page routes (DA and super_admin can access)
    const DA_PATHS = ["/upload", "/settings"];
    if (DA_PATHS.some((p) => pathname.startsWith(p)) && payload.role !== "da" && payload.role !== "super_admin") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "FORBIDDEN", message: "DA role required" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Pass user info in headers for server components
    const response = NextResponse.next();
    response.headers.set("x-user-id", payload.sub);
    response.headers.set("x-user-role", payload.role);
    return response;
  } catch {
    // Invalid token — clear cookie and redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Invalid session" },
        { status: 401 }
      );
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
