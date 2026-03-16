"use client";

import { FormEvent, useMemo, useState } from "react";
import { ADVERSARY_TYPES } from "@/lib/adversaries";
import { AdversaryStatBlock } from "@/components/adversaries/adversary-stat-block";

type Experience = { phrase: string; value?: string };
type Feature = { name: string; type: string; description: string };

export type AdversaryFormValue = {
  name: string;
  description?: string;
  tier: number;
  type: string;
  motives?: string;
  difficulty?: number;
  majorThreshold?: string;
  severeThreshold?: string;
  hp?: string;
  stress?: string;
  atk?: string;
  damageAverage?: string;
  potentialDicePools?: string[];
  experiences?: Experience[];
  features?: Feature[];
  weaponName?: string;
  weaponRange?: string;
  damageDice?: string;
  imageUrl?: string;
  tags?: string[];
  isPublic?: boolean;
};

type Props = {
  initial?: Partial<AdversaryFormValue>;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (value: AdversaryFormValue) => Promise<void> | void;
};

function parseCsv(input: string) {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseExperiences(input: string): Experience[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [phrase, value] = line.split("|").map((item) => item.trim());
      return { phrase, value: value || undefined };
    })
    .filter((item) => item.phrase.length > 0);
}

function parseFeatures(input: string): Feature[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, type = "standard", description = ""] = line.split("|").map((item) => item.trim());
      return { name, type, description };
    })
    .filter((item) => item.name.length > 0);
}

