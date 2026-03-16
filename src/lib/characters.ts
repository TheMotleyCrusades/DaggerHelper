import { z } from "zod";
import { resolveCharacterSheetCustomization, type CharacterSheetCustomization } from "@/lib/campaign-metadata";
import { TRAIT_KEYS, type TraitMap } from "@/lib/constants/classes";
import type {
  ResolvedCharacterCombat,
  ResolvedInventoryEntry,
} from "@/lib/equipment";
import {
  DEFAULT_CHARACTER_COMPANION_STATE,
  DEFAULT_CHARACTER_CRAFTING_STATE,
  DEFAULT_CHARACTER_DRUID_FORM_STATE,
  type CharacterCompanionState,
  type CharacterCraftingState,
  type CharacterDruidFormState,
} from "@/lib/optional-systems";

const CHARACTER_META_PREFIX = "[[DAGGERHELPER_CHARACTER_META]]";
const CHARACTER_META_VERSION = 1;

function toInt(value: unknown, fallback: number | null = null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function toStringOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toStringOrDefault(value: unknown, fallback: string) {
  const result = toStringOrNull(value);
  return result ?? fallback;
}

function toRecordString(value: unknown, fallback: Record<string, string>) {
  if (!value || typeof value !== "object") return fallback;
  const entries: Array<[string, string]> = [];
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (key.trim().length === 0 || typeof rawValue !== "string") continue;
    entries.push([key, rawValue.trim()]);
  }

  return entries.length ? Object.fromEntries(entries) : fallback;
}

function toRecordUnknown(value: unknown, fallback: Array<Record<string, unknown>>) {
  if (!Array.isArray(value)) return fallback;
  const next = value.filter(
    (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object"
  );
  return next.length ? next : [];
}

function toStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toRecordStringArray(value: unknown, fallback: Record<string, string[]> = {}) {
  if (!value || typeof value !== "object") return fallback;

  const next: Record<string, string[]> = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (!key.trim()) continue;
    const values = toStringArray(rawValue, []);
    if (!values.length) continue;
    next[key.trim()] = Array.from(new Set(values));
  }

  return next;
}

function toCharacterCraftingState(
  value: unknown,
  fallback: CharacterCraftingState
): CharacterCraftingState {
  if (!value || typeof value !== "object") {
    return {
      professions: [...fallback.professions],
      materials: { ...fallback.materials },
      notes: fallback.notes,
    };
  }

  const raw = value as Partial<CharacterCraftingState>;
  const professions = Array.isArray(raw.professions)
    ? raw.professions
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : fallback.professions;
  const materials: Record<string, number> = {};
  const sourceMaterials =
    raw.materials && typeof raw.materials === "object" ? raw.materials : fallback.materials;
  for (const [materialId, amount] of Object.entries(sourceMaterials)) {
    const parsed = toInt(amount, null);
    if (!materialId.trim() || parsed == null) continue;
    materials[materialId.trim()] = Math.max(0, parsed);
  }

  return {
    professions: Array.from(new Set(professions)),
    materials,
    notes: toStringOrDefault(raw.notes, fallback.notes),
  };
}

function toCharacterDruidFormState(
  value: unknown,
  fallback: CharacterDruidFormState
): CharacterDruidFormState {
  if (!value || typeof value !== "object") {
    return {
      knownFormIds: [...fallback.knownFormIds],
      activeFormId: fallback.activeFormId,
    };
  }

  const raw = value as Partial<CharacterDruidFormState>;
  return {
    knownFormIds: Array.isArray(raw.knownFormIds)
      ? Array.from(
          new Set(
            raw.knownFormIds
              .filter((item): item is string => typeof item === "string")
              .map((item) => item.trim())
              .filter(Boolean)
          )
        )
      : [...fallback.knownFormIds],
    activeFormId:
      raw.activeFormId === null
        ? null
        : toStringOrNull(raw.activeFormId) ?? fallback.activeFormId,
  };
}

function toCharacterCompanionState(
  value: unknown,
  fallback: CharacterCompanionState
): CharacterCompanionState {
  if (!value || typeof value !== "object") {
    return {
      ...fallback,
      attackProfile: { ...fallback.attackProfile },
      experiences: fallback.experiences.map((experience) => ({ ...experience })),
      upgrades: [...fallback.upgrades],
    };
  }

  const raw = value as Partial<CharacterCompanionState>;
  const attackProfileRaw: Record<string, unknown> =
    raw.attackProfile && typeof raw.attackProfile === "object"
      ? (raw.attackProfile as unknown as Record<string, unknown>)
      : {};
  const attackProfile = {
    label: toStringOrDefault(attackProfileRaw.label, fallback.attackProfile.label),
    traitMode: (() => {
      const value = toStringOrDefault(attackProfileRaw.traitMode, fallback.attackProfile.traitMode);
      if (
        value === "agility" ||
        value === "strength" ||
        value === "finesse" ||
        value === "instinct" ||
        value === "presence" ||
        value === "knowledge" ||
        value === "spellcast"
      ) {
        return value;
      }
      return fallback.attackProfile.traitMode;
    })(),
    rangeBand: (() => {
      const value = toStringOrDefault(attackProfileRaw.rangeBand, fallback.attackProfile.rangeBand);
      if (
        value === "melee" ||
        value === "very_close" ||
        value === "close" ||
        value === "far" ||
        value === "very_far"
      ) {
        return value;
      }
      return fallback.attackProfile.rangeBand;
    })(),
    damageFormula: toStringOrDefault(
      attackProfileRaw.damageFormula,
      fallback.attackProfile.damageFormula
    ),
    damageType: (() => {
      const value = toStringOrDefault(attackProfileRaw.damageType, fallback.attackProfile.damageType);
      if (value === "physical" || value === "magical") {
        return value;
      }
      return fallback.attackProfile.damageType;
    })(),
  } as CharacterCompanionState["attackProfile"];

  const experiences = Array.isArray(raw.experiences)
    ? raw.experiences
        .filter(
          (item): item is CharacterCompanionState["experiences"][number] =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof item.id === "string" &&
            typeof item.label === "string" &&
            Number.isFinite(Number((item as { value?: unknown }).value))
        )
        .map((experience) => ({
          id: experience.id.trim(),
          label: experience.label.trim(),
          value: Math.max(0, Math.round(Number(experience.value))),
        }))
        .filter((experience) => experience.id && experience.label)
    : fallback.experiences.map((experience) => ({ ...experience }));

  const upgrades = Array.isArray(raw.upgrades)
    ? Array.from(
        new Set(
          raw.upgrades
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
        )
      )
    : [...fallback.upgrades];

  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : fallback.enabled,
    name: toStringOrDefault(raw.name, fallback.name),
    species: toStringOrDefault(raw.species, fallback.species),
    evasion: Math.max(0, toInt(raw.evasion, fallback.evasion) ?? fallback.evasion),
    stressCurrent: Math.max(
      0,
      toInt(raw.stressCurrent, fallback.stressCurrent) ?? fallback.stressCurrent
    ),
    stressMax: Math.max(0, toInt(raw.stressMax, fallback.stressMax) ?? fallback.stressMax),
    attackName: toStringOrDefault(raw.attackName, fallback.attackName),
    attackProfile,
    experiences,
    upgrades,
    notes: toStringOrDefault(raw.notes, fallback.notes),
  };
}

