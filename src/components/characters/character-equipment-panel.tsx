"use client";

import { useEffect, useMemo, useState } from "react";
import type { CharacterRecord } from "@/lib/characters";
import type {
  ArmorCatalogEntry,
  ConsumableCatalogEntry,
  ItemCatalogEntry,
  ResolvedInventoryEntry,
  WeaponCatalogEntry,
} from "@/lib/equipment";
import {
  buildEquipmentMaps,
  fetchEquipmentCatalog,
  getInventoryEntryName,
} from "@/lib/equipment-client";

type AddFormState = {
  entityKind: "weapon" | "armor" | "item" | "consumable";
  entityId: string;
  quantity: number;
  isEquipped: boolean;
  equippedSlot: "primary_weapon" | "secondary_weapon" | "armor" | null;
  notes: string;
};

const INITIAL_FORM: AddFormState = {
  entityKind: "weapon",
  entityId: "",
  quantity: 1,
  isEquipped: false,
  equippedSlot: null,
  notes: "",
};

function toInt(value: unknown, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function parseLegacyInventory(entries: Array<Record<string, unknown>>) {
  return entries
    .map((entry, index): ResolvedInventoryEntry | null => {
      const entityKind = entry.entityKind;
      const entityId = typeof entry.entityId === "string" ? entry.entityId.trim() : "";
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
        entry.equippedSlot === "primary_weapon" ||
        entry.equippedSlot === "secondary_weapon" ||
        entry.equippedSlot === "armor"
          ? entry.equippedSlot
          : null;

      return {
        id:
          typeof entry.id === "string" && entry.id.trim()
            ? entry.id
            : `legacy-${entityKind}-${entityId}-${index + 1}`,
        characterId: 0,
        entityKind,
        entityId,
        quantity: Math.max(1, toInt(entry.quantity, 1)),
        isEquipped: Boolean(entry.isEquipped),
        equippedSlot,
        notes: typeof entry.notes === "string" ? entry.notes : "",
        sortOrder: Math.max(0, toInt(entry.sortOrder, index)),
        sourceName: null,
        sourceScope: null,
        sourceArchived: false,
      };
    })
    .filter((entry): entry is ResolvedInventoryEntry => Boolean(entry))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function CharacterEquipmentPanel({
  character,
  onCharacterChange,
}: {
  character: CharacterRecord;
  onCharacterChange: (next: CharacterRecord) => void;
}) {
  const [form, setForm] = useState<AddFormState>(INITIAL_FORM);
  const [inventoryEntries, setInventoryEntries] = useState<ResolvedInventoryEntry[]>(
    character.inventory.length ? character.inventory : parseLegacyInventory(character.inventoryItems)
  );
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [weapons, setWeapons] = useState<WeaponCatalogEntry[]>([]);
  const [armor, setArmor] = useState<ArmorCatalogEntry[]>([]);
  const [items, setItems] = useState<ItemCatalogEntry[]>([]);
  const [consumables, setConsumables] = useState<ConsumableCatalogEntry[]>([]);

  const maps = useMemo(
    () =>
      buildEquipmentMaps({
        weapons,
        armor,
        items,
        consumables,
      }),
    [armor, consumables, items, weapons]
  );

  const optionsByKind = useMemo(() => {
    return {
      weapon: weapons.map((entry) => ({ id: entry.id, name: entry.name })),
      armor: armor.map((entry) => ({ id: entry.id, name: entry.name })),
      item: items.map((entry) => ({ id: entry.id, name: entry.name })),
      consumable: consumables.map((entry) => ({ id: entry.id, name: entry.name })),
    };
  }, [armor, consumables, items, weapons]);

  useEffect(() => {
    setInventoryEntries(
      character.inventory.length ? character.inventory : parseLegacyInventory(character.inventoryItems)
    );
  }, [character.id, character.inventory, character.inventoryItems]);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      if (!character.campaignId) return;
      setLoadingCatalog(true);
      try {
        const [nextWeapons, nextArmor, nextItems, nextConsumables] = await Promise.all([
          fetchEquipmentCatalog("weapons", {
            campaignId: character.campaignId,
            scope: "available",
          }),
          fetchEquipmentCatalog("armor", {
            campaignId: character.campaignId,
            scope: "available",
          }),
          fetchEquipmentCatalog("items", {
            campaignId: character.campaignId,
            scope: "available",
          }),
          fetchEquipmentCatalog("consumables", {
            campaignId: character.campaignId,
            scope: "available",
          }),
        ]);
        if (cancelled) return;
        setWeapons(nextWeapons);
        setArmor(nextArmor);
        setItems(nextItems);
        setConsumables(nextConsumables);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load equipment");
        }
      } finally {
        if (!cancelled) {
          setLoadingCatalog(false);
        }
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [character.campaignId]);

  async function refreshCharacterFromResponse(data: unknown) {
    if (!data || typeof data !== "object") return;
    const payload = data as { character?: CharacterRecord };
    if (payload.character) {
      onCharacterChange(payload.character);
      return;
    }

    if ("id" in payload) {
      onCharacterChange(payload as CharacterRecord);
    }
  }

  async function addEntry() {
    if (!form.entityId.trim()) {
      setError("Select an entry to add.");
      return;
    }

    setAdding(true);
    setError(null);
    try {
      const response = await fetch(`/api/characters/${character.id}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityKind: form.entityKind,
          entityId: form.entityId,
          quantity: Math.max(1, form.quantity),
          isEquipped: form.entityKind === "consumable" ? false : form.isEquipped,
          equippedSlot:
            form.entityKind === "consumable" || form.entityKind === "item"
              ? null
              : form.equippedSlot,
          notes: form.notes,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to add entry");
      }

      await refreshCharacterFromResponse(data);
      setForm((current) => ({ ...INITIAL_FORM, entityKind: current.entityKind }));
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Failed to add entry");
    } finally {
      setAdding(false);
    }
  }

  async function updateEntry(entry: ResolvedInventoryEntry, patch: Partial<ResolvedInventoryEntry>) {
    if (!entry.id || entry.id.startsWith("legacy-")) {
      setError("Legacy inventory entry cannot be edited directly. Re-add it from the add form.");
      return;
    }

    setPendingEntryId(entry.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/characters/${character.id}/inventory/${entry.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity: patch.quantity ?? entry.quantity,
            isEquipped: patch.isEquipped ?? entry.isEquipped,
            equippedSlot:
              patch.equippedSlot !== undefined ? patch.equippedSlot : entry.equippedSlot,
            notes: patch.notes ?? entry.notes,
            sortOrder: patch.sortOrder ?? entry.sortOrder,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to update entry");
      }
      await refreshCharacterFromResponse(data);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update entry");
    } finally {
      setPendingEntryId(null);
    }
  }

  async function removeEntry(entry: ResolvedInventoryEntry) {
    if (!entry.id || entry.id.startsWith("legacy-")) {
      setError("Legacy inventory entry cannot be removed directly. Replace your loadout in editor.");
      return;
    }

    setPendingEntryId(entry.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/characters/${character.id}/inventory/${entry.id}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to delete entry");
      }
      await refreshCharacterFromResponse(data);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete entry");
    } finally {
      setPendingEntryId(null);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-700/50 bg-slate-900/65 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg text-amber-200">Equipment Loadout</h3>
          <p className="text-xs text-slate-400">
            Manage equipped slots, passive items, and carried consumables.
          </p>
        </div>
      </div>

      {loadingCatalog && <p className="text-xs text-slate-300">Loading equipment catalog...</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="grid gap-2 rounded-lg border border-slate-700/45 bg-slate-950/50 p-2 lg:grid-cols-[1fr_1.5fr_0.6fr_0.8fr_1fr_auto]">
        <label className="text-xs text-slate-300">
          Kind
          <select
            className="field mt-1"
            value={form.entityKind}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                entityKind: event.target.value as AddFormState["entityKind"],
                entityId: "",
                isEquipped:
                  event.target.value === "item" || event.target.value === "consumable"
                    ? false
                    : current.isEquipped,
                equippedSlot:
                  event.target.value === "armor"
                    ? "armor"
                    : event.target.value === "weapon"
                      ? "primary_weapon"
                      : null,
              }))
            }
          >
            <option value="weapon">Weapon</option>
            <option value="armor">Armor</option>
            <option value="item">Item</option>
            <option value="consumable">Consumable</option>
          </select>
        </label>

        <label className="text-xs text-slate-300">
          Entry
          <select
            className="field mt-1"
            value={form.entityId}
            onChange={(event) => setForm((current) => ({ ...current, entityId: event.target.value }))}
          >
            <option value="">Select {form.entityKind}</option>
            {optionsByKind[form.entityKind].map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-300">
          Qty
          <input
            className="field mt-1"
            min={1}
            type="number"
            value={form.quantity}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                quantity: Math.max(1, toInt(event.target.value, 1)),
              }))
            }
          />
        </label>

        <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/45 px-2 py-2 text-xs text-slate-300">
          <input
            checked={form.isEquipped}
            disabled={form.entityKind === "item" || form.entityKind === "consumable"}
            type="checkbox"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                isEquipped: event.target.checked,
              }))
            }
          />
          Equipped
        </label>

        <label className="text-xs text-slate-300">
          Slot
          <select
            className="field mt-1"
            disabled={!form.isEquipped || form.entityKind === "item" || form.entityKind === "consumable"}
            value={form.equippedSlot ?? ""}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                equippedSlot:
                  event.target.value === "primary_weapon" ||
                  event.target.value === "secondary_weapon" ||
                  event.target.value === "armor"
                    ? event.target.value
                    : null,
              }))
            }
          >
            <option value="">No slot</option>
            <option value="primary_weapon">Primary</option>
            <option value="secondary_weapon">Secondary</option>
            <option value="armor">Armor</option>
          </select>
        </label>

        <button
          className="btn-outline min-h-11 px-3 py-2 text-xs"
          disabled={adding}
          type="button"
          onClick={() => void addEntry()}
        >
          {adding ? "Adding..." : "Add"}
        </button>
      </div>

      <div className="space-y-2">
        {inventoryEntries.length === 0 && (
          <p className="text-xs text-slate-400">No inventory entries on this character.</p>
        )}
        {inventoryEntries.map((entry) => {
          const pending = pendingEntryId === entry.id;
          const name = getInventoryEntryName(entry, maps);
          const isLegacy = entry.id.startsWith("legacy-");
          return (
            <article
              key={entry.id}
              className="grid gap-2 rounded-md border border-slate-700/45 bg-slate-950/60 p-2 lg:grid-cols-[1.2fr_0.6fr_0.8fr_1fr_1fr_auto]"
            >
              <div>
                <p className="text-sm text-amber-100">{name}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  {entry.entityKind}
                  {entry.sourceScope ? ` · ${entry.sourceScope}` : ""}
                  {entry.sourceArchived ? " · archived" : ""}
                  {isLegacy ? " · legacy" : ""}
                </p>
              </div>

              <label className="text-[11px] text-slate-300">
                Qty
                <input
                  className="field mt-1"
                  min={1}
                  type="number"
                  value={entry.quantity}
                  onBlur={(event) =>
                    void updateEntry(entry, {
                      quantity: Math.max(1, toInt(event.target.value, entry.quantity)),
                    })
                  }
                />
              </label>

              <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/45 px-2 py-2 text-[11px] text-slate-300">
                <input
                  checked={entry.isEquipped}
                  disabled={entry.entityKind === "consumable" || entry.entityKind === "item"}
                  type="checkbox"
                  onChange={(event) =>
                    void updateEntry(entry, {
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
                    !entry.isEquipped ||
                    entry.entityKind === "item" ||
                    entry.entityKind === "consumable"
                  }
                  value={entry.equippedSlot ?? ""}
                  onChange={(event) =>
                    void updateEntry(entry, {
                      equippedSlot:
                        event.target.value === "primary_weapon" ||
                        event.target.value === "secondary_weapon" ||
                        event.target.value === "armor"
                          ? event.target.value
                          : null,
                    })
                  }
                >
                  <option value="">No slot</option>
                  <option value="primary_weapon">Primary</option>
                  <option value="secondary_weapon">Secondary</option>
                  <option value="armor">Armor</option>
                </select>
              </label>

              <label className="text-[11px] text-slate-300">
                Notes
                <input
                  className="field mt-1"
                  defaultValue={entry.notes}
                  onBlur={(event) => void updateEntry(entry, { notes: event.target.value })}
                />
              </label>

              <button
                className="rounded-md border border-red-400/45 px-2 py-2 text-xs text-red-300 hover:bg-red-950/30 disabled:opacity-40"
                disabled={pending}
                type="button"
                onClick={() => void removeEntry(entry)}
              >
                {pending ? "..." : "Remove"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
