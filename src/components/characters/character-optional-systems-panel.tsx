"use client";

import { useEffect, useMemo, useState } from "react";
import type { CharacterRecord } from "@/lib/characters";
import {
  type CharacterCompanionState,
  type CharacterCraftingState,
  type CharacterDruidFormState,
  type CompanionRulesConfiguration,
  type CraftingRulesConfiguration,
  type DruidFormRulesConfiguration,
  isCompanionAllowed,
  isFormSelectionAllowed,
  resolveDruidForms,
  rollGatheringResources,
} from "@/lib/optional-systems";

type OptionalTabId = "crafting" | "forms" | "companion";

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CharacterOptionalSystemsPanel({
  character,
  craftingRules,
  druidFormRules,
  companionRules,
  onCharacterPatch,
  onCharacterHydrate,
}: {
  character: CharacterRecord;
  craftingRules: CraftingRulesConfiguration;
  druidFormRules: DruidFormRulesConfiguration;
  companionRules: CompanionRulesConfiguration;
  onCharacterPatch: (patch: Record<string, unknown>) => Promise<CharacterRecord | null>;
  onCharacterHydrate: (next: CharacterRecord) => void;
}) {
  const formsAllowed = isFormSelectionAllowed(character.class, druidFormRules);
  const companionAllowed = isCompanionAllowed(character.class, character.subclass, companionRules);

  const availableTabs = useMemo<OptionalTabId[]>(
    () => [
      ...(craftingRules.enabled ? (["crafting"] as OptionalTabId[]) : []),
      ...(formsAllowed ? (["forms"] as OptionalTabId[]) : []),
      ...(companionAllowed ? (["companion"] as OptionalTabId[]) : []),
    ],
    [companionAllowed, craftingRules.enabled, formsAllowed]
  );

  const [activeTab, setActiveTab] = useState<OptionalTabId>(availableTabs[0] ?? "crafting");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [craftingState, setCraftingState] = useState<CharacterCraftingState>(character.craftingState);
  const [druidState, setDruidState] = useState<CharacterDruidFormState>(character.druidFormState);
  const [companionState, setCompanionState] = useState<CharacterCompanionState>(character.companionState);
  const [gatherMaterialId, setGatherMaterialId] = useState<string>(
    craftingRules.materialTypes[0]?.id ?? ""
  );

  useEffect(() => {
    setCraftingState(character.craftingState);
    setDruidState(character.druidFormState);
    setCompanionState(character.companionState);
  }, [character]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] ?? "crafting");
    }
  }, [activeTab, availableTabs]);

  useEffect(() => {
    if (!craftingRules.materialTypes.length) {
      setGatherMaterialId("");
      return;
    }
    const currentExists = craftingRules.materialTypes.some((material) => material.id === gatherMaterialId);
    if (!currentExists) {
      setGatherMaterialId(craftingRules.materialTypes[0].id);
    }
  }, [craftingRules.materialTypes, gatherMaterialId]);

  const levelTier = useMemo(() => {
    if (character.level >= 8) return 4;
    if (character.level >= 5) return 3;
    if (character.level >= 2) return 2;
    return 1;
  }, [character.level]);

  const availableForms = useMemo(
    () => resolveDruidForms(druidFormRules).filter((form) => form.tier <= levelTier),
    [druidFormRules, levelTier]
  );
  const materialLabelById = useMemo(
    () => new Map(craftingRules.materialTypes.map((material) => [material.id, material.label])),
    [craftingRules.materialTypes]
  );
  const selectedProfessionCount = craftingState.professions.length;
  const totalMaterialCount = Object.values(craftingState.materials).reduce(
    (sum, value) => sum + Math.max(0, Math.round(Number(value) || 0)),
    0
  );
  const enabledRecipeCount = craftingRules.recipes.filter((recipe) => recipe.enabled).length;

  async function saveCraftingState(nextState: CharacterCraftingState, goldOverride?: number) {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        craftingState: nextState,
      };
      if (goldOverride !== undefined) {
        payload.gold = Math.max(0, goldOverride);
        payload.currencyValues = {
          ...character.currencyValues,
          gold: Math.max(0, goldOverride),
        };
      }

      const updated = await onCharacterPatch(payload);
      if (updated) {
        setCraftingState(updated.craftingState);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save crafting state");
    } finally {
      setSaving(false);
    }
  }

  async function saveDruidState(nextState: CharacterDruidFormState) {
    setSaving(true);
    setError(null);
    try {
      const updated = await onCharacterPatch({ druidFormState: nextState });
      if (updated) {
        setDruidState(updated.druidFormState);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save form state");
    } finally {
      setSaving(false);
    }
  }

  async function saveCompanionState(nextState: CharacterCompanionState) {
    setSaving(true);
    setError(null);
    try {
      const updated = await onCharacterPatch({ companionState: nextState });
      if (updated) {
        setCompanionState(updated.companionState);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save companion");
    } finally {
      setSaving(false);
    }
  }

  async function craftRecipe(recipeId: string) {
    const recipe = craftingRules.recipes.find((item) => item.id === recipeId && item.enabled);
    if (!recipe) return;

    const hasMaterials = recipe.resourceCosts.every((cost) => {
      return (craftingState.materials[cost.materialId] ?? 0) >= cost.amount;
    });
    if (!hasMaterials) {
      setError("Not enough crafting materials for this recipe.");
      return;
    }

    const nextGold = (character.currencyValues.gold ?? character.gold ?? 0) - recipe.goldCost;
    if (nextGold < 0) {
      setError("Not enough gold for this recipe.");
      return;
    }

    const nextMaterials = { ...craftingState.materials };
    for (const cost of recipe.resourceCosts) {
      nextMaterials[cost.materialId] = Math.max(0, (nextMaterials[cost.materialId] ?? 0) - cost.amount);
    }

    const nextState: CharacterCraftingState = {
      ...craftingState,
      materials: nextMaterials,
    };

    await saveCraftingState(nextState, nextGold);

    if (
      recipe.targetKind !== "custom" &&
      recipe.targetId &&
      (recipe.targetKind === "weapon" ||
        recipe.targetKind === "armor" ||
        recipe.targetKind === "item" ||
        recipe.targetKind === "consumable")
    ) {
      const response = await fetch(`/api/characters/${character.id}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityKind: recipe.targetKind,
          entityId: recipe.targetId,
          quantity: 1,
          isEquipped: false,
          equippedSlot: null,
          notes: `Crafted via ${recipe.name}`,
        }),
      });
      const data = await response.json();
      if (response.ok && data.character) {
        onCharacterHydrate(data.character as CharacterRecord);
      }
    }
  }

  if (!availableTabs.length) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-xl border border-amber-700/25 bg-slate-900/70 p-4 shadow-[0_14px_28px_rgba(2,6,23,0.35)]">
      <header className="space-y-2 rounded-lg border border-slate-700/45 bg-slate-950/35 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg text-amber-200">Optional Systems Console</h2>
          <span className="rounded-full border border-amber-500/45 bg-amber-950/20 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-amber-100">
            Live Runtime
          </span>
        </div>
        <p className="text-xs text-slate-300">
          Manage campaign-enabled extras for this character with sheet-synced updates.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-slate-700/45 px-2 py-2 text-xs text-slate-300">
            Active tabs: <span className="text-slate-100">{availableTabs.length}</span>
          </div>
          <div className="rounded-md border border-slate-700/45 px-2 py-2 text-xs text-slate-300">
            Save state: <span className="text-slate-100">{saving ? "Saving..." : "Ready"}</span>
          </div>
          <div className="rounded-md border border-slate-700/45 px-2 py-2 text-xs text-slate-300">
            Gold: <span className="text-slate-100">{character.currencyValues.gold ?? character.gold ?? 0}</span>
          </div>
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-3">
        {availableTabs.map((tab) => (
          <button
            key={`optional-tab-${tab}`}
            className={`min-h-11 rounded-md border px-3 py-2 text-left text-xs transition ${
              activeTab === tab
                ? "border-amber-500/65 bg-amber-950/25 text-amber-100"
                : "border-slate-700/55 bg-slate-800/50 text-slate-300 hover:border-amber-500/35"
            }`}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            <p className="text-sm">
              {tab === "crafting" ? "Crafting" : tab === "forms" ? "Shapeforms" : "Companion"}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-300/90">
              {tab === "crafting"
                ? `${selectedProfessionCount} professions, ${totalMaterialCount} resources`
                : tab === "forms"
                  ? `${druidState.knownFormIds.length} known forms`
                  : `${companionState.upgrades.length} selected upgrades`}
            </p>
          </button>
        ))}
      </div>

      {activeTab === "crafting" && (
        <section className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-md border border-slate-700/45 bg-slate-950/35 px-3 py-2 text-xs text-slate-300">
              Selected professions:{" "}
              <span className="text-slate-100">
                {selectedProfessionCount}/{craftingRules.maxProfessionsPerCharacter}
              </span>
            </div>
            <div className="rounded-md border border-slate-700/45 bg-slate-950/35 px-3 py-2 text-xs text-slate-300">
              Stored resources: <span className="text-slate-100">{totalMaterialCount}</span>
            </div>
            <div className="rounded-md border border-slate-700/45 bg-slate-950/35 px-3 py-2 text-xs text-slate-300">
              Available recipes: <span className="text-slate-100">{enabledRecipeCount}</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-700/50 bg-slate-950/40 p-3">
            <h3 className="text-sm text-amber-100">Professions</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {craftingRules.professions
                .filter((profession) => profession.enabled)
                .map((profession) => (
                  <label
                    key={`profession-${profession.id}`}
                    className="flex min-h-11 items-start gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={craftingState.professions.includes(profession.id)}
                      onChange={() => {
                        const currentlySelected = craftingState.professions.includes(profession.id);
                        if (
                          !currentlySelected &&
                          craftingState.professions.length >= craftingRules.maxProfessionsPerCharacter
                        ) {
                          setError(
                            `You can select up to ${craftingRules.maxProfessionsPerCharacter} professions.`
                          );
                          return;
                        }
                        setError(null);
                        const nextProfessions = currentlySelected
                          ? craftingState.professions.filter((id) => id !== profession.id)
                          : [...craftingState.professions, profession.id];
                        setCraftingState((current) => ({ ...current, professions: nextProfessions }));
                      }}
                    />
                    <span>
                      <span className="block text-slate-100">{profession.label}</span>
                      <span className="text-[11px] text-slate-400">
                        {profession.description || "No description"}
                      </span>
                    </span>
                  </label>
                ))}
            </div>
            <button
              className="btn-outline mt-2 min-h-11 px-3 py-2 text-xs"
              disabled={saving}
              onClick={() => void saveCraftingState(craftingState)}
              type="button"
            >
              {saving ? "Saving..." : "Save Profession Loadout"}
            </button>
          </div>

          <div className="rounded-md border border-slate-700/50 bg-slate-950/40 p-3">
            <h3 className="text-sm text-amber-100">Materials</h3>
            <div className="mt-2 space-y-2">
              {craftingRules.materialTypes.map((material) => (
                <label key={`material-${material.id}`} className="flex items-center justify-between gap-2 rounded-md border border-slate-700/45 px-2 py-2 text-xs text-slate-300">
                  <span>
                    <span className="block text-slate-100">{material.label}</span>
                    <span className="text-[11px] text-slate-400">Max {material.maxStack}</span>
                  </span>
                  <input
                    className="field w-32"
                    type="number"
                    min={0}
                    max={material.maxStack}
                    value={craftingState.materials[material.id] ?? 0}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      const nextValue = Number.isFinite(parsed)
                        ? Math.max(0, Math.min(material.maxStack, Math.round(parsed)))
                        : 0;
                      setCraftingState((current) => ({
                        ...current,
                        materials: {
                          ...current.materials,
                          [material.id]: nextValue,
                        },
                      }));
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                className="field"
                value={gatherMaterialId}
                onChange={(event) => setGatherMaterialId(event.target.value)}
              >
                {craftingRules.materialTypes.map((material) => (
                  <option key={`gather-material-${material.id}`} value={material.id}>
                    {material.label}
                  </option>
                ))}
              </select>
              <button
                className="btn-outline min-h-11 px-3 py-2 text-xs"
                type="button"
                onClick={() => {
                  const rolled = rollGatheringResources(craftingRules.gatheringDie);
                  const currentValue = craftingState.materials[gatherMaterialId] ?? 0;
                  const materialCap =
                    craftingRules.materialTypes.find((material) => material.id === gatherMaterialId)?.maxStack ?? 999;
                  setCraftingState((current) => ({
                    ...current,
                    materials: {
                      ...current.materials,
                      [gatherMaterialId]: Math.min(materialCap, currentValue + rolled),
                    },
                  }));
                }}
              >
                Roll d{craftingRules.gatheringDie} Gather
              </button>
              <button
                className="btn-outline min-h-11 px-3 py-2 text-xs"
                disabled={saving}
                onClick={() => void saveCraftingState(craftingState)}
                type="button"
              >
                {saving ? "Saving..." : "Save Material Ledger"}
              </button>
            </div>
          </div>

          <div className="rounded-md border border-slate-700/50 bg-slate-950/40 p-3">
            <h3 className="text-sm text-amber-100">Recipes</h3>
            <div className="mt-2 space-y-2">
              {craftingRules.recipes
                .filter((recipe) => recipe.enabled)
                .map((recipe) => {
                  const hasMaterials = recipe.resourceCosts.every((cost) => {
                    return (craftingState.materials[cost.materialId] ?? 0) >= cost.amount;
                  });
                  const hasGold = (character.currencyValues.gold ?? character.gold ?? 0) >= recipe.goldCost;
                  const recipeStatus = !hasMaterials
                    ? "Missing materials"
                    : !hasGold
                      ? "Insufficient gold"
                      : "Ready";
                  return (
                    <article key={`recipe-${recipe.id}`} className="rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-amber-100">{recipe.name}</p>
                        <span
                          className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${
                            recipeStatus === "Ready"
                              ? "border-emerald-500/45 bg-emerald-950/25 text-emerald-200"
                              : "border-slate-600/60 bg-slate-900/55 text-slate-300"
                          }`}
                        >
                          {recipeStatus}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-400">{recipe.targetName}</p>
                        <button
                          className="btn-outline min-h-11 px-3 py-2 text-xs"
                          disabled={saving || !hasMaterials || !hasGold}
                          onClick={() => void craftRecipe(recipe.id)}
                          type="button"
                        >
                          Craft Item
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Costs:{" "}
                        {recipe.resourceCosts
                          .map(
                            (cost) =>
                              `${cost.amount} ${materialLabelById.get(cost.materialId) ?? cost.materialId}`
                          )
                          .join(", ") || "No materials"}
                        {recipe.goldCost > 0 ? ` | ${recipe.goldCost} gold` : ""}
                      </p>
                    </article>
                  );
                })}
              {!enabledRecipeCount && (
                <p className="rounded-md border border-slate-700/45 px-3 py-2 text-xs text-slate-400">
                  No enabled recipes are configured for this campaign.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === "forms" && (
        <section className="space-y-3">
          <div className="rounded-md border border-slate-700/50 bg-slate-950/40 p-3">
            <h3 className="text-sm text-amber-100">Known Forms (Tier {levelTier} max)</h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Select forms your character has learned. Only selected forms can be activated.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {availableForms.map((form) => (
                <label
                  key={`known-form-${form.id}`}
                  className="flex min-h-11 items-start gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={druidState.knownFormIds.includes(form.id)}
                    onChange={() => {
                      const selected = druidState.knownFormIds.includes(form.id);
                      const nextKnown = selected
                        ? druidState.knownFormIds.filter((id) => id !== form.id)
                        : [...druidState.knownFormIds, form.id];
                      setDruidState((current) => ({
                        ...current,
                        knownFormIds: nextKnown,
                        activeFormId:
                          current.activeFormId && !nextKnown.includes(current.activeFormId)
                            ? null
                            : current.activeFormId,
                      }));
                    }}
                  />
                  <span>
                    <span className="block text-slate-100">
                      T{form.tier} {form.name}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Examples: {form.examples.join(", ") || "N/A"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <button
              className="btn-outline mt-2 min-h-11 px-3 py-2 text-xs"
              disabled={saving}
              onClick={() => void saveDruidState(druidState)}
              type="button"
            >
              {saving ? "Saving..." : "Save Known Forms List"}
            </button>
          </div>

          <div className="rounded-md border border-slate-700/50 bg-slate-950/40 p-3">
            <h3 className="text-sm text-amber-100">Active Form</h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Choose one active form for current scenes, or clear to return to base profile.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <button
                className={`rounded-md border px-3 py-2 text-xs ${
                  druidState.activeFormId === null
                    ? "border-amber-500/60 bg-amber-950/20 text-amber-100"
                    : "border-slate-700/50 text-slate-300"
                }`}
                onClick={() => setDruidState((current) => ({ ...current, activeFormId: null }))}
                type="button"
              >
                No Active Form
              </button>
              {availableForms
                .filter((form) => druidState.knownFormIds.includes(form.id))
                .map((form) => (
                  <button
                    key={`active-form-${form.id}`}
                    className={`rounded-md border px-3 py-2 text-xs ${
                      druidState.activeFormId === form.id
                        ? "border-amber-500/60 bg-amber-950/20 text-amber-100"
                        : "border-slate-700/50 text-slate-300"
                    }`}
                    onClick={() => setDruidState((current) => ({ ...current, activeFormId: form.id }))}
                    type="button"
                  >
                    {form.name}
                  </button>
                ))}
            </div>
            <button
              className="btn-outline mt-2 min-h-11 px-3 py-2 text-xs"
              disabled={saving}
              onClick={() => void saveDruidState(druidState)}
              type="button"
            >
              {saving ? "Saving..." : "Save Active Form"}
            </button>
          </div>

          {druidState.activeFormId && (
            <div className="rounded-md border border-slate-700/50 bg-slate-950/40 p-3 text-xs text-slate-300">
              {availableForms
                .filter((form) => normalizeToken(form.id) === normalizeToken(druidState.activeFormId ?? ""))
                .map((form) => (
                  <div key={`active-form-detail-${form.id}`}>
                    <p className="text-amber-100">{form.name}</p>
                    <p>Trait: +{form.traitBonus.amount} {form.traitBonus.trait}</p>
                    <p>Evasion Bonus: {form.evasionBonus >= 0 ? `+${form.evasionBonus}` : form.evasionBonus}</p>
                    <p>Attack: {form.attack.damageFormula} ({form.attack.damageType})</p>
                    <p className="mt-1">Features: {form.features.map((feature) => feature.label).join(", ") || "None"}</p>
                    <p className="mt-1 text-slate-400">
                      Advantages: {form.advantages.join(", ") || "None"}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "companion" && (
        <section className="space-y-3">
          <div className="rounded-md border border-slate-700/50 bg-slate-950/40 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm text-amber-100">Companion Sheet</h3>
              <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/45 px-3 py-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={companionState.enabled}
                  onChange={(event) =>
                    setCompanionState((current) => ({ ...current, enabled: event.target.checked }))
                  }
                />
                Enabled
              </label>
            </div>
            <p className="mb-2 text-[11px] text-slate-400">
              Baseline: Evasion {companionRules.startingEvasion}, Stress {companionRules.startingStressSlots}, Attack{" "}
              {companionRules.startingDamageDie} ({companionRules.startingRangeBand.replace("_", " ")}).
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-slate-300">
                Companion Name
                <input
                  className="field mt-1"
                  value={companionState.name}
                  onChange={(event) =>
                    setCompanionState((current) => ({ ...current, enabled: true, name: event.target.value }))
                  }
                />
              </label>
              <label className="text-xs text-slate-300">
                Species
                <input
                  className="field mt-1"
                  value={companionState.species}
                  onChange={(event) =>
                    setCompanionState((current) => ({ ...current, enabled: true, species: event.target.value }))
                  }
                />
              </label>
              <label className="text-xs text-slate-300">
                Evasion
                <input
                  className="field mt-1"
                  type="number"
                  min={0}
                  max={99}
                  value={companionState.evasion}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    const nextValue = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
                    setCompanionState((current) => ({ ...current, enabled: true, evasion: nextValue }));
                  }}
                />
              </label>
              <label className="text-xs text-slate-300">
                Stress Current / Max
                <div className="mt-1 flex gap-2">
                  <input
                    className="field"
                    type="number"
                    min={0}
                    max={99}
                    value={companionState.stressCurrent}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      const nextValue = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
                      setCompanionState((current) => ({ ...current, enabled: true, stressCurrent: nextValue }));
                    }}
                  />
                  <input
                    className="field"
                    type="number"
                    min={0}
                    max={99}
                    value={companionState.stressMax}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      const nextValue = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
                      setCompanionState((current) => ({ ...current, enabled: true, stressMax: nextValue }));
                    }}
                  />
                </div>
              </label>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs text-slate-300">
                Attack Name
                <input
                  className="field mt-1"
                  value={companionState.attackName}
                  onChange={(event) =>
                    setCompanionState((current) => ({ ...current, enabled: true, attackName: event.target.value }))
                  }
                />
              </label>
              <label className="text-xs text-slate-300">
                Damage
                <input
                  className="field mt-1"
                  value={companionState.attackProfile.damageFormula}
                  onChange={(event) =>
                    setCompanionState((current) => ({
                      ...current,
                      enabled: true,
                      attackProfile: {
                        ...current.attackProfile,
                        damageFormula: event.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs text-slate-300">
                Range
                <select
                  className="field mt-1"
                  value={companionState.attackProfile.rangeBand}
                  onChange={(event) =>
                    setCompanionState((current) => ({
                      ...current,
                      enabled: true,
                      attackProfile: {
                        ...current.attackProfile,
                        rangeBand: event.target.value as CharacterCompanionState["attackProfile"]["rangeBand"],
                      },
                    }))
                  }
                >
                  <option value="melee">Melee</option>
                  <option value="very_close">Very Close</option>
                  <option value="close">Close</option>
                  <option value="far">Far</option>
                  <option value="very_far">Very Far</option>
                </select>
              </label>
            </div>

            <label className="mt-2 block text-xs text-slate-300">
              Notes
              <textarea
                className="field mt-1 min-h-20"
                value={companionState.notes}
                onChange={(event) =>
                  setCompanionState((current) => ({ ...current, enabled: true, notes: event.target.value }))
                }
                placeholder="Bond notes, commands, roleplay hooks..."
              />
            </label>

            <div className="mt-2">
              <p className="text-xs text-slate-300">Level-Up Upgrades</p>
              <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {companionRules.levelUpOptions.map((option) => (
                  <label
                    key={`companion-upgrade-${option.id}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={companionState.upgrades.includes(option.id)}
                      onChange={() => {
                        const selected = companionState.upgrades.includes(option.id);
                        setCompanionState((current) => ({
                          ...current,
                          enabled: true,
                          upgrades: selected
                            ? current.upgrades.filter((upgradeId) => upgradeId !== option.id)
                            : [...current.upgrades, option.id],
                        }));
                      }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <button
              className="btn-outline mt-2 min-h-11 px-3 py-2 text-xs"
              disabled={saving}
              onClick={() => void saveCompanionState(companionState)}
              type="button"
            >
              {saving ? "Saving..." : "Save Companion Sheet"}
            </button>
          </div>
        </section>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </section>
  );
}
