"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BackgroundQuestions } from "@/components/characters/background-questions";
import { ConnectionsEditor } from "@/components/characters/connections-editor";
import { NarrativeEditor } from "@/components/characters/narrative-editor";
import type {
  CharacterRuleConfiguration,
  ConditionDefinition,
  CurrencyConfiguration,
  CustomFieldDefinition,
  ResourceDefinition,
} from "@/lib/campaign-metadata";
import { DEFAULT_CHARACTER_SHEET_CUSTOMIZATION } from "@/lib/campaign-metadata";
import type {
  AdvancementSelectionStore,
  CharacterRecord,
  RuntimeConditionStateStore,
  RuntimeCurrencyStore,
  RuntimeCustomFieldStore,
  RuntimeResourceStore,
} from "@/lib/characters";
import { CLASS_DEFINITIONS, HERITAGE_OPTIONS, TRAIT_KEYS, type TraitMap } from "@/lib/constants/classes";
import {
  LEVEL_UP_OPTIONS,
  baseLevelUpOptionId,
  getLevelUpOptionCost,
  isLevelUpOptionAvailable,
} from "@/lib/constants/leveling";

export type CharacterEditorValue = {
  campaignId: number | null;
  name: string;
  pronouns: string;
  heritage: string;
  class: string;
  subclass: string;
  level: number;
  traits: TraitMap;
  baseEvasion: number;
  hpCurrent: number | null;
  hpMax: number | null;
  stressCurrent: number | null;
  stressMax: number | null;
  hopeCurrent: number | null;
  hopeMax: number | null;
  experienceCurrent: number | null;
  experienceMax: number | null;
  proficiency: number;
  rallyDie: string;
  primaryWeaponId: string;
  secondaryWeaponId: string;
  armorId: string;
  domainCards: string[];
  backgroundQuestions: Record<string, string>;
  connections: Array<Record<string, unknown>>;
  narrativeBackstory: string;
  advancementSelections: AdvancementSelectionStore;
  inventoryItems: Array<Record<string, unknown>>;
  gold: number;
  handfuls: number;
  bags: number;
  debt: number;
  resourceValues: RuntimeResourceStore;
  conditionStates: RuntimeConditionStateStore;
  currencyValues: RuntimeCurrencyStore;
  customFieldValues: RuntimeCustomFieldStore;
};

type ResourceKey =
  | "hpCurrent"
  | "hpMax"
  | "stressCurrent"
  | "stressMax"
  | "hopeCurrent"
  | "hopeMax"
  | "experienceCurrent"
  | "experienceMax";

const RESOURCE_FIELDS: Array<{ key: ResourceKey; label: string }> = [
  { key: "hpCurrent", label: "HP Current" },
  { key: "hpMax", label: "HP Max" },
  { key: "stressCurrent", label: "Stress Current" },
  { key: "stressMax", label: "Stress Max" },
  { key: "hopeCurrent", label: "Hope Current" },
  { key: "hopeMax", label: "Hope Max" },
  { key: "experienceCurrent", label: "Experience Current" },
  { key: "experienceMax", label: "Experience Max" },
];

const LEGACY_RESOURCE_MAP: Record<ResourceKey, { resourceId: string; slot: "current" | "max" }> = {
  hpCurrent: { resourceId: "hp", slot: "current" },
  hpMax: { resourceId: "hp", slot: "max" },
  stressCurrent: { resourceId: "stress", slot: "current" },
  stressMax: { resourceId: "stress", slot: "max" },
  hopeCurrent: { resourceId: "hope", slot: "current" },
  hopeMax: { resourceId: "hope", slot: "max" },
  experienceCurrent: { resourceId: "experience", slot: "current" },
  experienceMax: { resourceId: "experience", slot: "max" },
};

function buildInitialResourceStore(character: CharacterRecord): RuntimeResourceStore {
  return {
    hp: {
      current: character.hpCurrent ?? 0,
      max: character.hpMax ?? null,
    },
    stress: {
      current: character.stressCurrent ?? 0,
      max: character.stressMax ?? null,
    },
    hope: {
      current: character.hopeCurrent ?? 0,
      max: character.hopeMax ?? null,
    },
    experience: {
      current: character.experienceCurrent ?? 0,
      max: character.experienceMax ?? null,
    },
    ...character.resourceValues,
  };
}

function buildInitialCurrencyStore(character: CharacterRecord): RuntimeCurrencyStore {
  const next: RuntimeCurrencyStore = {
    ...character.currencyValues,
  };

  if (next.gold === undefined) next.gold = character.gold;
  if (next.handfuls === undefined) next.handfuls = character.handfuls;
  if (next.bags === undefined) next.bags = character.bags;

  return next;
}

