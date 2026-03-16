import type { TraitKey, TraitMap } from "@/lib/constants/classes";
import armorSeed from "@/lib/data/equipment/armor.json";
import consumablesSeed from "@/lib/data/equipment/consumables.json";
import itemsSeed from "@/lib/data/equipment/items.json";
import weaponsSeed from "@/lib/data/equipment/weapons.json";

export type AttackProfile = {
  label: string;
  traitMode: TraitKey | "spellcast";
  rangeBand: "melee" | "very_close" | "close" | "far" | "very_far";
  damageFormula: string;
  damageType: "physical" | "magical";
};

export type SheetModifierSet = {
  evasion?: number;
  armorScore?: number;
  majorThreshold?: number;
  severeThreshold?: number;
  proficiency?: number;
  traits?: Partial<TraitMap>;
  resourceMax?: Partial<Record<"hp" | "stress" | "hope" | "experience", number>>;
};

export type EquipmentScope = "official" | "personal" | "campaign";

type EquipmentBaseRecord = {
  id: string;
  lineageKey: string;
  scope: EquipmentScope;
  ownerUserId: number | null;
  campaignId: number | null;
  parentId: string | null;
  slug: string;
  name: string;
  tier: number;
  tags: string[];
  sourceBook: string;
  sourcePage: number | null;
  isArchived: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  isOfficial: boolean;
};

export type WeaponCatalogEntry = EquipmentBaseRecord & {
  weaponCategory: "primary" | "secondary";
  weaponSubtype: string;
  requiresSpellcast: boolean;
  burdenHands: number;
  defaultProfile: AttackProfile;
  alternateProfiles: AttackProfile[];
  sheetModifiers: SheetModifierSet;
  featureName: string | null;
  featureText: string;
  trait: TraitKey;
  rangeCategory: "melee" | "close" | "far";
  damageDice: string;
  damageType: "physical" | "magical";
  feature: string;
};

export type ArmorCatalogEntry = EquipmentBaseRecord & {
  baseMajorThreshold: number;
  baseSevereThreshold: number;
  baseArmorScore: number;
  sheetModifiers: SheetModifierSet;
  featureName: string | null;
  featureText: string;
  baseThresholds: number;
  baseScore: number;
  feature: string;
};

export type ItemCatalogEntry = EquipmentBaseRecord & {
  rarity: "common" | "uncommon" | "rare" | "legendary";
  rollValue: number | null;
  itemCategory: "loot" | "recipe" | "relic" | "attachment" | "tool" | "wearable" | "utility";
  canEquip: boolean;
  equipLabel: string | null;
  stackLimit: number;
  sheetModifiers: SheetModifierSet;
  usagePayload: Record<string, unknown>;
  rulesText: string;
  description: string;
};

export type ConsumableCatalogEntry = EquipmentBaseRecord & {
  rarity: "common" | "uncommon" | "rare" | "legendary";
  rollValue: number | null;
  consumableCategory: "potion" | "poison" | "salve" | "bomb" | "food" | "scroll" | "other";
  stackLimit: number;
  usagePayload: Record<string, unknown>;
  rulesText: string;
  description: string;
};

export type CharacterInventoryEntry = {
  id: string;
  characterId: number;
  entityKind: "weapon" | "armor" | "item" | "consumable";
  entityId: string;
  quantity: number;
  isEquipped: boolean;
  equippedSlot: "primary_weapon" | "secondary_weapon" | "armor" | null;
  notes: string;
  sortOrder: number;
};

export type ResolvedInventoryEntry = CharacterInventoryEntry & {
  sourceName: string | null;
  sourceScope: EquipmentScope | null;
  sourceArchived: boolean;
};

export type ResolvedCharacterCombat = {
  baseEvasion: number;
  finalEvasion: number;
  armorScore: number;
  majorThreshold: number;
  severeThreshold: number;
  primaryAttack: { sourceId: string; profile: AttackProfile; warnings: string[] } | null;
  secondaryAttack: { sourceId: string; profile: AttackProfile; warnings: string[] } | null;
  equippedItems: Array<{
    sourceId: string;
    name: string;
    modifiers: SheetModifierSet;
    rulesText: string;
  }>;
  warnings: string[];
};

export type EquipmentSourceMaps = {
  weaponsById: Map<string, WeaponCatalogEntry>;
  armorById: Map<string, ArmorCatalogEntry>;
  itemsById: Map<string, ItemCatalogEntry>;
  consumablesById: Map<string, ConsumableCatalogEntry>;
};