function toRuntimeResourceStore(value: unknown): RuntimeResourceStore {
  if (!value || typeof value !== "object") return {};

  const next: RuntimeResourceStore = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (!key.trim() || !rawValue || typeof rawValue !== "object") continue;
    const entry = rawValue as { current?: unknown; max?: unknown };
    const current = toInt(entry.current, null);
    const maxRaw = entry.max;
    const max =
      maxRaw === null
        ? null
        : maxRaw === undefined
          ? null
          : toInt(maxRaw, null);

    if (current == null && max == null) continue;

    next[key.trim()] = {
      current: Math.max(0, current ?? 0),
      max: max == null ? null : Math.max(0, max),
    };
  }

  return next;
}

function mergeRuntimeResourceStore(
  base: RuntimeResourceStore,
  patch: unknown
): RuntimeResourceStore {
  const normalizedPatch = toRuntimeResourceStore(patch);
  if (!Object.keys(normalizedPatch).length) return { ...base };
  return {
    ...base,
    ...normalizedPatch,
  };
}

function toRuntimeConditionStateStore(value: unknown): RuntimeConditionStateStore {
  if (!value || typeof value !== "object") return {};

  const next: RuntimeConditionStateStore = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (!key.trim() || typeof rawValue !== "boolean") continue;
    next[key.trim()] = rawValue;
  }

  return next;
}

function mergeRuntimeConditionStateStore(
  base: RuntimeConditionStateStore,
  patch: unknown
): RuntimeConditionStateStore {
  const normalizedPatch = toRuntimeConditionStateStore(patch);
  if (!Object.keys(normalizedPatch).length) return { ...base };
  return {
    ...base,
    ...normalizedPatch,
  };
}

function toRuntimeCurrencyStore(value: unknown): RuntimeCurrencyStore {
  if (!value || typeof value !== "object") return {};

  const next: RuntimeCurrencyStore = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (!key.trim()) continue;
    const parsed = toInt(rawValue, null);
    if (parsed == null) continue;
    next[key.trim()] = parsed;
  }

  return next;
}

function mergeRuntimeCurrencyStore(
  base: RuntimeCurrencyStore,
  patch: unknown
): RuntimeCurrencyStore {
  const normalizedPatch = toRuntimeCurrencyStore(patch);
  if (!Object.keys(normalizedPatch).length) return { ...base };
  return {
    ...base,
    ...normalizedPatch,
  };
}

function toRuntimeCustomFieldStore(value: unknown): RuntimeCustomFieldStore {
  if (!value || typeof value !== "object") return {};

  const next: RuntimeCustomFieldStore = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (!key.trim()) continue;
    if (
      rawValue === null ||
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "boolean"
    ) {
      next[key.trim()] = rawValue as RuntimeCustomFieldValue;
    }
  }

  return next;
}

function mergeRuntimeCustomFieldStore(
  base: RuntimeCustomFieldStore,
  patch: unknown
): RuntimeCustomFieldStore {
  const normalizedPatch = toRuntimeCustomFieldStore(patch);
  if (!Object.keys(normalizedPatch).length) return { ...base };
  return {
    ...base,
    ...normalizedPatch,
  };
}

function buildLegacyResourceStore(metadata: Pick<
  StoredCharacterMetadata,
  | "hpCurrent"
  | "hpMax"
  | "stressCurrent"
  | "stressMax"
  | "hopeCurrent"
  | "hopeMax"
  | "experienceCurrent"
  | "experienceMax"
>): RuntimeResourceStore {
  const entries: RuntimeResourceStore = {};

  if (metadata.hpCurrent != null || metadata.hpMax != null) {
    entries.hp = {
      current: Math.max(0, metadata.hpCurrent ?? 0),
      max: metadata.hpMax == null ? null : Math.max(0, metadata.hpMax),
    };
  }
  if (metadata.stressCurrent != null || metadata.stressMax != null) {
    entries.stress = {
      current: Math.max(0, metadata.stressCurrent ?? 0),
      max: metadata.stressMax == null ? null : Math.max(0, metadata.stressMax),
    };
  }
  if (metadata.hopeCurrent != null || metadata.hopeMax != null) {
    entries.hope = {
      current: Math.max(0, metadata.hopeCurrent ?? 0),
      max: metadata.hopeMax == null ? null : Math.max(0, metadata.hopeMax),
    };
  }
  if (metadata.experienceCurrent != null || metadata.experienceMax != null) {
    entries.experience = {
      current: Math.max(0, metadata.experienceCurrent ?? 0),
      max: metadata.experienceMax == null ? null : Math.max(0, metadata.experienceMax),
    };
  }

  return entries;
}

function buildLegacyCurrencyStore(metadata: Pick<StoredCharacterMetadata, "gold" | "handfuls" | "bags">) {
  return {
    gold: Math.max(0, metadata.gold),
    handfuls: Math.max(0, metadata.handfuls),
    bags: Math.max(0, metadata.bags),
  } satisfies RuntimeCurrencyStore;
}

function mergeTraits(base: TraitMap, patch?: Partial<TraitMap>) {
  return TRAIT_KEYS.reduce(
    (acc, key) => {
      const raw = patch?.[key];
      const parsed = toInt(raw, base[key]);
      acc[key] = Math.max(-3, Math.min(3, parsed ?? base[key]));
      return acc;
    },
    {} as TraitMap
  );
}

const defaultTraits: TraitMap = {
  agility: 0,
  strength: 0,
  finesse: 0,
  instinct: 0,
  presence: 0,
  knowledge: 0,
};

export type RuntimeResourceValue = {
  current: number;
  max: number | null;
};

export type RuntimeResourceStore = Record<string, RuntimeResourceValue>;
export type RuntimeConditionStateStore = Record<string, boolean>;
export type RuntimeCurrencyStore = Record<string, number>;
export type RuntimeCustomFieldValue = string | number | boolean | null;
export type RuntimeCustomFieldStore = Record<string, RuntimeCustomFieldValue>;
export type AdvancementSelectionStore = Record<string, string[]>;