function defaultCustomFieldValue(type: CustomFieldDefinition["type"]) {
  if (type === "checkbox") return false;
  if (type === "number") return 0;
  return "";
}

function syncLegacyValues(value: CharacterEditorValue): CharacterEditorValue {
  const hp = value.resourceValues.hp;
  const stress = value.resourceValues.stress;
  const hope = value.resourceValues.hope;
  const experience = value.resourceValues.experience;

  return {
    ...value,
    hpCurrent: hp?.current ?? value.hpCurrent,
    hpMax: hp?.max ?? value.hpMax,
    stressCurrent: stress?.current ?? value.stressCurrent,
    stressMax: stress?.max ?? value.stressMax,
    hopeCurrent: hope?.current ?? value.hopeCurrent,
    hopeMax: hope?.max ?? value.hopeMax,
    experienceCurrent: experience?.current ?? value.experienceCurrent,
    experienceMax: experience?.max ?? value.experienceMax,
    gold: value.currencyValues.gold ?? value.gold,
    handfuls: value.currencyValues.handfuls ?? value.handfuls,
    bags: value.currencyValues.bags ?? value.bags,
  };
}

function toEditorValue(character: CharacterRecord): CharacterEditorValue {
  return syncLegacyValues({
    campaignId: character.campaignId,
    name: character.name,
    pronouns: character.pronouns ?? "",
    heritage: character.heritage,
    class: character.class,
    subclass: character.subclass,
    level: character.level,
    traits: character.traits,
    baseEvasion: character.baseEvasion,
    hpCurrent: character.hpCurrent,
    hpMax: character.hpMax,
    stressCurrent: character.stressCurrent,
    stressMax: character.stressMax,
    hopeCurrent: character.hopeCurrent,
    hopeMax: character.hopeMax,
    experienceCurrent: character.experienceCurrent,
    experienceMax: character.experienceMax,
    proficiency: character.proficiency,
    rallyDie: character.rallyDie,
    primaryWeaponId: character.primaryWeaponId ?? "",
    secondaryWeaponId: character.secondaryWeaponId ?? "",
    armorId: character.armorId ?? "",
    domainCards: character.domainCards,
    backgroundQuestions: character.backgroundQuestions,
    connections: character.connections,
    narrativeBackstory: character.narrativeBackstory ?? "",
    advancementSelections: character.advancementSelections,
    inventoryItems: character.inventoryItems,
    gold: character.gold,
    handfuls: character.handfuls,
    bags: character.bags,
    debt: character.debt,
    resourceValues: buildInitialResourceStore(character),
    conditionStates: {
      ...character.conditionStates,
    },
    currencyValues: buildInitialCurrencyStore(character),
    customFieldValues: {
      ...character.customFieldValues,
    },
  });
}