type ResolverCharacter = {
  id: number;
  class: string;
  level: number;
  baseEvasion?: number | null;
  traits: TraitMap;
};

const TRAIT_KEYS: TraitKey[] = [
  "agility",
  "strength",
  "finesse",
  "instinct",
  "presence",
  "knowledge",
];

const RANGE_TO_LEGACY: Record<AttackProfile["rangeBand"], "melee" | "close" | "far"> = {
  melee: "melee",
  very_close: "close",
  close: "close",
  far: "far",
  very_far: "far",
};

const LEGACY_TO_RANGE: Record<string, AttackProfile["rangeBand"]> = {
  melee: "melee",
  close: "close",
  far: "far",
  very_close: "very_close",
  very_far: "very_far",
};

const SCOPE_PRECEDENCE: Record<EquipmentScope, number> = {
  campaign: 3,
  personal: 2,
  official: 1,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readField<T = unknown>(
  row: Record<string, unknown>,
  snakeCase: string,
  camelCase: string
): T | undefined {
  if (row[snakeCase] !== undefined) return row[snakeCase] as T;
  if (row[camelCase] !== undefined) return row[camelCase] as T;
  return undefined;
}

function toInt(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function toNullableInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

function toStringValue(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
}

function toNullableString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAttackProfile(value: unknown, fallback: AttackProfile): AttackProfile {
  if (!isObject(value)) return fallback;

  const rawTrait = value.traitMode;
  const traitMode =
    rawTrait === "spellcast"
      ? "spellcast"
      : TRAIT_KEYS.includes(rawTrait as TraitKey)
        ? (rawTrait as TraitKey)
        : fallback.traitMode;

  const rawRange = toStringValue(value.rangeBand, fallback.rangeBand);
  const rangeBand =
    rawRange === "melee" ||
    rawRange === "very_close" ||
    rawRange === "close" ||
    rawRange === "far" ||
    rawRange === "very_far"
      ? rawRange
      : fallback.rangeBand;

  const rawDamageType = toStringValue(value.damageType, fallback.damageType);
  const damageType =
    rawDamageType === "physical" || rawDamageType === "magical"
      ? rawDamageType
      : fallback.damageType;

  return {
    label: toStringValue(value.label, fallback.label),
    traitMode,
    rangeBand,
    damageFormula: toStringValue(value.damageFormula, fallback.damageFormula),
    damageType,
  };
}

function parseAttackProfiles(value: unknown): AttackProfile[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) =>
      parseAttackProfile(entry, {
        label: "Alternate Profile",
        traitMode: "strength",
        rangeBand: "melee",
        damageFormula: "d6",
        damageType: "physical",
      })
    )
    .filter((entry) => entry.damageFormula.trim().length > 0);
}

function parseSheetModifiers(value: unknown): SheetModifierSet {
  if (!isObject(value)) return {};
  const modifiers: SheetModifierSet = {};

  const numericKeys: Array<keyof Omit<SheetModifierSet, "traits" | "resourceMax">> = [
    "evasion",
    "armorScore",
    "majorThreshold",
    "severeThreshold",
    "proficiency",
  ];
  for (const key of numericKeys) {
    const parsed = toNullableInt(value[key]);
    if (parsed !== null) modifiers[key] = parsed;
  }

  if (isObject(value.traits)) {
    const nextTraits: Partial<TraitMap> = {};
    for (const trait of TRAIT_KEYS) {
      const parsed = toNullableInt(value.traits[trait]);
      if (parsed !== null) {
        nextTraits[trait] = parsed;
      }
    }
    if (Object.keys(nextTraits).length > 0) {
      modifiers.traits = nextTraits;
    }
  }

  if (isObject(value.resourceMax)) {
    const nextResources: Partial<Record<"hp" | "stress" | "hope" | "experience", number>> = {};
    for (const key of ["hp", "stress", "hope", "experience"] as const) {
      const parsed = toNullableInt(value.resourceMax[key]);
      if (parsed !== null) {
        nextResources[key] = parsed;
      }
    }
    if (Object.keys(nextResources).length > 0) {
      modifiers.resourceMax = nextResources;
    }
  }

  return modifiers;
}

function parseUsagePayload(value: unknown) {
  if (!isObject(value)) return {};
  return value;
}

