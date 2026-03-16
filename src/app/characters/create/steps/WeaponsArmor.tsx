"use client";

import { useEffect, useMemo, useState } from "react";
import { getClassDefinition } from "@/lib/constants/classes";
import {
  buildSourceMaps,
  getOfficialArmor,
  getOfficialConsumables,
  getOfficialItems,
  getOfficialWeapons,
  resolveCharacterCombat,
  type CharacterInventoryEntry,
} from "@/lib/equipment";
import { fetchEquipmentCatalog } from "@/lib/equipment-client";

type Props = {
  campaignId: number | null;
  className: string;
  baseEvasion: number;
  inventoryItems: Array<Record<string, unknown>>;
  onChange: (patch: {
    baseEvasion?: number;
    inventoryItems?: Array<Record<string, unknown>>;
    primaryWeaponId?: string;
    secondaryWeaponId?: string;
    armorId?: string;
  }) => void;
};

type DraftInventoryEntry = {
  id: string;
  entityKind: "weapon" | "armor" | "item" | "consumable";
  entityId: string;
  quantity: number;
  isEquipped: boolean;
  equippedSlot: "primary_weapon" | "secondary_weapon" | "armor" | null;
  notes: string;
  sortOrder: number;
};

const TRAITS_ZERO = {
  agility: 0,
  strength: 0,
  finesse: 0,
  instinct: 0,
  presence: 0,
  knowledge: 0,
};