function parseInteger(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function parseNumericCustomField(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const SECTION_CLASS =
  "rounded-xl border border-slate-700/55 bg-slate-900/60 p-4 backdrop-blur-sm";
const CARD_CLASS =
  "rounded-xl border border-slate-700/55 bg-gradient-to-br from-slate-950/80 via-slate-900/65 to-slate-950/75 p-3";

function isCraftingLevelUpOption(optionId: string) {
  const baseId = baseLevelUpOptionId(optionId);
  return (
    baseId === "crafting_profession" ||
    baseId === "crafting_mastery" ||
    baseId === "crafting_specialization"
  );
}

function resourceFormatLabel(format: ResourceDefinition["format"]) {
  if (format === "current_max") return "Current / Max";
  if (format === "single") return "Single Value";
  return "Toggle";
}

export function CharacterEditor({
  initial,
  campaignOptions,
  submitLabel,
  pendingLabel,
  onSubmit,
}: {
  initial: CharacterRecord;
  campaignOptions: Array<{ id: number; name: string }>;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (value: CharacterEditorValue) => Promise<void> | void;
}) {
  const [form, setForm] = useState<CharacterEditorValue>(() => toEditorValue(initial));
  const [domainInput, setDomainInput] = useState(initial.domainCards.join(", "));
  const [resources, setResources] = useState<ResourceDefinition[]>([]);
  const [currency, setCurrency] = useState<CurrencyConfiguration | undefined>(undefined);
  const [conditions, setConditions] = useState<ConditionDefinition[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [characterRules, setCharacterRules] = useState<CharacterRuleConfiguration>(
    DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.characterRules
  );
  const [craftingEnabled, setCraftingEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClass = useMemo(
    () => CLASS_DEFINITIONS.find((item) => item.id === form.class),
    [form.class]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCampaignSettings() {
      if (!form.campaignId) {
        setResources([]);
        setCurrency(undefined);
        setConditions([]);
        setCustomFields([]);
        setCharacterRules(DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.characterRules);
        setCraftingEnabled(false);
        return;
      }

      const response = await fetch(`/api/campaigns/${form.campaignId}/settings`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (cancelled || !response.ok) return;

      const resourceDefinitions = Array.isArray(data.resources) ? data.resources : [];
      const conditionDefinitions = Array.isArray(data.conditions) ? data.conditions : [];
      const customFieldDefinitions = Array.isArray(data.customFields) ? data.customFields : [];
      const currencyConfig =
        data.currency && typeof data.currency === "object"
          ? (data.currency as CurrencyConfiguration)
          : undefined;
      const nextCharacterRules =
        data.characterRules && typeof data.characterRules === "object"
          ? ({
              ...DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.characterRules,
              ...(data.characterRules as Partial<CharacterRuleConfiguration>),
            } as CharacterRuleConfiguration)
          : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.characterRules;

      setResources(resourceDefinitions);
      setConditions(conditionDefinitions);
      setCustomFields(customFieldDefinitions);
      setCurrency(currencyConfig);
      setCharacterRules(nextCharacterRules);
      setCraftingEnabled(Boolean(data.craftingRules?.enabled));

      setForm((current) => {
        const nextResourceValues: RuntimeResourceStore = {
          ...current.resourceValues,
        };
        for (const resource of resourceDefinitions) {
          if (!nextResourceValues[resource.id]) {
            nextResourceValues[resource.id] = {
              current: resource.defaultCurrent,
              max: resource.format === "single" || resource.format === "checkbox" ? null : resource.defaultMax,
            };
          }
        }

        const nextConditionStates: RuntimeConditionStateStore = {
          ...current.conditionStates,
        };
        for (const condition of conditionDefinitions) {
          if (nextConditionStates[condition.id] === undefined) {
            nextConditionStates[condition.id] = false;
          }
        }

        const nextCurrencyValues: RuntimeCurrencyStore = {
          ...current.currencyValues,
        };
        for (const denomination of currencyConfig?.denominations ?? []) {
          if (nextCurrencyValues[denomination.id] === undefined) {
            nextCurrencyValues[denomination.id] = denomination.defaultAmount;
          }
        }

        const nextCustomFieldValues: RuntimeCustomFieldStore = {
          ...current.customFieldValues,
        };
        for (const field of customFieldDefinitions) {
          if (nextCustomFieldValues[field.id] === undefined) {
            nextCustomFieldValues[field.id] = defaultCustomFieldValue(field.type);
          }
        }

        return syncLegacyValues({
          ...current,
          resourceValues: nextResourceValues,
          conditionStates: nextConditionStates,
          currencyValues: nextCurrencyValues,
          customFieldValues: nextCustomFieldValues,
        });
      });
    }

    void loadCampaignSettings();
    return () => {
      cancelled = true;
    };
  }, [form.campaignId]);

  useEffect(() => {
    if (craftingEnabled) return;

    setForm((current) => {
      let changed = false;
      const nextAdvancementSelections = Object.fromEntries(
        Object.entries(current.advancementSelections)
          .map(([level, selections]) => {
            const filtered = selections.filter((selectionId) => !isCraftingLevelUpOption(selectionId));
            if (filtered.length !== selections.length) {
              changed = true;
            }
            if (!filtered.length) return null;
            return [level, filtered] as const;
          })
          .filter((entry): entry is readonly [string, string[]] => Boolean(entry))
      );

      if (!changed) return current;
      return {
        ...current,
        advancementSelections: nextAdvancementSelections,
      };
    });
  }, [craftingEnabled]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const next = syncLegacyValues({
      ...form,
      name: form.name.trim(),
      domainCards: domainInput
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      primaryWeaponId: form.primaryWeaponId.trim(),
      secondaryWeaponId: form.secondaryWeaponId.trim(),
      armorId: form.armorId.trim(),
      narrativeBackstory: form.narrativeBackstory.trim(),
      advancementSelections: { ...form.advancementSelections },
      conditionStates: { ...form.conditionStates },
      customFieldValues: { ...form.customFieldValues },
    });

    try {
      await onSubmit(next);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save character");
    } finally {
      setSaving(false);
    }
  }

  const editableResources = resources.filter((resource) => resource.visibleOn.editor);
  const sortedCustomFields = [...customFields].sort((a, b) => a.position - b.position);
  const currencyDenominations = [...(currency?.denominations ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  const gmLockedResourceCount = editableResources.filter((resource) => !resource.playerEditable).length;
  const playerConditionCount = conditions.filter((condition) => condition.playerToggle).length;
  const levelUpPointsPerLevel = Math.max(1, characterRules.levelUpPointsPerLevel);
  const visibleLevelUpOptions = useMemo(
    () =>
      LEVEL_UP_OPTIONS.filter((option) => {
        if (isCraftingLevelUpOption(option.id) && !craftingEnabled) return false;
        return true;
      }),
    [craftingEnabled]
  );
  const advancementLevels = Array.from({ length: Math.max(0, form.level - 1) }, (_, index) =>
    String(index + 2)
  );

  function toggleAdvancementOption(level: string, optionId: string) {
    setForm((current) => {
      const levelNumber = Number(level);
      const currentSelections = current.advancementSelections[level] ?? [];
      const isSelected = currentSelections.some(
        (selectionId) => baseLevelUpOptionId(selectionId) === optionId
      );
      const nextSelections = isSelected
        ? currentSelections.filter((item) => baseLevelUpOptionId(item) !== optionId)
        : [...currentSelections.filter((item) => baseLevelUpOptionId(item) !== optionId), optionId];

      const spent = nextSelections.reduce(
        (sum, entryId) => sum + getLevelUpOptionCost(entryId, characterRules),
        0
      );
      const selectable =
        isSelected ||
        (spent <= levelUpPointsPerLevel &&
          isLevelUpOptionAvailable(optionId, levelNumber, characterRules) &&
          (!isCraftingLevelUpOption(optionId) || craftingEnabled));

      if (!selectable) {
        return current;
      }

      const nextAdvancementSelections = {
        ...current.advancementSelections,
      };

      if (nextSelections.length === 0) {
        delete nextAdvancementSelections[level];
      } else {
        nextAdvancementSelections[level] = nextSelections;
      }

      return {
        ...current,
        advancementSelections: nextAdvancementSelections,
      };
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <section className={SECTION_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg text-amber-200">Campaign Runtime Profile</h3>
            <p className="text-xs text-slate-400">
              Editing runtime values against this campaign&apos;s active character-sheet rules.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <p className="rounded-md border border-slate-700/55 bg-slate-950/60 px-2 py-1 text-slate-300">
              Resources: <span className="text-slate-100">{editableResources.length || 4}</span>
            </p>
            <p className="rounded-md border border-slate-700/55 bg-slate-950/60 px-2 py-1 text-slate-300">
              Currency: <span className="text-slate-100">{currencyDenominations.length || 3}</span>
            </p>
            <p className="rounded-md border border-slate-700/55 bg-slate-950/60 px-2 py-1 text-slate-300">
              Conditions: <span className="text-slate-100">{conditions.length}</span>
            </p>
            <p className="rounded-md border border-slate-700/55 bg-slate-950/60 px-2 py-1 text-slate-300">
              Custom: <span className="text-slate-100">{sortedCustomFields.length}</span>
            </p>
          </div>
        </div>
      </section>

      <section className={`${SECTION_CLASS} grid gap-3 sm:grid-cols-2`}>
        <label className="text-sm text-slate-300 sm:col-span-2">
          Campaign
          <select
            className="field mt-1"
            value={form.campaignId ?? ""}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                campaignId: Number(event.target.value) || null,
              }))
            }
          >
            <option value="">Select campaign</option>
            {campaignOptions.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300 sm:col-span-2">
          Name
          <input
            className="field mt-1"
            required
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </label>

        <label className="text-sm text-slate-300">
          Pronouns
          <input
            className="field mt-1"
            value={form.pronouns}
            onChange={(event) => setForm((current) => ({ ...current, pronouns: event.target.value }))}
          />
        </label>

        <label className="text-sm text-slate-300">
          Heritage
          <select
            className="field mt-1"
            value={form.heritage}
            onChange={(event) => setForm((current) => ({ ...current, heritage: event.target.value }))}
          >
            <option value="">Select heritage</option>
            {HERITAGE_OPTIONS.map((heritage) => (
              <option key={heritage} value={heritage}>
                {heritage}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Class
          <select
            className="field mt-1"
            value={form.class}
            onChange={(event) =>
              setForm((current) => {
                const nextClassId = event.target.value;
                const nextClass = CLASS_DEFINITIONS.find((item) => item.id === nextClassId);
                if (!nextClass) {
                  return {
                    ...current,
                    class: nextClassId,
                    subclass: "",
                  };
                }

                return syncLegacyValues({
                  ...current,
                  class: nextClassId,
                  subclass: "",
                  baseEvasion: nextClass.startingEvasion,
                  hpCurrent: nextClass.startingHp,
                  hpMax: nextClass.startingHp,
                  resourceValues: {
                    ...current.resourceValues,
                    hp: {
                      current: nextClass.startingHp,
                      max: nextClass.startingHp,
                    },
                  },
                });
              })
            }
          >
            <option value="">Select class</option>
            {CLASS_DEFINITIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Subclass
          <select
            className="field mt-1"
            disabled={!selectedClass}
            value={form.subclass}
            onChange={(event) => setForm((current) => ({ ...current, subclass: event.target.value }))}
          >
            <option value="">Select subclass</option>
            {selectedClass?.subclasses.map((subclass) => (
              <option key={subclass} value={subclass}>
                {subclass}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Level
          <input
            className="field mt-1"
            type="number"
            min={1}
            max={10}
            value={form.level}
            onChange={(event) =>
              setForm((current) => {
                const nextLevel = Math.max(1, Math.min(10, Number(event.target.value) || 1));
                return {
                  ...current,
                  level: nextLevel,
                  advancementSelections: Object.fromEntries(
                    Object.entries(current.advancementSelections).filter(([level]) => {
                      const parsedLevel = Number(level);
                      return Number.isFinite(parsedLevel) && parsedLevel <= nextLevel;
                    })
                  ),
                };
              })
            }
          />
        </label>

        <label className="text-sm text-slate-300">
          Base Evasion
          <input
            className="field mt-1"
            type="number"
            min={-20}
            max={99}
            value={form.baseEvasion}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                baseEvasion: parseInteger(event.target.value) ?? 0,
              }))
            }
          />
        </label>
      </section>

      <section className={SECTION_CLASS}>
        <div className="mb-3">
          <h3 className="text-lg text-amber-200">Level-Up Progression</h3>
          <p className="text-xs text-slate-400">
            Track advancement picks for each level. Budget: {levelUpPointsPerLevel} points per
            level-up.
          </p>
        </div>

        {advancementLevels.length === 0 ? (
          <p className="text-sm text-slate-300">
            Character is level 1. Advancement choices unlock from level 2 onward.
          </p>
        ) : (
          <div className="space-y-3">
            {advancementLevels.map((level) => {
              const levelNumber = Number(level);
              const selected = form.advancementSelections[level] ?? [];
              const pointsSpent = selected.reduce(
                (sum, optionId) => sum + getLevelUpOptionCost(optionId, characterRules),
                0
              );
              return (
                <article
                  key={`advancement-level-${level}`}
                  className="rounded-lg border border-slate-700/50 bg-slate-950/60 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm text-amber-100">Level {level} Advancements</p>
                    <p
                      className={`text-xs ${
                        pointsSpent <= levelUpPointsPerLevel ? "text-slate-300" : "text-red-300"
                      }`}
                    >
                      {pointsSpent}/{levelUpPointsPerLevel} points
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {visibleLevelUpOptions.map((option) => {
                      const selectedOption = selected.some(
                        (selectionId) => baseLevelUpOptionId(selectionId) === option.id
                      );
                      const optionCost = getLevelUpOptionCost(option.id, characterRules);
                      const available = isLevelUpOptionAvailable(
                        option.id,
                        levelNumber,
                        characterRules
                      ) && (!isCraftingLevelUpOption(option.id) || craftingEnabled);
                      const disabled = !selectedOption && !available;

                      return (
                        <label
                          key={`${level}-${option.id}`}
                          className={`inline-flex min-h-11 items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                            selectedOption
                              ? "border-amber-500/55 bg-amber-950/25 text-amber-100"
                              : "border-slate-700/50 text-slate-300"
                          } ${disabled ? "opacity-50" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedOption}
                            disabled={disabled}
                            onChange={() => toggleAdvancementOption(level, option.id)}
                          />
                          <span>
                            <span className="block text-slate-100">
                              {option.label} ({optionCost} pt)
                            </span>
                            <span className="block text-[11px] text-slate-400">
                              {option.description}
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              {option.impact}
                            </span>
                            {!available && option.id === "multiclass" && (
                              <span className="block text-[11px] text-slate-500">
                                Requires level {characterRules.multiclassMinLevel}+
                              </span>
                            )}
                            {!craftingEnabled && isCraftingLevelUpOption(option.id) && (
                              <span className="block text-[11px] text-slate-500">
                                Crafting must be enabled in campaign customization.
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className={SECTION_CLASS}>
        <div className="mb-3">
          <h3 className="text-lg text-amber-200">Traits</h3>
          <p className="text-xs text-slate-400">Use these values for checks, attacks, and class features.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TRAIT_KEYS.map((trait) => (
            <label key={trait} className="text-sm capitalize text-slate-300">
              {trait}
              <input
                className="field mt-1"
                type="number"
                min={-3}
                max={3}
                value={form.traits[trait]}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    traits: {
                      ...current.traits,
                      [trait]: Number(event.target.value) || 0,
                    },
                  }))
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section className={SECTION_CLASS}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-lg text-amber-200">Resources</h3>
            <p className="text-xs text-slate-400">
              Runtime trackers generated from campaign settings.
            </p>
          </div>
          {gmLockedResourceCount > 0 ? (
            <p className="rounded-full border border-amber-700/55 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-200">
              {gmLockedResourceCount} resource{gmLockedResourceCount === 1 ? "" : "s"} GM-managed
            </p>
          ) : null}
        </div>
        {editableResources.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {editableResources.map((resource) => {
              const value = form.resourceValues[resource.id] ?? {
                current: resource.defaultCurrent,
                max: resource.format === "single" || resource.format === "checkbox" ? null : resource.defaultMax,
              };

              return (
                <div key={resource.id} className={CARD_CLASS}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-slate-100">{resource.label}</p>
                      <p className="text-[11px] text-slate-400">
                        Range {resource.min}-{resource.max}
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      <span className="rounded-full border border-slate-700/60 bg-slate-900/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                        {resourceFormatLabel(resource.format)}
                      </span>
                      {!resource.playerEditable ? (
                        <span className="rounded-full border border-amber-700/60 bg-amber-950/35 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
                          GM Managed
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {resource.format === "checkbox" ? (
                    <button
                      aria-pressed={value.current > 0}
                      className={`w-full rounded-md border px-3 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        value.current > 0
                          ? "border-emerald-500/55 bg-emerald-950/25 text-emerald-100"
                          : "border-slate-700/60 bg-slate-950/60 text-slate-300 hover:border-slate-500/70"
                      }`}
                      disabled={!resource.playerEditable}
                      onClick={() =>
                        setForm((current) => {
                          const currentlyActive = (current.resourceValues[resource.id]?.current ?? value.current) > 0;
                          const nextResourceValues = {
                            ...current.resourceValues,
                            [resource.id]: {
                              current: currentlyActive ? 0 : 1,
                              max: null,
                            },
                          };
                          return syncLegacyValues({
                            ...current,
                            resourceValues: nextResourceValues,
                          });
                        })
                      }
                      type="button"
                    >
                      {value.current > 0 ? "Active" : "Inactive"}
                    </button>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="text-xs text-slate-300">
                        Current
                        <input
                          className="field mt-1"
                          disabled={!resource.playerEditable}
                          type="number"
                          value={value.current}
                          onChange={(event) =>
                            setForm((current) => {
                              const parsed = parseInteger(event.target.value);
                              const existing = current.resourceValues[resource.id] ?? {
                                current: resource.defaultCurrent,
                                max:
                                  resource.format === "single" || resource.format === "checkbox"
                                    ? null
                                    : resource.defaultMax,
                              };
                              const nextResourceValues = {
                                ...current.resourceValues,
                                [resource.id]: {
                                  current: parsed ?? existing.current,
                                  max: resource.format === "single" ? null : existing.max,
                                },
                              };
                              return syncLegacyValues({
                                ...current,
                                resourceValues: nextResourceValues,
                              });
                            })
                          }
                        />
                      </label>
                      {resource.format === "current_max" ? (
                        <label className="text-xs text-slate-300">
                          Max
                          <input
                            className="field mt-1"
                            disabled={!resource.playerEditable}
                            type="number"
                            value={value.max ?? ""}
                            onChange={(event) =>
                              setForm((current) => {
                                const parsed = parseInteger(event.target.value);
                                const existing = current.resourceValues[resource.id] ?? {
                                  current: resource.defaultCurrent,
                                  max: resource.defaultMax,
                                };
                                const nextResourceValues = {
                                  ...current.resourceValues,
                                  [resource.id]: {
                                    current: existing.current,
                                    max: parsed,
                                  },
                                };
                                return syncLegacyValues({
                                  ...current,
                                  resourceValues: nextResourceValues,
                                });
                              })
                            }
                          />
                        </label>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {RESOURCE_FIELDS.map(({ key, label }) => (
              <label key={key} className="text-sm text-slate-300">
                {label}
                <input
                  className="field mt-1"
                  type="number"
                  value={form[key] ?? ""}
                  onChange={(event) =>
                    setForm((current) => {
                      const parsed = parseInteger(event.target.value);
                      const mapping = LEGACY_RESOURCE_MAP[key];
                      const existingResource = current.resourceValues[mapping.resourceId] ?? {
                        current: 0,
                        max: null,
                      };

                      const nextResourceValues = {
                        ...current.resourceValues,
                        [mapping.resourceId]: {
                          current:
                            mapping.slot === "current"
                              ? parsed ?? existingResource.current
                              : existingResource.current,
                          max:
                            mapping.slot === "max"
                              ? parsed
                              : existingResource.max,
                        },
                      };

                      return syncLegacyValues({
                        ...current,
                        [key]: parsed,
                        resourceValues: nextResourceValues,
                      });
                    })
                  }
                />
              </label>
            ))}
          </div>
        )}
      </section>

      <section className={`${SECTION_CLASS} grid gap-3 sm:grid-cols-2`}>
        <article className="rounded-md border border-slate-700/50 bg-slate-950/55 px-3 py-2 text-xs text-slate-300 sm:col-span-2">
          Equipment slots and inventory are managed on the character sheet via the equipment panel.
        </article>
        <label className="text-sm text-slate-300 sm:col-span-2">
          Domain Cards (comma separated IDs)
          <input className="field mt-1" value={domainInput} onChange={(event) => setDomainInput(event.target.value)} />
        </label>
      </section>

      <section className={SECTION_CLASS}>
        <div className="mb-3">
          <h3 className="text-lg text-amber-200">Currency</h3>
          <p className="text-xs text-slate-400">
            {currency?.mode
              ? `Mode: ${currency.mode}.`
              : "Using fallback coin fields."}
          </p>
        </div>
        {currencyDenominations.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {currencyDenominations.map((denomination) => (
              <label key={denomination.id} className={`${CARD_CLASS} text-sm text-slate-300`}>
                <span className="block text-sm text-slate-100">{denomination.label}</span>
                <span className="mb-2 block text-[11px] text-slate-400">
                  {denomination.abbreviation}
                </span>
                <input
                  className="field mt-1"
                  type="number"
                  value={form.currencyValues[denomination.id] ?? 0}
                  onChange={(event) =>
                    setForm((current) => {
                      const parsed = parseInteger(event.target.value) ?? 0;
                      return syncLegacyValues({
                        ...current,
                        currencyValues: {
                          ...current.currencyValues,
                          [denomination.id]: parsed,
                        },
                      });
                    })
                  }
                />
              </label>
            ))}
            {currency?.debtEnabled ? (
              <label className={`${CARD_CLASS} text-sm text-slate-300`}>
                <span className="block text-sm text-slate-100">{currency.debtLabel}</span>
                <span className="mb-2 block text-[11px] text-slate-400">Campaign debt tracker</span>
                <input
                  className="field mt-1"
                  type="number"
                  value={form.debt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      debt: parseInteger(event.target.value) ?? 0,
                    }))
                  }
                />
              </label>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className={`${CARD_CLASS} text-sm text-slate-300`}>
              <span className="mb-2 block text-sm text-slate-100">Gold</span>
              <input
                className="field mt-1"
                type="number"
                value={form.gold}
                onChange={(event) =>
                  setForm((current) =>
                    syncLegacyValues({
                      ...current,
                      currencyValues: {
                        ...current.currencyValues,
                        gold: parseInteger(event.target.value) ?? 0,
                      },
                    })
                  )
                }
              />
            </label>
            <label className={`${CARD_CLASS} text-sm text-slate-300`}>
              <span className="mb-2 block text-sm text-slate-100">Handfuls</span>
              <input
                className="field mt-1"
                type="number"
                value={form.handfuls}
                onChange={(event) =>
                  setForm((current) =>
                    syncLegacyValues({
                      ...current,
                      currencyValues: {
                        ...current.currencyValues,
                        handfuls: parseInteger(event.target.value) ?? 0,
                      },
                    })
                  )
                }
              />
            </label>
            <label className={`${CARD_CLASS} text-sm text-slate-300`}>
              <span className="mb-2 block text-sm text-slate-100">Bags</span>
              <input
                className="field mt-1"
                type="number"
                value={form.bags}
                onChange={(event) =>
                  setForm((current) =>
                    syncLegacyValues({
                      ...current,
                      currencyValues: {
                        ...current.currencyValues,
                        bags: parseInteger(event.target.value) ?? 0,
                      },
                    })
                  )
                }
              />
            </label>
            <label className={`${CARD_CLASS} text-sm text-slate-300`}>
              <span className="mb-2 block text-sm text-slate-100">Debt</span>
              <input
                className="field mt-1"
                type="number"
                value={form.debt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    debt: parseInteger(event.target.value) ?? 0,
                  }))
                }
              />
            </label>
          </div>
        )}
      </section>

      {conditions.length > 0 && (
        <section className={SECTION_CLASS}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-lg text-amber-200">Conditions</h3>
              <p className="text-xs text-slate-400">Toggle active state for current character runtime.</p>
            </div>
            <p className="rounded-full border border-slate-700/55 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-300">
              Player toggles: <span className="text-slate-100">{playerConditionCount}</span>
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {conditions.map((condition) => (
              <article key={condition.id} className={CARD_CLASS}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="text-sm text-slate-100">{condition.name}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                      condition.playerToggle
                        ? "border-emerald-700/55 bg-emerald-950/25 text-emerald-200"
                        : "border-amber-700/55 bg-amber-950/25 text-amber-200"
                    }`}
                  >
                    {condition.playerToggle ? "Player Toggle" : "GM Managed"}
                  </span>
                </div>
                <p className="mb-3 text-xs text-slate-400">{condition.description}</p>
                <button
                  aria-pressed={Boolean(form.conditionStates[condition.id])}
                  className={`w-full rounded-md border px-3 py-2 text-left text-xs transition ${
                    form.conditionStates[condition.id]
                      ? "border-emerald-500/55 bg-emerald-950/25 text-emerald-100"
                      : "border-slate-700/60 bg-slate-950/60 text-slate-300 hover:border-slate-500/70"
                  }`}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      conditionStates: {
                        ...current.conditionStates,
                        [condition.id]: !Boolean(current.conditionStates[condition.id]),
                      },
                    }))
                  }
                  type="button"
                >
                  {form.conditionStates[condition.id] ? "Active" : "Inactive"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {sortedCustomFields.length > 0 && (
        <section className={SECTION_CLASS}>
          <div className="mb-3">
            <h3 className="text-lg text-amber-200">Custom Fields</h3>
            <p className="text-xs text-slate-400">
              Campaign-defined fields mapped directly to this character record.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sortedCustomFields.map((field) => {
              const value = form.customFieldValues[field.id];
              if (field.type === "checkbox") {
                return (
                  <article key={field.id} className={CARD_CLASS}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="text-sm text-slate-100">{field.name}</p>
                      {field.required ? (
                        <span className="rounded-full border border-amber-700/60 bg-amber-950/35 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
                          Required
                        </span>
                      ) : null}
                    </div>
                    <button
                      aria-pressed={Boolean(value)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-xs transition ${
                        Boolean(value)
                          ? "border-emerald-500/55 bg-emerald-950/25 text-emerald-100"
                          : "border-slate-700/60 bg-slate-950/60 text-slate-300 hover:border-slate-500/70"
                      }`}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          customFieldValues: {
                            ...current.customFieldValues,
                            [field.id]: !Boolean(current.customFieldValues[field.id]),
                          },
                        }))
                      }
                      type="button"
                    >
                      {Boolean(value) ? "Enabled" : "Disabled"}
                    </button>
                  </article>
                );
              }

              if (field.type === "number") {
                return (
                  <label key={field.id} className={`${CARD_CLASS} text-sm text-slate-300`}>
                    <span className="mb-1 block text-sm text-slate-100">
                      {field.name}
                      {field.required ? (
                        <span className="ml-1 text-[11px] text-amber-300">*</span>
                      ) : null}
                    </span>
                    <input
                      className="field mt-1"
                      type="number"
                      value={typeof value === "number" ? value : ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          customFieldValues: {
                            ...current.customFieldValues,
                            [field.id]: parseNumericCustomField(event.target.value),
                          },
                        }))
                      }
                    />
                  </label>
                );
              }

              return (
                <label key={field.id} className={`${CARD_CLASS} text-sm text-slate-300`}>
                  <span className="mb-1 block text-sm text-slate-100">
                    {field.name}
                    {field.required ? (
                      <span className="ml-1 text-[11px] text-amber-300">*</span>
                    ) : null}
                  </span>
                  <input
                    className="field mt-1"
                    value={typeof value === "string" ? value : ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        customFieldValues: {
                          ...current.customFieldValues,
                          [field.id]: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              );
            })}
          </div>
        </section>
      )}

      <BackgroundQuestions
        className={form.class}
        values={form.backgroundQuestions}
        onChange={(backgroundQuestions) => setForm((current) => ({ ...current, backgroundQuestions }))}
      />

      <ConnectionsEditor
        values={form.connections}
        onChange={(connections) => setForm((current) => ({ ...current, connections }))}
      />

      <NarrativeEditor
        value={form.narrativeBackstory}
        onChange={(narrativeBackstory) => setForm((current) => ({ ...current, narrativeBackstory }))}
      />

      <section className={`${SECTION_CLASS} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          {error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : (
            <p className="text-xs text-slate-400">
              Save applies runtime resources, conditions, currencies, and custom fields together.
            </p>
          )}
        </div>
        <button className="btn-primary min-h-11 px-4 py-2 text-sm" disabled={saving} type="submit">
          {saving ? pendingLabel : submitLabel}
        </button>
      </section>
    </form>
  );
}