function parseScopeFromLegacy(
  row: Record<string, unknown>,
  fallback: EquipmentScope
): EquipmentScope {
  if (row.scope === "official" || row.scope === "personal" || row.scope === "campaign") {
    return row.scope;
  }
  if (toBoolean(readField(row, "is_official", "isOfficial"), false)) return "official";
  if (toNullableInt(readField(row, "campaign_id", "campaignId")) !== null) return "campaign";
  if (toNullableInt(readField(row, "owner_user_id", "ownerUserId")) !== null) return "personal";
  return fallback;
}

function fallbackWeaponProfile(row: Record<string, unknown>): AttackProfile {
  const rawTrait = toStringValue(readField(row, "trait", "trait"), "strength");
  const traitMode =
    rawTrait === "spellcast" || TRAIT_KEYS.includes(rawTrait as TraitKey)
      ? (rawTrait as TraitKey | "spellcast")
      : "strength";
  const rawRange = toStringValue(readField(row, "range_category", "rangeCategory"), "melee");
  const rangeBand = LEGACY_TO_RANGE[rawRange] ?? "melee";
  const rawDamageType = toStringValue(readField(row, "damage_type", "damageType"), "physical");
  const damageType =
    rawDamageType === "physical" || rawDamageType === "magical"
      ? rawDamageType
      : "physical";

  return {
    label: "Standard Attack",
    traitMode,
    rangeBand,
    damageFormula: toStringValue(readField(row, "damage_dice", "damageDice"), "d6"),
    damageType,
  };
}

function withBaseFields(
  row: Record<string, unknown>,
  fallbackScope: EquipmentScope
): Omit<EquipmentBaseRecord, "id" | "lineageKey" | "slug" | "name" | "tier"> & {
  id: string;
  lineageKey: string;
  slug: string;
  name: string;
  tier: number;
} {
  const scope = parseScopeFromLegacy(row, fallbackScope);
  const name = toStringValue(readField(row, "name", "name"), "Unnamed");
  const slug = toStringValue(readField(row, "slug", "slug"), slugify(name));
  const lineageKey = toStringValue(
    readField(row, "lineage_key", "lineageKey"),
    slug || `lineage-${toStringValue(readField(row, "id", "id"), "unknown")}`
  );

  return {
    id: toStringValue(
      readField(row, "id", "id"),
      slug || `record-${Math.random().toString(36).slice(2, 8)}`
    ),
    lineageKey,
    scope,
    ownerUserId: toNullableInt(readField(row, "owner_user_id", "ownerUserId")),
    campaignId: toNullableInt(readField(row, "campaign_id", "campaignId")),
    parentId: toNullableString(readField(row, "parent_id", "parentId")),
    slug,
    name,
    tier: Math.max(1, toInt(readField(row, "tier", "tier"), 1)),
    tags: toStringArray(readField(row, "tags", "tags")),
    sourceBook: toStringValue(readField(row, "source_book", "sourceBook"), "Unknown"),
    sourcePage: toNullableInt(readField(row, "source_page", "sourcePage")),
    isArchived: toBoolean(readField(row, "is_archived", "isArchived"), false),
    createdAt: toNullableString(readField(row, "created_at", "createdAt")),
    updatedAt: toNullableString(readField(row, "updated_at", "updatedAt")),
    isOfficial: scope === "official",
  };
}

export function mapWeaponRow(row: Record<string, unknown>): WeaponCatalogEntry {
  const base = withBaseFields(row, "campaign");
  const defaultProfile = parseAttackProfile(
    readField(row, "default_profile", "defaultProfile"),
    fallbackWeaponProfile(row)
  );
  const alternateProfiles = parseAttackProfiles(
    readField(row, "alternate_profiles", "alternateProfiles")
  );
  const sheetModifiers = parseSheetModifiers(
    readField(row, "sheet_modifiers", "sheetModifiers")
  );
  const featureText = toStringValue(
    readField(row, "feature_text", "featureText"),
    toStringValue(readField(row, "feature", "feature"), "")
  );
  const trait =
    defaultProfile.traitMode === "spellcast" ? "knowledge" : defaultProfile.traitMode;

  return {
    ...base,
    weaponCategory:
      toStringValue(readField(row, "weapon_category", "weaponCategory"), "primary") ===
      "secondary"
        ? "secondary"
        : "primary",
    weaponSubtype: toStringValue(readField(row, "weapon_subtype", "weaponSubtype"), "standard"),
    requiresSpellcast: toBoolean(
      readField(row, "requires_spellcast", "requiresSpellcast"),
      defaultProfile.traitMode === "spellcast"
    ),
    burdenHands: Math.max(0, toInt(readField(row, "burden_hands", "burdenHands"), 1)),
    defaultProfile,
    alternateProfiles,
    sheetModifiers,
    featureName: toNullableString(readField(row, "feature_name", "featureName")),
    featureText,
    trait,
    rangeCategory: RANGE_TO_LEGACY[defaultProfile.rangeBand],
    damageDice: defaultProfile.damageFormula,
    damageType: defaultProfile.damageType,
    feature: featureText,
  };
}

