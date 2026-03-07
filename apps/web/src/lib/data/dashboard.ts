/**
 * Dashboard Data Access Layer
 *
 * Aggregates user progress across all tables to produce the dashboard
 * statistics. When the DB is unavailable, returns null so the page
 * can fall back to hardcoded defaults.
 */

import { eq, desc, count, max, gt, and as dbAnd } from "drizzle-orm";
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

    return {
      domains: domainStats,
      overallProgress,
      bestExamScore,
      totalExamAttempts: attemptCount[0]?.total ?? 0,
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
