/**
 * Progress Data Access Layer
 *
 * CRUD operations for all user progress tables:
 * - flashcardProgress (SM-2 state)
 * - practiceAttempts + practiceAnswers (exam history)
 * - labAttempts (lab completion)
 * - studyProgress (objective checkboxes)
 *
 * All functions accept a userId. If userId is null or the DB is
 * unavailable, operations are silent no-ops so the UI never breaks.
 */

import { eq, and, desc } from "drizzle-orm";
import { isDbConfigured, getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dbAvailable(): boolean {
  return isDbConfigured();
}

// ---------------------------------------------------------------------------
// Flashcard Progress
// ---------------------------------------------------------------------------

export interface FlashcardProgressRecord {
  flashcardId: string;
  ease: number;
  interval: number;
  repetitions: number;
  nextReview: string; // ISO
  lastReview: string; // ISO
}

/**
 * Get all flashcard SM-2 progress for a user.
 * Returns a map keyed by flashcardId for easy client-side merge.
 */
export async function getFlashcardProgress(
  userId: string | null,
): Promise<Record<string, FlashcardProgressRecord>> {
  if (!userId || !dbAvailable()) return {};

  try {
    const db = getDb();
    const rows = await db
      .select({
        flashcardId: schema.flashcardProgress.flashcardId,
        ease: schema.flashcardProgress.ease,
        interval: schema.flashcardProgress.interval,
        repetitions: schema.flashcardProgress.repetitions,
        nextReview: schema.flashcardProgress.nextReview,
        lastReview: schema.flashcardProgress.lastReview,
      })
      .from(schema.flashcardProgress)
      .where(eq(schema.flashcardProgress.userId, userId));

    const map: Record<string, FlashcardProgressRecord> = {};
    for (const row of rows) {
      map[row.flashcardId] = {
        flashcardId: row.flashcardId,
        ease: row.ease,
        interval: row.interval,
        repetitions: row.repetitions,
        nextReview: row.nextReview?.toISOString() ?? new Date().toISOString(),
        lastReview: row.lastReview?.toISOString() ?? new Date().toISOString(),
      };
    }
    return map;
  } catch (err) {
    console.warn("Failed to load flashcard progress from DB:", err);
    return {};
  }
}

/**
 * Upsert a single flashcard's SM-2 progress for a user.
 */
export async function upsertFlashcardProgress(
  userId: string | null,
  data: {
    flashcardId: string;
    ease: number;
    interval: number;
    repetitions: number;
    nextReview: string;
    lastReview: string;
  },
): Promise<void> {
  if (!userId || !dbAvailable()) return;

  try {
    const db = getDb();

    // Atomic upsert — avoids race condition with concurrent requests
    await db
      .insert(schema.flashcardProgress)
      .values({
        userId,
        flashcardId: data.flashcardId,
        ease: data.ease,
        interval: data.interval,
        repetitions: data.repetitions,
        nextReview: new Date(data.nextReview),
        lastReview: new Date(data.lastReview),
      })
      .onConflictDoUpdate({
        target: [schema.flashcardProgress.userId, schema.flashcardProgress.flashcardId],
        set: {
          ease: data.ease,
          interval: data.interval,
          repetitions: data.repetitions,
          nextReview: new Date(data.nextReview),
          lastReview: new Date(data.lastReview),
        },
      });
  } catch (err) {
    console.warn("Failed to upsert flashcard progress:", err);
  }
}

// ---------------------------------------------------------------------------
// Exam Attempts
// ---------------------------------------------------------------------------

export interface ExamAttemptRecord {
  id: string;
  score: number;
  totalQuestions: number;
  domainFilter: string | null;
  startedAt: string;
  completedAt: string | null;
}

/**
 * Get all past exam attempts for a user, newest first.
 */
export async function getExamAttempts(
  userId: string | null,
): Promise<ExamAttemptRecord[]> {
  if (!userId || !dbAvailable()) return [];

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: schema.practiceAttempts.id,
        score: schema.practiceAttempts.score,
        totalQuestions: schema.practiceAttempts.totalQuestions,
        domainFilter: schema.practiceAttempts.domainFilter,
        startedAt: schema.practiceAttempts.startedAt,
        completedAt: schema.practiceAttempts.completedAt,
      })
      .from(schema.practiceAttempts)
      .where(eq(schema.practiceAttempts.userId, userId))
      .orderBy(desc(schema.practiceAttempts.startedAt))
      .limit(50);

    return rows.map((r) => ({
      id: r.id,
      score: r.score ?? 0,
      totalQuestions: r.totalQuestions ?? 0,
      domainFilter: r.domainFilter,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    }));
  } catch (err) {
    console.warn("Failed to load exam attempts from DB:", err);
    return [];
  }
}