export function mapArmorRow(row: Record<string, unknown>): ArmorCatalogEntry {
  const base = withBaseFields(row, "campaign");
  const baseMajorThreshold = Math.max(
    0,
    toInt(
      readField(row, "base_major_threshold", "baseMajorThreshold"),
      toInt(readField(row, "base_thresholds", "baseThresholds"), 0)
    )
  );
  const baseSevereThreshold = Math.max(
    0,
    toInt(readField(row, "base_severe_threshold", "baseSevereThreshold"), baseMajorThreshold * 2)
  );
  const baseArmorScore = Math.max(
    0,
    toInt(
      readField(row, "base_armor_score", "baseArmorScore"),
      toInt(readField(row, "base_score", "baseScore"), 0)
    )
  );
  const featureText = toStringValue(
    readField(row, "feature_text", "featureText"),
    toStringValue(readField(row, "feature", "feature"), "")
  );

  return {
    ...base,
    baseMajorThreshold,
    baseSevereThreshold,
    baseArmorScore,
    sheetModifiers: parseSheetModifiers(readField(row, "sheet_modifiers", "sheetModifiers")),
    featureName: toNullableString(readField(row, "feature_name", "featureName")),
    featureText,
    baseThresholds: baseMajorThreshold,
    baseScore: baseArmorScore,
    feature: featureText,
  };
}

function normalizeRarity(value: unknown): ItemCatalogEntry["rarity"] {
  const raw = toStringValue(value, "common");
  return raw === "uncommon" || raw === "rare" || raw === "legendary" ? raw : "common";
}

function normalizeItemCategory(value: unknown): ItemCatalogEntry["itemCategory"] {
  const raw = toStringValue(value, "utility");
  return raw === "loot" ||
    raw === "recipe" ||
    raw === "relic" ||
    raw === "attachment" ||
    raw === "tool" ||
    raw === "wearable"
    ? raw
    : "utility";
}

function normalizeConsumableCategory(value: unknown): ConsumableCatalogEntry["consumableCategory"] {
  const raw = toStringValue(value, "other");
  return raw === "potion" ||
    raw === "poison" ||
    raw === "salve" ||
    raw === "bomb" ||
    raw === "food" ||
    raw === "scroll"
    ? raw
    : "other";
}

export function mapItemRow(row: Record<string, unknown>): ItemCatalogEntry {
  const base = withBaseFields(row, "campaign");
  const rulesText = toStringValue(
    readField(row, "rules_text", "rulesText"),
    toStringValue(readField(row, "description", "description"), "")
  );

  return {
    ...base,
    rarity: normalizeRarity(readField(row, "rarity", "rarity")),
    rollValue: toNullableInt(readField(row, "roll_value", "rollValue")),
    itemCategory: normalizeItemCategory(readField(row, "item_category", "itemCategory")),
    canEquip: toBoolean(readField(row, "can_equip", "canEquip"), false),
    equipLabel: toNullableString(readField(row, "equip_label", "equipLabel")),
    stackLimit: Math.max(1, toInt(readField(row, "stack_limit", "stackLimit"), 1)),
    sheetModifiers: parseSheetModifiers(readField(row, "sheet_modifiers", "sheetModifiers")),
    usagePayload: parseUsagePayload(readField(row, "usage_payload", "usagePayload")),
    rulesText,
    description: rulesText,
  };
}

