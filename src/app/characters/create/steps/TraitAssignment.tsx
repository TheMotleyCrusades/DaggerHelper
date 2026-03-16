"use client";

import { useEffect, useMemo, useState } from "react";
import { TRAIT_KEYS, type TraitMap, getClassDefinition } from "@/lib/constants/classes";

type Props = {
  className: string;
  traits: TraitMap;
  pointsTotal: number;
  onSetTraits: (traits: TraitMap) => void;
  onSetTrait: (trait: keyof TraitMap, value: number) => void;
};

const POINT_BUY_TARGET = 3;

const TRAIT_HELP: Record<keyof TraitMap, string> = {
  agility: "Mobility, speed, and nimble maneuvering.",
  strength: "Power, force, and endurance under pressure.",
  finesse: "Precision, control, and technical execution.",
  instinct: "Awareness, intuition, and tactical reaction.",
  presence: "Influence, charisma, and force of personality.",
  knowledge: "Lore, analysis, and arcane understanding.",
};

function getConstraintStatus(traits: TraitMap) {
  const values = Object.values(traits);
  const count = (value: number) => values.filter((item) => item === value).length;

  return {
    hasPlusTwo: count(2) === 1,
    hasTwoPlusOne: count(1) === 2,
    hasTwoZero: count(0) === 2,
    hasOneMinusOne: count(-1) === 1,
  };
}

function clampTraitValue(value: number) {
  return Math.max(-3, Math.min(3, Math.round(value)));
}

export function TraitAssignmentStep({
  className,
  traits,
  pointsTotal,
  onSetTraits,
  onSetTrait,
}: Props) {
  const [useRecommended, setUseRecommended] = useState(false);
  const selectedClass = useMemo(() => getClassDefinition(className), [className]);
  const recommendedLocked = Boolean(selectedClass) && useRecommended;
  const remainingPoints = POINT_BUY_TARGET - pointsTotal;
  const constraints = getConstraintStatus(traits);
  const constraintsMet = Object.values(constraints).every(Boolean);

  useEffect(() => {
    if (selectedClass && useRecommended) {
      onSetTraits(selectedClass.recommendedTraits);
    }
  }, [onSetTraits, selectedClass, useRecommended]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl text-amber-300">Step 3 - Trait Assignment</h2>
        <p className="text-sm text-slate-300">
          Choose recommended values or tune each trait manually.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Standard spread: +2, +1, +1, 0, 0, -1.
        </p>
      </div>

      <label
        className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm ${
          selectedClass
            ? "border-slate-700/50 text-slate-200"
            : "cursor-not-allowed border-slate-700/30 text-slate-500"
        }`}
      >
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={recommendedLocked}
          disabled={!selectedClass}
          onChange={(event) => {
            const enabled = event.target.checked;
            setUseRecommended(enabled);
            if (enabled && selectedClass) {
              onSetTraits(selectedClass.recommendedTraits);
            }
          }}
        />
        Select recommended traits
      </label>

      {selectedClass && (
        <div className="rounded-md border border-amber-700/35 bg-amber-950/20 p-3">
          <p className="text-sm text-amber-200">Recommended for {selectedClass.label}</p>
          <p className="mt-1 text-xs text-slate-300">{selectedClass.description}</p>
        </div>
      )}

      {!selectedClass && (
        <p className="text-xs text-amber-200">
          Select a class in Step 2 to unlock class-recommended trait defaults.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TRAIT_KEYS.map((trait) => (
          <label key={trait} className="text-sm capitalize text-slate-300">
            <span className="mb-0.5 block">{trait}</span>
            <span className="block text-[11px] normal-case text-slate-400">{TRAIT_HELP[trait]}</span>
            <input
              className="field mt-1"
              type="number"
              min={-3}
              max={3}
              step={1}
              disabled={recommendedLocked}
              value={traits[trait]}
              onChange={(event) => onSetTrait(trait, clampTraitValue(Number(event.target.value)))}
            />
          </label>
        ))}
      </div>

      <div className="rounded-md border border-slate-700/50 bg-slate-900/70 p-3 text-sm">
        <p className="text-slate-200">Point-Buy Target: {POINT_BUY_TARGET}</p>
        <p className={remainingPoints === 0 ? "text-emerald-300" : "text-amber-200"}>
          Remaining Points: {remainingPoints}
        </p>
        <p className={constraintsMet ? "text-emerald-300" : "text-slate-300"}>
          Constraint Pattern: +2, +1, +1, 0, 0, -1
        </p>
      </div>

      <ul className="grid gap-1 text-xs text-slate-300 sm:grid-cols-2">
        <li className={constraints.hasPlusTwo ? "text-emerald-300" : "text-slate-400"}>One trait at +2</li>
        <li className={constraints.hasTwoPlusOne ? "text-emerald-300" : "text-slate-400"}>Two traits at +1</li>
        <li className={constraints.hasTwoZero ? "text-emerald-300" : "text-slate-400"}>Two traits at 0</li>
        <li className={constraints.hasOneMinusOne ? "text-emerald-300" : "text-slate-400"}>One trait at -1</li>
      </ul>
    </section>
  );
}