function toInt(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function parseDraftEntries(input: Array<Record<string, unknown>>) {
  return input
    .map((item, index): DraftInventoryEntry | null => {
      const entityKind = item.entityKind;
      const entityId = typeof item.entityId === "string" ? item.entityId.trim() : "";
      if (
        (entityKind !== "weapon" &&
          entityKind !== "armor" &&
          entityKind !== "item" &&
          entityKind !== "consumable") ||
        !entityId
      ) {
        return null;
      }

      const equippedSlot =
        item.equippedSlot === "primary_weapon" ||
        item.equippedSlot === "secondary_weapon" ||
        item.equippedSlot === "armor"
          ? item.equippedSlot
          : null;

      return {
        id:
          typeof item.id === "string" && item.id.trim()
            ? item.id
            : `draft-${entityKind}-${entityId}-${index + 1}`,
        entityKind,
        entityId,
        quantity: Math.max(1, toInt(item.quantity, 1)),
        isEquipped: Boolean(item.isEquipped),
        equippedSlot,
        notes: typeof item.notes === "string" ? item.notes : "",
        sortOrder: Math.max(0, toInt(item.sortOrder, index)),
      };
    })
    .filter((entry): entry is DraftInventoryEntry => Boolean(entry))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function toPatchInventory(entries: DraftInventoryEntry[]) {
  return entries.map((entry, index) => ({
    id: entry.id,
    entityKind: entry.entityKind,
    entityId: entry.entityId,
    quantity: entry.quantity,
    isEquipped: entry.isEquipped,
    equippedSlot: entry.equippedSlot,
    notes: entry.notes,
    sortOrder: index,
  }));
}

function withDerivedIds(entries: DraftInventoryEntry[]) {
  const primaryWeaponId =
    entries.find(
      (entry) =>
        entry.entityKind === "weapon" &&
        entry.isEquipped &&
        entry.equippedSlot === "primary_weapon"
    )?.entityId ?? "";

  const secondaryWeaponId =
    entries.find(
      (entry) =>
        entry.entityKind === "weapon" &&
        entry.isEquipped &&
        entry.equippedSlot === "secondary_weapon"
    )?.entityId ?? "";

  const armorId =
    entries.find(
      (entry) =>
        entry.entityKind === "armor" &&
        entry.isEquipped &&
        entry.equippedSlot === "armor"
    )?.entityId ?? "";

  return {
    primaryWeaponId,
    secondaryWeaponId,
    armorId,
  };
}

function ensureUniqueSlots(entries: DraftInventoryEntry[]) {
  const used = new Set<"primary_weapon" | "secondary_weapon" | "armor">();
  return entries.map((entry) => {
    if (!entry.isEquipped || !entry.equippedSlot) {
      return { ...entry, equippedSlot: null };
    }

    if (used.has(entry.equippedSlot)) {
      return {
        ...entry,
        isEquipped: false,
        equippedSlot: null,
      };
    }

    used.add(entry.equippedSlot);
    return entry;
  });
}

export function WeaponsArmorStep({
  campaignId,
  className,
  baseEvasion,
  inventoryItems,
  onChange,
}: Props) {
  const [weapons, setWeapons] = useState(getOfficialWeapons());
  const [armor, setArmor] = useState(getOfficialArmor());
  const [items, setItems] = useState(getOfficialItems());
  const [consumables, setConsumables] = useState(getOfficialConsumables());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useRecommended, setUseRecommended] = useState(false);
  const [addItemId, setAddItemId] = useState("");
  const [addConsumableId, setAddConsumableId] = useState("");

  const selectedClass = useMemo(() => getClassDefinition(className), [className]);
  const recommendedLocked = Boolean(selectedClass) && useRecommended;
  const entries = useMemo(() => parseDraftEntries(inventoryItems), [inventoryItems]);

  const sourceMaps = useMemo(
    () =>
      buildSourceMaps({
        weapons,
        armor,
        items,
        consumables,
      }),
    [armor, consumables, items, weapons]
  );

  const resolvedPreview = useMemo(() => {
    const normalizedEntries = ensureUniqueSlots(entries).map(
      (entry): CharacterInventoryEntry => ({
        id: entry.id,
        characterId: 0,
        entityKind: entry.entityKind,
        entityId: entry.entityId,
        quantity: entry.quantity,
        isEquipped: entry.isEquipped,
        equippedSlot: entry.equippedSlot,
        notes: entry.notes,
        sortOrder: entry.sortOrder,
      })
    );

    return resolveCharacterCombat({
      character: {
        id: 0,
        class: className || "adventurer",
        level: 1,
        baseEvasion,
        traits: TRAITS_ZERO,
      },
      inventoryEntries: normalizedEntries,
      sourceMaps,
    });
  }, [baseEvasion, className, entries, sourceMaps]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!campaignId) {
        setWeapons(getOfficialWeapons());
        setArmor(getOfficialArmor());
        setItems(getOfficialItems());
        setConsumables(getOfficialConsumables());
        return;
      }

      setLoading(true);
      try {
        const [nextWeapons, nextArmor, nextItems, nextConsumables] = await Promise.all([
          fetchEquipmentCatalog("weapons", { campaignId, scope: "available" }),
          fetchEquipmentCatalog("armor", { campaignId, scope: "available" }),
          fetchEquipmentCatalog("items", { campaignId, scope: "available" }),
          fetchEquipmentCatalog("consumables", { campaignId, scope: "available" }),
        ]);

        if (cancelled) return;

        setWeapons(nextWeapons.length ? nextWeapons : getOfficialWeapons());
        setArmor(nextArmor.length ? nextArmor : getOfficialArmor());
        setItems(nextItems.length ? nextItems : getOfficialItems());
        setConsumables(nextConsumables.length ? nextConsumables : getOfficialConsumables());
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load equipment");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  function applyEntries(nextEntries: DraftInventoryEntry[]) {
    const normalized = ensureUniqueSlots(
      [...nextEntries].sort((left, right) => left.sortOrder - right.sortOrder)
    ).map((entry, index) => ({ ...entry, sortOrder: index }));

    onChange({
      inventoryItems: toPatchInventory(normalized),
      ...withDerivedIds(normalized),
    });
  }

  function nextSortOrder() {
    if (!entries.length) return 0;
    return Math.max(...entries.map((entry) => entry.sortOrder)) + 1;
  }

  function upsertSlot(
    slot: "primary_weapon" | "secondary_weapon" | "armor",
    nextEntityId: string
  ) {
    const trimmed = nextEntityId.trim();
    const filtered = entries.filter((entry) => entry.equippedSlot !== slot);
    if (!trimmed) {
      applyEntries(filtered);
      return;
    }

    const entityKind = slot === "armor" ? "armor" : "weapon";
    const existing = entries.find(
      (entry) => entry.entityKind === entityKind && entry.entityId === trimmed
    );
    const slotEntry: DraftInventoryEntry = existing
      ? {
          ...existing,
          isEquipped: true,
          equippedSlot: slot,
        }
      : {
          id: `draft-${entityKind}-${trimmed}-${Date.now().toString(36)}`,
          entityKind,
          entityId: trimmed,
          quantity: 1,
          isEquipped: true,
          equippedSlot: slot,
          notes: "",
          sortOrder: nextSortOrder(),
        };

    const withoutExistingSameItem = filtered.filter((entry) => entry.id !== slotEntry.id);
    applyEntries([...withoutExistingSameItem, slotEntry]);
  }

  function updateEntry(entryId: string, patch: Partial<DraftInventoryEntry>) {
    applyEntries(
      entries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              ...patch,
            }
          : entry
      )
    );
  }

  function removeEntry(entryId: string) {
    applyEntries(entries.filter((entry) => entry.id !== entryId));
  }

  function addInventoryEntry(kind: "item" | "consumable", entityId: string) {
    const trimmed = entityId.trim();
    if (!trimmed) return;

    const existing = entries.find(
      (entry) => entry.entityKind === kind && entry.entityId === trimmed
    );
    if (existing) {
      updateEntry(existing.id, { quantity: existing.quantity + 1 });
      return;
    }

    const nextEntry: DraftInventoryEntry = {
      id: `draft-${kind}-${trimmed}-${Date.now().toString(36)}`,
      entityKind: kind,
      entityId: trimmed,
      quantity: 1,
      isEquipped: false,
      equippedSlot: null,
      notes: "",
      sortOrder: nextSortOrder(),
    };
    applyEntries([...entries, nextEntry]);
  }

  useEffect(() => {
    if (!selectedClass || !useRecommended) return;
    const next = [...entries].filter(
      (entry) =>
        entry.equippedSlot !== "primary_weapon" &&
        entry.equippedSlot !== "secondary_weapon" &&
        entry.equippedSlot !== "armor"
    );
    const recommended: DraftInventoryEntry[] = [
      {
        id: `draft-weapon-${selectedClass.recommendedPrimaryWeaponId}`,
        entityKind: "weapon",
        entityId: selectedClass.recommendedPrimaryWeaponId,
        quantity: 1,
        isEquipped: true,
        equippedSlot: "primary_weapon",
        notes: "",
        sortOrder: nextSortOrder() + 1,
      },
      {
        id: `draft-weapon-${selectedClass.recommendedSecondaryWeaponId}`,
        entityKind: "weapon",
        entityId: selectedClass.recommendedSecondaryWeaponId,
        quantity: 1,
        isEquipped: true,
        equippedSlot: "secondary_weapon",
        notes: "",
        sortOrder: nextSortOrder() + 2,
      },
      {
        id: `draft-armor-${selectedClass.recommendedArmorId}`,
        entityKind: "armor",
        entityId: selectedClass.recommendedArmorId,
        quantity: 1,
        isEquipped: true,
        equippedSlot: "armor",
        notes: "",
        sortOrder: nextSortOrder() + 3,
      },
    ];
    applyEntries([...next, ...recommended]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, useRecommended]);

  const equippedPrimaryId =
    entries.find(
      (entry) =>
        entry.entityKind === "weapon" &&
        entry.isEquipped &&
        entry.equippedSlot === "primary_weapon"
    )?.entityId ?? "";

  const equippedSecondaryId =
    entries.find(
      (entry) =>
        entry.entityKind === "weapon" &&
        entry.isEquipped &&
        entry.equippedSlot === "secondary_weapon"
    )?.entityId ?? "";

  const equippedArmorId =
    entries.find(
      (entry) =>
        entry.entityKind === "armor" &&
        entry.isEquipped &&
        entry.equippedSlot === "armor"
    )?.entityId ?? "";

  const itemNameById = useMemo(
    () => new Map(items.map((entry) => [entry.id, entry.name])),
    [items]
  );
  const consumableNameById = useMemo(
    () => new Map(consumables.map((entry) => [entry.id, entry.name])),
    [consumables]
  );
  const weaponNameById = useMemo(
    () => new Map(weapons.map((entry) => [entry.id, entry.name])),
    [weapons]
  );
  const armorNameById = useMemo(
    () => new Map(armor.map((entry) => [entry.id, entry.name])),
    [armor]
  );

  function entryName(entry: DraftInventoryEntry) {
    if (entry.entityKind === "weapon") return weaponNameById.get(entry.entityId) ?? entry.entityId;
    if (entry.entityKind === "armor") return armorNameById.get(entry.entityId) ?? entry.entityId;
    if (entry.entityKind === "item") return itemNameById.get(entry.entityId) ?? entry.entityId;
    return consumableNameById.get(entry.entityId) ?? entry.entityId;
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl text-amber-300">Step 4 - Loadout & Inventory</h2>
        <p className="text-sm text-slate-300">
          Select equipped weapon and armor slots, then add carried items and consumables.
        </p>
      </div>

      <label className="block max-w-48 text-sm text-slate-300">
        Base Evasion
        <input
          className="field mt-1"
          max={99}
          min={-20}
          type="number"
          value={baseEvasion}
          onChange={(event) => onChange({ baseEvasion: toInt(event.target.value, 0) })}
        />
      </label>

      <label
        className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm ${
          selectedClass
            ? "border-slate-700/50 text-slate-200"
            : "cursor-not-allowed border-slate-700/30 text-slate-500"
        }`}
      >
        <input
          checked={recommendedLocked}
          className="h-4 w-4"
          disabled={!selectedClass}
          type="checkbox"
          onChange={(event) => setUseRecommended(event.target.checked)}
        />
        Use recommended loadout
      </label>

      {loading && <p className="text-sm text-slate-300">Loading equipment libraries...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid gap-3 lg:grid-cols-3">
        <label className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-3 text-sm text-slate-300">
          Primary Weapon
          <select
            className="field mt-1"
            disabled={recommendedLocked}
            value={equippedPrimaryId}
            onChange={(event) => upsertSlot("primary_weapon", event.target.value)}
          >
            <option value="">Select primary weapon</option>
            {weapons.map((weapon) => (
              <option key={weapon.id} value={weapon.id}>
                {weapon.name}
              </option>
            ))}
          </select>
        </label>

        <label className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-3 text-sm text-slate-300">
          Secondary Weapon
          <select
            className="field mt-1"
            disabled={recommendedLocked}
            value={equippedSecondaryId}
            onChange={(event) => upsertSlot("secondary_weapon", event.target.value)}
          >
            <option value="">Select secondary weapon</option>
            {weapons.map((weapon) => (
              <option key={weapon.id} value={weapon.id}>
                {weapon.name}
              </option>
            ))}
          </select>
        </label>

        <label className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-3 text-sm text-slate-300">
          Armor
          <select
            className="field mt-1"
            disabled={recommendedLocked}
            value={equippedArmorId}
            onChange={(event) => upsertSlot("armor", event.target.value)}
          >
            <option value="">Select armor</option>
            {armor.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-3">
          <h3 className="text-sm text-amber-100">Add Item</h3>
          <div className="mt-2 flex gap-2">
            <select
              className="field flex-1"
              value={addItemId}
              onChange={(event) => setAddItemId(event.target.value)}
            >
              <option value="">Select item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              className="btn-outline min-h-11 px-3 py-2 text-xs"
              type="button"
              onClick={() => {
                addInventoryEntry("item", addItemId);
                setAddItemId("");
              }}
            >
              Add
            </button>
          </div>
        </article>

        <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-3">
          <h3 className="text-sm text-amber-100">Add Consumable</h3>
          <div className="mt-2 flex gap-2">
            <select
              className="field flex-1"
              value={addConsumableId}
              onChange={(event) => setAddConsumableId(event.target.value)}
            >
              <option value="">Select consumable</option>
              {consumables.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
            <button
              className="btn-outline min-h-11 px-3 py-2 text-xs"
              type="button"
              onClick={() => {
                addInventoryEntry("consumable", addConsumableId);
                setAddConsumableId("");
              }}
            >
              Add
            </button>
          </div>
        </article>
      </div>

      <article className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-900/65 p-3">
        <h3 className="text-sm text-amber-100">Current Inventory</h3>
        {entries.length === 0 && (
          <p className="text-xs text-slate-400">No entries yet. Add equipment above.</p>
        )}
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="grid gap-2 rounded-md border border-slate-700/45 bg-slate-950/60 p-2 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr_auto]"
          >
            <div>
              <p className="text-xs text-amber-100">{entryName(entry)}</p>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{entry.entityKind}</p>
            </div>

            <label className="text-[11px] text-slate-300">
              Quantity
              <input
                className="field mt-1"
                min={1}
                type="number"
                value={entry.quantity}
                onChange={(event) =>
                  updateEntry(entry.id, { quantity: Math.max(1, toInt(event.target.value, 1)) })
                }
              />
            </label>

            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-2 py-2 text-[11px] text-slate-300">
              <input
                checked={entry.isEquipped}
                disabled={entry.entityKind === "consumable"}
                type="checkbox"
                onChange={(event) =>
                  updateEntry(entry.id, {
                    isEquipped: event.target.checked,
                    equippedSlot: event.target.checked ? entry.equippedSlot : null,
                  })
                }
              />
              Equipped
            </label>

            <label className="text-[11px] text-slate-300">
              Slot
              <select
                className="field mt-1"
                disabled={
                  entry.entityKind === "consumable" ||
                  entry.entityKind === "item" ||
                  !entry.isEquipped
                }
                value={entry.equippedSlot ?? ""}
                onChange={(event) => {
                  const nextSlot =
                    event.target.value === "primary_weapon" ||
                    event.target.value === "secondary_weapon" ||
                    event.target.value === "armor"
                      ? event.target.value
                      : null;
                  updateEntry(entry.id, { equippedSlot: nextSlot });
                }}
              >
                <option value="">Not slotted</option>
                <option value="primary_weapon">Primary Weapon</option>
                <option value="secondary_weapon">Secondary Weapon</option>
                <option value="armor">Armor</option>
              </select>
            </label>

            <button
              className="rounded-md border border-red-400/45 px-2 py-2 text-xs text-red-300 hover:bg-red-950/30"
              type="button"
              onClick={() => removeEntry(entry.id)}
            >
              Remove
            </button>
          </div>
        ))}
      </article>

      <article className="rounded-xl border border-amber-700/35 bg-amber-950/20 p-3 text-xs text-slate-200">
        <p>
          Combat Preview: Evasion {resolvedPreview.finalEvasion}, Armor Score {resolvedPreview.armorScore}, Major{" "}
          {resolvedPreview.majorThreshold}, Severe {resolvedPreview.severeThreshold}
        </p>
        <p>
          Primary: {resolvedPreview.primaryAttack?.profile.damageFormula ?? "-"} | Secondary:{" "}
          {resolvedPreview.secondaryAttack?.profile.damageFormula ?? "-"}
        </p>
        {resolvedPreview.warnings.length > 0 && (
          <ul className="mt-2 space-y-1 text-amber-200">
            {resolvedPreview.warnings.map((warning) => (
              <li key={warning}>- {warning}</li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
