/**
 * Simple in-memory sliding-window rate limiter for API routes.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });
 *
 *   export async function POST(request: NextRequest) {
 *     const limited = limiter.check(request);
 *     if (limited) return limited;
 *     // ... handle request
 *   }
 */

import { NextRequest, NextResponse } from "next/server";

interface RateLimiterOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  max: number;
}

interface Entry {
  timestamps: number[];
}

export function createRateLimiter({ windowMs, max }: RateLimiterOptions) {
  const clients = new Map<string, Entry>();

  // Periodically clean up stale entries (every 60s)
  let lastCleanup = Date.now();

  function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < 60_000) return;
    lastCleanup = now;
    const cutoff = now - windowMs;
    for (const [key, entry] of clients) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0) clients.delete(key);
    }
  }

  function getClientKey(request: NextRequest): string {
    return (
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown"
    );
  }

  return {
    /**
     * Check if the request should be rate limited.
     * Returns a 429 Response if limited, or null if allowed.
     */
    check(request: NextRequest): NextResponse | null {
      cleanup();

      const key = getClientKey(request);
      const now = Date.now();
      const cutoff = now - windowMs;

      let entry = clients.get(key);
      if (!entry) {
        entry = { timestamps: [] };
        clients.set(key, entry);
      }

      // Remove timestamps outside the window
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

      if (entry.timestamps.length >= max) {
        const retryAfter = Math.ceil(
          (entry.timestamps[0] + windowMs - now) / 1000,
        );
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Limit": String(max),
              "X-RateLimit-Remaining": "0",
            },
          },
        );
      }

      entry.timestamps.push(now);
      return null;
    },
  };
}
