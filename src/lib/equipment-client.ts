import type {
  ArmorCatalogEntry,
  CharacterInventoryEntry,
  ConsumableCatalogEntry,
  ItemCatalogEntry,
  ResolvedInventoryEntry,
  WeaponCatalogEntry,
} from "@/lib/equipment";

export type EquipmentCatalogKind = "weapons" | "armor" | "items" | "consumables";
export type EquipmentEntityKind = "weapon" | "armor" | "item" | "consumable";
export type EquipmentSlot = "primary_weapon" | "secondary_weapon" | "armor";

export type EquipmentCatalogEntryByKind = {
  weapons: WeaponCatalogEntry;
  armor: ArmorCatalogEntry;
  items: ItemCatalogEntry;
  consumables: ConsumableCatalogEntry;
};

export type EquipmentEntryLike = CharacterInventoryEntry | ResolvedInventoryEntry;

function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

export async function fetchEquipmentCatalog<K extends EquipmentCatalogKind>(
  kind: K,
  options: {
    scope?: "official" | "personal" | "campaign" | "available";
    campaignId?: number | null;
    includeArchived?: boolean;
    search?: string;
  } = {}
) {
  const query = buildQuery({
    scope: options.scope ?? "available",
    campaignId: options.campaignId ?? null,
    includeArchived: options.includeArchived ? "true" : null,
    search: options.search?.trim() || null,
  });
  const response = await fetch(`/api/${kind}${query}`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : `Failed to load ${kind}`
    );
  }
  return (Array.isArray(payload) ? payload : []) as Array<EquipmentCatalogEntryByKind[K]>;
}

export function getInventoryEntryName(
  entry: EquipmentEntryLike,
  maps: {
    weaponsById: Map<string, WeaponCatalogEntry>;
    armorById: Map<string, ArmorCatalogEntry>;
    itemsById: Map<string, ItemCatalogEntry>;
    consumablesById: Map<string, ConsumableCatalogEntry>;
  }
) {
  if ("sourceName" in entry && typeof entry.sourceName === "string" && entry.sourceName.trim()) {
    return entry.sourceName;
  }

  if (entry.entityKind === "weapon") {
    return maps.weaponsById.get(entry.entityId)?.name ?? entry.entityId;
  }
  if (entry.entityKind === "armor") {
    return maps.armorById.get(entry.entityId)?.name ?? entry.entityId;
  }
  if (entry.entityKind === "item") {
    return maps.itemsById.get(entry.entityId)?.name ?? entry.entityId;
  }
  return maps.consumablesById.get(entry.entityId)?.name ?? entry.entityId;
}

export function buildEquipmentMaps(input: {
  weapons: WeaponCatalogEntry[];
  armor: ArmorCatalogEntry[];
  items: ItemCatalogEntry[];
  consumables: ConsumableCatalogEntry[];
}) {
  return {
    weaponsById: new Map(input.weapons.map((entry) => [entry.id, entry])),
    armorById: new Map(input.armor.map((entry) => [entry.id, entry])),
    itemsById: new Map(input.items.map((entry) => [entry.id, entry])),
    consumablesById: new Map(input.consumables.map((entry) => [entry.id, entry])),
  };
}

