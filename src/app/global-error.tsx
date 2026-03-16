"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16 text-white">
        <section className="w-full rounded-xl border border-red-400/40 bg-slate-950 p-6">
          <h1 className="mb-2 text-2xl text-red-300">Critical Application Error</h1>
          <p className="mb-4 text-sm text-slate-300">The application hit an unrecoverable error.</p>
          <p className="mb-4 text-xs text-slate-500">{error.message}</p>
          <button className="rounded-md border border-red-400/60 px-4 py-2 text-sm text-red-200" onClick={reset}>
            Retry
          </button>
        </section>
      </body>
    </html>
  );
}
