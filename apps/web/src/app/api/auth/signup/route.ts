import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import { isDbConfigured, getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { jsonOk, jsonBadRequest, jsonError } from "@/lib/api-helpers";
import { createRateLimiter } from "@/lib/rate-limit";
import { generateToken, hashToken, sendVerificationEmail } from "@/lib/email";
import { auditLog, getClientIp } from "@/lib/audit-log";

// 5 signup attempts per minute per IP
const signupLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

export async function POST(request: NextRequest) {
  const limited = signupLimiter.check(request);
  if (limited) return limited;
  try {
    const { name, email, password } = await request.json();

    // Validate required fields
    if (!name || typeof name !== "string" || !name.trim()) {
      return jsonBadRequest("Name is required");
    }

    if (!email || typeof email !== "string") {
      return jsonBadRequest("Valid email is required");
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return jsonBadRequest("Invalid email format");
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return jsonBadRequest("Password must be at least 8 characters");
    }

    if (!isDbConfigured()) {
      return jsonError("Database is not configured", 503);
    }

    const db = getDb();

    // Check for existing email
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      // Return 201 with same response to prevent email enumeration.
      // The user won't receive a verification email if already registered.
      return jsonOk({ success: true }, 201);
    }

    // Hash password and insert user
    const hashedPassword = await bcrypt.hash(password, 12);

    await db.insert(schema.users).values({
      name: name.trim(),
      email: email.toLowerCase(),
      hashedPassword,
    });

    // Send verification email (fire-and-forget)
    const token = generateToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    db.insert(schema.verificationTokens)
      .values({
        identifier: email.toLowerCase(),
        token: hashToken(token),
        expires,
      })
      .then(() => sendVerificationEmail(email.toLowerCase(), token))
      .catch((err) => console.error("Failed to send verification email:", err));

    auditLog({ event: "SIGNUP", email: email.toLowerCase(), ip: getClientIp(request) });
    return jsonOk({ success: true }, 201);
  } catch (err) {
    console.error("Signup error:", err);
    return jsonError("Something went wrong");
  }
}
