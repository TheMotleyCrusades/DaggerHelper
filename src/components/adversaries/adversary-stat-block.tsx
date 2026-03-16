type Experience = { phrase: string; value?: string };
type Feature = { name: string; type: string; description: string };

export type AdversaryStatBlockData = {
  name: string;
  tier: number;
  type: string;
  description?: string | null;
  motives?: string | null;
  difficulty?: number | null;
  majorThreshold?: string | null;
  severeThreshold?: string | null;
  hp?: string | null;
  stress?: string | null;
  atk?: string | null;
  damageAverage?: string | null;
  weaponName?: string | null;
  weaponRange?: string | null;
  damageDice?: string | null;
  tags?: string[] | null;
  potentialDicePools?: string[] | null;
  features?: Feature[] | null;
  experiences?: Experience[] | null;
};

function nonEmptyList(values?: (string | null | undefined)[] | null) {
  return (values ?? []).map((value) => value?.trim()).filter(Boolean) as string[];
}

export function AdversaryStatBlock({ adversary }: { adversary: AdversaryStatBlockData }) {
  const tags = nonEmptyList(adversary.tags);
  const experiences = (adversary.experiences ?? []).filter((item) => item?.phrase?.trim());
  const features = (adversary.features ?? []).filter((item) => item?.name?.trim());

  return (
    <article className="rounded-lg border border-amber-700/35 bg-slate-950/65 p-4">
      <header className="mb-3 border-b border-amber-700/35 pb-3">
        <h3 className="text-xl text-amber-200">{adversary.name || "Unnamed adversary"}</h3>
        <p className="text-xs uppercase tracking-wide text-slate-300">
          Tier {adversary.tier || 1} | {adversary.type || "standard"}
        </p>
        {adversary.description && <p className="mt-2 text-sm text-slate-300">{adversary.description}</p>}
      </header>

      <div className="grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
        <div className="space-y-2">
          <p>
            <span className="text-slate-400">Difficulty:</span> {adversary.difficulty ?? "-"}
          </p>
          <p>
            <span className="text-slate-400">HP:</span> {adversary.hp ?? "-"}
          </p>
          <p>
            <span className="text-slate-400">Stress:</span> {adversary.stress ?? "-"}
          </p>
        </div>
        <div className="space-y-2">
          <p>
            <span className="text-slate-400">ATK:</span> {adversary.atk ?? "-"}
          </p>
          <p>
            <span className="text-slate-400">Major:</span> {adversary.majorThreshold ?? "-"}
          </p>
          <p>
            <span className="text-slate-400">Severe:</span> {adversary.severeThreshold ?? "-"}
          </p>
        </div>
      </div>

      {(adversary.weaponName || adversary.weaponRange || adversary.damageDice) && (
        <div className="mt-3 rounded-md border border-slate-700/60 bg-slate-900/60 p-3 text-sm text-slate-200">
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Weapon</p>
          <p>
            {adversary.weaponName ?? "Unknown"} | {adversary.weaponRange ?? "-"} | {adversary.damageDice ?? "-"}
          </p>
        </div>
      )}

      {adversary.motives && (
        <div className="mt-3 rounded-md border border-slate-700/60 bg-slate-900/60 p-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Motives & Tactics</p>
          <p className="text-sm text-slate-200">{adversary.motives}</p>
        </div>
      )}

      {!!experiences.length && (
        <div className="mt-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Experiences</p>
          <ul className="space-y-1 text-sm text-slate-300">
            {experiences.map((experience) => (
              <li key={`${experience.phrase}-${experience.value ?? ""}`}>
                {experience.phrase}
                {experience.value ? ` (${experience.value})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!features.length && (
        <div className="mt-3 space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Features</p>
          {features.map((feature) => (
            <div key={`${feature.name}-${feature.type}`} className="rounded-md border border-slate-700/60 p-2">
              <p className="text-sm text-amber-200">
                {feature.name} <span className="text-xs text-slate-400">({feature.type})</span>
              </p>
              {feature.description && <p className="text-sm text-slate-300">{feature.description}</p>}
            </div>
          ))}
        </div>
      )}

      {!!tags.length && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full border border-slate-600 px-2 py-0.5 text-xs text-slate-200">
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
