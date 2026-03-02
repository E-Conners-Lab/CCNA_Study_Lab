"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Play,
  Clock,
  CheckCircle2,
  Circle,
  RotateCw,
  Terminal as TerminalIcon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getDifficultyClasses } from "@/lib/ui-constants";

type LabStatus = "not_started" | "in_progress" | "completed";

interface LabFromAPI {
  slug: string;
  title: string;
  description: string;
  domain: string;
  domainSlug: string;
  objectiveCode: string;
  difficulty: string;
  estimatedMinutes: number;
  type: string;
  tags: string[];
}

const statusConfig: Record<
  LabStatus,
  { label: string; icon: typeof Circle; color: string }
> = {
  not_started: {
    label: "Not Started",
    icon: Circle,
    color: "text-zinc-500",
  },
  in_progress: {
    label: "In Progress",
    icon: RotateCw,
    color: "text-amber-400",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    color: "text-blue-500",
  },
};

export default function LabsPage() {
  const router = useRouter();
  const [labs, setLabs] = useState<LabFromAPI[]>([]);
  const [labStatuses, setLabStatuses] = useState<Record<string, LabStatus>>({});
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<string>("all");

  // Fetch labs from API
  useEffect(() => {
    fetch("/api/labs")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.labs) {
          setLabs(data.labs);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch lab attempt statuses
  useEffect(() => {
    fetch("/api/labs/attempts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.attempts && Object.keys(data.attempts).length > 0) {
          const statusMap: Record<string, LabStatus> = {};
          for (const [slug, attempt] of Object.entries(data.attempts)) {
            const a = attempt as { status: string };
            if (a.status === "completed") statusMap[slug] = "completed";
            else if (a.status === "started") statusMap[slug] = "in_progress";
            else if (a.status === "failed") statusMap[slug] = "in_progress";
          }
          setLabStatuses(statusMap);
        }
      })
      .catch(() => {});
  }, []);

  const getStatus = (slug: string): LabStatus =>
    labStatuses[slug] ?? "not_started";

  // Build unique lab types for filter tabs
  const labTypes = ["all", ...Array.from(new Set(labs.map((l) => l.type)))];

  const filteredLabs =
    activeType === "all" ? labs : labs.filter((l) => l.type === activeType);

  const completedCount = labs.filter(
    (l) => getStatus(l.slug) === "completed"
  ).length;
  const inProgressCount = labs.filter(
    (l) => getStatus(l.slug) === "in_progress"
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
            Hands-on Labs
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Practice with interactive IOS CLI labs aligned to CCNA exam
            objectives
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="secondary"
            className="bg-blue-500/10 text-blue-400 border-blue-500/20"
          >
            {completedCount} completed
          </Badge>
          <Badge
            variant="secondary"
            className="bg-amber-500/10 text-amber-400 border-amber-500/20"
          >
            {inProgressCount} in progress
          </Badge>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
        {labTypes.map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
              activeType === type
                ? "bg-blue-500/10 text-blue-400"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {type === "all" ? "All" : type.replace("-", " ")}
          </button>
        ))}
      </div>

      {/* Lab Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredLabs.map((lab) => {
          const status = getStatus(lab.slug);
          const StatusIcon = statusConfig[status].icon;
          return (
            <Card
              key={lab.slug}
              className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700 transition-all"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 shrink-0">
                      <TerminalIcon className="h-5 w-5 text-zinc-400" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold text-zinc-200 leading-tight">
                        {lab.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge
                          variant="secondary"
                          className="bg-zinc-800 text-zinc-400 text-[10px]"
                        >
                          {lab.objectiveCode}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] capitalize",
                            getDifficultyClasses(lab.difficulty)
                          )}
                        >
                          {lab.difficulty}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="bg-zinc-800 text-zinc-400 text-[10px] capitalize"
                        >
                          {lab.type.replace("-", " ")}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription className="text-xs text-zinc-500 leading-relaxed">
                  {lab.description}
                </CardDescription>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <Clock className="h-3 w-3" />
                      <span>{lab.estimatedMinutes} min</span>
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-1.5 text-xs",
                        statusConfig[status].color
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      <span>{statusConfig[status].label}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className={cn(
                      "text-xs",
                      status === "completed"
                        ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        : "bg-blue-600 text-white hover:bg-blue-500"
                    )}
                    onClick={() =>
                      router.push(`/dashboard/labs/${lab.slug}`)
                    }
                  >
                    <Play className="h-3 w-3 mr-1" />
                    {status === "completed"
                      ? "Redo"
                      : status === "in_progress"
                        ? "Continue"
                        : "Start"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredLabs.length === 0 && (
        <div className="text-center py-12 text-zinc-500 text-sm">
          No labs found for this filter.
        </div>
      )}
    </div>
  );
}