export function mapConsumableRow(row: Record<string, unknown>): ConsumableCatalogEntry {
  const base = withBaseFields(row, "campaign");
  const rulesText = toStringValue(
    readField(row, "rules_text", "rulesText"),
    toStringValue(readField(row, "description", "description"), "")
  );

  return {
    ...base,
    rarity: normalizeRarity(readField(row, "rarity", "rarity")),
    rollValue: toNullableInt(readField(row, "roll_value", "rollValue")),
    consumableCategory: normalizeConsumableCategory(
      readField(row, "consumable_category", "consumableCategory")
    ),
    stackLimit: Math.max(1, toInt(readField(row, "stack_limit", "stackLimit"), 5)),
    usagePayload: parseUsagePayload(readField(row, "usage_payload", "usagePayload")),
    rulesText,
    description: rulesText,
  };
}

function mapInventorySlot(value: unknown): CharacterInventoryEntry["equippedSlot"] {
  if (value === "primary_weapon" || value === "secondary_weapon" || value === "armor") {
    return value;
  }
  return null;
}

export function mapInventoryRow(row: Record<string, unknown>): CharacterInventoryEntry {
  const rawKind = readField(row, "entity_kind", "entityKind");
  return {
    id: toStringValue(readField(row, "id", "id"), ""),
    characterId: Math.max(0, toInt(readField(row, "character_id", "characterId"), 0)),
    entityKind:
      rawKind === "weapon" ||
      rawKind === "armor" ||
      rawKind === "item" ||
      rawKind === "consumable"
        ? rawKind
        : "item",
    entityId: toStringValue(readField(row, "entity_id", "entityId"), ""),
    quantity: Math.max(1, toInt(readField(row, "quantity", "quantity"), 1)),
    isEquipped: toBoolean(readField(row, "is_equipped", "isEquipped"), false),
    equippedSlot: mapInventorySlot(readField(row, "equipped_slot", "equippedSlot")),
    notes: toStringValue(readField(row, "notes", "notes"), ""),
    sortOrder: Math.max(0, toInt(readField(row, "sort_order", "sortOrder"), 0)),
  };
}

function seedToRecord<T>(value: T): Record<string, unknown> {
  return value as unknown as Record<string, unknown>;
}

const OFFICIAL_WEAPON_RECORDS: WeaponCatalogEntry[] = (weaponsSeed as unknown[])
  .map((entry) =>
    mapWeaponRow({
      ...seedToRecord(entry),
      scope: "official",
      owner_user_id: null,
      campaign_id: null,
      parent_id: null,
      is_archived: false,
      tags: isObject(seedToRecord(entry)) ? seedToRecord(entry).tags : [],
    })
  )
  .sort((a, b) => a.name.localeCompare(b.name));

const OFFICIAL_ARMOR_RECORDS: ArmorCatalogEntry[] = (armorSeed as unknown[])
  .map((entry) =>
    mapArmorRow({
      ...seedToRecord(entry),
      scope: "official",
      owner_user_id: null,
      campaign_id: null,
      parent_id: null,
      is_archived: false,
    })
  )
  .sort((a, b) => a.name.localeCompare(b.name));

const OFFICIAL_ITEM_RECORDS: ItemCatalogEntry[] = (itemsSeed as unknown[])
  .map((entry) =>
    mapItemRow({
      ...seedToRecord(entry),
      scope: "official",
      owner_user_id: null,
      campaign_id: null,
      parent_id: null,
      is_archived: false,
    })
  )
  .sort((a, b) => a.name.localeCompare(b.name));

const OFFICIAL_CONSUMABLE_RECORDS: ConsumableCatalogEntry[] = (consumablesSeed as unknown[])
  .map((entry) =>
    mapConsumableRow({
      ...seedToRecord(entry),
      scope: "official",
      owner_user_id: null,
      campaign_id: null,
      parent_id: null,
      is_archived: false,
    })
  )
  .sort((a, b) => a.name.localeCompare(b.name));

export function getOfficialWeapons() {
  return OFFICIAL_WEAPON_RECORDS.map((entry) => ({ ...entry }));
}

export function getOfficialArmor() {
  return OFFICIAL_ARMOR_RECORDS.map((entry) => ({ ...entry }));
}

export function getOfficialItems() {
  return OFFICIAL_ITEM_RECORDS.map((entry) => ({ ...entry }));
}

export function getOfficialConsumables() {
  return OFFICIAL_CONSUMABLE_RECORDS.map((entry) => ({ ...entry }));
}

