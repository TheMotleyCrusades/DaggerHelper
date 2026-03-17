import { ADVERSARY_TYPES } from "@/lib/adversaries";
import type { AdversaryFormValue } from "@/components/adversaries/adversary-form";

export function Step1BasicInfo({
  value,
  onChange,
}: {
  value: AdversaryFormValue;
  onChange: (patch: Partial<AdversaryFormValue>) => void;
}) {
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl text-amber-200">Step 1: Basic Information</h2>
        <p className="text-sm text-slate-400">Define the adversary’s identity and core role.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-300 sm:col-span-2">
          Name
          <input
            className="field mt-1"
            required
            value={value.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </label>

        <label className="text-sm text-slate-300">
          Tier
          <input
            className="field mt-1"
            type="number"
            min={1}
            max={4}
            value={value.tier}
            onChange={(event) => onChange({ tier: Number(event.target.value) || 1 })}
          />
        </label>

        <label className="text-sm text-slate-300">
          Type
          <select
            className="field mt-1"
            value={value.type}
            onChange={(event) => onChange({ type: event.target.value })}
          >
            {ADVERSARY_TYPES.map((adversaryType) => (
              <option key={adversaryType} value={adversaryType}>
                {adversaryType}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="text-sm text-slate-300">
        Description
        <textarea
          className="field mt-1 min-h-20"
          value={value.description ?? ""}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </label>

      <label className="text-sm text-slate-300">
        Motives & Tactics
        <textarea
          className="field mt-1 min-h-20"
          value={value.motives ?? ""}
          onChange={(event) => onChange({ motives: event.target.value })}
        />
      </label>
    </section>
  );
}
