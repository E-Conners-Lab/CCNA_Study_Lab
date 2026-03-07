"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { AuthLayout, AuthInput, AuthError, AuthButton } from "@/components/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout subtitle="Check your email">
        <div className="text-center space-y-4">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="text-zinc-300 text-sm">
            If an account exists for <span className="text-zinc-100 font-medium">{email}</span>,
            we&apos;ve sent a password reset link.
          </p>
          <p className="text-zinc-500 text-xs">
            Check your spam folder if you don&apos;t see it. The link expires in 1 hour.
          </p>
          <Link
            href="/login"
            className="mt-2 inline-block text-sm text-blue-500 hover:text-blue-400 transition"
          >
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout subtitle="Reset your password">
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthError message={error} />

        <p className="text-sm text-zinc-400">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>

        <AuthInput
          id="email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <AuthButton loading={loading} label="Send Reset Link" loadingLabel="Sending..." />

        <p className="text-center text-sm text-zinc-500">
          Remember your password?{" "}
          <Link
            href="/login"
            className="text-blue-500 hover:text-blue-400 transition"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
