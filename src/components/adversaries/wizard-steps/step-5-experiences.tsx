import type { AdversaryFormValue } from "@/components/adversaries/adversary-form";
import type { AdversaryExperience } from "@/components/adversaries/adversary-types";
import { ExperiencesEditor } from "@/components/adversaries/experiences-editor";

export function Step5Experiences({
  value,
  onChange,
}: {
  value: AdversaryFormValue;
  onChange: (patch: Partial<AdversaryFormValue>) => void;
}) {
  const experiences = (value.experiences ?? []) as AdversaryExperience[];

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl text-amber-200">Step 5: Experiences</h2>
        <p className="text-sm text-slate-400">Highlight training and unique tricks.</p>
      </header>

      <ExperiencesEditor value={experiences} onChange={(next) => onChange({ experiences: next })} tier={value.tier} />
    </section>
  );
}