/**
 * Save an exam attempt with individual answers.
 */
export async function saveExamAttempt(
  userId: string | null,
  data: {
    score: number;
    totalQuestions: number;
    domainFilter?: string;
    timeTakenSeconds: number;
    answers: Array<{
      questionId: string;
      userAnswer: unknown;
      isCorrect: boolean;
      timeSpent?: number;
    }>;
  },
): Promise<string | null> {
  if (!userId || !dbAvailable()) return null;

  try {
    const db = getDb();
    const now = new Date();
    const startedAt = new Date(now.getTime() - data.timeTakenSeconds * 1000);

    // Wrap in a transaction to prevent partial writes (attempt without answers)
    const attemptId = await db.transaction(async (tx) => {
      const [attempt] = await tx
        .insert(schema.practiceAttempts)
        .values({
          userId,
          score: data.score,
          totalQuestions: data.totalQuestions,
          domainFilter: data.domainFilter ?? null,
          startedAt,
          completedAt: now,
        })
        .returning({ id: schema.practiceAttempts.id });

      if (attempt && data.answers.length > 0) {
        await tx.insert(schema.practiceAnswers).values(
          data.answers.map((a) => ({
            attemptId: attempt.id,
            questionId: a.questionId,
            userAnswer: a.userAnswer,
            isCorrect: a.isCorrect,
            timeSpent: a.timeSpent ?? null,
          })),
        );
      }

      return attempt?.id ?? null;
    });

    return attemptId;
  } catch (err) {
    console.warn("Failed to save exam attempt:", err);
    return null;
  }
}

/**
 * Get full detail for a single exam attempt, including per-question results.
 * Joins practiceAnswers → practiceQuestions to rebuild the review data.
 */