type StoredCharacterMetadata = {
  pronouns: string | null;
  heritage: string;
  subclass: string;
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
  primaryWeaponId: string | null;
  secondaryWeaponId: string | null;
  armorId: string | null;
  domainCards: string[];
  inventoryItems: Array<Record<string, unknown>>;
  gold: number;
  handfuls: number;
  bags: number;
  debt: number;
  backgroundQuestions: Record<string, string>;
  connections: Array<Record<string, unknown>>;
  narrativeBackstory: string | null;
  advancementSelections: AdvancementSelectionStore;
  resourceValues: RuntimeResourceStore;
  conditionStates: RuntimeConditionStateStore;
  currencyValues: RuntimeCurrencyStore;
  customFieldValues: RuntimeCustomFieldStore;
  craftingState: CharacterCraftingState;
  druidFormState: CharacterDruidFormState;
  companionState: CharacterCompanionState;
};

const defaultMetadata: StoredCharacterMetadata = {
  pronouns: null,
  heritage: "Unknown",
  subclass: "Generalist",
  traits: defaultTraits,
  baseEvasion: 0,
  hpCurrent: null,
  hpMax: null,
  stressCurrent: null,
  stressMax: null,
  hopeCurrent: null,
  hopeMax: null,
  experienceCurrent: 0,
  experienceMax: 1,
  proficiency: 1,
  rallyDie: "d6",
  primaryWeaponId: null,
  secondaryWeaponId: null,
  armorId: null,
  domainCards: [],
  inventoryItems: [],
  gold: 0,
  handfuls: 0,
  bags: 0,
  debt: 0,
  backgroundQuestions: {},
  connections: [],
  narrativeBackstory: null,
  advancementSelections: {},
  resourceValues: {},
  conditionStates: {},
  currencyValues: {},
  customFieldValues: {},
  craftingState: DEFAULT_CHARACTER_CRAFTING_STATE,
  druidFormState: DEFAULT_CHARACTER_DRUID_FORM_STATE,
  companionState: DEFAULT_CHARACTER_COMPANION_STATE,
};

function normalizeMetadata(partial: Partial<StoredCharacterMetadata>, fallback: StoredCharacterMetadata) {
  return {
    pronouns: partial.pronouns !== undefined ? toStringOrNull(partial.pronouns) : fallback.pronouns,
    heritage: toStringOrDefault(partial.heritage, fallback.heritage),
    subclass: toStringOrDefault(partial.subclass, fallback.subclass),
    traits: mergeTraits(fallback.traits, partial.traits),
    baseEvasion: toInt(partial.baseEvasion, fallback.baseEvasion) ?? fallback.baseEvasion,
    hpCurrent: toInt(partial.hpCurrent, fallback.hpCurrent),
    hpMax: toInt(partial.hpMax, fallback.hpMax),
    stressCurrent: toInt(partial.stressCurrent, fallback.stressCurrent),
    stressMax: toInt(partial.stressMax, fallback.stressMax),
    hopeCurrent: toInt(partial.hopeCurrent, fallback.hopeCurrent),
    hopeMax: toInt(partial.hopeMax, fallback.hopeMax),
    experienceCurrent: toInt(partial.experienceCurrent, fallback.experienceCurrent),
    experienceMax: toInt(partial.experienceMax, fallback.experienceMax),
    proficiency: Math.max(1, Math.min(12, toInt(partial.proficiency, fallback.proficiency) ?? fallback.proficiency)),
    rallyDie: toStringOrDefault(partial.rallyDie, fallback.rallyDie),
    primaryWeaponId:
      partial.primaryWeaponId !== undefined
        ? toStringOrNull(partial.primaryWeaponId)
        : fallback.primaryWeaponId,
    secondaryWeaponId:
      partial.secondaryWeaponId !== undefined
        ? toStringOrNull(partial.secondaryWeaponId)
        : fallback.secondaryWeaponId,
    armorId: partial.armorId !== undefined ? toStringOrNull(partial.armorId) : fallback.armorId,
    domainCards: partial.domainCards ? toStringArray(partial.domainCards, fallback.domainCards) : fallback.domainCards,
    inventoryItems:
      partial.inventoryItems !== undefined
        ? toRecordUnknown(partial.inventoryItems, fallback.inventoryItems)
        : fallback.inventoryItems,
    gold: Math.max(0, toInt(partial.gold, fallback.gold) ?? fallback.gold),
    handfuls: Math.max(0, toInt(partial.handfuls, fallback.handfuls) ?? fallback.handfuls),
    bags: Math.max(0, toInt(partial.bags, fallback.bags) ?? fallback.bags),
    debt: Math.max(0, toInt(partial.debt, fallback.debt) ?? fallback.debt),
    backgroundQuestions:
      partial.backgroundQuestions !== undefined
        ? toRecordString(partial.backgroundQuestions, fallback.backgroundQuestions)
        : fallback.backgroundQuestions,
    connections:
      partial.connections !== undefined
        ? toRecordUnknown(partial.connections, fallback.connections)
        : fallback.connections,
    narrativeBackstory:
      partial.narrativeBackstory !== undefined
        ? toStringOrNull(partial.narrativeBackstory)
        : fallback.narrativeBackstory,
    advancementSelections:
      partial.advancementSelections !== undefined
        ? toRecordStringArray(partial.advancementSelections, fallback.advancementSelections)
        : fallback.advancementSelections,
    resourceValues:
      partial.resourceValues !== undefined
        ? mergeRuntimeResourceStore(fallback.resourceValues, partial.resourceValues)
        : fallback.resourceValues,
    conditionStates:
      partial.conditionStates !== undefined
        ? mergeRuntimeConditionStateStore(fallback.conditionStates, partial.conditionStates)
        : fallback.conditionStates,
    currencyValues:
      partial.currencyValues !== undefined
        ? mergeRuntimeCurrencyStore(fallback.currencyValues, partial.currencyValues)
        : fallback.currencyValues,
    customFieldValues:
      partial.customFieldValues !== undefined
        ? mergeRuntimeCustomFieldStore(fallback.customFieldValues, partial.customFieldValues)
        : fallback.customFieldValues,
    craftingState:
      partial.craftingState !== undefined
        ? toCharacterCraftingState(partial.craftingState, fallback.craftingState)
        : toCharacterCraftingState(fallback.craftingState, fallback.craftingState),
    druidFormState:
      partial.druidFormState !== undefined
        ? toCharacterDruidFormState(partial.druidFormState, fallback.druidFormState)
        : toCharacterDruidFormState(fallback.druidFormState, fallback.druidFormState),
    companionState:
      partial.companionState !== undefined
        ? toCharacterCompanionState(partial.companionState, fallback.companionState)
        : toCharacterCompanionState(fallback.companionState, fallback.companionState),
  };
}

