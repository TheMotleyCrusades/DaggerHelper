import type { AdversaryFormValue } from "@/components/adversaries/adversary-form";
import type { AdversaryFeature } from "@/components/adversaries/adversary-types";
import { FeatureSelector } from "@/components/adversaries/feature-selector";

export function Step4Features({
  value,
  onChange,
}: {
  value: AdversaryFormValue;
  onChange: (patch: Partial<AdversaryFormValue>) => void;
}) {
  const features = (value.features ?? []) as AdversaryFeature[];

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl text-amber-200">Step 4: Features</h2>
        <p className="text-sm text-slate-400">Select and customize special abilities.</p>
      </header>

      <FeatureSelector
        value={features}
        onChange={(next) => onChange({ features: next })}
        tier={value.tier}
      />
    </section>
  );
}
