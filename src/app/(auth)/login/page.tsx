"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/ui/toast-provider";

function getFriendlySignInError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("email not confirmed") || normalized.includes("email not verified")) {
    return "Your email is not verified yet. Check your inbox and spam for the verification email first.";
  }
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { push } = useToast();
  const next = searchParams.get("next") || "/dashboard";
  const registered = searchParams.get("registered");
  const verified = searchParams.get("verified");
  const authErrorParam = searchParams.get("authError");
  const emailParam = searchParams.get("email");
  const { user, loading: authLoading } = useAuth();

  const [email, setEmail] = useState(emailParam ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const shownParamToastRef = useRef({
    registered: false,
    verified: false,
    authError: false,
  });
  const notice =
    verified === "1"
      ? "Email verified. You can log in now."
      : registered === "1"
        ? "Account created. Check your email to verify before logging in."
        : null;
  const errorMessage = error ?? authErrorParam;

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(next);
    }
  }, [authLoading, next, router, user]);

  useEffect(() => {
    if (registered === "1" && !shownParamToastRef.current.registered) {
      shownParamToastRef.current.registered = true;
      push("Account created. Check your email to verify before logging in.", "info");
    }

    if (verified === "1" && !shownParamToastRef.current.verified) {
      shownParamToastRef.current.verified = true;
      push("Email verified. You can log in now.", "success");
    }

    if (authErrorParam && !shownParamToastRef.current.authError) {
      shownParamToastRef.current.authError = true;
      push(authErrorParam, "error");
    }
  }, [authErrorParam, push, registered, verified]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResendMessage(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (signInError) {
      const friendlyError = getFriendlySignInError(signInError.message);
      setError(friendlyError);
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function resendVerificationEmail() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter your email above, then request a new verification email.");
      return;
    }

    setError(null);
    setResendMessage(null);
    setResending(true);

    const response = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    const data = await response.json().catch(() => ({}));

    setResending(false);
    if (!response.ok) {
      const friendlyError = getFriendlySignInError(data.error ?? "Failed to resend verification email.");
      setError(friendlyError);
      push(friendlyError, "error");
      return;
    }

    const message = data.alreadyVerified
      ? data.confirmedAt
        ? `Email already verified on ${new Date(data.confirmedAt).toLocaleString()}. You can log in now.`
        : "Email is already verified. You can log in now."
      : data.message ?? "Verification email sent. Use the newest link in your inbox/spam.";
    setResendMessage(message);
    push(message, data.alreadyVerified ? "info" : "success");
  }

  if (!authLoading && user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
        <section className="panel w-full rounded-xl p-6">
          <p className="text-sm text-slate-300">Signed in. Redirecting to dashboard...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <section className="panel w-full rounded-xl p-6">
        <h1 className="mb-1 text-3xl text-amber-300">Welcome Back</h1>
        <p className="mb-5 text-sm text-slate-300">Login to manage your Daggerheart tools.</p>
        {notice && (
          <p className="mb-4 rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-2 text-sm text-sky-200">
            {notice}
          </p>
        )}

        <form className="space-y-3" onSubmit={onSubmit}>
          <input
            className="field"
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            className="field"
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
          <button className="btn-primary w-full px-4 py-2.5 text-sm" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
          <div className="rounded-lg border border-slate-500/40 bg-slate-900/40 p-3">
            <p className="mb-2 text-xs text-slate-300">Need a new verification email?</p>
            <button
              className="btn-outline w-full px-4 py-2 text-sm"
              type="button"
              disabled={resending || !email.trim()}
              onClick={resendVerificationEmail}
            >
              {resending ? "Sending..." : "Resend Verification Email"}
            </button>
            {!email.trim() && (
              <p className="mt-2 text-xs text-slate-400">Enter your email above to enable resend.</p>
            )}
            {resendMessage && <p className="mt-2 text-xs text-emerald-300">{resendMessage}</p>}
          </div>
        </form>

        <p className="mt-5 text-sm text-slate-300">
          No account?{" "}
          <Link href="/register" className="text-amber-300 hover:text-amber-200">
            Create one
          </Link>
        </p>
      </section>
    </main>
  );
}
