"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { AuthLayout } from "@/components/auth";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const [result, setResult] = useState<{
    status: "loading" | "success" | "error";
    message: string;
  }>(() => {
    if (!token || !email) {
      return { status: "error", message: "Invalid verification link." };
    }
    return { status: "loading", message: "" };
  });

  useEffect(() => {
    if (!token || !email) return;

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setResult({ status: "success", message: "Your email has been verified!" });
        } else {
          setResult({ status: "error", message: data.error || "Verification failed." });
        }
      })
      .catch(() => {
        setResult({ status: "error", message: "Something went wrong. Please try again." });
      });
  }, [token, email]);

  const { status, message } = result;

  return (
    <div className="text-center space-y-4">
      {status === "loading" && (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-zinc-400">Verifying your email...</p>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center gap-3">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="text-zinc-200 font-medium">{message}</p>
          <Link
            href="/login"
            className="mt-2 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition"
          >
            Sign In
          </Link>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-3">
          <XCircle className="h-10 w-10 text-red-500" />
          <p className="text-zinc-200 font-medium">{message}</p>
          <Link
            href="/signup"
            className="mt-2 text-sm text-blue-500 hover:text-blue-400 transition"
          >
            Back to sign up
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthLayout subtitle="Email Verification">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </AuthLayout>
  );
}
