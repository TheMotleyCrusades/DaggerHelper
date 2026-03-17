import type { AdversaryFormValue } from "@/components/adversaries/adversary-form";

export function Step2StatBlock({
  value,
  onChange,
}: {
  value: AdversaryFormValue;
  onChange: (patch: Partial<AdversaryFormValue>) => void;
}) {
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl text-amber-200">Step 2: Core Statistics</h2>
        <p className="text-sm text-slate-400">Set the baseline combat values.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm text-slate-300">
          Difficulty
          <input
            className="field mt-1"
            type="number"
            value={value.difficulty ?? ""}
            onChange={(event) => {
              const next = event.target.value;
              onChange({ difficulty: next === "" ? undefined : Number(next) });
            }}
          />
        </label>
        <label className="text-sm text-slate-300">
          Major Threshold
          <input
            className="field mt-1"
            value={value.majorThreshold ?? ""}
            onChange={(event) => onChange({ majorThreshold: event.target.value })}
          />
        </label>
        <label className="text-sm text-slate-300">
          Severe Threshold
          <input
            className="field mt-1"
            value={value.severeThreshold ?? ""}
            onChange={(event) => onChange({ severeThreshold: event.target.value })}
          />
        </label>
        <label className="text-sm text-slate-300">
          Damage Avg
          <input
            className="field mt-1"
            value={value.damageAverage ?? ""}
            onChange={(event) => onChange({ damageAverage: event.target.value })}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-slate-300">
          HP
          <input
            className="field mt-1"
            value={value.hp ?? ""}
            onChange={(event) => onChange({ hp: event.target.value })}
          />
        </label>
        <label className="text-sm text-slate-300">
          Stress
          <input
            className="field mt-1"
            value={value.stress ?? ""}
            onChange={(event) => onChange({ stress: event.target.value })}
          />
        </label>
        <label className="text-sm text-slate-300">
          ATK
          <input
            className="field mt-1"
            value={value.atk ?? ""}
            onChange={(event) => onChange({ atk: event.target.value })}
          />
        </label>
      </div>
    </section>
  );
}