export function officialSourceMaps(): EquipmentSourceMaps {
  return {
    weaponsById: new Map(OFFICIAL_WEAPON_RECORDS.map((entry) => [entry.id, { ...entry }])),
    armorById: new Map(OFFICIAL_ARMOR_RECORDS.map((entry) => [entry.id, { ...entry }])),
    itemsById: new Map(OFFICIAL_ITEM_RECORDS.map((entry) => [entry.id, { ...entry }])),
    consumablesById: new Map(OFFICIAL_CONSUMABLE_RECORDS.map((entry) => [entry.id, { ...entry }])),
  };
}

function compareByPrecedence(
  left: { scope: EquipmentScope; updatedAt: string | null; createdAt: string | null },
  right: { scope: EquipmentScope; updatedAt: string | null; createdAt: string | null }
) {
  const precedenceDelta = SCOPE_PRECEDENCE[right.scope] - SCOPE_PRECEDENCE[left.scope];
  if (precedenceDelta !== 0) return precedenceDelta;

  const leftTime = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();
  const rightTime = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime();
  if (leftTime === rightTime) return 0;
  return rightTime - leftTime;
}

export function collapseByLineage<
  T extends {
    lineageKey: string;
    scope: EquipmentScope;
    updatedAt: string | null;
    createdAt: string | null;
    name: string;
  }
>(entries: T[]) {
  const byLineage = new Map<string, T[]>();
  for (const entry of entries) {
    if (!entry.lineageKey) continue;
    const bucket = byLineage.get(entry.lineageKey) ?? [];
    bucket.push(entry);
    byLineage.set(entry.lineageKey, bucket);
  }

  const resolved: T[] = [];
  for (const bucket of byLineage.values()) {
    bucket.sort(compareByPrecedence);
    resolved.push(bucket[0]);
  }

  return resolved.sort((a, b) => a.name.localeCompare(b.name));
}

export function buildSourceMaps(input: {
  weapons?: WeaponCatalogEntry[];
  armor?: ArmorCatalogEntry[];
  items?: ItemCatalogEntry[];
  consumables?: ConsumableCatalogEntry[];
}) {
  const official = officialSourceMaps();
  const weaponsById = new Map<string, WeaponCatalogEntry>(official.weaponsById);
  const armorById = new Map<string, ArmorCatalogEntry>(official.armorById);
  const itemsById = new Map<string, ItemCatalogEntry>(official.itemsById);
  const consumablesById = new Map<string, ConsumableCatalogEntry>(official.consumablesById);

  for (const weapon of input.weapons ?? []) {
    weaponsById.set(weapon.id, weapon);
  }
  for (const armor of input.armor ?? []) {
    armorById.set(armor.id, armor);
  }
  for (const item of input.items ?? []) {
    itemsById.set(item.id, item);
  }
  for (const consumable of input.consumables ?? []) {
    consumablesById.set(consumable.id, consumable);
  }

  return {
    weaponsById,
    armorById,
    itemsById,
    consumablesById,
  };
}

export function buildLegacyInventoryEntries(character: {
  id: number;
  primaryWeaponId?: string | null;
  secondaryWeaponId?: string | null;
  armorId?: string | null;
  inventoryItems?: Array<Record<string, unknown>>;
}) {
  const entries: CharacterInventoryEntry[] = [];
  let sortOrder = 0;
  const charId = Math.max(0, character.id);

  function pushEntry(entry: Omit<CharacterInventoryEntry, "id" | "characterId" | "sortOrder">) {
    sortOrder += 1;
    entries.push({
      id: `legacy-${charId}-${sortOrder}`,
      characterId: charId,
      sortOrder,
      ...entry,
    });
  }

  if (character.primaryWeaponId) {
    pushEntry({
      entityKind: "weapon",
      entityId: character.primaryWeaponId,
      quantity: 1,
      isEquipped: true,
      equippedSlot: "primary_weapon",
      notes: "",
    });
  }
  if (character.secondaryWeaponId) {
    pushEntry({
      entityKind: "weapon",
      entityId: character.secondaryWeaponId,
      quantity: 1,
      isEquipped: true,
      equippedSlot: "secondary_weapon",
      notes: "",
    });
  }
  if (character.armorId) {
    pushEntry({
      entityKind: "armor",
      entityId: character.armorId,
      quantity: 1,
      isEquipped: true,
      equippedSlot: "armor",
      notes: "",
    });
  }

  for (const rawItem of character.inventoryItems ?? []) {
    if (!isObject(rawItem)) continue;
    const entityKind = rawItem.entityKind;
    const entityId = toNullableString(rawItem.entityId);
    if (
      (entityKind === "weapon" ||
        entityKind === "armor" ||
        entityKind === "item" ||
        entityKind === "consumable") &&
      entityId
    ) {
      pushEntry({
        entityKind,
        entityId,
        quantity: Math.max(1, toInt(rawItem.quantity, 1)),
        isEquipped: toBoolean(rawItem.isEquipped, false),
        equippedSlot: mapInventorySlot(rawItem.equippedSlot),
        notes: toStringValue(rawItem.notes, ""),
      });
    }
  }

  return entries;
}

