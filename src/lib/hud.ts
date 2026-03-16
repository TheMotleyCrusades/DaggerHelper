import { mapAdversaryRow } from "@/lib/adversaries";
import {
  parseCampaignDescription,
  resolveCampaignHomebrew,
  resolveCharacterSheetCustomization,
  type CharacterSheetCustomization,
  type ConditionDefinition,
  type CustomFieldDefinition,
  type CurrencyDenomination,
  type ResourceDefinition,
} from "@/lib/campaign-metadata";
import {
  mapCharacterRow,
  toCharacterUpdate,
  type CharacterRecord,
  type RuntimeConditionStateStore,
  type RuntimeCurrencyStore,
  type RuntimeCustomFieldStore,
  type RuntimeResourceStore,
} from "@/lib/characters";
import { tableMissingError } from "@/lib/equipment-api";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type HudSessionStatus = "idle" | "active" | "paused" | "complete";
export type HudVisibilityState = "active" | "hidden" | "escaped" | "defeated";
export type HudFieldFormat = "current_max" | "single" | "checkbox" | "text";

export type CampaignHudSettings = {
  enabledFields: string[];
  pinnedPlayerFields: string[];
  pinnedAdversaryFields: string[];
  defaultEncounterView: "split" | "players" | "adversaries";
  allowPublicAdversarySearch: boolean;
};

export type HudFieldDefinition = {
  id: string;
  label: string;
  group: "resource" | "currency" | "custom";
  format: HudFieldFormat;
  min: number | null;
  max: number | null;
  editable: boolean;
};

export type HudFieldValue = {
  current: string | number | boolean | null;
  max: number | null;
};

export type HudPlayerState = {
  characterId: number;
  name: string;
  class: string;
  level: number;
  sheetUrl: string;
  trackedFields: Record<string, HudFieldValue>;
  activeConditions: string[];
  gmNotes: string | null;
};

export type HudAdversaryInstance = {
  id: string;
  adversaryId: number;
  sourceEncounterId: number | null;
  displayName: string;
  hpCurrent: number | null;
  stressCurrent: number | null;
  conditions: string[];
  gmNotes: string | null;
  visibility: HudVisibilityState;
  waveLabel: string | null;
  sortOrder: number;
  adversary: ReturnType<typeof mapAdversaryRow> | null;
};

export type HudLiveEncounterState = {
  campaignId: number;
  sourceEncounterId: number | null;
  name: string | null;
  status: HudSessionStatus;
  sceneNotes: string | null;
  updatedAt: string | null;
};

export type HudEncounterOption = {
  id: number;
  name: string;
  difficulty: string | null;
};

export type CampaignHudSnapshot = {
  campaign: {
    id: number;
    name: string;
  };
  settings: CampaignHudSettings;
  fieldDefinitions: HudFieldDefinition[];
  availableConditions: ConditionDefinition[];
  liveEncounter: HudLiveEncounterState;
  players: HudPlayerState[];
  adversaries: HudAdversaryInstance[];
  encounters: HudEncounterOption[];
};

type HudOwnerContext = {
  campaignId: number;
  campaignName: string;
  settings: CharacterSheetCustomization;
  availableConditions: ConditionDefinition[];
};

type CharacterOverlay = {
  characterId: number;
  trackedFields: Record<
    string,
    {
      current?: string | number | boolean | null;
      max?: number | null;
    }
  >;
  conditions: string[];
  gmNotes: string | null;
};

type AdversaryInstanceRow = {
  id: string;
  campaign_id: number;
  adversary_id: number;
  source_encounter_id: number | null;
  display_name: string;
  hp_current: number | null;
  stress_current: number | null;
  conditions: unknown;
  gm_notes: string | null;
  visibility: HudVisibilityState;
  wave_label: string | null;
  sort_order: number;
};

const DEFAULT_HUD_SETTINGS: CampaignHudSettings = {
  enabledFields: [],
  pinnedPlayerFields: [],
  pinnedAdversaryFields: ["hp", "stress", "difficulty"],
  defaultEncounterView: "split",
  allowPublicAdversarySearch: true,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function toInt(value: unknown, fallback: number | null = null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function toNonNegativeInt(value: unknown, fallback = 0) {
  const parsed = toInt(value, fallback) ?? fallback;
  return Math.max(0, parsed);
}

function toNullableInt(value: unknown) {
  const parsed = toInt(value, null);
  return parsed === null ? null : parsed;
}

function toNullableString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim().length) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean);
      }
    } catch {
      return [];
    }
  }
  return [];
}