function parseDescriptionToMetadata(
  description: unknown,
  fallback: StoredCharacterMetadata
): StoredCharacterMetadata {
  if (typeof description !== "string" || description.trim() === "") {
    return fallback;
  }

  const trimmed = description.trim();
  if (!trimmed.startsWith(CHARACTER_META_PREFIX)) {
    return {
      ...fallback,
      narrativeBackstory: description,
    };
  }

  const payloadText = trimmed.slice(CHARACTER_META_PREFIX.length).trim();
  if (!payloadText) return fallback;

  try {
    const parsed = JSON.parse(payloadText) as {
      version?: number;
      metadata?: Partial<StoredCharacterMetadata>;
    };

    if (parsed.version !== CHARACTER_META_VERSION || !parsed.metadata) {
      return fallback;
    }

    return normalizeMetadata(parsed.metadata, fallback);
  } catch {
    return fallback;
  }
}

function serializeMetadata(metadata: StoredCharacterMetadata) {
  return `${CHARACTER_META_PREFIX}${JSON.stringify({
    version: CHARACTER_META_VERSION,
    metadata,
  })}`;
}

function startingExperienceMax(level: number, settings: CharacterSheetCustomization) {
  const direct = settings.experiencesPerLevel[String(level)];
  if (Number.isFinite(direct)) return Math.max(0, Math.round(direct));
  return 1;
}

function defaultCustomFieldValue(type: "text" | "number" | "checkbox" | "select") {
  if (type === "number") return 0;
  if (type === "checkbox") return false;
  return "";
}

function applyRuntimeDefaults(
  metadata: StoredCharacterMetadata,
  settings: CharacterSheetCustomization
): StoredCharacterMetadata {
  const nextResourceValues: RuntimeResourceStore = {
    ...metadata.resourceValues,
  };

  const legacyResources = buildLegacyResourceStore(metadata);
  for (const [resourceId, legacyValue] of Object.entries(legacyResources)) {
    if (!nextResourceValues[resourceId]) {
      nextResourceValues[resourceId] = legacyValue;
    }
  }

  for (const resource of settings.resources) {
    const current = nextResourceValues[resource.id];
    if (current) continue;

    const fallbackCurrent = Math.max(0, resource.defaultCurrent);
    const fallbackMax =
      resource.format === "single" ? null : Math.max(0, resource.defaultMax);

    nextResourceValues[resource.id] = {
      current: fallbackCurrent,
      max: fallbackMax,
    };
  }

  const nextConditionStates: RuntimeConditionStateStore = {
    ...metadata.conditionStates,
  };
  for (const condition of settings.conditions) {
    if (nextConditionStates[condition.id] === undefined) {
      nextConditionStates[condition.id] = false;
    }
  }

  const nextCurrencyValues: RuntimeCurrencyStore = {
    ...buildLegacyCurrencyStore(metadata),
    ...metadata.currencyValues,
  };
  for (const denomination of settings.currency.denominations) {
    if (nextCurrencyValues[denomination.id] === undefined) {
      nextCurrencyValues[denomination.id] = denomination.defaultAmount;
    }
  }

  const nextCustomFieldValues: RuntimeCustomFieldStore = {
    ...metadata.customFieldValues,
  };
  for (const field of settings.displaySettings.customFields) {
    if (nextCustomFieldValues[field.id] === undefined) {
      nextCustomFieldValues[field.id] = defaultCustomFieldValue(field.type);
    }
  }

  return {
    ...metadata,
    resourceValues: nextResourceValues,
    conditionStates: nextConditionStates,
    currencyValues: nextCurrencyValues,
    customFieldValues: nextCustomFieldValues,
  };
}

export const traitsSchema = z.object({
  agility: z.number().int().min(-3).max(3),
  strength: z.number().int().min(-3).max(3),
  finesse: z.number().int().min(-3).max(3),
  instinct: z.number().int().min(-3).max(3),
  presence: z.number().int().min(-3).max(3),
  knowledge: z.number().int().min(-3).max(3),
});

const runtimeResourceValueSchema = z.object({
  current: z.number().int(),
  max: z.number().int().nullable().default(null),
});

const runtimeResourceStoreSchema = z.record(z.string(), runtimeResourceValueSchema);
const runtimeConditionStateStoreSchema = z.record(z.string(), z.boolean());
const runtimeCurrencyStoreSchema = z.record(z.string(), z.number().int());
const runtimeCustomFieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
const runtimeCustomFieldStoreSchema = z.record(z.string(), runtimeCustomFieldValueSchema);
const companionAttackProfileSchema = z.object({
  label: z.string().min(1).max(120),
  traitMode: z.enum([
    "agility",
    "strength",
    "finesse",
    "instinct",
    "presence",
    "knowledge",
    "spellcast",
  ]),
  rangeBand: z.enum(["melee", "very_close", "close", "far", "very_far"]),
  damageFormula: z.string().min(1).max(80),
  damageType: z.enum(["physical", "magical"]),
});
const companionExperienceSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(160),
  value: z.number().int().min(0).max(20),
});
const characterCraftingStateSchema = z.object({
  professions: z.array(z.string().min(1)).default([]),
  materials: z.record(z.string(), z.number().int().min(0)).default({}),
  notes: z.string().default(""),
});
const characterDruidFormStateSchema = z.object({
  knownFormIds: z.array(z.string().min(1)).default([]),
  activeFormId: z.string().nullable().default(null),
});
const characterCompanionStateSchema = z.object({
  enabled: z.boolean().default(false),
  name: z.string().default(""),
  species: z.string().default(""),
  evasion: z.number().int().min(0).max(99).default(DEFAULT_CHARACTER_COMPANION_STATE.evasion),
  stressCurrent: z.number().int().min(0).max(99).default(0),
  stressMax: z.number().int().min(0).max(99).default(DEFAULT_CHARACTER_COMPANION_STATE.stressMax),
  attackName: z.string().default(DEFAULT_CHARACTER_COMPANION_STATE.attackName),
  attackProfile: companionAttackProfileSchema.default(DEFAULT_CHARACTER_COMPANION_STATE.attackProfile),
  experiences: z.array(companionExperienceSchema).default([]),
  upgrades: z.array(z.string().min(1)).default([]),
  notes: z.string().default(""),
});

