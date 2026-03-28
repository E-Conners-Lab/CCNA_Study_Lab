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

// ---------------------------------------------------------------------------
// Rate limiter for login endpoint (5 attempts per minute per IP)
// ---------------------------------------------------------------------------
const loginAttempts = new Map<string, { timestamps: number[] }>();

function checkLoginRateLimit(request: NextRequest): NextResponse | null {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const now = Date.now();
  const windowMs = 60_000;
  const max = 5;
  const cutoff = now - windowMs;

  let entry = loginAttempts.get(ip);
  if (!entry) {
    entry = { timestamps: [] };
    loginAttempts.set(ip, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= max) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  entry.timestamps.push(now);
  return null;
}

export function middleware(request: NextRequest) {
  // Skip auth when testing or when the database is unavailable
  if (process.env.SKIP_AUTH === "true") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SKIP_AUTH cannot be enabled in production");
    }
    return NextResponse.next();
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Rate limit login attempts (POST to credentials callback)
  if (
    pathname.startsWith("/api/auth/callback/credentials") &&
    request.method === "POST"
  ) {
    const limited = checkLoginRateLimit(request);
    if (limited) return limited;
  }

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
