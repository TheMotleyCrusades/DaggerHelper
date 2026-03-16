"use client";

import { useMemo, useState } from "react";
import {
  LEVEL_UP_OPTIONS,
  baseLevelUpOptionId,
  getLevelUpOptionCost,
  isLevelUpOptionAvailable,
  levelUpOptionPayload,
  type LevelingRuleSettings,
} from "@/lib/constants/leveling";
import type { HomebrewEntityRecord } from "@/lib/homebrew-library";

type AdvancementSelectionStore = Record<string, string[]>;

type ProfessionOption = {
  id: string;
  label: string;
  description?: string;
};

type Props = {
  level: number;
  className: string;
  classOptions: HomebrewEntityRecord[];
  advancementSelections: AdvancementSelectionStore;
  rules: LevelingRuleSettings;
  craftingEnabled?: boolean;
  professionOptions?: ProfessionOption[];
  onChange: (next: AdvancementSelectionStore) => void;
};

type ParsedSelection = {
  level: number;
  token: string;
  baseId: string;
  payload: string | null;
};

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function payloadKey(levelNumber: number, optionId: string) {
  return `${levelNumber}:${optionId}`;
}

function formatPayloadLabel(payload: string) {
  return payload
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isCraftingOption(optionId: string) {
  return (
    optionId === "crafting_profession" ||
    optionId === "crafting_mastery" ||
    optionId === "crafting_specialization"
  );
}

function requiresPayload(optionId: string) {
  return (
    optionId === "multiclass" ||
    optionId === "crafting_profession" ||
    optionId === "crafting_mastery" ||
    optionId === "crafting_specialization"
  );
}

export function LevelUpStep({
  level,
  className,
  classOptions,
  advancementSelections,
  rules,
  craftingEnabled = false,
  professionOptions = [],
  onChange,
}: Props) {
  const [draftPayloads, setDraftPayloads] = useState<Record<string, string>>({});
  const levelUpPointsPerLevel = Math.max(1, rules.levelUpPointsPerLevel);
  const currentClassId = normalizeToken(className);

  const parsedSelections = useMemo<ParsedSelection[]>(() => {
    return Object.entries(advancementSelections)
      .flatMap(([levelKey, tokens]) => {
        const levelNumber = Number(levelKey);
        if (!Number.isFinite(levelNumber) || levelNumber < 2) return [];
        return tokens.map((token) => ({
          level: levelNumber,
          token,
          baseId: baseLevelUpOptionId(token),
          payload: levelUpOptionPayload(token),
        }));
      })
      .sort((left, right) => left.level - right.level);
  }, [advancementSelections]);

  const availableClassChoices = useMemo(() => {
    return classOptions
      .map((entry) => ({
        id: normalizeToken(entry.id),
        label: entry.name.trim() || formatPayloadLabel(normalizeToken(entry.id)),
      }))
      .filter((entry) => entry.id.length > 0 && entry.id !== currentClassId)
      .reduce<Array<{ id: string; label: string }>>((acc, entry) => {
        if (!acc.some((item) => item.id === entry.id)) {
          acc.push(entry);
        }
        return acc;
      }, [])
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [classOptions, currentClassId]);

  const normalizedProfessionOptions = useMemo(() => {
    return professionOptions
      .map((entry) => {
        const id = normalizeToken(entry.id);
        return {
          id,
          label: entry.label.trim() || formatPayloadLabel(id),
          description: entry.description?.trim() ?? "",
        };
      })
      .filter((entry) => entry.id.length > 0)
      .reduce<ProfessionOption[]>((acc, entry) => {
        if (!acc.some((item) => normalizeToken(item.id) === entry.id)) {
          acc.push(entry);
        }
        return acc;
      }, [])
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [professionOptions]);

  const professionLabelById = useMemo(() => {
    const entries = normalizedProfessionOptions.map((entry) => [entry.id, entry.label] as const);
    return new Map(entries);
  }, [normalizedProfessionOptions]);

  const visibleOptions = useMemo(() => {
    return LEVEL_UP_OPTIONS.filter((option) => {
      if (isCraftingOption(option.id) && !craftingEnabled) return false;
      return true;
    });
  }, [craftingEnabled]);

  const advancementLevels = useMemo(() => {
    return Array.from({ length: Math.max(0, level - 1) }, (_, index) => index + 2);
  }, [level]);

  const levelSelectionMap = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const levelNumber of advancementLevels) {
      map.set(levelNumber, advancementSelections[String(levelNumber)] ?? []);
    }
    return map;
  }, [advancementLevels, advancementSelections]);

  function findSelectedToken(levelNumber: number, optionId: string) {
    const tokens = levelSelectionMap.get(levelNumber) ?? [];
    return tokens.find((token) => baseLevelUpOptionId(token) === optionId) ?? null;
  }

  function collectPayloads(baseId: string, predicate: (levelNumber: number) => boolean) {
    const set = new Set<string>();
    for (const selection of parsedSelections) {
      if (selection.baseId !== baseId) continue;
      if (!selection.payload) continue;
      if (!predicate(selection.level)) continue;
      set.add(selection.payload);
    }
    return set;
  }

  function payloadOptionsFor(
    levelNumber: number,
    optionId: string,
    currentPayload: string | null
  ): ProfessionOption[] {
    if (optionId === "multiclass") {
      const options = availableClassChoices.map((entry) => ({
        id: entry.id,
        label: entry.label,
      }));
      if (currentPayload && !options.some((entry) => entry.id === currentPayload)) {
        options.unshift({
          id: currentPayload,
          label: formatPayloadLabel(currentPayload),
        });
      }
      return options;
    }

    if (optionId === "crafting_profession") {
      const takenElsewhere = collectPayloads("crafting_profession", (rowLevel) => rowLevel !== levelNumber);
      const options = normalizedProfessionOptions.filter(
        (entry) => !takenElsewhere.has(entry.id) || entry.id === currentPayload
      );
      if (currentPayload && !options.some((entry) => entry.id === currentPayload)) {
        options.unshift({
          id: currentPayload,
          label: professionLabelById.get(currentPayload) ?? formatPayloadLabel(currentPayload),
        });
      }
      return options;
    }

    if (optionId === "crafting_mastery") {
      const learnedBefore = collectPayloads("crafting_profession", (rowLevel) => rowLevel < levelNumber);
      const masteredElsewhere = collectPayloads("crafting_mastery", (rowLevel) => rowLevel !== levelNumber);
      const options = Array.from(learnedBefore)
        .filter((id) => !masteredElsewhere.has(id) || id === currentPayload)
        .map((id) => ({
          id,
          label: professionLabelById.get(id) ?? formatPayloadLabel(id),
        }))
        .sort((left, right) => left.label.localeCompare(right.label));

      if (currentPayload && !options.some((entry) => entry.id === currentPayload)) {
        options.unshift({
          id: currentPayload,
          label: professionLabelById.get(currentPayload) ?? formatPayloadLabel(currentPayload),
        });
      }
      return options;
    }

    if (optionId === "crafting_specialization") {
      const masteredBefore = collectPayloads("crafting_mastery", (rowLevel) => rowLevel < levelNumber);
      const specializedElsewhere = collectPayloads(
        "crafting_specialization",
        (rowLevel) => rowLevel !== levelNumber
      );
      const options = Array.from(masteredBefore)
        .filter((id) => !specializedElsewhere.has(id) || id === currentPayload)
        .map((id) => ({
          id,
          label: professionLabelById.get(id) ?? formatPayloadLabel(id),
        }))
        .sort((left, right) => left.label.localeCompare(right.label));

      if (currentPayload && !options.some((entry) => entry.id === currentPayload)) {
        options.unshift({
          id: currentPayload,
          label: professionLabelById.get(currentPayload) ?? formatPayloadLabel(currentPayload),
        });
      }
      return options;
    }

    return [];
  }

  function isOptionUsable(
    optionId: string,
    levelNumber: number,
    payloadChoices: ProfessionOption[]
  ) {
    if (!isLevelUpOptionAvailable(optionId, levelNumber, rules)) return false;
    if (isCraftingOption(optionId) && !craftingEnabled) return false;

    if (requiresPayload(optionId)) {
      return payloadChoices.length > 0;
    }

    return true;
  }

  function updateLevelSelections(levelNumber: number, nextLevelSelections: string[]) {
    const levelKey = String(levelNumber);
    const nextStore: AdvancementSelectionStore = { ...advancementSelections };
    if (nextLevelSelections.length === 0) {
      delete nextStore[levelKey];
    } else {
      nextStore[levelKey] = nextLevelSelections;
    }
    onChange(nextStore);
  }

  function toggleOption(levelNumber: number, optionId: string, payloadValue: string | null) {
    const levelSelections = levelSelectionMap.get(levelNumber) ?? [];
    const selectedToken = findSelectedToken(levelNumber, optionId);
    const isSelected = Boolean(selectedToken);

    if (isSelected) {
      const nextLevelSelections = levelSelections.filter(
        (token) => baseLevelUpOptionId(token) !== optionId
      );
      updateLevelSelections(levelNumber, nextLevelSelections);
      return;
    }

    const nextToken = requiresPayload(optionId)
      ? payloadValue
        ? `${optionId}:${payloadValue}`
        : null
      : optionId;
    if (!nextToken) return;

    const payloadChoices = payloadOptionsFor(levelNumber, optionId, payloadValue);
    if (!isOptionUsable(optionId, levelNumber, payloadChoices)) return;

    const nextLevelSelections = [
      ...levelSelections.filter((token) => baseLevelUpOptionId(token) !== optionId),
      nextToken,
    ];
    const spent = nextLevelSelections.reduce(
      (sum, entryId) => sum + getLevelUpOptionCost(entryId, rules),
      0
    );
    if (spent > levelUpPointsPerLevel) return;

    updateLevelSelections(levelNumber, nextLevelSelections);
  }

  function changeOptionPayload(levelNumber: number, optionId: string, payload: string) {
    const normalizedPayload = normalizeToken(payload);
    if (!normalizedPayload) return;

    setDraftPayloads((current) => ({
      ...current,
      [payloadKey(levelNumber, optionId)]: normalizedPayload,
    }));

    const levelSelections = levelSelectionMap.get(levelNumber) ?? [];
    const selectedToken = findSelectedToken(levelNumber, optionId);
    if (!selectedToken) return;

    const nextToken = `${optionId}:${normalizedPayload}`;
    const nextLevelSelections = [
      ...levelSelections.filter((token) => baseLevelUpOptionId(token) !== optionId),
      nextToken,
    ];
    updateLevelSelections(levelNumber, nextLevelSelections);
  }

  if (advancementLevels.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-2xl text-amber-300">Step 6 - Level Up</h2>
        <p className="text-sm text-slate-300">
          You are starting at level 1. Level-up choices unlock once the character starts above level 1.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-3">
        <h2 className="text-2xl text-amber-300">Step 6 - Level Up</h2>
        <p className="text-sm text-slate-200">
          Celebrate each level with meaningful picks. Every level-up has {levelUpPointsPerLevel} point
          {levelUpPointsPerLevel === 1 ? "" : "s"} to spend.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Crafting level-up options only appear when the GM enables crafting in campaign customization.
        </p>
      </div>

      {advancementLevels.map((levelNumber) => {
        const levelSelections = levelSelectionMap.get(levelNumber) ?? [];
        const pointsSpent = levelSelections.reduce(
          (sum, optionId) => sum + getLevelUpOptionCost(optionId, rules),
          0
        );

        return (
          <article
            key={`level-up-${levelNumber}`}
            className="space-y-3 rounded-xl border border-slate-700/55 bg-slate-900/70 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg text-amber-200">Level {levelNumber}</h3>
              <p
                className={`rounded-full border px-2 py-1 text-xs ${
                  pointsSpent <= levelUpPointsPerLevel
                    ? "border-emerald-500/45 bg-emerald-950/30 text-emerald-200"
                    : "border-red-500/45 bg-red-950/30 text-red-200"
                }`}
              >
                {pointsSpent}/{levelUpPointsPerLevel} points
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {visibleOptions.map((option) => {
                const selectedToken = findSelectedToken(levelNumber, option.id);
                const selected = Boolean(selectedToken);
                const selectedPayload = selectedToken ? levelUpOptionPayload(selectedToken) : null;
                const payloadChoices = payloadOptionsFor(levelNumber, option.id, selectedPayload);
                const draftPayload =
                  draftPayloads[payloadKey(levelNumber, option.id)] ?? payloadChoices[0]?.id ?? null;
                const activePayload = selectedPayload ?? draftPayload;
                const available = isOptionUsable(option.id, levelNumber, payloadChoices);
                const disabled = !selected && !available;
                const optionCost = getLevelUpOptionCost(option.id, rules);
                const multiclassUnavailable = option.id === "multiclass" && payloadChoices.length === 0;
                const masteryLocked = option.id === "crafting_mastery" && payloadChoices.length === 0;
                const specializationLocked =
                  option.id === "crafting_specialization" && payloadChoices.length === 0;

                return (
                  <label
                    key={`${levelNumber}-${option.id}`}
                    className={`space-y-2 rounded-md border px-3 py-2 text-xs ${
                      selected
                        ? "border-amber-500/60 bg-amber-950/25"
                        : "border-slate-700/60 bg-slate-950/55"
                    } ${disabled ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4"
                        checked={selected}
                        disabled={disabled}
                        onChange={() => toggleOption(levelNumber, option.id, activePayload)}
                      />
                      <span>
                        <span className="block text-slate-100">
                          {option.label} ({optionCost} pt)
                        </span>
                        <span className="block text-[11px] text-slate-400">{option.description}</span>
                        <span className="block text-[11px] text-slate-500">{option.impact}</span>
                      </span>
                    </div>

                    {requiresPayload(option.id) && (
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          Selection
                        </p>
                        <select
                          className="field"
                          value={activePayload ?? ""}
                          disabled={payloadChoices.length === 0}
                          onChange={(event) =>
                            changeOptionPayload(levelNumber, option.id, event.target.value)
                          }
                        >
                          {payloadChoices.length === 0 ? (
                            <option value="">No valid options</option>
                          ) : (
                            payloadChoices.map((choice) => (
                              <option key={`${option.id}-${choice.id}`} value={choice.id}>
                                {choice.label}
                              </option>
                            ))
                          )}
                        </select>
                        {multiclassUnavailable && (
                          <p className="text-[11px] text-slate-500">
                            No alternate class options are currently available.
                          </p>
                        )}
                        {masteryLocked && (
                          <p className="text-[11px] text-slate-500">
                            Requires a crafting profession selected at an earlier level.
                          </p>
                        )}
                        {specializationLocked && (
                          <p className="text-[11px] text-slate-500">
                            Requires crafting mastery selected at an earlier level.
                          </p>
                        )}
                      </div>
                    )}

                    {!available && option.id === "multiclass" && !multiclassUnavailable && (
                      <p className="text-[11px] text-slate-500">
                        Requires level {Math.max(1, rules.multiclassMinLevel)}+
                      </p>
                    )}
                    {!craftingEnabled && isCraftingOption(option.id) && (
                      <p className="text-[11px] text-slate-500">
                        Enable crafting in campaign customization to unlock this option.
                      </p>
                    )}
                  </label>
                );
              })}
            </div>
          </article>
        );
      })}
    </section>
  );
}