export const characterInputSchema = z.object({
  campaignId: z.number().int().positive(),
  name: z.string().min(1).max(120),
  pronouns: z.string().max(80).optional(),
  heritage: z.string().min(1).max(120),
  class: z.string().min(1).max(120),
  subclass: z.string().min(1).max(120),
  level: z.number().int().min(1).max(10).default(1),
  traits: traitsSchema.default(defaultTraits),
  baseEvasion: z.number().int().min(-20).max(99).default(0),
  hpCurrent: z.number().int().optional(),
  hpMax: z.number().int().optional(),
  stressCurrent: z.number().int().optional(),
  stressMax: z.number().int().optional(),
  hopeCurrent: z.number().int().optional(),
  hopeMax: z.number().int().optional(),
  experienceCurrent: z.number().int().optional(),
  experienceMax: z.number().int().optional(),
  proficiency: z.number().int().min(1).max(12).default(1),
  rallyDie: z.string().default("d6"),
  primaryWeaponId: z.string().max(120).optional(),
  secondaryWeaponId: z.string().max(120).optional(),
  armorId: z.string().max(120).optional(),
  domainCards: z.array(z.string().max(120)).default([]),
  inventoryItems: z.array(z.record(z.string(), z.unknown())).default([]),
  gold: z.number().int().default(0),
  handfuls: z.number().int().default(0),
  bags: z.number().int().default(0),
  debt: z.number().int().default(0),
  backgroundQuestions: z.record(z.string(), z.string()).default({}),
  connections: z.array(z.record(z.string(), z.unknown())).default([]),
  narrativeBackstory: z.string().optional(),
  advancementSelections: z.record(z.string(), z.array(z.string().min(1))).default({}),
  resourceValues: runtimeResourceStoreSchema.default({}),
  conditionStates: runtimeConditionStateStoreSchema.default({}),
  currencyValues: runtimeCurrencyStoreSchema.default({}),
  customFieldValues: runtimeCustomFieldStoreSchema.default({}),
  craftingState: characterCraftingStateSchema.default(DEFAULT_CHARACTER_CRAFTING_STATE),
  druidFormState: characterDruidFormStateSchema.default(DEFAULT_CHARACTER_DRUID_FORM_STATE),
  companionState: characterCompanionStateSchema.default(DEFAULT_CHARACTER_COMPANION_STATE),
});

export const characterUpdateSchema = characterInputSchema.partial();

const customFieldSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["text", "number", "checkbox", "select"]),
  required: z.boolean(),
  position: z.number().int().min(0),
});

const visibilitySurfaceSchema = z.object({
  builder: z.boolean(),
  sheet: z.boolean(),
  editor: z.boolean(),
  pdf: z.boolean(),
  share: z.boolean(),
});

export const resourceDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  defaultCurrent: z.number().int().min(0).max(9999),
  defaultMax: z.number().int().min(0).max(9999),
  min: z.number().int().min(0).max(9999),
  max: z.number().int().min(0).max(9999),
  format: z.enum(["current_max", "single", "checkbox"]),
  playerEditable: z.boolean(),
  allowPermanentShift: z.boolean(),
  allowTemporaryModifiers: z.boolean(),
  visibleOn: visibilitySurfaceSchema,
});

const currencyDenominationSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  abbreviation: z.string().min(1).max(12),
  defaultAmount: z.number().int().min(0).max(999999),
  exchangeRate: z.number().positive(),
  sortOrder: z.number().int().min(0).max(999),
  visible: z.boolean(),
  allowFraction: z.boolean(),
});

const currencyConfigurationSchema = z.object({
  mode: z.enum(["abstract", "coin", "hybrid"]),
  denominations: z.array(currencyDenominationSchema),
  debtEnabled: z.boolean(),
  debtLabel: z.string().min(1).max(80),
  autoConvert: z.boolean(),
  showTotals: z.boolean(),
  showBreakdown: z.boolean(),
});

const labelOverridesSchema = z.object({
  resources: z.record(z.string(), z.string()),
  sections: z.record(z.string(), z.string()),
  helperText: z.record(z.string(), z.string()),
});

const layoutSectionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  visible: z.boolean(),
  order: z.number().int().min(0).max(999),
  description: z.string().max(400),
  showOnShare: z.boolean(),
  showOnPdf: z.boolean(),
  collapseWhenEmpty: z.boolean(),
});

const layoutConfigurationSchema = z.object({
  mode: z.enum(["compact", "standard", "print"]),
  sections: z.array(layoutSectionSchema),
  touchAlwaysExpandDetails: z.boolean(),
});

export const skillDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  traits: z.array(z.string().min(1)),
  helperText: z.string().max(300),
});

const characterRuleConfigurationSchema = z.object({
  requiredFields: z.array(z.string().min(1)),
  classAllowlist: z.array(z.string().min(1)),
  ancestryAllowlist: z.array(z.string().min(1)),
  communityAllowlist: z.array(z.string().min(1)),
  disableClassDomainGating: z.boolean(),
  expandedDomainsByClass: z.record(z.string(), z.array(z.string().min(1))),
  startingEquipmentByClass: z.record(z.string(), z.string().min(1)),
  levelUpPointsPerLevel: z.number().int().min(1).max(10),
  proficiencyAdvancementCost: z.number().int().min(1).max(10),
  multiclassMinLevel: z.number().int().min(1).max(10),
  allowMulticlass: z.boolean(),
});

const craftingProfessionSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  description: z.string().max(400),
  enabled: z.boolean(),
});

const craftingMaterialSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  description: z.string().max(400),
  maxStack: z.number().int().min(1).max(9999),
});

const craftingRecipeCostSchema = z.object({
  materialId: z.string().min(1).max(120),
  amount: z.number().int().min(1).max(9999),
});

const craftingRecipeSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  targetKind: z.enum(["weapon", "armor", "item", "consumable", "custom"]),
  targetId: z.string().nullable(),
  targetName: z.string().min(1).max(200),
  resourceCosts: z.array(craftingRecipeCostSchema),
  goldCost: z.number().int().min(0).max(999999),
  notes: z.string().max(1200),
  enabled: z.boolean(),
});

const craftingRulesConfigurationSchema = z.object({
  enabled: z.boolean(),
  gatheringDie: z.union([
    z.literal(4),
    z.literal(6),
    z.literal(8),
    z.literal(10),
    z.literal(12),
  ]),
  maxProfessionsPerCharacter: z.number().int().min(1).max(10),
  professions: z.array(craftingProfessionSchema),
  materialTypes: z.array(craftingMaterialSchema),
  recipes: z.array(craftingRecipeSchema),
});

const druidFormFeatureSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  text: z.string().max(1200),
});

const attackProfileSchema = z.object({
  label: z.string().min(1).max(120),
  traitMode: z.enum([
    "agility",
    "strength",
    "finesse",
    "instinct",
    "presence",
    "knowledge",
    "spellcast",
  ]),
  rangeBand: z.enum(["melee", "very_close", "close", "far", "very_far"]),
  damageFormula: z.string().min(1).max(80),
  damageType: z.enum(["physical", "magical"]),
});

const druidFormDefinitionSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  examples: z.array(z.string().min(1).max(80)),
  traitBonus: z.object({
    trait: z.enum(["agility", "strength", "finesse", "instinct", "presence", "knowledge"]),
    amount: z.number().int().min(-3).max(10),
  }),
  evasionBonus: z.number().int().min(-20).max(30),
  attack: attackProfileSchema,
  advantages: z.array(z.string().min(1).max(80)),
  features: z.array(druidFormFeatureSchema),
  drawbacks: z.array(druidFormFeatureSchema),
});

