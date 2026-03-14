/**
 * Dashboard Data Access Layer
 *
 * Aggregates user progress across all tables to produce the dashboard
 * statistics. When the DB is unavailable, returns null so the page
 * can fall back to hardcoded defaults.
 */

import { eq, desc, count, max, gt, and as dbAnd, sql } from "drizzle-orm";
import { isDbConfigured, getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardDomainStats {
  number: number;
  name: string;
  slug: string;
  weight: number;
  progress: number;
  stats: {
    objectivesCompleted: number;
    objectivesTotal: number;
    flashcardsDue: number;
    labsDone: number;
    labsTotal: number;
  };
}

export interface DashboardStats {
  domains: DashboardDomainStats[];
  overallProgress: number;
  bestExamScore: number;
  totalExamAttempts: number;
  studyStreak: number;
  recentActivity: Array<{
    type: "study" | "lab" | "exam" | "flashcard";
    text: string;
    time: string;
  }>;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/**
 * Fetch full dashboard stats for a user.
 * Returns null if DB is unavailable.
 */
export async function getDashboardStats(
  userId: string | null,
): Promise<DashboardStats | null> {
  if (!userId || !isDbConfigured()) return null;

  try {
    const db = getDb();

    // 1. Fetch all domains with objectives
    const allDomains = await db
      .select({
        id: schema.domains.id,
        slug: schema.domains.slug,
        name: schema.domains.name,
        weight: schema.domains.weight,
        orderIndex: schema.domains.orderIndex,
      })
      .from(schema.domains)
      .orderBy(schema.domains.orderIndex);

    if (allDomains.length === 0) return null;

    // Run independent queries in parallel
    const [
      objectiveCounts,
      completedObjectives,
      totalFlashcardsPerDomain,
      notDueFlashcards,
      labsTotal,
      labsDone,
    ] = await Promise.all([
      // 2. Count objectives per domain
      db.select({
        domainId: schema.objectives.domainId,
        total: count(),
      })
        .from(schema.objectives)
        .groupBy(schema.objectives.domainId),

      // 3. Get completed objectives for this user
      db.select({
        domainId: schema.studyProgress.domainId,
        count: count(),
      })
        .from(schema.studyProgress)
        .where(eq(schema.studyProgress.userId, userId))
        .groupBy(schema.studyProgress.domainId),

      // 4. Flashcards due for review per domain
      // A card is "due" if it has never been reviewed (no progress row) or nextReview <= now.
      // We count total flashcards minus those with nextReview in the future.
      db.select({
        domainId: schema.domains.id,
        total: count(),
      })
        .from(schema.flashcards)
        .innerJoin(
          schema.objectives,
          eq(schema.flashcards.objectiveId, schema.objectives.id),
        )
        .innerJoin(
          schema.domains,
          eq(schema.objectives.domainId, schema.domains.id),
        )
        .groupBy(schema.domains.id),

      // Cards with future nextReview (i.e., NOT due yet)
      db.select({
        domainId: schema.domains.id,
        notDue: count(),
      })
        .from(schema.flashcardProgress)
        .innerJoin(
          schema.flashcards,
          eq(schema.flashcardProgress.flashcardId, schema.flashcards.id),
        )
        .innerJoin(
          schema.objectives,
          eq(schema.flashcards.objectiveId, schema.objectives.id),
        )
        .innerJoin(
          schema.domains,
          eq(schema.objectives.domainId, schema.domains.id),
        )
        .where(
          dbAnd(
            eq(schema.flashcardProgress.userId, userId),
            gt(schema.flashcardProgress.nextReview, new Date()),
          ),
        )
        .groupBy(schema.domains.id),

      // 5. Total labs per domain
      db.select({
        domainId: schema.domains.id,
        total: count(),
      })
        .from(schema.labs)
        .innerJoin(
          schema.objectives,
          eq(schema.labs.objectiveId, schema.objectives.id),
        )
        .innerJoin(
          schema.domains,
          eq(schema.objectives.domainId, schema.domains.id),
        )
        .groupBy(schema.domains.id),

      // Labs completed by user
      db.select({
        domainId: schema.domains.id,
        done: count(),
      })
        .from(schema.labAttempts)
        .innerJoin(schema.labs, eq(schema.labAttempts.labId, schema.labs.id))
        .innerJoin(
          schema.objectives,
          eq(schema.labs.objectiveId, schema.objectives.id),
        )
        .innerJoin(
          schema.domains,
          eq(schema.objectives.domainId, schema.domains.id),
        )
        .where(eq(schema.labAttempts.userId, userId))
        .groupBy(schema.domains.id),
    ]);

    const objCountMap = new Map(objectiveCounts.map((r) => [r.domainId, r.total]));
    const completedMap = new Map(completedObjectives.map((r) => [r.domainId, r.count]));
    const totalFcMap = new Map(totalFlashcardsPerDomain.map((r) => [r.domainId, r.total]));
    const notDueFcMap = new Map(notDueFlashcards.map((r) => [r.domainId, r.notDue]));
    const labsTotalMap = new Map(labsTotal.map((r) => [r.domainId, r.total]));
    const labsDoneMap = new Map(labsDone.map((r) => [r.domainId, r.done]));

    // 6. Build domain stats
    const domainStats: DashboardDomainStats[] = allDomains.map((d, i) => {
      const objTotal = objCountMap.get(d.id) ?? 0;
      const objCompleted = completedMap.get(d.id) ?? 0;
      const totalFc = totalFcMap.get(d.id) ?? 0;
      const notDueFc = notDueFcMap.get(d.id) ?? 0;
      const labTotal = labsTotalMap.get(d.id) ?? 0;
      const labDone = labsDoneMap.get(d.id) ?? 0;

      const progress = objTotal > 0 ? Math.round((objCompleted / objTotal) * 100) : 0;

      return {
        number: i + 1,
        name: d.name,
        slug: d.slug,
        weight: d.weight,
        progress,
        stats: {
          objectivesCompleted: objCompleted,
          objectivesTotal: objTotal,
          flashcardsDue: Math.max(0, totalFc - notDueFc),
          labsDone: labDone,
          labsTotal: labTotal,
        },
      };
    });

    // 7. Overall weighted progress
    const overallProgress = Math.round(
      domainStats.reduce((acc, d) => acc + d.progress * (d.weight / 100), 0),
    );

    // 8-10. Exam stats (parallel)
    const [bestScore, attemptCount, recentExams] = await Promise.all([
      db.select({ best: max(schema.practiceAttempts.score) })
        .from(schema.practiceAttempts)
        .where(eq(schema.practiceAttempts.userId, userId)),

      db.select({ total: count() })
        .from(schema.practiceAttempts)
        .where(eq(schema.practiceAttempts.userId, userId)),

      db.select({
        score: schema.practiceAttempts.score,
        completedAt: schema.practiceAttempts.completedAt,
      })
        .from(schema.practiceAttempts)
        .where(eq(schema.practiceAttempts.userId, userId))
        .orderBy(desc(schema.practiceAttempts.completedAt))
        .limit(5),
    ]);

    const bestExamScore = Math.round(bestScore[0]?.best ?? 0);

    const recentActivity = recentExams.map((e) => ({
      type: "exam" as const,
      text: `Practice exam scored ${Math.round(e.score ?? 0)}%`,
      time: e.completedAt ? formatTimeAgo(e.completedAt) : "Recently",
    }));

    // 11. Study streak — count consecutive days with activity (going back from today)
    const studyStreak = await calculateStudyStreak(db, userId);

    return {
      domains: domainStats,
      overallProgress,
      bestExamScore,
      totalExamAttempts: attemptCount[0]?.total ?? 0,
      studyStreak,
      recentActivity,
    };
  } catch (err) {
    console.warn("Failed to load dashboard stats from DB:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { formatTimeAgo } from "@/lib/format-time";

/**
 * Calculate consecutive-day study streak for a user.
 * Counts distinct activity dates going backwards from today.
 * Activity = any exam attempt, lab attempt, flashcard review, or study progress entry.
 */
async function calculateStudyStreak(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<number> {
  try {
    // Get distinct activity dates from all progress tables (last 90 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const activityDates = await db.execute<{ activity_date: string }>(sql`
      SELECT DISTINCT activity_date FROM (
        SELECT DATE(started_at) AS activity_date FROM practice_attempts
          WHERE user_id = ${userId} AND started_at >= ${cutoff}
        UNION
        SELECT DATE(started_at) AS activity_date FROM lab_attempts
          WHERE user_id = ${userId} AND started_at >= ${cutoff}
        UNION
        SELECT DATE(last_review) AS activity_date FROM flashcard_progress
          WHERE user_id = ${userId} AND last_review IS NOT NULL AND last_review >= ${cutoff}
        UNION
        SELECT DATE(completed_at) AS activity_date FROM study_progress
          WHERE user_id = ${userId} AND completed_at IS NOT NULL AND completed_at >= ${cutoff}
      ) dates
      ORDER BY activity_date DESC
    `);

    if (!activityDates || activityDates.length === 0) return 0;

    const dates = activityDates.map((r) => String(r.activity_date));

    // Count consecutive days starting from today or yesterday
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    // Streak must include today or yesterday to be active
    if (dates[0] !== todayStr && dates[0] !== yesterdayStr) return 0;

    let streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + "T00:00:00");
      const curr = new Date(dates[i] + "T00:00:00");
      const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  } catch {
    return 0;
  }
}
