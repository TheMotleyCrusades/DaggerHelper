import Link from "next/link";
import { WORLD_KIND_CONFIGS } from "@/components/world/world-kinds";

export default function WorldCreatorHomePage() {
  return (
    <section className="space-y-4">
      <header className="rounded-lg border border-amber-700/30 bg-amber-950/20 p-4">
        <h2 className="text-2xl text-amber-300">World Creator Engine</h2>
        <p className="text-sm text-slate-300">
          The canonical workspace for building homebrew content, equipment libraries, adversaries, and install-ready packs.
        </p>
      </header>

      <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg text-amber-200">Quick Actions</h3>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/adversaries/new" className="btn-outline min-h-11 px-3 py-2 text-sm">
              Open Adversary Builder
            </Link>
            <Link href="/dashboard/world/weapons" className="btn-outline min-h-11 px-3 py-2 text-sm">
              Open Equipment Library
            </Link>
            <Link href="/dashboard/world/bundles" className="btn-primary min-h-11 px-3 py-2 text-sm">
              Open Bundle Manager
            </Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {WORLD_KIND_CONFIGS.map((kind) => (
            <Link
              key={kind.slug}
              href={`/dashboard/world/${kind.slug}`}
              className="rounded-lg border border-slate-700/45 bg-slate-950/55 p-3 transition hover:border-amber-500/45"
            >
              <p className="text-base text-amber-100">{kind.label}</p>
              <p className="mt-1 text-xs text-slate-300">{kind.description}</p>
            </Link>
          ))}
        </div>
      </article>

      <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-4">
        <h3 className="text-lg text-amber-200">How This Flows</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
          <li>Create drafts in the World Creator Engine.</li>
          <li>Package mixed entries into product versions in Bundles.</li>
          <li>Use installs to move versions into campaigns with collision warnings.</li>
        </ol>
      </article>
    </section>
  );
}
