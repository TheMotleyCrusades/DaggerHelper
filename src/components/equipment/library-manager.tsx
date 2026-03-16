"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  ArmorCatalogEntry,
  ConsumableCatalogEntry,
  ItemCatalogEntry,
  WeaponCatalogEntry,
} from "@/lib/equipment";
import { fetchEquipmentCatalog } from "@/lib/equipment-client";

type EquipmentTab = "weapons" | "armor" | "items" | "consumables";

function readError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const data = payload as { error?: string };
  return typeof data.error === "string" ? data.error : fallback;
}

export function EquipmentLibraryManager({
  scope,
  campaignId,
  title,
  description,
  initialTab,
  onChanged,
}: {
  scope: "personal" | "campaign";
  campaignId?: number;
  title: string;
  description: string;
  initialTab?: EquipmentTab;
  onChanged?: () => Promise<void> | void;
}) {
  const [activeTab, setActiveTab] = useState<EquipmentTab>(initialTab ?? "weapons");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [cloneId, setCloneId] = useState("");

  const [weapons, setWeapons] = useState<WeaponCatalogEntry[]>([]);
  const [armor, setArmor] = useState<ArmorCatalogEntry[]>([]);
  const [items, setItems] = useState<ItemCatalogEntry[]>([]);
  const [consumables, setConsumables] = useState<ConsumableCatalogEntry[]>([]);

  const [availableWeapons, setAvailableWeapons] = useState<WeaponCatalogEntry[]>([]);
  const [availableArmor, setAvailableArmor] = useState<ArmorCatalogEntry[]>([]);
  const [availableItems, setAvailableItems] = useState<ItemCatalogEntry[]>([]);
  const [availableConsumables, setAvailableConsumables] = useState<ConsumableCatalogEntry[]>([]);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, campaignId]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      setCloneId("");
    }
  }, [initialTab]);

  async function loadAll() {
    if (scope === "campaign" && !campaignId) {
      setError("Campaign ID is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [nextWeapons, nextArmor, nextItems, nextConsumables] = await Promise.all([
        fetchEquipmentCatalog("weapons", { scope, campaignId }),
        fetchEquipmentCatalog("armor", { scope, campaignId }),
        fetchEquipmentCatalog("items", { scope, campaignId }),
        fetchEquipmentCatalog("consumables", { scope, campaignId }),
      ]);
      setWeapons(nextWeapons);
      setArmor(nextArmor);
      setItems(nextItems);
      setConsumables(nextConsumables);

      const [availWeapons, availArmor, availItems, availConsumables] = await Promise.all([
        fetchEquipmentCatalog("weapons", { scope: "available", campaignId }),
        fetchEquipmentCatalog("armor", { scope: "available", campaignId }),
        fetchEquipmentCatalog("items", { scope: "available", campaignId }),
        fetchEquipmentCatalog("consumables", { scope: "available", campaignId }),
      ]);
      setAvailableWeapons(availWeapons);
      setAvailableArmor(availArmor);
      setAvailableItems(availItems);
      setAvailableConsumables(availConsumables);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load equipment library");
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    if (activeTab === "weapons") return weapons;
    if (activeTab === "armor") return armor;
    if (activeTab === "items") return items;
    return consumables;
  }, [activeTab, armor, consumables, items, weapons]);

  const cloneOptions = useMemo(() => {
    if (activeTab === "weapons") return availableWeapons;
    if (activeTab === "armor") return availableArmor;
    if (activeTab === "items") return availableItems;
    return availableConsumables;
  }, [activeTab, availableArmor, availableConsumables, availableItems, availableWeapons]);

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const basePayload = scope === "campaign" ? { scope, campaignId } : { scope };
      let endpoint = "/api/weapons";
      let payload: Record<string, unknown> = {};

      if (activeTab === "weapons") {
        endpoint = "/api/weapons";
        payload = {
          ...basePayload,
          name: name.trim(),
          tier: 1,
          weaponCategory: "primary",
          weaponSubtype: "custom",
          defaultProfile: {
            label: "Standard Attack",
            traitMode: "strength",
            rangeBand: "melee",
            damageFormula: "d8",
            damageType: "physical",
          },
          featureText: details.trim(),
        };
      } else if (activeTab === "armor") {
        endpoint = "/api/armor";
        payload = {
          ...basePayload,
          name: name.trim(),
          tier: 1,
          baseMajorThreshold: 1,
          baseSevereThreshold: 2,
          baseArmorScore: 0,
          featureText: details.trim(),
        };
      } else if (activeTab === "items") {
        endpoint = "/api/items";
        payload = {
          ...basePayload,
          name: name.trim(),
          rarity: "common",
          itemCategory: "utility",
          stackLimit: 1,
          rulesText: details.trim(),
        };
      } else {
        endpoint = "/api/consumables";
        payload = {
          ...basePayload,
          name: name.trim(),
          rarity: "common",
          consumableCategory: "other",
          stackLimit: 1,
          rulesText: details.trim(),
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(readError(data, "Failed to create entry"));

      setName("");
      setDetails("");
      await loadAll();
      if (onChanged) await onChanged();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create entry");
    } finally {
      setBusy(false);
    }
  }

  async function cloneEntry() {
    if (!cloneId) return;
    setBusy(true);
    setError(null);
    try {
      const basePayload = scope === "campaign" ? { scope, campaignId } : { scope };
      const endpoint =
        activeTab === "weapons"
          ? "/api/weapons"
          : activeTab === "armor"
            ? "/api/armor"
            : activeTab === "items"
              ? "/api/items"
              : "/api/consumables";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...basePayload,
          cloneFromId: cloneId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(readError(data, "Failed to clone entry"));
      setCloneId("");
      await loadAll();
      if (onChanged) await onChanged();
    } catch (cloneError) {
      setError(cloneError instanceof Error ? cloneError.message : "Failed to clone entry");
    } finally {
      setBusy(false);
    }
  }

  async function archiveRow(id: string) {
    setBusy(true);
    setError(null);
    try {
      const endpoint =
        activeTab === "weapons"
          ? `/api/weapons/${id}`
          : activeTab === "armor"
            ? `/api/armor/${id}`
            : activeTab === "items"
              ? `/api/items/${id}`
              : `/api/consumables/${id}`;
      const response = await fetch(endpoint, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(readError(data, "Failed to archive entry"));
      await loadAll();
      if (onChanged) await onChanged();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive entry");
    } finally {
      setBusy(false);
    }
  }

  async function quickEdit(id: string, currentName: string, currentText: string) {
    const nextName = prompt("Entry name", currentName)?.trim();
    if (!nextName) return;
    const nextText = prompt("Rules / feature text", currentText) ?? currentText;
    setBusy(true);
    setError(null);
    try {
      const endpoint =
        activeTab === "weapons"
          ? `/api/weapons/${id}`
          : activeTab === "armor"
            ? `/api/armor/${id}`
            : activeTab === "items"
              ? `/api/items/${id}`
              : `/api/consumables/${id}`;
      const payload =
        activeTab === "weapons"
          ? { name: nextName, featureText: nextText }
          : activeTab === "armor"
            ? { name: nextName, featureText: nextText }
            : { name: nextName, rulesText: nextText };
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(readError(data, "Failed to update entry"));
      await loadAll();
      if (onChanged) await onChanged();
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Failed to update entry");
    } finally {
      setBusy(false);
    }
  }

  function rowText(
    row: WeaponCatalogEntry | ArmorCatalogEntry | ItemCatalogEntry | ConsumableCatalogEntry
  ) {
    if (activeTab === "weapons") {
      const weapon = row as WeaponCatalogEntry;
      return `${weapon.defaultProfile.damageFormula} ${weapon.defaultProfile.damageType}`;
    }
    if (activeTab === "armor") {
      const armorRow = row as ArmorCatalogEntry;
      return `Armor ${armorRow.baseArmorScore} · Major ${armorRow.baseMajorThreshold}`;
    }
    if (activeTab === "items") {
      return (row as ItemCatalogEntry).rulesText || "No rules text";
    }
    return (row as ConsumableCatalogEntry).rulesText || "No rules text";
  }

  function rowRulesText(
    row: WeaponCatalogEntry | ArmorCatalogEntry | ItemCatalogEntry | ConsumableCatalogEntry
  ) {
    if (activeTab === "weapons") return (row as WeaponCatalogEntry).featureText || "";
    if (activeTab === "armor") return (row as ArmorCatalogEntry).featureText || "";
    if (activeTab === "items") return (row as ItemCatalogEntry).rulesText || "";
    return (row as ConsumableCatalogEntry).rulesText || "";
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-700/50 bg-slate-900/65 p-4">
      <div>
        <h3 className="text-lg text-amber-200">{title}</h3>
        <p className="text-xs text-slate-400">{description}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {(["weapons", "armor", "items", "consumables"] as const).map((tab) => (
          <button
            key={tab}
            className={`min-h-11 rounded-md px-3 py-2 text-xs ${
              activeTab === tab
                ? "bg-amber-700/35 text-amber-100"
                : "bg-slate-800/70 text-slate-300"
            }`}
            type="button"
            onClick={() => {
              setActiveTab(tab);
              setCloneId("");
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {loading && <p className="text-xs text-slate-300">Loading equipment...</p>}

      <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] rounded-lg border border-slate-700/45 bg-slate-950/55 p-3" onSubmit={submitCreate}>
        <label className="text-xs text-slate-300">
          Name
          <input
            className="field mt-1"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="text-xs text-slate-300">
          Details
          <input
            className="field mt-1"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
          />
        </label>
        <button className="btn-primary min-h-11 px-3 py-2 text-xs" disabled={busy}>
          Create
        </button>
      </form>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto] rounded-lg border border-slate-700/45 bg-slate-950/55 p-3">
        <label className="text-xs text-slate-300">
          Clone From Available
          <select
            className="field mt-1"
            value={cloneId}
            onChange={(event) => setCloneId(event.target.value)}
          >
            <option value="">Select entry</option>
            {cloneOptions.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} ({entry.scope})
              </option>
            ))}
          </select>
        </label>
        <button className="btn-outline min-h-11 px-3 py-2 text-xs" disabled={!cloneId || busy} type="button" onClick={() => void cloneEntry()}>
          Clone
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <article key={row.id} className="rounded-lg border border-slate-700/45 bg-slate-950/55 p-3">
            <p className="text-sm text-amber-100">{row.name}</p>
            <p className="text-[11px] text-slate-400">scope: {row.scope}</p>
            <p className="mt-1 text-xs text-slate-300">{rowText(row)}</p>
            <div className="mt-2 flex gap-2">
              <button
                className="rounded-md border border-slate-500/45 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                type="button"
                onClick={() => void quickEdit(row.id, row.name, rowRulesText(row))}
              >
                Edit
              </button>
              <button
                className="rounded-md border border-red-400/45 px-2 py-1 text-xs text-red-300 hover:bg-red-950/30"
                type="button"
                onClick={() => void archiveRow(row.id)}
              >
                Archive
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
