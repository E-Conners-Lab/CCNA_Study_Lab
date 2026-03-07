import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { isDbConfigured, getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { jsonOk, jsonBadRequest, jsonError } from "@/lib/api-helpers";
import { createRateLimiter } from "@/lib/rate-limit";
import { generateToken, hashToken, sendPasswordResetEmail } from "@/lib/email";

// 3 password reset requests per minute per IP
const resetLimiter = createRateLimiter({ windowMs: 60_000, max: 3 });

export async function POST(request: NextRequest) {
  const limited = resetLimiter.check(request);
  if (limited) return limited;

  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return jsonBadRequest("Email is required");
    }

    if (!isDbConfigured()) {
      return jsonError("Database is not configured", 503);
    }

    const db = getDb();

    // Always return success to prevent email enumeration
    const successResponse = jsonOk({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });

    // Check if user exists
    const [user] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      return successResponse;
    }

    // Delete any existing reset tokens for this email
    await db
      .delete(schema.verificationTokens)
      .where(eq(schema.verificationTokens.identifier, `reset:${email.toLowerCase()}`));

    // Create a new reset token (expires in 1 hour)
    const token = generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await db.insert(schema.verificationTokens).values({
      identifier: `reset:${email.toLowerCase()}`,
      token: hashToken(token),
      expires,
    });

    // Send the reset email (fire-and-forget in background)
    sendPasswordResetEmail(email.toLowerCase(), token).catch((err) =>
      console.error("Failed to send password reset email:", err),
    );

    return successResponse;
  } catch (err) {
    console.error("Forgot password error:", err);
    return jsonError("Something went wrong");
  }
}
