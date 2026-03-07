import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";

import { isDbConfigured, getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { jsonOk, jsonBadRequest, jsonError } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  try {
    const { token, email } = await request.json();

    if (!token || !email) {
      return jsonBadRequest("Token and email are required");
    }

    if (!isDbConfigured()) {
      return jsonError("Database is not configured", 503);
    }

    const db = getDb();

    // Look up the verification token
    const [record] = await db
      .select()
      .from(schema.verificationTokens)
      .where(
        and(
          eq(schema.verificationTokens.identifier, email.toLowerCase()),
          eq(schema.verificationTokens.token, token),
        ),
      )
      .limit(1);

    if (!record) {
      return jsonError("Invalid or expired verification link", 400);
    }

    // Check expiry
    if (record.expires < new Date()) {
      // Clean up expired token
      await db
        .delete(schema.verificationTokens)
        .where(
          and(
            eq(schema.verificationTokens.identifier, email.toLowerCase()),
            eq(schema.verificationTokens.token, token),
          ),
        );
      return jsonError("Verification link has expired. Please sign up again.", 400);
    }

    // Mark user as verified
    await db
      .update(schema.users)
      .set({ emailVerified: new Date() })
      .where(eq(schema.users.email, email.toLowerCase()));

    // Delete the used token
    await db
      .delete(schema.verificationTokens)
      .where(
        and(
          eq(schema.verificationTokens.identifier, email.toLowerCase()),
          eq(schema.verificationTokens.token, token),
        ),
      );

    return jsonOk({ success: true });
  } catch (err) {
    console.error("Email verification error:", err);
    return jsonError("Something went wrong");
  }
}
