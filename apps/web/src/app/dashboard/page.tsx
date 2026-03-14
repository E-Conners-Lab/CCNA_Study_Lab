"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DomainCard, type DomainData } from "@/components/dashboard/domain-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { CCNA_DOMAINS } from "@/lib/domains";
import {
  Target,
  Flame,
  Trophy,
  BookOpen,
  FlaskConical,
  ClipboardCheck,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Zero-state defaults (shown before API responds or when DB is unavailable)
// ---------------------------------------------------------------------------

const DEFAULT_PROGRESS: Record<number, { progress: number; stats: DomainData["stats"] }> = {
  1: { progress: 0, stats: { objectivesCompleted: 0, objectivesTotal: 13, flashcardsDue: 0, labsDone: 0, labsTotal: 1 } },
  2: { progress: 0, stats: { objectivesCompleted: 0, objectivesTotal: 9, flashcardsDue: 0, labsDone: 0, labsTotal: 2 } },
  3: { progress: 0, stats: { objectivesCompleted: 0, objectivesTotal: 5, flashcardsDue: 0, labsDone: 0, labsTotal: 2 } },
  4: { progress: 0, stats: { objectivesCompleted: 0, objectivesTotal: 9, flashcardsDue: 0, labsDone: 0, labsTotal: 1 } },
  5: { progress: 0, stats: { objectivesCompleted: 0, objectivesTotal: 10, flashcardsDue: 0, labsDone: 0, labsTotal: 2 } },
  6: { progress: 0, stats: { objectivesCompleted: 0, objectivesTotal: 7, flashcardsDue: 0, labsDone: 0, labsTotal: 2 } },
};

const defaultDomains: DomainData[] = CCNA_DOMAINS.map((d) => ({
  number: d.number,
  name: d.name,
  slug: d.slug,
  weight: d.weight,
  ...DEFAULT_PROGRESS[d.number],
}));

const defaultRecentActivity: {
  type: string;
  text: string;
  time: string;
  icon: typeof BookOpen;
}[] = [];

const ACTIVITY_ICON_MAP: Record<string, typeof BookOpen> = {
  study: BookOpen,
  lab: FlaskConical,
  exam: ClipboardCheck,
  flashcard: BookOpen,
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [domains, setDomains] = useState<DomainData[]>(defaultDomains);
  const [overallProgress, setOverallProgress] = useState(() =>
    Math.round(defaultDomains.reduce((acc, d) => acc + d.progress * (d.weight / 100), 0)),
  );
  const [bestScore, setBestScore] = useState("--");
  const [studyStreak, setStudyStreak] = useState(0);
  const [examsTaken, setExamsTaken] = useState(0);
  const [recentActivity, setRecentActivity] = useState(defaultRecentActivity);

  // Fetch live stats from API (replaces defaults if DB has data)
  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.stats) {
          const s = data.stats;
          if (s.domains && s.domains.length > 0) {
            setDomains(s.domains);
          }
          if (typeof s.overallProgress === "number") {
            setOverallProgress(s.overallProgress);
          }
          if (typeof s.bestExamScore === "number" && s.bestExamScore > 0) {
            setBestScore(`${s.bestExamScore}%`);
          }
          if (typeof s.totalExamAttempts === "number") {
            setExamsTaken(s.totalExamAttempts);
          }
          if (typeof s.studyStreak === "number") {
            setStudyStreak(s.studyStreak);
          }
          if (s.recentActivity && s.recentActivity.length > 0) {
            setRecentActivity(
              s.recentActivity.map(
                (a: { type: string; text: string; time: string }) => ({
                  ...a,
                  icon: ACTIVITY_ICON_MAP[a.type] ?? BookOpen,
                }),
              ),
            );
          }
        }
      })
      .catch(() => {
        // API unavailable — keep hardcoded defaults
      });
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
          Welcome back
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Track your CCNA 200-301 exam preparation progress
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={Target}
          label="Overall Progress"
          value={`${overallProgress}%`}
        />
        <StatsCard
          icon={Flame}
          label="Study Streak"
          value={`${studyStreak} day${studyStreak !== 1 ? "s" : ""}`}
        />
        <StatsCard
          icon={Trophy}
          label="Best Score"
          value={bestScore}
        />
        <StatsCard
          icon={ClipboardCheck}
          label="Exams Taken"
          value={String(examsTaken)}
        />
      </div>

      {/* Overall Progress Card */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-200">Exam Readiness</CardTitle>
          <CardDescription>
            Weighted progress across all six exam domains
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold text-blue-400">
              {overallProgress}%
            </span>
            <Badge
              variant="secondary"
              className="bg-blue-500/10 text-blue-400 border-blue-500/20"
            >
              {overallProgress >= 80
                ? "Exam Ready"
                : overallProgress >= 50
                ? "On Track"
                : "Keep Going"}
            </Badge>
          </div>
          <Progress
            value={overallProgress}
            className="h-3 bg-zinc-800 [&>[data-slot=progress-indicator]]:bg-blue-500"
          />
          <p className="text-xs text-zinc-500">
            {100 - overallProgress}% remaining to complete all domains
          </p>
        </CardContent>
      </Card>

      {/* Domain Cards Grid */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-200 mb-4">
          Exam Domains
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {domains.map((domain) => (
            <DomainCard key={domain.slug} domain={domain} />
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-200">Recent Activity</CardTitle>
          <CardDescription>Your latest study sessions and completions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {recentActivity.map((activity, i) => (
              <div key={i}>
                <div className="flex items-center gap-3 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
                    <activity.icon className="h-4 w-4 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300">{activity.text}</p>
                    <p className="text-xs text-zinc-600">{activity.time}</p>
                  </div>
                </div>
                {i < recentActivity.length - 1 && (
                  <Separator className="bg-zinc-800/50" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