function defaultCustomFieldValue(field: CustomFieldDefinition): string | number | boolean {
  if (field.type === "number") return 0;
  if (field.type === "checkbox") return false;
  return "";
}

function parseSessionStatus(value: unknown): HudSessionStatus {
  if (value === "active" || value === "paused" || value === "complete") return value;
  return "idle";
}

function parseVisibilityState(value: unknown): HudVisibilityState {
  if (value === "hidden" || value === "escaped" || value === "defeated") return value;
  return "active";
}

function parseTrackedFields(
  value: unknown
): CharacterOverlay["trackedFields"] {
  if (!isObject(value)) return {};
  const next: CharacterOverlay["trackedFields"] = {};
  for (const [fieldId, rawField] of Object.entries(value)) {
    if (!fieldId.trim()) continue;

    if (isObject(rawField)) {
      const currentRaw = rawField.current;
      const maxRaw = rawField.max;
      const currentValid =
        currentRaw === null ||
        typeof currentRaw === "string" ||
        typeof currentRaw === "number" ||
        typeof currentRaw === "boolean";
      const maxValid =
        maxRaw === null || maxRaw === undefined || typeof maxRaw === "number";

      if (!currentValid && !maxValid) continue;
      next[fieldId] = {
        current: currentValid ? (currentRaw as string | number | boolean | null) : undefined,
        max: maxValid ? (maxRaw as number | null | undefined) : undefined,
      };
      continue;
    }

    if (
      rawField === null ||
      typeof rawField === "string" ||
      typeof rawField === "number" ||
      typeof rawField === "boolean"
    ) {
      next[fieldId] = { current: rawField };
    }
  }
  return next;
}

function mapResourceField(resource: ResourceDefinition): HudFieldDefinition {
  return {
    id: resource.id,
    label: resource.label,
    group: "resource",
    format: resource.format,
    min: resource.min,
    max: resource.max,
    editable: true,
  };
}

function mapCurrencyField(denomination: CurrencyDenomination): HudFieldDefinition {
  return {
    id: denomination.id,
    label: denomination.label,
    group: "currency",
    format: "single",
    min: 0,
    max: null,
    editable: true,
  };
}

function mapCustomField(field: CustomFieldDefinition): HudFieldDefinition {
  const format: HudFieldFormat =
    field.type === "checkbox" ? "checkbox" : field.type === "text" || field.type === "select" ? "text" : "single";
  return {
    id: field.id,
    label: field.name,
    group: "custom",
    format,
    min: field.type === "number" ? -99999 : null,
    max: field.type === "number" ? 99999 : null,
    editable: true,
  };
}

export function parseCampaignId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid campaign id");
  }
  return id;
}

export function buildHudFieldDefinitions(settings: CharacterSheetCustomization): HudFieldDefinition[] {
  const resources = settings.resources.map((resource) => mapResourceField(resource));
  const currency = settings.currency.denominations
    .filter((denomination) => denomination.visible)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((denomination) => mapCurrencyField(denomination));
  const custom = [...settings.displaySettings.customFields]
    .sort((left, right) => left.position - right.position)
    .map((field) => mapCustomField(field));

  if (settings.currency.debtEnabled) {
    currency.push({
      id: "debt",
      label: settings.currency.debtLabel,
      group: "currency",
      format: "single",
      min: 0,
      max: null,
      editable: true,
    });
  }

  const seen = new Set<string>();
  const merged = [...resources, ...currency, ...custom].filter((field) => {
    if (!field.id.trim() || seen.has(field.id)) return false;
    seen.add(field.id);
    return true;
  });

  return merged;
}

function normalizeHudSettings(
  raw: unknown,
  fieldDefinitions: HudFieldDefinition[]
): CampaignHudSettings {
  const input = isObject(raw) ? raw : {};
  const fieldIds = new Set(fieldDefinitions.map((field) => field.id));
  const enabledFields = parseStringArray(input.enabledFields).filter((id) => fieldIds.has(id));
  const pinnedPlayerFields = parseStringArray(input.pinnedPlayerFields).filter((id) => fieldIds.has(id));
  const defaultPinned = ["hp", "stress", "hope", "experience"].filter((id) => fieldIds.has(id));
  const fallbackPinned = defaultPinned.length
    ? defaultPinned
    : fieldDefinitions.slice(0, 6).map((field) => field.id);

  return {
    enabledFields: enabledFields.length ? enabledFields : fieldDefinitions.map((field) => field.id),
    pinnedPlayerFields: pinnedPlayerFields.length ? pinnedPlayerFields : fallbackPinned,
    pinnedAdversaryFields: parseStringArray(input.pinnedAdversaryFields).length
      ? parseStringArray(input.pinnedAdversaryFields)
      : DEFAULT_HUD_SETTINGS.pinnedAdversaryFields,
    defaultEncounterView:
      input.defaultEncounterView === "players" || input.defaultEncounterView === "adversaries"
        ? input.defaultEncounterView
        : "split",
    allowPublicAdversarySearch:
      typeof input.allowPublicAdversarySearch === "boolean"
        ? input.allowPublicAdversarySearch
        : DEFAULT_HUD_SETTINGS.allowPublicAdversarySearch,
  };
}