export async function getExamAttemptDetail(
  userId: string,
  attemptId: string,
): Promise<{
  attempt: ExamAttemptRecord;
  questionResults: Array<{
    questionId: string;
    text: string;
    userAnswer: unknown;
    correctAnswer: unknown;
    correct: boolean;
    explanation: string | null;
    domain: string | null;
  }>;
} | null> {
  if (!dbAvailable()) return null;

  try {
    const db = getDb();

    // Verify the attempt belongs to this user
    const [attempt] = await db
      .select({
        id: schema.practiceAttempts.id,
        score: schema.practiceAttempts.score,
        totalQuestions: schema.practiceAttempts.totalQuestions,
        domainFilter: schema.practiceAttempts.domainFilter,
        startedAt: schema.practiceAttempts.startedAt,
        completedAt: schema.practiceAttempts.completedAt,
      })
      .from(schema.practiceAttempts)
      .where(
        and(
          eq(schema.practiceAttempts.id, attemptId),
          eq(schema.practiceAttempts.userId, userId),
        ),
      )
      .limit(1);

    if (!attempt) return null;

    // Fetch answers joined with questions and objectives/domains
    const answers = await db
      .select({
        questionId: schema.practiceAnswers.questionId,
        userAnswer: schema.practiceAnswers.userAnswer,
        isCorrect: schema.practiceAnswers.isCorrect,
        questionText: schema.practiceQuestions.question,
        correctAnswer: schema.practiceQuestions.correctAnswer,
        explanation: schema.practiceQuestions.explanation,
        objectiveId: schema.practiceQuestions.objectiveId,
      })
      .from(schema.practiceAnswers)
      .innerJoin(
        schema.practiceQuestions,
        eq(schema.practiceAnswers.questionId, schema.practiceQuestions.id),
      )
      .where(eq(schema.practiceAnswers.attemptId, attemptId));

    return {
      attempt: {
        id: attempt.id,
        score: attempt.score ?? 0,
        totalQuestions: attempt.totalQuestions ?? 0,
        domainFilter: attempt.domainFilter,
        startedAt: attempt.startedAt.toISOString(),
        completedAt: attempt.completedAt?.toISOString() ?? null,
      },
      questionResults: answers.map((a) => ({
        questionId: a.questionId,
        text: a.questionText,
        userAnswer: a.userAnswer,
        correctAnswer: a.correctAnswer,
        correct: a.isCorrect,
        explanation: a.explanation,
        domain: null, // domain name resolution is optional
      })),
    };
  } catch (err) {
    console.warn("Failed to load exam attempt detail:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Lab Attempts
// ---------------------------------------------------------------------------

export interface LabAttemptRecord {
  labSlug: string;
  status: "started" | "completed" | "failed";
  lastAttemptAt: string;
}

/**
 * Get all lab attempt statuses for a user.
 * Returns the most recent status per lab slug.
 */
export async function getLabAttempts(
  userId: string | null,
): Promise<Record<string, LabAttemptRecord>> {
  if (!userId || !dbAvailable()) return {};

  try {
    const db = getDb();
    const rows = await db
      .select({
        labId: schema.labAttempts.labId,
        status: schema.labAttempts.status,
        startedAt: schema.labAttempts.startedAt,
        completedAt: schema.labAttempts.completedAt,
        labSlug: schema.labs.slug,
      })
      .from(schema.labAttempts)
      .innerJoin(schema.labs, eq(schema.labAttempts.labId, schema.labs.id))
      .where(eq(schema.labAttempts.userId, userId))
      .orderBy(desc(schema.labAttempts.startedAt));

    // Keep only the latest attempt per lab slug
    const map: Record<string, LabAttemptRecord> = {};
    for (const row of rows) {
      if (!map[row.labSlug]) {
        map[row.labSlug] = {
          labSlug: row.labSlug,
          status: row.status,
          lastAttemptAt: (row.completedAt ?? row.startedAt).toISOString(),
        };
      }
    }
    return map;
  } catch (err) {
    console.warn("Failed to load lab attempts from DB:", err);
    return {};
  }
}

/**
 * Save or update a lab attempt.
 */
export async function saveLabAttempt(
  userId: string | null,
  labSlug: string,
  status: "started" | "completed" | "failed",
  userCode?: string,
): Promise<void> {
  if (!userId || !dbAvailable()) return;

  try {
    const db = getDb();

    // Look up lab id from slug
    const [lab] = await db
      .select({ id: schema.labs.id })
      .from(schema.labs)
      .where(eq(schema.labs.slug, labSlug))
      .limit(1);

    if (!lab) return;

    await db.insert(schema.labAttempts).values({
      userId,
      labId: lab.id,
      status,
      userCode: userCode ?? null,
      completedAt: status === "completed" ? new Date() : null,
    });
  } catch (err) {
    console.warn("Failed to save lab attempt:", err);
  }
}

// ---------------------------------------------------------------------------
// Study Progress (objective checkboxes)
// ---------------------------------------------------------------------------

/**
 * Get completed objective codes for a user.
 * Returns a Set of objective codes like "1.1", "2.3", etc.
 */
export async function getStudyProgress(
  userId: string | null,
): Promise<string[]> {
  if (!userId || !dbAvailable()) return [];

  try {
    const db = getDb();
    const rows = await db
      .select({
        code: schema.objectives.code,
      })
      .from(schema.studyProgress)
      .innerJoin(
        schema.objectives,
        eq(schema.studyProgress.objectiveId, schema.objectives.id),
      )
      .where(eq(schema.studyProgress.userId, userId));

    return rows.map((r) => r.code);
  } catch (err) {
    console.warn("Failed to load study progress from DB:", err);
    return [];
  }
}

/**
 * Toggle an objective's completion status.
 * If completed=true, inserts a row. If false, deletes it.
 */
export async function saveStudyObjective(
  userId: string | null,
  objectiveCode: string,
  completed: boolean,
): Promise<void> {
  if (!userId || !dbAvailable()) return;

  try {
    const db = getDb();

    // Look up objective by code
    const [objective] = await db
      .select({
        id: schema.objectives.id,
        domainId: schema.objectives.domainId,
      })
      .from(schema.objectives)
      .where(eq(schema.objectives.code, objectiveCode))
      .limit(1);

    if (!objective) return;

    if (completed) {
      // Atomic upsert — avoids race condition with concurrent requests
      await db
        .insert(schema.studyProgress)
        .values({
          userId,
          domainId: objective.domainId,
          objectiveId: objective.id,
          completedAt: new Date(),
        })
        .onConflictDoNothing();
    } else {
      // Delete the row
      await db
        .delete(schema.studyProgress)
        .where(
          and(
            eq(schema.studyProgress.userId, userId),
            eq(schema.studyProgress.objectiveId, objective.id),
          ),
        );
    }
  } catch (err) {
    console.warn("Failed to save study objective:", err);
  }
}