export function enrichInventoryEntries(
  entries: CharacterInventoryEntry[],
  maps: EquipmentSourceMaps
): ResolvedInventoryEntry[] {
  return [...entries]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((entry) => {
      if (entry.entityKind === "weapon") {
        const source = maps.weaponsById.get(entry.entityId);
        return {
          ...entry,
          sourceName: source?.name ?? null,
          sourceScope: source?.scope ?? null,
          sourceArchived: Boolean(source?.isArchived),
        };
      }
      if (entry.entityKind === "armor") {
        const source = maps.armorById.get(entry.entityId);
        return {
          ...entry,
          sourceName: source?.name ?? null,
          sourceScope: source?.scope ?? null,
          sourceArchived: Boolean(source?.isArchived),
        };
      }
      if (entry.entityKind === "item") {
        const source = maps.itemsById.get(entry.entityId);
        return {
          ...entry,
          sourceName: source?.name ?? null,
          sourceScope: source?.scope ?? null,
          sourceArchived: Boolean(source?.isArchived),
        };
      }
      const source = maps.consumablesById.get(entry.entityId);
      return {
        ...entry,
        sourceName: source?.name ?? null,
        sourceScope: source?.scope ?? null,
        sourceArchived: Boolean(source?.isArchived),
      };
    });
}

function addWarning(target: string[], warning: string) {
  if (!target.includes(warning)) {
    target.push(warning);
  }
}

function applyModifierSet(
  accumulator: {
    finalEvasion: number;
    armorScore: number;
    majorThreshold: number;
    severeThreshold: number;
  },
  modifiers: SheetModifierSet
) {
  if (typeof modifiers.evasion === "number") {
    accumulator.finalEvasion += modifiers.evasion;
  }
  if (typeof modifiers.armorScore === "number") {
    accumulator.armorScore += modifiers.armorScore;
  }
  if (typeof modifiers.majorThreshold === "number") {
    accumulator.majorThreshold += modifiers.majorThreshold;
  }
  if (typeof modifiers.severeThreshold === "number") {
    accumulator.severeThreshold += modifiers.severeThreshold;
  }
}

function spellcastMismatch(character: ResolverCharacter, weapon: WeaponCatalogEntry) {
  if (!weapon.requiresSpellcast) return false;
  if (weapon.defaultProfile.traitMode !== "spellcast") return false;
  const spellTraits = [character.traits.knowledge, character.traits.presence, character.traits.instinct];
  return Math.max(...spellTraits) <= 0;
}