function mapCharacterOverlay(row: Record<string, unknown>): CharacterOverlay {
  return {
    characterId: toNonNegativeInt(row.character_id),
    trackedFields: parseTrackedFields(row.tracked_fields),
    conditions: parseStringArray(row.conditions),
    gmNotes: toNullableString(row.gm_notes),
  };
}

function mapAdversaryInstance(
  row: AdversaryInstanceRow,
  adversariesById: Map<number, ReturnType<typeof mapAdversaryRow>>
): HudAdversaryInstance {
  return {
    id: row.id,
    adversaryId: Number(row.adversary_id),
    sourceEncounterId: toNullableInt(row.source_encounter_id),
    displayName: row.display_name,
    hpCurrent: toNullableInt(row.hp_current),
    stressCurrent: toNullableInt(row.stress_current),
    conditions: parseStringArray(row.conditions),
    gmNotes: toNullableString(row.gm_notes),
    visibility: parseVisibilityState(row.visibility),
    waveLabel: toNullableString(row.wave_label),
    sortOrder: toNonNegativeInt(row.sort_order),
    adversary: adversariesById.get(Number(row.adversary_id)) ?? null,
  };
}

function buildCharacterTrackedFields(
  character: CharacterRecord,
  fieldDefinitions: HudFieldDefinition[],
  settings: CharacterSheetCustomization,
  overlay: CharacterOverlay | null
) {
  const tracked: Record<string, HudFieldValue> = {};
  const resourceById = new Map(settings.resources.map((resource) => [resource.id, resource]));
  const currencyValues = character.currencyValues as RuntimeCurrencyStore;

  for (const definition of fieldDefinitions) {
    let current: string | number | boolean | null = null;
    let max: number | null = null;

    if (definition.group === "resource") {
      const resourceDefinition = resourceById.get(definition.id);
      const source = character.resourceValues[definition.id];
      if (definition.format === "checkbox") {
        current = Boolean(source?.current ?? 0);
        max = null;
      } else {
        current = source?.current ?? resourceDefinition?.defaultCurrent ?? 0;
        max =
          definition.format === "current_max"
            ? source?.max ?? resourceDefinition?.defaultMax ?? null
            : null;
      }
    } else if (definition.group === "currency") {
      if (definition.id === "debt") {
        current = character.debt;
      } else {
        current = currencyValues[definition.id] ?? 0;
      }
      max = null;
    } else if (definition.group === "custom") {
      const customField = settings.displaySettings.customFields.find(
        (item) => item.id === definition.id
      );
      current =
        character.customFieldValues[definition.id] ??
        (customField ? defaultCustomFieldValue(customField) : null);
      max = null;
    }

    const override = overlay?.trackedFields[definition.id];
    if (override?.current !== undefined) {
      current = override.current;
    }
    if (override?.max !== undefined) {
      max = override.max ?? null;
    }

    tracked[definition.id] = {
      current,
      max,
    };
  }

  return tracked;
}

function buildPlayerState(
  character: CharacterRecord,
  settings: CharacterSheetCustomization,
  fieldDefinitions: HudFieldDefinition[],
  overlay: CharacterOverlay | null
): HudPlayerState {
  const activeBaseConditions = Object.entries(character.conditionStates)
    .filter(([, value]) => value)
    .map(([conditionId]) => conditionId);
  const activeConditions = Array.from(
    new Set([...activeBaseConditions, ...(overlay?.conditions ?? [])])
  ).sort((left, right) => left.localeCompare(right));

  return {
    characterId: character.id,
    name: character.name,
    class: character.class,
    level: character.level,
    sheetUrl: `/characters/${character.id}`,
    trackedFields: buildCharacterTrackedFields(character, fieldDefinitions, settings, overlay),
    activeConditions,
    gmNotes: overlay?.gmNotes ?? null,
  };
}

