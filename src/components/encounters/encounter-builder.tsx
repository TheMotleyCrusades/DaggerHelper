"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateBaseBudget,
  calculateEncounterCost,
  classifyDifficulty,
  ROLE_COSTS,
} from "@/lib/encounters";

export type EncounterSelection = {
  adversaryId: number;
  quantity: number;
};

type AdversaryOption = {
  id: number;
  name: string;
  type: string;
  tier: number;
};

export function EncounterBuilder({
  partySize,
  difficultyAdjustment,
  selections,
  onChange,
}: {
  partySize: number;
  difficultyAdjustment: number;
  selections: EncounterSelection[];
  onChange: (value: EncounterSelection[]) => void;
}) {
  const [available, setAvailable] = useState<AdversaryOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [mine, community] = await Promise.all([
        fetch("/api/adversaries", { cache: "no-store" }),
        fetch("/api/adversaries/public?limit=50", { cache: "no-store" }),
      ]);

      const mineData = await mine.json();
      const communityData = await community.json();
      if (cancelled) return;

      const options = new Map<number, AdversaryOption>();
      for (const row of (Array.isArray(mineData) ? mineData : []) as Array<AdversaryOption>) {
        options.set(row.id, row);
      }
      for (const row of ((communityData.items ?? []) as Array<AdversaryOption>)) {
        if (!options.has(row.id)) options.set(row.id, row);
      }

      setAvailable([...options.values()].sort((a, b) => a.name.localeCompare(b.name)));
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectionDetails = useMemo(() => {
    return selections.map((item) => {
      const adversary = available.find((option) => option.id === item.adversaryId) ?? null;
      return { ...item, adversary };
    });
  }, [available, selections]);

  const budget = calculateBaseBudget(partySize) + difficultyAdjustment;
  const spent = calculateEncounterCost(
    selectionDetails.map((item) => ({
      type: item.adversary?.type ?? "standard",
      quantity: item.quantity,
    }))
  );
  const difficulty = classifyDifficulty(spent, budget);

  function addSelection() {
    const adversaryId = Number(selectedId);
    if (!Number.isInteger(adversaryId) || adversaryId <= 0) return;
    const existing = selections.find((item) => item.adversaryId === adversaryId);
    if (existing) {
      onChange(
        selections.map((item) =>
          item.adversaryId === adversaryId ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      onChange([...selections, { adversaryId, quantity: 1 }]);
    }
    setSelectedId("");
  }

  function updateQuantity(adversaryId: number, quantity: number) {
    if (quantity <= 0) {
      onChange(selections.filter((item) => item.adversaryId !== adversaryId));
      return;
    }
    onChange(
      selections.map((item) =>
        item.adversaryId === adversaryId ? { ...item, quantity } : item
      )
    );
  }

  function removeSelection(adversaryId: number) {
    onChange(selections.filter((item) => item.adversaryId !== adversaryId));
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg text-amber-200">Encounter Builder</h3>
        <p className="text-sm text-slate-300">Select adversaries and tune quantity to match budget.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className="field min-w-[260px] flex-1" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          <option value="">Add adversary...</option>
          {available.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} (Tier {option.tier} | {option.type} | Cost {ROLE_COSTS[option.type] ?? 2})
            </option>
          ))}
        </select>
        <button className="btn-outline px-3 py-2 text-sm" onClick={addSelection} type="button">
          Add
        </button>
      </div>

      <div className="space-y-2">
        {selectionDetails.map((item) => (
          <article key={item.adversaryId} className="rounded-md border border-slate-700/50 bg-slate-900/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-slate-100">{item.adversary?.name ?? `Adversary #${item.adversaryId}`}</p>
                <p className="text-xs text-slate-400">
                  {item.adversary?.type ?? "standard"} | cost {ROLE_COSTS[item.adversary?.type ?? "standard"] ?? 2}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="field w-20"
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(event) => updateQuantity(item.adversaryId, Number(event.target.value))}
                />
                <button
                  className="rounded-md border border-red-400/45 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-950/30"
                  onClick={() => removeSelection(item.adversaryId)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-md border border-slate-700/50 bg-slate-900/70 p-3 text-sm">
        <p className="text-slate-200">Budget: {budget}</p>
        <p className="text-slate-200">Spent: {spent}</p>
        <p className="text-amber-200">Difficulty: {difficulty}</p>
      </div>
    </section>
  );
}
