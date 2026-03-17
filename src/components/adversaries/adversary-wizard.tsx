"use client";

import { useMemo, useState } from "react";
import type { AdversaryFormValue } from "@/components/adversaries/adversary-form";
import { AdversaryStatBlock } from "@/components/adversaries/adversary-stat-block";
import { Step1BasicInfo } from "@/components/adversaries/wizard-steps/step-1-basic-info";
import { Step2StatBlock } from "@/components/adversaries/wizard-steps/step-2-stat-block";
import { Step3Weapon } from "@/components/adversaries/wizard-steps/step-3-weapon";
import { Step4Features } from "@/components/adversaries/wizard-steps/step-4-features";
import { Step5Experiences } from "@/components/adversaries/wizard-steps/step-5-experiences";
import { Step6ImageTags } from "@/components/adversaries/wizard-steps/step-6-image-tags";
import { Step7Review } from "@/components/adversaries/wizard-steps/step-7-review";

type Props = {
  initial?: Partial<AdversaryFormValue>;
  onSubmit: (value: AdversaryFormValue) => Promise<void> | void;
};

const steps = [
  "Basic Info",
  "Stats",
  "Weapon",
  "Features",
  "Experiences",
  "Image & Tags",
  "Review",
] as const;

function parseCsv(input: string) {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeDraft(draft: AdversaryFormValue, tagsInput: string, dicePoolsInput: string): AdversaryFormValue {
  const tags = parseCsv(tagsInput).map((tag) => tag.toLowerCase());
  const dicePools = parseCsv(dicePoolsInput);
  const features = (draft.features ?? []).filter((feature) => feature.name.trim().length > 0);
  const experiences = (draft.experiences ?? []).filter((experience) => experience.phrase.trim().length > 0);

  return {
    ...draft,
    name: draft.name.trim(),
    description: draft.description?.trim() || undefined,
    motives: draft.motives?.trim() || undefined,
    majorThreshold: draft.majorThreshold?.trim() || undefined,
    severeThreshold: draft.severeThreshold?.trim() || undefined,
    hp: draft.hp?.trim() || undefined,
    stress: draft.stress?.trim() || undefined,
    atk: draft.atk?.trim() || undefined,
    damageAverage: draft.damageAverage?.trim() || undefined,
    weaponName: draft.weaponName?.trim() || undefined,
    weaponRange: draft.weaponRange?.trim() || undefined,
    damageDice: draft.damageDice?.trim() || undefined,
    tags: tags.length ? tags : undefined,
    potentialDicePools: dicePools.length ? dicePools : undefined,
    features: features.length ? features : undefined,
    experiences: experiences.length ? experiences : undefined,
  };
}

export function AdversaryWizard({ initial, onSubmit }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [draft, setDraft] = useState<AdversaryFormValue>(() => ({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    tier: initial?.tier ?? 1,
    type: initial?.type ?? "standard",
    motives: initial?.motives ?? "",
    difficulty: initial?.difficulty,
    majorThreshold: initial?.majorThreshold ?? "",
    severeThreshold: initial?.severeThreshold ?? "",
    hp: initial?.hp ?? "",
    stress: initial?.stress ?? "",
    atk: initial?.atk ?? "",
    damageAverage: initial?.damageAverage ?? "",
    weaponName: initial?.weaponName ?? "",
    weaponRange: initial?.weaponRange ?? "Melee",
    damageDice: initial?.damageDice ?? "",
    features: initial?.features ?? [],
    experiences: initial?.experiences ?? [],
    imageUrl: initial?.imageUrl ?? "",
    isPublic: initial?.isPublic ?? false,
  }));
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(", "));
  const [dicePoolsInput, setDicePoolsInput] = useState((initial?.potentialDicePools ?? []).join(", "));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => sanitizeDraft(draft, tagsInput, dicePoolsInput), [draft, tagsInput, dicePoolsInput]);

  function update(patch: Partial<AdversaryFormValue>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function canContinue() {
    if (currentStep === 0) {
      return draft.name.trim().length > 0;
    }
    return true;
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const payload = sanitizeDraft(draft, tagsInput, dicePoolsInput);
      await onSubmit(payload);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit adversary");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-700/35 bg-amber-950/20 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Step {currentStep + 1} of {steps.length}
          </p>
          <h3 className="text-lg text-amber-200">{steps[currentStep]}</h3>
          <div className="mt-2 h-1 w-full rounded-full bg-slate-800">
            <div
              className="h-1 rounded-full bg-amber-400/70"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-4">
          {currentStep === 0 && <Step1BasicInfo value={draft} onChange={update} />}
          {currentStep === 1 && <Step2StatBlock value={draft} onChange={update} />}
          {currentStep === 2 && (
            <Step3Weapon
              value={draft}
              onChange={update}
              dicePoolsInput={dicePoolsInput}
              onDicePoolsChange={setDicePoolsInput}
            />
          )}
          {currentStep === 3 && <Step4Features value={draft} onChange={update} />}
          {currentStep === 4 && <Step5Experiences value={draft} onChange={update} />}
          {currentStep === 5 && (
            <Step6ImageTags
              value={draft}
              onChange={update}
              tagsInput={tagsInput}
              onTagsChange={setTagsInput}
            />
          )}
          {currentStep === 6 && (
            <Step7Review
              value={preview}
              tags={preview.tags ?? []}
              dicePools={preview.potentialDicePools ?? []}
            />
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="btn-outline min-h-11 px-4 py-2 text-sm"
            onClick={() => setCurrentStep((step) => Math.max(step - 1, 0))}
            disabled={currentStep === 0 || submitting}
          >
            Previous
          </button>
          {currentStep < steps.length - 1 ? (
            <button
              type="button"
              className="btn-primary min-h-11 px-4 py-2 text-sm"
              onClick={() => setCurrentStep((step) => Math.min(step + 1, steps.length - 1))}
              disabled={!canContinue() || submitting}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary min-h-11 px-4 py-2 text-sm"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create Adversary"}
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Live Preview</p>
        <AdversaryStatBlock adversary={preview} />
      </div>
    </div>
  );
}
