"use client";

import type { AdversaryExperience } from "@/components/adversaries/adversary-types";

export function ExperiencesEditor({
  value,
  onChange,
  tier,
}: {
  value: AdversaryExperience[];
  onChange: (next: AdversaryExperience[]) => void;
  tier: number;
}) {
  function updateExperience(index: number, patch: Partial<AdversaryExperience>) {
    const next = value.map((item, idx) => (idx === index ? { ...item, ...patch } : item));
    onChange(next);
  }

  function addExperience() {
    onChange([...value, { phrase: "", value: "" }]);
  }

  function removeExperience(index: number) {
    onChange(value.filter((_, idx) => idx !== index));
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg text-amber-200">Experiences</h3>
        <p className="text-xs text-slate-400">
          Experiences describe signature tricks or special training. Tier {tier} adversaries often have 1-3.
        </p>
      </div>

      <div className="space-y-2">
        {value.map((experience, index) => (
          <div key={`${experience.phrase}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
            <label className="text-xs text-slate-300">
              Phrase
              <input
                className="field mt-1"
                value={experience.phrase}
                onChange={(event) => updateExperience(index, { phrase: event.target.value })}
                placeholder="Ancient hunter"
              />
            </label>
            <label className="text-xs text-slate-300">
              Value
              <input
                className="field mt-1"
                value={experience.value ?? ""}
                onChange={(event) => updateExperience(index, { value: event.target.value })}
                placeholder="+2"
              />
            </label>
            <button
              type="button"
              className="btn-outline min-h-11 px-3 py-2 text-xs"
              onClick={() => removeExperience(index)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="btn-primary min-h-11 px-3 py-2 text-xs" onClick={addExperience}>
        Add Experience
      </button>
    </section>
  );
}