export async function requireHudOwnerContext(
  campaignId: number,
  userId: number
): Promise<HudOwnerContext | null> {
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select("id,name,user_id,description")
    .eq("id", campaignId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data || Number(data.user_id) !== userId) {
    return null;
  }

  const parsedDescription = parseCampaignDescription(data.description);
  const settings = resolveCharacterSheetCustomization(parsedDescription.metadata);
  const homebrew = resolveCampaignHomebrew(parsedDescription.metadata);

  const byId = new Map<string, ConditionDefinition>();
  for (const condition of [...settings.conditions, ...homebrew.conditions]) {
    if (!condition.id.trim()) continue;
    if (!byId.has(condition.id)) byId.set(condition.id, condition);
  }

  return {
    campaignId: Number(data.id),
    campaignName: String(data.name ?? "Campaign"),
    settings,
    availableConditions: [...byId.values()].sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
  };
}

export async function loadHudSnapshot(context: HudOwnerContext): Promise<CampaignHudSnapshot> {
  const fieldDefinitions = buildHudFieldDefinitions(context.settings);

  const [
    hudStateResponse,
    overlayResponse,
    charactersResponse,
    instancesResponse,
    encountersResponse,
  ] = await Promise.all([
    supabaseAdmin
      .from("campaign_hud_states")
      .select("*")
      .eq("campaign_id", context.campaignId)
      .maybeSingle(),
    supabaseAdmin
      .from("campaign_hud_character_overlays")
      .select("*")
      .eq("campaign_id", context.campaignId),
    supabaseAdmin
      .from("characters")
      .select("*")
      .eq("campaign_id", context.campaignId)
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("campaign_hud_adversary_instances")
      .select("*")
      .eq("campaign_id", context.campaignId)
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("encounters")
      .select("id,name,difficulty")
      .eq("campaign_id", context.campaignId)
      .order("updated_at", { ascending: false }),
  ]);

  if (hudStateResponse.error && !tableMissingError(hudStateResponse.error)) {
    throw new Error(hudStateResponse.error.message);
  }
  if (overlayResponse.error && !tableMissingError(overlayResponse.error)) {
    throw new Error(overlayResponse.error.message);
  }
  if (charactersResponse.error) {
    throw new Error(charactersResponse.error.message);
  }
  if (instancesResponse.error && !tableMissingError(instancesResponse.error)) {
    throw new Error(instancesResponse.error.message);
  }
  if (encountersResponse.error) {
    throw new Error(encountersResponse.error.message);
  }

  const hudState = (hudStateResponse.data as Record<string, unknown> | null) ?? null;
  const overlays = ((overlayResponse.data ?? []) as Array<Record<string, unknown>>).map((row) =>
    mapCharacterOverlay(row)
  );
  const overlayByCharacter = new Map(overlays.map((overlay) => [overlay.characterId, overlay]));

  const characters = ((charactersResponse.data ?? []) as Array<Record<string, unknown>>).map((row) =>
    mapCharacterRow(row)
  );
  const players = characters.map((character) =>
    buildPlayerState(
      character,
      context.settings,
      fieldDefinitions,
      overlayByCharacter.get(character.id) ?? null
    )
  );

  const instanceRows = (instancesResponse.data ?? []) as AdversaryInstanceRow[];
  const adversaryIds = Array.from(
    new Set(instanceRows.map((row) => Number(row.adversary_id)).filter((id) => Number.isInteger(id) && id > 0))
  );
  let adversariesById = new Map<number, ReturnType<typeof mapAdversaryRow>>();
  if (adversaryIds.length) {
    const { data: adversaryRows, error: adversaryError } = await supabaseAdmin
      .from("adversaries")
      .select("*")
      .in("id", adversaryIds);

    if (adversaryError) {
      throw new Error(adversaryError.message);
    }

    adversariesById = new Map(
      ((adversaryRows ?? []) as Array<Record<string, unknown>>).map((row) => [
        Number(row.id),
        mapAdversaryRow(row),
      ])
    );
  }

  const settings = normalizeHudSettings(hudState?.settings, fieldDefinitions);
  const liveEncounter: HudLiveEncounterState = {
    campaignId: context.campaignId,
    sourceEncounterId: toNullableInt(hudState?.source_encounter_id),
    name: toNullableString(hudState?.encounter_name) ?? null,
    status: parseSessionStatus(hudState?.status),
    sceneNotes: toNullableString(hudState?.scene_notes),
    updatedAt: toNullableString(hudState?.updated_at),
  };

  return {
    campaign: {
      id: context.campaignId,
      name: context.campaignName,
    },
    settings,
    fieldDefinitions,
    availableConditions: context.availableConditions,
    liveEncounter,
    players,
    adversaries: instanceRows.map((row) => mapAdversaryInstance(row, adversariesById)),
    encounters: ((encountersResponse.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: toNonNegativeInt(row.id),
      name: String(row.name ?? "Encounter"),
      difficulty: toNullableString(row.difficulty),
    })),
  };
}

