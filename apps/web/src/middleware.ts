/**
 * Route protection middleware
 *
 * Protects /dashboard/* and /api/* routes, redirecting or rejecting
 * unauthenticated users.
 *
 * Auth is bypassed when:
 * - SKIP_AUTH=true (E2E tests)
 * - DATABASE_URL is not set (no DB to authenticate against)
 *
 * Public API routes (no auth required):
 * - /api/auth/* (login, signup, verify-email, forgot/reset password)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// API routes that don't require authentication
const PUBLIC_API_PREFIXES = ["/api/auth/"];

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function getSessionToken(request: NextRequest): string | undefined {
  return (
    request.cookies.get("authjs.session-token")?.value ??
    request.cookies.get("__Secure-authjs.session-token")?.value
  );
}

export function middleware(request: NextRequest) {
  // Skip auth when testing or when the database is unavailable
  if (
    process.env.SKIP_AUTH === "true" ||
    !process.env.DATABASE_URL
  ) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Public auth routes — always allow
  if (isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  const token = getSessionToken(request);

  // API routes — return 401 JSON instead of redirect
  if (pathname.startsWith("/api/")) {
    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // Dashboard pages — redirect to login
  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
