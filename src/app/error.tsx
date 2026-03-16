"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-16">
      <section className="panel w-full rounded-xl p-6">
        <h1 className="mb-2 text-3xl text-amber-300">Something went wrong</h1>
        <p className="mb-4 text-sm text-slate-300">An unexpected error occurred while rendering this page.</p>
        <button className="btn-primary px-4 py-2 text-sm" onClick={reset}>
          Try Again
        </button>
      </section>
    </main>
  );
}