export function parseAdversaryStatNumber(raw: unknown) {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.round(raw);
  }
  if (typeof raw !== "string") return null;
  const match = raw.match(/-?\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export function normalizeConditionStatePatch(
  existing: RuntimeConditionStateStore,
  activeConditionIds: string[]
) {
  const next: RuntimeConditionStateStore = {};
  for (const key of Object.keys(existing)) {
    next[key] = false;
  }
  for (const conditionId of activeConditionIds) {
    if (!conditionId.trim()) continue;
    next[conditionId] = true;
  }
  return next;
}

export function applyHudFieldPatchToCharacter(
  character: CharacterRecord,
  fieldDefinition: HudFieldDefinition,
  input: {
    current?: string | number | boolean | null;
    max?: number | null;
    delta?: number;
  }
): {
  resourceValues?: RuntimeResourceStore;
  currencyValues?: RuntimeCurrencyStore;
  customFieldValues?: RuntimeCustomFieldStore;
  debt?: number;
} {
  if (fieldDefinition.group === "resource") {
    const currentStore = character.resourceValues[fieldDefinition.id] ?? {
      current: 0,
      max: null,
    };
    let nextCurrent = currentStore.current;
    let nextMax = currentStore.max;

    if (typeof input.delta === "number") {
      nextCurrent += Math.round(input.delta);
    }
    if (input.current !== undefined) {
      if (fieldDefinition.format === "checkbox") {
        nextCurrent = input.current ? 1 : 0;
      } else if (typeof input.current === "number") {
        nextCurrent = Math.round(input.current);
      }
    }
    if (input.max !== undefined && fieldDefinition.format === "current_max") {
      nextMax = input.max === null ? null : Math.round(input.max);
    }

    if (typeof fieldDefinition.min === "number") {
      nextCurrent = Math.max(fieldDefinition.min, nextCurrent);
    }
    if (typeof fieldDefinition.max === "number") {
      nextCurrent = Math.min(fieldDefinition.max, nextCurrent);
      if (nextMax !== null) {
        nextMax = Math.min(fieldDefinition.max, nextMax);
      }
    }
    if (nextMax !== null && nextCurrent > nextMax) {
      nextCurrent = nextMax;
    }

    return {
      resourceValues: {
        [fieldDefinition.id]: {
          current: nextCurrent,
          max: fieldDefinition.format === "current_max" ? nextMax : null,
        },
      },
    };
  }

  if (fieldDefinition.group === "currency") {
    const currencyValues = character.currencyValues as RuntimeCurrencyStore;
    const currentValue =
      fieldDefinition.id === "debt"
        ? character.debt
        : currencyValues[fieldDefinition.id] ?? 0;
    let nextValue = currentValue;
    if (typeof input.delta === "number") {
      nextValue += Math.round(input.delta);
    }
    if (input.current !== undefined && typeof input.current === "number") {
      nextValue = Math.round(input.current);
    }
    if (typeof fieldDefinition.min === "number") {
      nextValue = Math.max(fieldDefinition.min, nextValue);
    }
    if (typeof fieldDefinition.max === "number") {
      nextValue = Math.min(fieldDefinition.max, nextValue);
    }

    if (fieldDefinition.id === "debt") {
      return { debt: nextValue };
    }
    return {
      currencyValues: {
        [fieldDefinition.id]: nextValue,
      },
    };
  }

  let nextValue: string | number | boolean | null = character.customFieldValues[fieldDefinition.id] ?? null;
  if (input.current !== undefined) {
    nextValue = input.current;
  }
  return {
    customFieldValues: {
      [fieldDefinition.id]: nextValue,
    },
  };
}

export function buildCharacterUpdateRowFromHud(
  existingRow: Record<string, unknown>,
  patch: {
    resourceValues?: RuntimeResourceStore;
    currencyValues?: RuntimeCurrencyStore;
    customFieldValues?: RuntimeCustomFieldStore;
    conditionStates?: RuntimeConditionStateStore;
    debt?: number;
  },
  settings: CharacterSheetCustomization
) {
  return toCharacterUpdate(
    existingRow,
    {
      resourceValues: patch.resourceValues,
      currencyValues: patch.currencyValues,
      customFieldValues: patch.customFieldValues,
      conditionStates: patch.conditionStates,
      debt: patch.debt,
    },
    settings
  );
}