export function AdversaryForm({
  initial,
  submitLabel,
  pendingLabel,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tier, setTier] = useState(initial?.tier ?? 1);
  const [type, setType] = useState(initial?.type ?? "standard");
  const [motives, setMotives] = useState(initial?.motives ?? "");
  const [difficulty, setDifficulty] = useState(initial?.difficulty?.toString() ?? "");
  const [majorThreshold, setMajorThreshold] = useState(initial?.majorThreshold ?? "");
  const [severeThreshold, setSevereThreshold] = useState(initial?.severeThreshold ?? "");
  const [hp, setHp] = useState(initial?.hp ?? "");
  const [stress, setStress] = useState(initial?.stress ?? "");
  const [atk, setAtk] = useState(initial?.atk ?? "");
  const [damageAverage, setDamageAverage] = useState(initial?.damageAverage ?? "");
  const [damageDice, setDamageDice] = useState(initial?.damageDice ?? "");
  const [weaponName, setWeaponName] = useState(initial?.weaponName ?? "");
  const [weaponRange, setWeaponRange] = useState(initial?.weaponRange ?? "Melee");
  const [dicePoolsInput, setDicePoolsInput] = useState((initial?.potentialDicePools ?? []).join(", "));
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(", "));
  const [experiencesInput, setExperiencesInput] = useState(
    (initial?.experiences ?? [])
      .map((experience) => `${experience.phrase}${experience.value ? `|${experience.value}` : ""}`)
      .join("\n")
  );
  const [featuresInput, setFeaturesInput] = useState(
    (initial?.features ?? [])
      .map((feature) => `${feature.name}|${feature.type}|${feature.description}`)
      .join("\n")
  );
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draft = useMemo<AdversaryFormValue>(() => {
    const tags = parseCsv(tagsInput).map((tag) => tag.toLowerCase());
    const potentialDicePools = parseCsv(dicePoolsInput);
    const experiences = parseExperiences(experiencesInput);
    const features = parseFeatures(featuresInput);
    return {
      name: name.trim(),
      description: description.trim() || undefined,
      tier,
      type,
      motives: motives.trim() || undefined,
      difficulty: difficulty ? Number(difficulty) : undefined,
      majorThreshold: majorThreshold.trim() || undefined,
      severeThreshold: severeThreshold.trim() || undefined,
      hp: hp.trim() || undefined,
      stress: stress.trim() || undefined,
      atk: atk.trim() || undefined,
      damageAverage: damageAverage.trim() || undefined,
      weaponName: weaponName.trim() || undefined,
      weaponRange: weaponRange.trim() || undefined,
      damageDice: damageDice.trim() || undefined,
      tags: tags.length ? tags : undefined,
      potentialDicePools: potentialDicePools.length ? potentialDicePools : undefined,
      experiences: experiences.length ? experiences : undefined,
      features: features.length ? features : undefined,
      isPublic,
    };
  }, [
    atk,
    damageAverage,
    damageDice,
    description,
    dicePoolsInput,
    difficulty,
    experiencesInput,
    featuresInput,
    hp,
    isPublic,
    majorThreshold,
    motives,
    name,
    severeThreshold,
    stress,
    tagsInput,
    tier,
    type,
    weaponName,
    weaponRange,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await onSubmit(draft);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to submit adversary"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-300 sm:col-span-2">
            Name
            <input className="field mt-1" required value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <label className="text-sm text-slate-300">
            Tier
            <input
              className="field mt-1"
              required
              type="number"
              min={1}
              max={4}
              value={tier}
              onChange={(event) => setTier(Number(event.target.value))}
            />
          </label>

          <label className="text-sm text-slate-300">
            Type
            <select className="field mt-1" value={type} onChange={(event) => setType(event.target.value)}>
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
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label className="text-sm text-slate-300">
          Motives & Tactics
          <textarea
            className="field mt-1 min-h-20"
            value={motives}
            onChange={(event) => setMotives(event.target.value)}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm text-slate-300">
            Difficulty
            <input className="field mt-1" value={difficulty} onChange={(event) => setDifficulty(event.target.value)} />
          </label>
          <label className="text-sm text-slate-300">
            Major Threshold
            <input
              className="field mt-1"
              value={majorThreshold}
              onChange={(event) => setMajorThreshold(event.target.value)}
            />
          </label>
          <label className="text-sm text-slate-300">
            Severe Threshold
            <input
              className="field mt-1"
              value={severeThreshold}
              onChange={(event) => setSevereThreshold(event.target.value)}
            />
          </label>
          <label className="text-sm text-slate-300">
            Damage Avg
            <input
              className="field mt-1"
              value={damageAverage}
              onChange={(event) => setDamageAverage(event.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-slate-300">
            HP
            <input className="field mt-1" value={hp} onChange={(event) => setHp(event.target.value)} />
          </label>
          <label className="text-sm text-slate-300">
            Stress
            <input className="field mt-1" value={stress} onChange={(event) => setStress(event.target.value)} />
          </label>
          <label className="text-sm text-slate-300">
            ATK
            <input className="field mt-1" value={atk} onChange={(event) => setAtk(event.target.value)} />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-slate-300">
            Weapon Name
            <input
              className="field mt-1"
              value={weaponName}
              onChange={(event) => setWeaponName(event.target.value)}
            />
          </label>
          <label className="text-sm text-slate-300">
            Weapon Range
            <input
              className="field mt-1"
              value={weaponRange}
              onChange={(event) => setWeaponRange(event.target.value)}
            />
          </label>
          <label className="text-sm text-slate-300">
            Damage Dice
            <input
              className="field mt-1"
              value={damageDice}
              onChange={(event) => setDamageDice(event.target.value)}
            />
          </label>
        </div>

        <label className="text-sm text-slate-300">
          Potential Dice Pools (comma separated)
          <input
            className="field mt-1"
            value={dicePoolsInput}
            onChange={(event) => setDicePoolsInput(event.target.value)}
            placeholder="2d8, 1d20"
          />
        </label>

        <label className="text-sm text-slate-300">
          Features (one per line: name|type|description)
          <textarea
            className="field mt-1 min-h-28"
            value={featuresInput}
            onChange={(event) => setFeaturesInput(event.target.value)}
            placeholder="Battle Roar|action|All foes in close range are Frightened"
          />
        </label>

        <label className="text-sm text-slate-300">
          Experiences (one per line: phrase|value)
          <textarea
            className="field mt-1 min-h-20"
            value={experiencesInput}
            onChange={(event) => setExperiencesInput(event.target.value)}
            placeholder="Ancient hunter|+2"
          />
        </label>

        <label className="text-sm text-slate-300">
          Tags (comma separated)
          <input
            className="field mt-1"
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            placeholder="undead, boss, fire"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
          Share publicly to community
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn-primary px-4 py-2 text-sm" disabled={submitting}>
          {submitting ? pendingLabel : submitLabel}
        </button>
      </form>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Live Preview</p>
        <AdversaryStatBlock adversary={draft} />
      </div>
    </div>
  );
}
