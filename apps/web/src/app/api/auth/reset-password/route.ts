import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";

import { isDbConfigured, getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { jsonOk, jsonBadRequest, jsonError } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  try {
    const { token, email, password } = await request.json();

    if (!token || !email || !password) {
      return jsonBadRequest("Token, email, and new password are required");
    }

    if (typeof password !== "string" || password.length < 8) {
      return jsonBadRequest("Password must be at least 8 characters");
    }

    if (!isDbConfigured()) {
      return jsonError("Database is not configured", 503);
    }

    const db = getDb();
    const identifier = `reset:${email.toLowerCase()}`;

    // Look up the reset token
    const [record] = await db
      .select()
      .from(schema.verificationTokens)
      .where(
        and(
          eq(schema.verificationTokens.identifier, identifier),
          eq(schema.verificationTokens.token, token),
        ),
      )
      .limit(1);

    if (!record) {
      return jsonError("Invalid or expired reset link", 400);
    }

    if (record.expires < new Date()) {
      await db
        .delete(schema.verificationTokens)
        .where(
          and(
            eq(schema.verificationTokens.identifier, identifier),
            eq(schema.verificationTokens.token, token),
          ),
        );
      return jsonError("Reset link has expired. Please request a new one.", 400);
    }

    // Update the password
    const hashedPassword = await bcrypt.hash(password, 12);

    await db
      .update(schema.users)
      .set({ hashedPassword })
      .where(eq(schema.users.email, email.toLowerCase()));

    // Delete the used token
    await db
      .delete(schema.verificationTokens)
      .where(
        and(
          eq(schema.verificationTokens.identifier, identifier),
          eq(schema.verificationTokens.token, token),
        ),
      );

    return jsonOk({ success: true });
  } catch (err) {
    console.error("Reset password error:", err);
    return jsonError("Something went wrong");
  }
}
