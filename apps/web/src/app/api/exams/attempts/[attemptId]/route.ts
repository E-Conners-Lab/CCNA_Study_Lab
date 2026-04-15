import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth-helpers";
import { getExamAttemptDetail } from "@/lib/data";
import { jsonOk, jsonNotFound, jsonError } from "@/lib/api-helpers";

/**
 * GET /api/exams/attempts/[attemptId]
 *
 * Returns full detail for a past exam attempt, including per-question
 * results with the original question text, user answer, correct answer,
 * and explanation. Only returns data owned by the authenticated user.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return jsonError("Authentication required", 401);
    }

    const { attemptId } = await params;
    const detail = await getExamAttemptDetail(userId, attemptId);

    if (!detail) {
      return jsonNotFound("Exam attempt");
    }

    return jsonOk(detail);
  } catch (error) {
    console.error("Error loading exam attempt detail:", error);
    return jsonError("Failed to load attempt detail");
  }
}