export function resolveCharacterCombat(input: {
  character: ResolverCharacter;
  inventoryEntries: CharacterInventoryEntry[];
  sourceMaps: EquipmentSourceMaps;
}): ResolvedCharacterCombat {
  const { character, inventoryEntries, sourceMaps } = input;
  const warnings: string[] = [];
  const baseEvasion = Math.max(0, toInt(character.baseEvasion, 0));
  const state = {
    finalEvasion: baseEvasion,
    armorScore: 0,
    majorThreshold: Math.max(0, character.level),
    severeThreshold: Math.max(0, character.level * 2),
  };

  const equippedBySlot = new Map<"primary_weapon" | "secondary_weapon" | "armor", CharacterInventoryEntry[]>();
  for (const slot of ["primary_weapon", "secondary_weapon", "armor"] as const) {
    equippedBySlot.set(slot, []);
  }

  for (const entry of inventoryEntries) {
    if (entry.isEquipped && entry.equippedSlot) {
      equippedBySlot.get(entry.equippedSlot)?.push(entry);
    }
  }

  for (const slot of ["primary_weapon", "secondary_weapon", "armor"] as const) {
    const entries = equippedBySlot.get(slot) ?? [];
    if (entries.length > 1) {
      addWarning(warnings, `Duplicate occupancy on slot ${slot}.`);
    }
  }

  const armorCandidates = (equippedBySlot.get("armor") ?? []).filter((entry) => entry.entityKind === "armor");
  if (armorCandidates.length > 1) {
    addWarning(warnings, "Multiple armors equipped; only the first armor is used.");
  }

  const selectedArmorEntry = armorCandidates[0] ?? null;
  if (selectedArmorEntry) {
    const armor = sourceMaps.armorById.get(selectedArmorEntry.entityId);
    if (!armor) {
      addWarning(warnings, `Missing armor source: ${selectedArmorEntry.entityId}`);
    } else {
      state.armorScore = armor.baseArmorScore;
      state.majorThreshold = armor.baseMajorThreshold;
      state.severeThreshold = armor.baseSevereThreshold;
      applyModifierSet(state, armor.sheetModifiers);
      if (armor.tier > character.level) {
        addWarning(warnings, `${armor.name} is tier ${armor.tier} and may be illegal for level ${character.level}.`);
      }
      if (armor.isArchived) {
        addWarning(warnings, `${armor.name} is archived.`);
      }
    }
  }

  function resolveWeaponAttack(
    slot: "primary_weapon" | "secondary_weapon"
  ): { sourceId: string; profile: AttackProfile; warnings: string[] } | null {
    const entry = (equippedBySlot.get(slot) ?? []).find((item) => item.entityKind === "weapon");
    if (!entry) return null;
    const weapon = sourceMaps.weaponsById.get(entry.entityId);
    if (!weapon) {
      const localWarnings = [`Missing weapon source: ${entry.entityId}`];
      for (const warning of localWarnings) addWarning(warnings, warning);
      return {
        sourceId: entry.entityId,
        profile: {
          label: "Unknown Attack",
          traitMode: "strength",
          rangeBand: "melee",
          damageFormula: "d6",
          damageType: "physical",
        },
        warnings: localWarnings,
      };
    }

    const localWarnings: string[] = [];
    applyModifierSet(state, weapon.sheetModifiers);
    if (weapon.tier > character.level) {
      localWarnings.push(
        `${weapon.name} is tier ${weapon.tier} and may be illegal for level ${character.level}.`
      );
    }
    if (spellcastMismatch(character, weapon)) {
      localWarnings.push(`${weapon.name} requires spellcasting capability.`);
    }
    if (weapon.isArchived) {
      localWarnings.push(`${weapon.name} is archived.`);
    }
    for (const warning of localWarnings) addWarning(warnings, warning);

    return {
      sourceId: weapon.id,
      profile: weapon.defaultProfile,
      warnings: localWarnings,
    };
  }

  const primaryAttack = resolveWeaponAttack("primary_weapon");
  const secondaryAttack = resolveWeaponAttack("secondary_weapon");

  const equippedItems: ResolvedCharacterCombat["equippedItems"] = [];
  for (const entry of inventoryEntries) {
    if (entry.entityKind !== "item" || !entry.isEquipped) continue;
    const item = sourceMaps.itemsById.get(entry.entityId);
    if (!item) {
      addWarning(warnings, `Missing item source: ${entry.entityId}`);
      continue;
    }
    if (!item.canEquip) {
      addWarning(warnings, `${item.name} is not marked as equippable but is currently equipped.`);
    }
    applyModifierSet(state, item.sheetModifiers);
    if (item.isArchived) {
      addWarning(warnings, `${item.name} is archived.`);
    }
    equippedItems.push({
      sourceId: item.id,
      name: item.name,
      modifiers: item.sheetModifiers,
      rulesText: item.rulesText,
    });
  }

  for (const entry of inventoryEntries) {
    if (entry.entityKind === "consumable") {
      const source = sourceMaps.consumablesById.get(entry.entityId);
      if (!source) {
        addWarning(warnings, `Missing consumable source: ${entry.entityId}`);
      } else if (source.isArchived) {
        addWarning(warnings, `${source.name} is archived.`);
      }
    }
  }

  return {
    baseEvasion,
    finalEvasion: state.finalEvasion,
    armorScore: state.armorScore,
    majorThreshold: state.majorThreshold,
    severeThreshold: state.severeThreshold,
    primaryAttack,
    secondaryAttack,
    equippedItems,
    warnings,
  };
}