const druidFormRulesConfigurationSchema = z.object({
  enabled: z.boolean(),
  allowNonDruid: z.boolean(),
  allowedClassIds: z.array(z.string().min(1).max(120)),
  disabledFormIds: z.array(z.string().min(1).max(120)),
  customForms: z.array(druidFormDefinitionSchema),
});

const companionLevelUpOptionSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  description: z.string().max(800),
});

const companionRulesConfigurationSchema = z.object({
  enabled: z.boolean(),
  allowNonBeastbound: z.boolean(),
  allowedClassIds: z.array(z.string().min(1).max(120)),
  allowedSubclassIds: z.array(z.string().min(1).max(120)),
  startingEvasion: z.number().int().min(0).max(99),
  startingStressSlots: z.number().int().min(0).max(99),
  startingDamageDie: z.string().min(1).max(80),
  startingRangeBand: z.enum(["melee", "very_close", "close", "far", "very_far"]),
  levelUpOptions: z.array(companionLevelUpOptionSchema),
});

export const conditionDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(600),
  playerToggle: z.boolean(),
  visibleToPlayers: z.boolean(),
});

export const homebrewEntityInputSchema = z.object({
  campaignId: z.number().int().positive().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(1200).default(""),
  tags: z.array(z.string().min(1).max(60)).default([]),
});

const importExportConfigurationSchema = z.object({
  applyLabelsToShare: z.boolean(),
  applyLabelsToPdf: z.boolean(),
  includeRulesInJson: z.boolean(),
  allowCopyFromCampaign: z.boolean(),
});

