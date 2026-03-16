import type { CharacterRecord } from "@/lib/characters";
import {
  buildLegacyInventoryEntries,
  buildSourceMaps,
  enrichInventoryEntries,
  mapArmorRow,
  mapConsumableRow,
  mapInventoryRow,
  mapItemRow,
  mapWeaponRow,
  resolveCharacterCombat,
  type CharacterInventoryEntry,
} from "@/lib/equipment";
import { supabaseAdmin } from "@/lib/supabase/admin";

function isMissingTableError(error: { message?: string; details?: string } | null) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return message.includes("does not exist") || message.includes("could not find the table");
}

function uniqueIds(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

export async function fetchInventoryByCharacterIds(characterIds: number[]) {
  const result = new Map<number, CharacterInventoryEntry[]>();
  if (!characterIds.length) return result;

  const { data, error } = await supabaseAdmin
    .from("character_inventory_entries")
    .select("*")
    .in("character_id", characterIds)
    .order("sort_order", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) return result;
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const entry = mapInventoryRow(row);
    const bucket = result.get(entry.characterId) ?? [];
    bucket.push(entry);
    result.set(entry.characterId, bucket);
  }

  return result;
}

async function fetchSourceMapsByInventory(entries: CharacterInventoryEntry[]) {
  const weaponIds = uniqueIds(
    entries.filter((entry) => entry.entityKind === "weapon").map((entry) => entry.entityId)
  );
  const armorIds = uniqueIds(
    entries.filter((entry) => entry.entityKind === "armor").map((entry) => entry.entityId)
  );
  const itemIds = uniqueIds(
    entries.filter((entry) => entry.entityKind === "item").map((entry) => entry.entityId)
  );
  const consumableIds = uniqueIds(
    entries
      .filter((entry) => entry.entityKind === "consumable")
      .map((entry) => entry.entityId)
  );

  const [weaponsResponse, armorResponse, itemsResponse, consumablesResponse] = await Promise.all([
    weaponIds.length
      ? supabaseAdmin.from("weapons").select("*").in("id", weaponIds)
      : Promise.resolve({ data: [], error: null }),
    armorIds.length
      ? supabaseAdmin.from("armor").select("*").in("id", armorIds)
      : Promise.resolve({ data: [], error: null }),
    itemIds.length
      ? supabaseAdmin.from("items").select("*").in("id", itemIds)
      : Promise.resolve({ data: [], error: null }),
    consumableIds.length
      ? supabaseAdmin.from("consumables").select("*").in("id", consumableIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (weaponsResponse.error && !isMissingTableError(weaponsResponse.error)) {
    throw new Error(weaponsResponse.error.message);
  }
  if (armorResponse.error && !isMissingTableError(armorResponse.error)) {
    throw new Error(armorResponse.error.message);
  }
  if (itemsResponse.error && !isMissingTableError(itemsResponse.error)) {
    throw new Error(itemsResponse.error.message);
  }
  if (consumablesResponse.error && !isMissingTableError(consumablesResponse.error)) {
    throw new Error(consumablesResponse.error.message);
  }

  const weapons = ((weaponsResponse.data ?? []) as Array<Record<string, unknown>>).map((row) =>
    mapWeaponRow(row)
  );
  const armor = ((armorResponse.data ?? []) as Array<Record<string, unknown>>).map((row) =>
    mapArmorRow(row)
  );
  const items = ((itemsResponse.data ?? []) as Array<Record<string, unknown>>).map((row) =>
    mapItemRow(row)
  );
  const consumables = (
    (consumablesResponse.data ?? []) as Array<Record<string, unknown>>
  ).map((row) => mapConsumableRow(row));

  return buildSourceMaps({
    weapons,
    armor,
    items,
    consumables,
  });
}

function withResolvedState(
  character: CharacterRecord,
  entries: CharacterInventoryEntry[],
  sourceMaps: ReturnType<typeof buildSourceMaps>
) {
  return {
    ...character,
    inventory: enrichInventoryEntries(entries, sourceMaps),
    resolvedCombat: resolveCharacterCombat({
      character: {
        id: character.id,
        class: character.class,
        level: character.level,
        baseEvasion: character.baseEvasion ?? 0,
        traits: character.traits,
      },
      inventoryEntries: entries,
      sourceMaps,
    }),
  };
}

export async function resolveCharacterEquipment(character: CharacterRecord) {
  const inventoryByCharacter = await fetchInventoryByCharacterIds([character.id]);
  const inventoryEntries = inventoryByCharacter.get(character.id) ?? [];
  const effectiveEntries = inventoryEntries.length
    ? inventoryEntries
    : buildLegacyInventoryEntries(character);
  const sourceMaps = await fetchSourceMapsByInventory(effectiveEntries);
  return withResolvedState(character, effectiveEntries, sourceMaps);
}

export async function resolveCharactersEquipment(characters: CharacterRecord[]) {
  if (!characters.length) return characters;
  const inventoryByCharacter = await fetchInventoryByCharacterIds(characters.map((character) => character.id));

  const effectiveByCharacter = new Map<number, CharacterInventoryEntry[]>();
  const allEntries: CharacterInventoryEntry[] = [];

  for (const character of characters) {
    const tableEntries = inventoryByCharacter.get(character.id) ?? [];
    const effectiveEntries = tableEntries.length ? tableEntries : buildLegacyInventoryEntries(character);
    effectiveByCharacter.set(character.id, effectiveEntries);
    allEntries.push(...effectiveEntries);
  }

  const sourceMaps = await fetchSourceMapsByInventory(allEntries);
  return characters.map((character) => {
    const entries = effectiveByCharacter.get(character.id) ?? [];
    return withResolvedState(character, entries, sourceMaps);
  });
}

export async function ensureInventoryBackfill(character: CharacterRecord) {
  const inventoryByCharacter = await fetchInventoryByCharacterIds([character.id]);
  const existing = inventoryByCharacter.get(character.id) ?? [];
  if (existing.length > 0) return existing;

  const legacyEntries = buildLegacyInventoryEntries(character);
  if (!legacyEntries.length) return [];

  const insertRows = legacyEntries.map((entry) => ({
    character_id: character.id,
    entity_kind: entry.entityKind,
    entity_id: entry.entityId,
    quantity: entry.quantity,
    is_equipped: entry.isEquipped,
    equipped_slot: entry.equippedSlot,
    notes: entry.notes,
    sort_order: entry.sortOrder,
  }));

  const { error } = await supabaseAdmin
    .from("character_inventory_entries")
    .insert(insertRows);

  if (error && !isMissingTableError(error)) {
    throw new Error(error.message);
  }

  return legacyEntries;
}

