"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <h2 className="text-lg font-semibold text-zinc-100">
        Something went wrong
      </h2>
      <p className="text-sm text-zinc-400 text-center max-w-md">
        An unexpected error occurred. Please try again. If the problem
        persists, refresh the page.
      </p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