export const campaignSettingsSchema = z.object({
  baseHp: z.number().int().min(1).max(999).optional(),
  baseStress: z.number().int().min(0).max(99).optional(),
  baseHope: z.number().int().min(0).max(99).optional(),
  maxDomainCards: z.number().int().min(1).max(20).optional(),
  experiencesPerLevel: z.record(z.string(), z.number().int().min(0).max(20)).optional(),
  startingEquipmentByClass: z.record(z.string(), z.string().min(1)).optional(),
  resources: z.array(resourceDefinitionSchema).optional(),
  currency: currencyConfigurationSchema.optional(),
  labels: labelOverridesSchema.optional(),
  layout: layoutConfigurationSchema.optional(),
  skills: z.array(skillDefinitionSchema).optional(),
  characterRules: characterRuleConfigurationSchema.optional(),
  conditions: z.array(conditionDefinitionSchema).optional(),
  importExport: importExportConfigurationSchema.optional(),
  craftingRules: craftingRulesConfigurationSchema.optional(),
  druidFormRules: druidFormRulesConfigurationSchema.optional(),
  companionRules: companionRulesConfigurationSchema.optional(),
  showGold: z.boolean().optional(),
  showInventory: z.boolean().optional(),
  showConnections: z.boolean().optional(),
  customFields: z.array(customFieldSchema).optional(),
  domainCardTemplate: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const domainCardInputSchema = z.object({
  campaignId: z.number().int().positive().optional(),
  name: z.string().min(1).max(120),
  class: z.string().min(1).max(120),
  tier: z.number().int().min(1).max(4),
  description: z.string().default(""),
  traitBonuses: z.record(z.string(), z.number().int()).default({}),
  evasion: z.number().int().default(0),
  moveAbility: z.string().default(""),
  fragileText: z.string().default(""),
  featureText: z.string().default(""),
  imageUrl: z.string().url().optional(),
  colorScheme: z.string().default("default"),
  isOfficial: z.boolean().default(false),
});

export const weaponInputSchema = z.object({
  campaignId: z.number().int().positive().optional(),
  name: z.string().min(1).max(120),
  trait: z.enum(TRAIT_KEYS),
  rangeCategory: z.enum(["melee", "close", "far"]),
  damageDice: z.string().min(1).max(40),
  damageType: z.enum(["physical", "magical"]),
  feature: z.string().default(""),
  isOfficial: z.boolean().default(false),
});

export const armorInputSchema = z.object({
  campaignId: z.number().int().positive().optional(),
  name: z.string().min(1).max(120),
  baseThresholds: z.number().int().min(0).max(99),
  baseScore: z.number().int().min(0).max(99),
  feature: z.string().default(""),
  isOfficial: z.boolean().default(false),
});

type CharacterInput = z.infer<typeof characterInputSchema>;
type CharacterUpdateInput = z.infer<typeof characterUpdateSchema>;

export function mapCharacterRow(row: Record<string, unknown>) {
  const level = Math.max(1, Math.min(10, toInt(row.level, 1) ?? 1));
  const base: StoredCharacterMetadata = {
    ...defaultMetadata,
    heritage: toStringOrDefault(row.ancestry, defaultMetadata.heritage),
    subclass: defaultMetadata.subclass,
  };

  const metadata = parseDescriptionToMetadata(row.description, base);
  const resourceValues = Object.keys(metadata.resourceValues).length
    ? metadata.resourceValues
    : buildLegacyResourceStore(metadata);
  const currencyValues = Object.keys(metadata.currencyValues).length
    ? metadata.currencyValues
    : buildLegacyCurrencyStore(metadata);

  const hpResource = resourceValues.hp;
  const stressResource = resourceValues.stress;
  const hopeResource = resourceValues.hope;
  const experienceResource = resourceValues.experience;

  return {
    id: toInt(row.id, 0) ?? 0,
    campaignId: toInt(row.campaign_id, null),
    playerId: toInt(row.user_id, null),
    name: toStringOrDefault(row.name, "Unnamed Character"),
    pronouns: metadata.pronouns,
    heritage: metadata.heritage,
    class: toStringOrDefault(row.class, "Adventurer"),
    subclass: metadata.subclass,
    level,
    traits: metadata.traits,
    baseEvasion: metadata.baseEvasion,
    hpCurrent: metadata.hpCurrent ?? hpResource?.current ?? null,
    hpMax: metadata.hpMax ?? hpResource?.max ?? null,
    stressCurrent: metadata.stressCurrent ?? stressResource?.current ?? null,
    stressMax: metadata.stressMax ?? stressResource?.max ?? null,
    hopeCurrent: metadata.hopeCurrent ?? hopeResource?.current ?? null,
    hopeMax: metadata.hopeMax ?? hopeResource?.max ?? null,
    experienceCurrent: metadata.experienceCurrent ?? experienceResource?.current ?? null,
    experienceMax: metadata.experienceMax ?? experienceResource?.max ?? null,
    proficiency: metadata.proficiency,
    rallyDie: metadata.rallyDie,
    primaryWeaponId: metadata.primaryWeaponId,
    secondaryWeaponId: metadata.secondaryWeaponId,
    armorId: metadata.armorId,
    domainCards: metadata.domainCards,
    inventoryItems: metadata.inventoryItems,
    gold: metadata.gold,
    handfuls: metadata.handfuls,
    bags: metadata.bags,
    debt: metadata.debt,
    backgroundQuestions: metadata.backgroundQuestions,
    connections: metadata.connections,
    narrativeBackstory: metadata.narrativeBackstory,
    advancementSelections: metadata.advancementSelections,
    resourceValues,
    conditionStates: metadata.conditionStates,
    currencyValues,
    customFieldValues: metadata.customFieldValues,
    craftingState: toCharacterCraftingState(metadata.craftingState, defaultMetadata.craftingState),
    druidFormState: toCharacterDruidFormState(
      metadata.druidFormState,
      defaultMetadata.druidFormState
    ),
    companionState: toCharacterCompanionState(
      metadata.companionState,
      defaultMetadata.companionState
    ),
    inventory: [] as ResolvedInventoryEntry[],
    resolvedCombat: null as ResolvedCharacterCombat | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastModifiedBy: null,
  };
}

export type CharacterRecord = ReturnType<typeof mapCharacterRow>;

export function toCharacterInsert(
  payload: CharacterInput,
  customization?: CharacterSheetCustomization
) {
  const settings = resolveCharacterSheetCustomization(
    customization ? { settings: customization } : undefined
  );

  const level = payload.level;
  const initialMetadata: StoredCharacterMetadata = {
    ...defaultMetadata,
    pronouns: toStringOrNull(payload.pronouns),
    heritage: payload.heritage.trim(),
    subclass: payload.subclass.trim(),
    traits: mergeTraits(defaultTraits, payload.traits),
    baseEvasion: payload.baseEvasion ?? defaultMetadata.baseEvasion,
    hpCurrent: payload.hpCurrent ?? settings.baseHp,
    hpMax: payload.hpMax ?? settings.baseHp,
    stressCurrent: payload.stressCurrent ?? settings.baseStress,
    stressMax: payload.stressMax ?? settings.baseStress,
    hopeCurrent: payload.hopeCurrent ?? settings.baseHope,
    hopeMax: payload.hopeMax ?? settings.baseHope,
    experienceCurrent: payload.experienceCurrent ?? 0,
    experienceMax: payload.experienceMax ?? startingExperienceMax(level, settings),
    proficiency: payload.proficiency,
    rallyDie: payload.rallyDie,
    primaryWeaponId: toStringOrNull(payload.primaryWeaponId),
    secondaryWeaponId: toStringOrNull(payload.secondaryWeaponId),
    armorId: toStringOrNull(payload.armorId),
    domainCards: payload.domainCards,
    inventoryItems: payload.inventoryItems,
    gold: payload.gold,
    handfuls: payload.handfuls,
    bags: payload.bags,
    debt: payload.debt,
    backgroundQuestions: payload.backgroundQuestions,
    connections: payload.connections,
    narrativeBackstory: toStringOrNull(payload.narrativeBackstory),
    advancementSelections: toRecordStringArray(payload.advancementSelections, {}),
    resourceValues: toRuntimeResourceStore(payload.resourceValues),
    conditionStates: toRuntimeConditionStateStore(payload.conditionStates),
    currencyValues: toRuntimeCurrencyStore(payload.currencyValues),
    customFieldValues: toRuntimeCustomFieldStore(payload.customFieldValues),
    craftingState: toCharacterCraftingState(
      payload.craftingState,
      defaultMetadata.craftingState
    ),
    druidFormState: toCharacterDruidFormState(
      payload.druidFormState,
      defaultMetadata.druidFormState
    ),
    companionState: toCharacterCompanionState(
      payload.companionState,
      defaultMetadata.companionState
    ),
  };

  const metadataWithDefaults = applyRuntimeDefaults(initialMetadata, settings);
  const resourceValues = mergeRuntimeResourceStore(
    metadataWithDefaults.resourceValues,
    payload.resourceValues
  );

  function upsertResource(
    resourceId: string,
    current: number | undefined,
    max: number | undefined
  ) {
    const existing = resourceValues[resourceId] ?? { current: 0, max: null };
    resourceValues[resourceId] = {
      current: current ?? existing.current,
      max: max === undefined ? existing.max : max,
    };
  }

  upsertResource("hp", payload.hpCurrent, payload.hpMax);
  upsertResource("stress", payload.stressCurrent, payload.stressMax);
  upsertResource("hope", payload.hopeCurrent, payload.hopeMax);
  upsertResource("experience", payload.experienceCurrent, payload.experienceMax);

  const currencyValues = {
    ...metadataWithDefaults.currencyValues,
    ...toRuntimeCurrencyStore(payload.currencyValues),
    gold: payload.gold,
    handfuls: payload.handfuls,
    bags: payload.bags,
  };

  const metadata: StoredCharacterMetadata = {
    ...metadataWithDefaults,
    baseEvasion: payload.baseEvasion ?? metadataWithDefaults.baseEvasion,
    hpCurrent: resourceValues.hp?.current ?? metadataWithDefaults.hpCurrent,
    hpMax: resourceValues.hp?.max ?? metadataWithDefaults.hpMax,
    stressCurrent: resourceValues.stress?.current ?? metadataWithDefaults.stressCurrent,
    stressMax: resourceValues.stress?.max ?? metadataWithDefaults.stressMax,
    hopeCurrent: resourceValues.hope?.current ?? metadataWithDefaults.hopeCurrent,
    hopeMax: resourceValues.hope?.max ?? metadataWithDefaults.hopeMax,
    experienceCurrent:
      resourceValues.experience?.current ?? metadataWithDefaults.experienceCurrent,
    experienceMax: resourceValues.experience?.max ?? metadataWithDefaults.experienceMax,
    gold: currencyValues.gold ?? 0,
    handfuls: currencyValues.handfuls ?? 0,
    bags: currencyValues.bags ?? 0,
    resourceValues,
    currencyValues,
    craftingState: toCharacterCraftingState(
      payload.craftingState,
      metadataWithDefaults.craftingState
    ),
    druidFormState: toCharacterDruidFormState(
      payload.druidFormState,
      metadataWithDefaults.druidFormState
    ),
    companionState: toCharacterCompanionState(
      payload.companionState,
      metadataWithDefaults.companionState
    ),
  };

  return {
    campaign_id: payload.campaignId,
    name: payload.name.trim(),
    ancestry: payload.heritage.trim(),
    class: payload.class.trim(),
    level,
    description: serializeMetadata(metadata),
  };
}

export function toCharacterUpdate(
  existingRow: Record<string, unknown>,
  payload: CharacterUpdateInput,
  customization?: CharacterSheetCustomization
) {
  const existingCharacter = mapCharacterRow(existingRow);
  const settings = resolveCharacterSheetCustomization(
    customization ? { settings: customization } : undefined
  );

  const nextLevel = payload.level ?? existingCharacter.level;
  const fallbackMetadata: StoredCharacterMetadata = {
    ...defaultMetadata,
    pronouns: existingCharacter.pronouns,
    heritage: existingCharacter.heritage,
    subclass: existingCharacter.subclass,
    traits: existingCharacter.traits,
    baseEvasion: existingCharacter.baseEvasion,
    hpCurrent: existingCharacter.hpCurrent,
    hpMax: existingCharacter.hpMax,
    stressCurrent: existingCharacter.stressCurrent,
    stressMax: existingCharacter.stressMax,
    hopeCurrent: existingCharacter.hopeCurrent,
    hopeMax: existingCharacter.hopeMax,
    experienceCurrent: existingCharacter.experienceCurrent,
    experienceMax: existingCharacter.experienceMax,
    proficiency: existingCharacter.proficiency,
    rallyDie: existingCharacter.rallyDie,
    primaryWeaponId: existingCharacter.primaryWeaponId,
    secondaryWeaponId: existingCharacter.secondaryWeaponId,
    armorId: existingCharacter.armorId,
    domainCards: existingCharacter.domainCards,
    inventoryItems: existingCharacter.inventoryItems,
    gold: existingCharacter.gold,
    handfuls: existingCharacter.handfuls,
    bags: existingCharacter.bags,
    debt: existingCharacter.debt,
    backgroundQuestions: existingCharacter.backgroundQuestions,
    connections: existingCharacter.connections,
    narrativeBackstory: existingCharacter.narrativeBackstory,
    advancementSelections: existingCharacter.advancementSelections,
    resourceValues: existingCharacter.resourceValues,
    conditionStates: existingCharacter.conditionStates,
    currencyValues: existingCharacter.currencyValues,
    customFieldValues: existingCharacter.customFieldValues,
    craftingState: existingCharacter.craftingState,
    druidFormState: existingCharacter.druidFormState,
    companionState: existingCharacter.companionState,
  };

  const mergedMetadata = normalizeMetadata(
    {
      pronouns: payload.pronouns,
      heritage: payload.heritage,
      subclass: payload.subclass,
      traits: payload.traits,
      baseEvasion: payload.baseEvasion,
      hpCurrent: payload.hpCurrent,
      hpMax: payload.hpMax,
      stressCurrent: payload.stressCurrent,
      stressMax: payload.stressMax,
      hopeCurrent: payload.hopeCurrent,
      hopeMax: payload.hopeMax,
      experienceCurrent: payload.experienceCurrent,
      experienceMax:
        payload.experienceMax ??
        (payload.level !== undefined && fallbackMetadata.experienceMax == null
          ? startingExperienceMax(nextLevel, settings)
          : undefined),
      proficiency: payload.proficiency,
      rallyDie: payload.rallyDie,
      primaryWeaponId: payload.primaryWeaponId,
      secondaryWeaponId: payload.secondaryWeaponId,
      armorId: payload.armorId,
      domainCards: payload.domainCards,
      inventoryItems: payload.inventoryItems,
      gold: payload.gold,
      handfuls: payload.handfuls,
      bags: payload.bags,
      debt: payload.debt,
      backgroundQuestions: payload.backgroundQuestions,
      connections: payload.connections,
      narrativeBackstory: payload.narrativeBackstory,
      advancementSelections: payload.advancementSelections,
      resourceValues: payload.resourceValues,
      conditionStates: payload.conditionStates,
      currencyValues: payload.currencyValues,
      customFieldValues: payload.customFieldValues,
      craftingState: payload.craftingState,
      druidFormState: payload.druidFormState,
      companionState: payload.companionState,
    },
    fallbackMetadata
  );

  const normalizedMetadata = applyRuntimeDefaults(mergedMetadata, settings);
  const resourceValues = mergeRuntimeResourceStore(
    normalizedMetadata.resourceValues,
    payload.resourceValues
  );

  function patchResource(
    resourceId: string,
    current: number | undefined,
    max: number | undefined
  ) {
    if (current === undefined && max === undefined) return;
    const existing = resourceValues[resourceId] ?? { current: 0, max: null };
    resourceValues[resourceId] = {
      current: current ?? existing.current,
      max: max === undefined ? existing.max : max,
    };
  }

  patchResource("hp", payload.hpCurrent, payload.hpMax);
  patchResource("stress", payload.stressCurrent, payload.stressMax);
  patchResource("hope", payload.hopeCurrent, payload.hopeMax);
  patchResource("experience", payload.experienceCurrent, payload.experienceMax);

  const currencyValues = {
    ...normalizedMetadata.currencyValues,
    ...toRuntimeCurrencyStore(payload.currencyValues),
    gold: payload.gold ?? normalizedMetadata.gold,
    handfuls: payload.handfuls ?? normalizedMetadata.handfuls,
    bags: payload.bags ?? normalizedMetadata.bags,
  };

  const finalMetadata: StoredCharacterMetadata = {
    ...normalizedMetadata,
    baseEvasion: payload.baseEvasion ?? normalizedMetadata.baseEvasion,
    hpCurrent: resourceValues.hp?.current ?? normalizedMetadata.hpCurrent,
    hpMax: resourceValues.hp?.max ?? normalizedMetadata.hpMax,
    stressCurrent: resourceValues.stress?.current ?? normalizedMetadata.stressCurrent,
    stressMax: resourceValues.stress?.max ?? normalizedMetadata.stressMax,
    hopeCurrent: resourceValues.hope?.current ?? normalizedMetadata.hopeCurrent,
    hopeMax: resourceValues.hope?.max ?? normalizedMetadata.hopeMax,
    experienceCurrent:
      resourceValues.experience?.current ?? normalizedMetadata.experienceCurrent,
    experienceMax: resourceValues.experience?.max ?? normalizedMetadata.experienceMax,
    gold: currencyValues.gold ?? 0,
    handfuls: currencyValues.handfuls ?? 0,
    bags: currencyValues.bags ?? 0,
    resourceValues,
    currencyValues,
    craftingState: toCharacterCraftingState(
      payload.craftingState,
      normalizedMetadata.craftingState
    ),
    druidFormState: toCharacterDruidFormState(
      payload.druidFormState,
      normalizedMetadata.druidFormState
    ),
    companionState: toCharacterCompanionState(
      payload.companionState,
      normalizedMetadata.companionState
    ),
  };

  const nextName = payload.name?.trim() || existingCharacter.name;
  const nextClass = payload.class?.trim() || existingCharacter.class;
  const nextHeritage = payload.heritage?.trim() || existingCharacter.heritage;

  return {
    campaign_id: payload.campaignId ?? existingCharacter.campaignId,
    name: nextName,
    ancestry: nextHeritage,
    class: nextClass,
    level: nextLevel,
    description: serializeMetadata(finalMetadata),
  };
}
