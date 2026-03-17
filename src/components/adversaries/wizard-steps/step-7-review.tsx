import type { AdversaryFormValue } from "@/components/adversaries/adversary-form";

export function Step7Review({
  value,
  tags,
  dicePools,
}: {
  value: AdversaryFormValue;
  tags: string[];
  dicePools: string[];
}) {
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl text-amber-200">Step 7: Review</h2>
        <p className="text-sm text-slate-400">Confirm details before creating the adversary.</p>
      </header>

      <div className="rounded-lg border border-slate-700/60 bg-slate-950/50 p-3 text-sm text-slate-200">
        <p className="text-amber-200">{value.name || "Unnamed adversary"}</p>
        <p className="text-xs text-slate-400">Tier {value.tier} | {value.type}</p>
        {value.description ? <p className="mt-2 text-slate-300">{value.description}</p> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-700/60 bg-slate-950/50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Stats</p>
          <p className="text-sm text-slate-200">Difficulty: {value.difficulty ?? "-"}</p>
          <p className="text-sm text-slate-200">HP: {value.hp ?? "-"}</p>
          <p className="text-sm text-slate-200">Stress: {value.stress ?? "-"}</p>
          <p className="text-sm text-slate-200">ATK: {value.atk ?? "-"}</p>
          <p className="text-sm text-slate-200">Major: {value.majorThreshold ?? "-"}</p>
          <p className="text-sm text-slate-200">Severe: {value.severeThreshold ?? "-"}</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-950/50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Weapon</p>
          <p className="text-sm text-slate-200">Name: {value.weaponName ?? "-"}</p>
          <p className="text-sm text-slate-200">Range: {value.weaponRange ?? "-"}</p>
          <p className="text-sm text-slate-200">Damage: {value.damageDice ?? "-"}</p>
          {dicePools.length ? (
            <p className="text-sm text-slate-200">Pools: {dicePools.join(", ")}</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-slate-700/60 bg-slate-950/50 p-3">
        <p className="text-xs uppercase tracking-wide text-slate-400">Features</p>
        {value.features?.length ? (
          <ul className="mt-1 space-y-1 text-sm text-slate-200">
            {value.features.map((feature, index) => (
              <li key={`${feature.name}-${index}`}>
                {feature.name} ({feature.type})
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No features added.</p>
        )}
      </div>

      <div className="rounded-lg border border-slate-700/60 bg-slate-950/50 p-3">
        <p className="text-xs uppercase tracking-wide text-slate-400">Experiences</p>
        {value.experiences?.length ? (
          <ul className="mt-1 space-y-1 text-sm text-slate-200">
            {value.experiences.map((experience, index) => (
              <li key={`${experience.phrase}-${index}`}>
                {experience.phrase}
                {experience.value ? ` (${experience.value})` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No experiences added.</p>
        )}
      </div>

      {tags.length ? (
        <div className="rounded-lg border border-slate-700/60 bg-slate-950/50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Tags</p>
          <p className="text-sm text-slate-200">{tags.join(", ")}</p>
        </div>
      ) : null}
    </section>
  );
}
