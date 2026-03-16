"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/ui/toast-provider";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const { user, loading: authLoading } = useAuth();
  const { push } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(next);
    }
  }, [authLoading, next, router, user]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const redirectTo =
      typeof window !== "undefined"
        ? (() => {
            const callbackUrl = new URL("/auth/callback", window.location.origin);
            callbackUrl.searchParams.set("next", next);
            return callbackUrl.toString();
          })()
        : undefined;

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    const params = new URLSearchParams({
      registered: "1",
      email: email.trim().toLowerCase(),
      next,
    });
    push("Account created. Check your email to verify before logging in.", "success");
    router.push(`/login?${params.toString()}`);
  }

  if (!authLoading && user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
        <section className="panel w-full rounded-xl p-6">
          <p className="text-sm text-slate-300">Signed in. Redirecting...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <section className="panel w-full rounded-xl p-6">
        <h1 className="mb-1 text-3xl text-amber-300">Create Account</h1>
        <p className="mb-5 text-sm text-slate-300">
          Create an account to start building characters, share homebrew, and use the full toolkit.
        </p>

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
            placeholder="Password (min 6 chars)"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-primary w-full px-4 py-2.5 text-sm" disabled={loading}>
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-300">
          Already registered?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="text-amber-300 hover:text-amber-200"
          >
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}
