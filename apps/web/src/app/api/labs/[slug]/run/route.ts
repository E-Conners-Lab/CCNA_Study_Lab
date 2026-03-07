import { NextRequest } from "next/server";
import { getLabForRun, saveLabAttempt } from "@/lib/data";
import { getCurrentUserId } from "@/lib/auth-helpers";
import { jsonOk, jsonNotFound, jsonBadRequest, jsonError } from "@/lib/api-helpers";
import { createRateLimiter } from "@/lib/rate-limit";

// 30 lab runs per minute per IP
const labRunLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

// Max code submission size (100KB)
const MAX_CODE_LENGTH = 100_000;

// ---------------------------------------------------------------------------
// POST /api/labs/[slug]/run
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const limited = labRunLimiter.check(request);
  if (limited) return limited;

  try {
    const { slug } = await params;
    const lab = getLabForRun(slug);

    if (!lab) {
      return jsonNotFound(`Lab "${slug}"`);
    }

    // Parse and validate request body
    let body: { code: string; iosValidation?: { score: number; status: string } };
    try {
      body = await request.json();
    } catch {
      return jsonBadRequest("Invalid JSON in request body");
    }

    const { code, iosValidation } = body;

    if (!code || typeof code !== "string") {
      return jsonBadRequest('"code" string is required');
    }

    if (code.length > MAX_CODE_LENGTH) {
      return jsonBadRequest(`Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`);
    }

    // IOS CLI labs validated client-side — record the attempt
    // Note: iosValidation scores are informational; the client-side IOS
    // simulator handles validation. Server records attempts for progress.
    if (iosValidation && lab.type === "ios-cli") {
      const userId = await getCurrentUserId();
      if (userId) {
        const status = iosValidation.score === 100 ? "completed" : "started";
        saveLabAttempt(userId, slug, status, code).catch((err) =>
          console.warn("Background lab attempt save failed:", err),
        );
      }
      return jsonOk({
        success: iosValidation.score === 100,
        output: `IOS CLI validation: ${iosValidation.score}%`,
        executionTime: 0,
        engineAvailable: false,
      });
    }

    // Proxy to the Docker lab engine (required for code execution)
    const LAB_ENGINE_URL = process.env.LAB_ENGINE_URL;

    if (LAB_ENGINE_URL) {
      try {
        const engineResponse = await fetch(LAB_ENGINE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.LAB_ENGINE_API_KEY
              ? { Authorization: `Bearer ${process.env.LAB_ENGINE_API_KEY}` }
              : {}),
          },
          body: JSON.stringify({
            code,
            language: lab.type,
            slug,
          }),
          signal: AbortSignal.timeout(30000),
        });

        const engineData = await engineResponse.json();

        // Fire-and-forget: save lab attempt to DB
        const userId = await getCurrentUserId();
        if (userId) {
          const status = engineResponse.ok ? "completed" : "failed";
          saveLabAttempt(userId, slug, status, code).catch((err) =>
            console.warn("Background lab attempt save failed:", err),
          );
        }

        return jsonOk({
          success: engineResponse.ok,
          output: engineData.output ?? engineData.error ?? "No output",
          executionTime: engineData.executionTime ?? 0,
          engineAvailable: true,
        });
      } catch {
        return jsonOk({
          success: false,
          output: "The lab engine is not responding. Please try again later or check that Docker services are running.",
          executionTime: 0,
          engineAvailable: false,
        });
      }
    }

    // Text-based labs (IOS CLI, subnetting, config review, ACL): record attempt
    const userId = await getCurrentUserId();
    if (userId) {
      saveLabAttempt(userId, slug, "started", code).catch((err) =>
        console.warn("Background lab attempt save failed:", err),
      );
    }

    return jsonOk({
      success: true,
      output:
        "Code execution requires the Docker lab engine. Set LAB_ENGINE_URL in .env.local and start Docker services.\n\n" +
        "Run: docker compose -f docker/docker-compose.yml up -d",
      executionTime: 0,
      engineAvailable: false,
    });
  } catch (error) {
    console.error("Error running lab code:", error);
    return jsonError("Failed to run code");
  }
}
