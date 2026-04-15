"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface QuestionResult {
  questionId: string;
  text: string;
  userAnswer: unknown;
  correctAnswer: unknown;
  correct: boolean;
  explanation: string | null;
}

interface AttemptDetail {
  attempt: {
    id: string;
    score: number;
    totalQuestions: number;
    domainFilter: string | null;
    startedAt: string;
    completedAt: string | null;
  };
  questionResults: QuestionResult[];
}

function formatAnswer(val: unknown): string {
  if (Array.isArray(val)) return val.join(", ");
  if (val === null || val === undefined) return "";
  return String(val);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ReviewContent() {
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attemptId");

  const [data, setData] = useState<AttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) {
      queueMicrotask(() => {
        setError("No attempt ID provided");
        setLoading(false);
      });
      return;
    }

    fetch(`/api/exams/attempts/${attemptId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load attempt (${res.status})`);
        return res.json();
      })
      .then((json) => setData(json))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-zinc-500">Loading attempt...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-zinc-800 bg-zinc-900/50 max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
            <p className="text-sm text-zinc-300">
              {error || "Attempt not found"}
            </p>
            <Button
              onClick={() => (window.location.href = "/dashboard/practice")}
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Practice
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { attempt, questionResults } = data;
  const passed = attempt.score >= 70;
  const totalCorrect = questionResults.filter((q) => q.correct).length;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Score Header */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div
              className={cn(
                "flex h-24 w-24 items-center justify-center rounded-full border-4",
                passed
                  ? "border-blue-500/50 text-blue-400"
                  : "border-red-500/50 text-red-400"
              )}
            >
              <span className="text-3xl font-bold">
                {Math.round(attempt.score)}%
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">
                {attempt.domainFilter
                  ? `Domain Quiz — ${attempt.domainFilter}`
                  : "Full Practice Exam"}
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                {totalCorrect} of {attempt.totalQuestions} correct
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {formatDate(attempt.startedAt)}
              </p>
            </div>
            {passed ? (
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-sm px-4 py-1">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                PASSED
              </Badge>
            ) : (
              <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-sm px-4 py-1">
                <XCircle className="h-4 w-4 mr-1" />
                FAILED
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Per-question Review */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-200">Question Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {questionResults.map((qr, i) => (
              <div
                key={qr.questionId}
                className={cn(
                  "rounded-lg border p-4 space-y-3",
                  qr.correct
                    ? "border-blue-500/20 bg-blue-500/5"
                    : "border-red-500/20 bg-red-500/5"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-zinc-200">
                    <span className="font-semibold text-zinc-400 mr-2">
                      Q{i + 1}.
                    </span>
                    {qr.text}
                  </p>
                  {qr.correct ? (
                    <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-500">Your answer: </span>
                    <span
                      className={cn(
                        "font-medium",
                        qr.correct ? "text-blue-400" : "text-red-400"
                      )}
                    >
                      {formatAnswer(qr.userAnswer) || "(no answer)"}
                    </span>
                  </div>
                  {!qr.correct && (
                    <div>
                      <span className="text-zinc-500">Correct answer: </span>
                      <span className="font-medium text-blue-400">
                        {formatAnswer(qr.correctAnswer)}
                      </span>
                    </div>
                  )}
                </div>

                {qr.explanation && (
                  <p className="text-xs text-zinc-400 border-t border-zinc-800 pt-2">
                    {qr.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Back Button */}
      <div className="flex justify-center pb-8">
        <Button
          onClick={() => (window.location.href = "/dashboard/practice")}
          className="bg-blue-600 hover:bg-blue-500 text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Practice
        </Button>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <ReviewContent />
    </Suspense>
  );
}
