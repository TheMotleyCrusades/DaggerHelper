"use client";

import { describeIdentityFromHeritage } from "@/lib/character-identity";
import type {
  CharacterRuleConfiguration,
  ConditionDefinition,
  CurrencyConfiguration,
  CustomFieldDefinition,
  LabelOverrides,
  LayoutConfiguration,
  ResourceDefinition,
} from "@/lib/campaign-metadata";
import { getClassDefinition } from "@/lib/constants/classes";
import {
  baseLevelUpOptionId,
  getLevelUpOptionCost,
  getLevelUpOptionLabel,
} from "@/lib/constants/leveling";
import { OFFICIAL_DOMAIN_CARDS } from "@/lib/constants/domains";
import type { CharacterRecord, RuntimeCurrencyStore, RuntimeResourceStore } from "@/lib/characters";
import {
  DEFAULT_COMPANION_RULES,
  DEFAULT_CRAFTING_RULES,
  DEFAULT_DRUID_FORM_RULES,
  resolveActiveDruidForm,
  type CompanionRulesConfiguration,
  type CraftingRulesConfiguration,
  type DruidFormRulesConfiguration,
} from "@/lib/optional-systems";

type DisplaySettings = {
  showGold: boolean;
  showInventory: boolean;
  showConnections: boolean;
};

type SheetSurface = "sheet" | "share" | "pdf";

const DEFAULT_DISPLAY: DisplaySettings = {
  showGold: true,
  showInventory: true,
  showConnections: true,
};

function formatCustomFieldValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

type DisplayInventoryEntry = {
  id: string;
  entityKind: "weapon" | "armor" | "item" | "consumable";
  entityId: string;
  sourceName: string | null;
  quantity: number;
  isEquipped: boolean;
  equippedSlot: "primary_weapon" | "secondary_weapon" | "armor" | null;
  notes: string;
  sourceArchived: boolean;
};

function parseStructuredInventory(
  items: Array<Record<string, unknown>>
): DisplayInventoryEntry[] {
  return items
    .map((item, index): DisplayInventoryEntry | null => {
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

      const slot =
        item.equippedSlot === "primary_weapon" ||
        item.equippedSlot === "secondary_weapon" ||
        item.equippedSlot === "armor"
          ? item.equippedSlot
          : null;
      const quantityRaw = Number(item.quantity);
      return {
        id:
          typeof item.id === "string" && item.id.trim()
            ? item.id
            : `inventory-${index + 1}`,
        entityKind,
        entityId,
        sourceName: null,
        quantity: Number.isFinite(quantityRaw) ? Math.max(1, Math.round(quantityRaw)) : 1,
        isEquipped: Boolean(item.isEquipped),
        equippedSlot: slot,
        notes: typeof item.notes === "string" ? item.notes : "",
        sourceArchived: false,
      };
    })
    .filter((entry): entry is DisplayInventoryEntry => Boolean(entry));
}

function labelForSlot(slot: DisplayInventoryEntry["equippedSlot"]) {
  if (slot === "primary_weapon") return "Primary";
  if (slot === "secondary_weapon") return "Secondary";
  if (slot === "armor") return "Armor";
  return "Carried";
}

export function CharacterSheet({
  character,
  displaySettings = DEFAULT_DISPLAY,
  resources,
  currency,
  characterRules,
  conditions,
  customFields,
  labels,
  layout,
  craftingRules = DEFAULT_CRAFTING_RULES,
  druidFormRules = DEFAULT_DRUID_FORM_RULES,
  companionRules = DEFAULT_COMPANION_RULES,
  surface = "sheet",
  onConditionToggle,
  conditionPendingIds = [],
  title = "Character Sheet",
  showIdentityCards = true,
}: {
  character: CharacterRecord;
  displaySettings?: DisplaySettings;
  resources?: ResourceDefinition[];
  currency?: CurrencyConfiguration;
  characterRules?: CharacterRuleConfiguration;
  conditions?: ConditionDefinition[];
  customFields?: CustomFieldDefinition[];
  labels?: LabelOverrides;
  layout?: LayoutConfiguration;
  craftingRules?: CraftingRulesConfiguration;
  druidFormRules?: DruidFormRulesConfiguration;
  companionRules?: CompanionRulesConfiguration;
  surface?: SheetSurface;
  onConditionToggle?: (conditionId: string, nextValue: boolean) => void | Promise<void>;
  conditionPendingIds?: string[];
  title?: string;
  showIdentityCards?: boolean;
}) {
  const resourceDefinitions = resources ?? [];
  const pendingConditionSet = new Set(conditionPendingIds);

  const legacyResourceValues: RuntimeResourceStore = {
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
  };

  const runtimeResourceValues: RuntimeResourceStore = {
    ...legacyResourceValues,
    ...character.resourceValues,
  };

  const resourceRows = resourceDefinitions.length
    ? resourceDefinitions
        .filter((resource) => resource.visibleOn[surface])
        .map((resource) => {
          const runtimeValue = runtimeResourceValues[resource.id] ?? {
            current: resource.defaultCurrent,
            max: resource.format === "single" ? null : resource.defaultMax,
          };

          return {
            id: resource.id,
            label: labels?.resources?.[resource.id] ?? resource.label,
            current: runtimeValue.current,
            max: runtimeValue.max,
            format: resource.format,
          };
        })
    : (Object.entries(runtimeResourceValues).map(([resourceId, runtimeValue]) => ({
        id: resourceId,
        label: labels?.resources?.[resourceId] ?? resourceId,
        current: runtimeValue.current,
        max: runtimeValue.max,
        format: runtimeValue.max === null ? ("single" as const) : ("current_max" as const),
      })));

  const layoutSectionsById = new Map((layout?.sections ?? []).map((section) => [section.id, section]));

  function isSectionVisible(sectionId: string) {
    const section = layoutSectionsById.get(sectionId);
    if (!section) return true;
    if (!section.visible) return false;
    if (surface === "share" && !section.showOnShare) return false;
    if (surface === "pdf" && !section.showOnPdf) return false;
    return true;
  }

  const sectionLabels = labels?.sections ?? {};

  const currencyValueById: RuntimeCurrencyStore = {
    ...character.currencyValues,
  };
  if (currencyValueById.gold === undefined) currencyValueById.gold = character.gold;
  if (currencyValueById.handfuls === undefined) currencyValueById.handfuls = character.handfuls;
  if (currencyValueById.bags === undefined) currencyValueById.bags = character.bags;

  const currencyRows = (currency?.denominations ?? [])
    .filter((denomination) => denomination.visible)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((denomination) => {
      return {
        id: denomination.id,
        label: denomination.label,
        abbreviation: denomination.abbreviation,
        value: currencyValueById[denomination.id] ?? denomination.defaultAmount,
      };
    });
  const fallbackCurrencyRows = Object.entries(character.currencyValues ?? {}).map(
    ([id, value]) => ({
      id,
      label: id,
      value,
    })
  );
  const classDefinition = getClassDefinition(character.class);
  const identityCards = describeIdentityFromHeritage(character.heritage);
  const officialDomainCardById = new Map(
    OFFICIAL_DOMAIN_CARDS.map((card) => [card.id, card])
  );
  const domainCardLabels = character.domainCards.map((cardId) => {
    return officialDomainCardById.get(cardId)?.name ?? cardId;
  });
  const resolvedInventory: DisplayInventoryEntry[] = character.inventory.length
    ? character.inventory.map((entry) => ({
        id: entry.id,
        entityKind: entry.entityKind,
        entityId: entry.entityId,
        sourceName: entry.sourceName,
        quantity: entry.quantity,
        isEquipped: entry.isEquipped,
        equippedSlot: entry.equippedSlot,
        notes: entry.notes,
        sourceArchived: entry.sourceArchived,
      }))
    : parseStructuredInventory(character.inventoryItems);

  const inventoryEntries = resolvedInventory.filter((entry) => entry.entityKind !== "consumable");
  const consumableEntries = resolvedInventory.filter((entry) => entry.entityKind === "consumable");
  const supplementalEquipmentNotes = character.inventoryItems
    .map((item) => {
      const kind = typeof item.kind === "string" ? item.kind : "";
      const text = typeof item.text === "string" ? item.text : "";
      if (kind === "starting-equipment" && text.trim().length > 0) {
        return text.trim();
      }
      return "";
    })
    .filter(Boolean);

  const combat = character.resolvedCombat;
  const activeDruidForm = resolveActiveDruidForm(
    character.level,
    character.class,
    character.druidFormState,
    druidFormRules
  );
  const materialLabelById = new Map(
    craftingRules.materialTypes.map((material) => [material.id, material.label])
  );
  const craftingMaterials = Object.entries(character.craftingState?.materials ?? {})
    .filter(([, amount]) => Number(amount) > 0)
    .map(([materialId, amount]) => `${materialLabelById.get(materialId) ?? materialId}: ${amount}`);
  const baseCombatDefaults = {
    finalEvasion: character.baseEvasion ?? 0,
    armorScore: 0,
    majorThreshold: character.level,
    severeThreshold: character.level * 2,
  };

  const conditionRows = (conditions ?? [])
    .filter((condition) => condition.visibleToPlayers)
    .map((condition) => ({
      ...condition,
      active: Boolean(character.conditionStates?.[condition.id]),
      pending: pendingConditionSet.has(condition.id),
      canToggle: Boolean(onConditionToggle && condition.playerToggle),
    }));

  const customFieldRows = [...(customFields ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((field) => ({
      ...field,
      value: character.customFieldValues?.[field.id],
    }));
  const levelUpPointsPerLevel = Math.max(1, characterRules?.levelUpPointsPerLevel ?? 2);
  const advancementRows = Object.entries(character.advancementSelections ?? {})
    .map(([level, optionIds]) => ({
      level: Number(level),
      optionIds,
    }))
    .filter((row) => Number.isFinite(row.level) && row.level >= 2 && row.optionIds.length > 0)
    .sort((left, right) => left.level - right.level);
  const advancementTotals = advancementRows.reduce(
    (acc, row) => {
      for (const optionId of row.optionIds) {
        const baseId = baseLevelUpOptionId(optionId);
        if (baseId === "evasion_boost") acc.evasion += 1;
        if (baseId === "hp_slot") acc.hp += 1;
        if (baseId === "stress_slot") acc.stress += 1;
        if (baseId === "proficiency_boost") acc.proficiency += 1;
      }
      return acc;
    },
    { evasion: 0, hp: 0, stress: 0, proficiency: 0 }
  );

  return (
    <section className="space-y-4">
      <article className="rounded-xl border border-amber-700/35 bg-slate-900/70 p-4">
        <h2 className="text-2xl text-amber-200">{title}</h2>
        <p className="text-sm text-slate-300">
          {character.name} | Level {character.level} {character.class} ({character.subclass})
        </p>
        <p className="text-sm text-slate-400">
          {character.heritage}
          {character.pronouns ? ` | ${character.pronouns}` : ""}
        </p>
      </article>

      <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-4">
        <h3 className="mb-2 text-lg text-amber-200">
          {sectionLabels.traits ?? "Traits"}
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(character.traits).map(([trait, value]) => (
            <p key={trait} className="rounded-md border border-slate-700/40 px-2 py-1 text-sm capitalize text-slate-200">
              {trait}: <span className="text-amber-100">{value >= 0 ? `+${value}` : value}</span>
            </p>
          ))}
        </div>
      </article>

      {showIdentityCards && (
        <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-4">
          <h3 className="mb-2 text-lg text-amber-200">Identity Cards</h3>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="overflow-hidden rounded-lg border border-slate-700/50 bg-slate-950/65 p-3">
              <div
                className="rounded-md border border-slate-600/60 px-3 py-3"
                style={{
                  backgroundImage:
                    "linear-gradient(140deg, rgba(245,158,11,0.24), rgba(124,45,18,0.2), rgba(15,23,42,0.85))",
                }}
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-100/75">Class</p>
                <p className="mt-1 text-lg text-amber-100">{classDefinition?.label ?? character.class}</p>
                <p className="text-xs text-slate-200/85">
                  Foundation Path: {character.subclass || "Unassigned"}
                </p>
              </div>
              <p className="mt-2 text-xs text-slate-300">
                {classDefinition?.description ?? "Class details unavailable."}
              </p>
            </div>

            {identityCards.ancestryCards.map((card) => (
              <div key={card.id} className="overflow-hidden rounded-lg border border-slate-700/50 bg-slate-950/65 p-2">
                <div
                  className="h-72 w-full rounded-md border border-slate-700/60 bg-contain bg-center bg-no-repeat"
                  style={{
                    backgroundImage: `url(${card.image})`,
                  }}
                />
                <div className="sr-only">
                  <p>Ancestry: {card.label}</p>
                </div>
              </div>
            ))}

            {identityCards.communityCard && (
              <div className="overflow-hidden rounded-lg border border-slate-700/50 bg-slate-950/65 p-2">
                <div
                  className="h-72 w-full rounded-md border border-slate-700/60 bg-contain bg-center bg-no-repeat"
                  style={{
                    backgroundImage: `url(${identityCards.communityCard.image})`,
                  }}
                />
                <div className="sr-only">
                  <p>Community: {identityCards.communityCard.label}</p>
                </div>
              </div>
            )}
          </div>
        </article>
      )}

      {isSectionVisible("resources") && (
        <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-4">
          <h3 className="mb-2 text-lg text-amber-200">
            {sectionLabels.resources ?? "Resources"}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {resourceRows.map((resource) => (
              <p key={resource.id} className="rounded-md border border-slate-700/40 px-2 py-1 text-sm text-slate-200">
                {resource.label}:{" "}
                {resource.format === "single"
                  ? (resource.current ?? "-")
                  : `${resource.current ?? "-"}/${resource.max ?? "-"}`}
              </p>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Proficiency {character.proficiency} | Rally {character.rallyDie}
          </p>
        </article>
      )}

      {advancementRows.length > 0 && (
        <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-4">
          <h3 className="mb-2 text-lg text-amber-200">Level-Up Progression</h3>
          <p className="mb-2 text-xs text-slate-400">
            Recorded picks include +{advancementTotals.evasion} Evasion, +{advancementTotals.hp} HP
            slots, +{advancementTotals.stress} Stress slots, +{advancementTotals.proficiency}{" "}
            Proficiency.
          </p>
          <div className="space-y-2 text-sm text-slate-300">
            {advancementRows.map((row) => {
              const pointsSpent = row.optionIds.reduce(
                (sum, optionId) => sum + getLevelUpOptionCost(optionId, characterRules),
                0
              );
              return (
                <div
                  key={`advancement-row-${row.level}`}
                  className="rounded-md border border-slate-700/45 bg-slate-950/50 px-2 py-2"
                >
                  <p className="text-slate-100">
                    Level {row.level} ({pointsSpent}/{levelUpPointsPerLevel} points)
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    {row.optionIds.map((optionId) => getLevelUpOptionLabel(optionId)).join(", ")}
                  </p>
                </div>
              );
            })}
          </div>
        </article>
      )}

      {conditionRows.length > 0 && (
        <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-4">
          <h3 className="mb-2 text-lg text-amber-200">Conditions</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {conditionRows.map((condition) => (
              <div
                key={condition.id}
                className={`rounded-md border px-2 py-1 text-sm ${
                  condition.active
                    ? "border-amber-500/55 bg-amber-950/25 text-amber-100"
                    : "border-slate-700/45 text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p>{condition.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {condition.active ? "Active" : "Inactive"}
                    </p>
                  </div>
                  {condition.canToggle && onConditionToggle && (
                    <button
                      className="rounded-md border border-slate-600/60 px-2 py-1 text-[11px] text-slate-100 hover:bg-slate-800/70 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={condition.pending}
                      onClick={() => {
                        void onConditionToggle(condition.id, !condition.active);
                      }}
                      type="button"
                    >
                      {condition.pending
                        ? "Saving..."
                        : condition.active
                          ? "Set Inactive"
                          : "Set Active"}
                    </button>
                  )}
                </div>
                {condition.description ? (
                  <p className="mt-1 text-[11px] text-slate-400">{condition.description}</p>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      )}

      {customFieldRows.length > 0 && (
        <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-4">
          <h3 className="mb-2 text-lg text-amber-200">Custom Fields</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {customFieldRows.map((field) => (
              <p
                key={field.id}
                className="rounded-md border border-slate-700/45 px-2 py-1 text-sm text-slate-200"
              >
                {field.name}: {formatCustomFieldValue(field.value)}
              </p>
            ))}
          </div>
        </article>
      )}

      {(character.craftingState.professions.length > 0 ||
        craftingMaterials.length > 0 ||
        activeDruidForm ||
        character.companionState.enabled) && (
        <article className="rounded-xl border border-amber-700/25 bg-slate-900/70 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg text-amber-200">Optional Systems</h3>
            <p className="rounded-full border border-slate-700/45 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-300">
              Runtime Snapshot
            </p>
          </div>
          <div className="grid gap-3 text-sm text-slate-200 md:grid-cols-3">
            {(character.craftingState.professions.length > 0 || craftingMaterials.length > 0) && (
              <div className="rounded-md border border-slate-700/45 bg-slate-950/35 px-3 py-3">
                <p className="text-slate-100">Crafting</p>
                <p className="mt-1 text-xs text-slate-300">
                  Professions: {character.craftingState.professions.join(", ") || "-"}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Materials: {craftingMaterials.join(", ") || "-"}
                </p>
              </div>
            )}

            {activeDruidForm && (
              <div className="rounded-md border border-slate-700/45 bg-slate-950/35 px-3 py-3">
                <p className="text-slate-100">Shapeform: {activeDruidForm.name}</p>
                <p className="mt-1 text-xs text-slate-300">
                  Trait Bonus: +{activeDruidForm.traitBonus.amount} {activeDruidForm.traitBonus.trait}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Attack: {activeDruidForm.attack.damageFormula} ({activeDruidForm.attack.damageType})
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Features: {activeDruidForm.features.map((feature) => feature.label).join(", ") || "-"}
                </p>
              </div>
            )}

            {character.companionState.enabled && (
              <div className="rounded-md border border-slate-700/45 bg-slate-950/35 px-3 py-3">
                <p className="text-slate-100">
                  Companion: {character.companionState.name || "Companion"}
                  {character.companionState.species ? ` (${character.companionState.species})` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Evasion {character.companionState.evasion} | Stress{" "}
                  {character.companionState.stressCurrent}/{character.companionState.stressMax}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Attack: {character.companionState.attackName} ({character.companionState.attackProfile.damageFormula})
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Upgrades:{" "}
                  {character.companionState.upgrades
                    .map(
                      (upgradeId) =>
                        companionRules.levelUpOptions.find((option) => option.id === upgradeId)?.label ??
                        upgradeId
                    )
                    .join(", ") || "-"}
                </p>
                {character.companionState.notes ? (
                  <p className="mt-1 text-xs text-slate-400">{character.companionState.notes}</p>
                ) : null}
              </div>
            )}
          </div>
        </article>
      )}

      {isSectionVisible("equipment") && (
        <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-4">
          <h3 className="mb-2 text-lg text-amber-200">
            {sectionLabels.equipment ?? "Combat & Equipment"}
          </h3>
          <div className="grid gap-2 text-sm text-slate-200 lg:grid-cols-2">
            <p>Evasion: {combat?.finalEvasion ?? baseCombatDefaults.finalEvasion}</p>
            <p>Armor Score: {combat?.armorScore ?? baseCombatDefaults.armorScore}</p>
            <p>Major Threshold: {combat?.majorThreshold ?? baseCombatDefaults.majorThreshold}</p>
            <p>Severe Threshold: {combat?.severeThreshold ?? baseCombatDefaults.severeThreshold}</p>
            <p>
              Primary Weapon:{" "}
              {combat?.primaryAttack?.sourceId
                ? resolvedInventory.find((entry) => entry.entityId === combat.primaryAttack?.sourceId)?.sourceName ??
                  combat.primaryAttack.sourceId
                : "-"}
            </p>
            <p>
              Secondary Weapon:{" "}
              {combat?.secondaryAttack?.sourceId
                ? resolvedInventory.find((entry) => entry.entityId === combat.secondaryAttack?.sourceId)?.sourceName ??
                  combat.secondaryAttack.sourceId
                : "-"}
            </p>
          </div>

          <div className="mt-2 space-y-1 text-sm text-slate-200">
            <p className="text-slate-100">Equipped Passive Items</p>
            {combat?.equippedItems?.length ? (
              combat.equippedItems.map((item) => (
                <p key={item.sourceId} className="text-xs text-slate-300">
                  {item.name}
                </p>
              ))
            ) : (
              <p className="text-xs text-slate-400">No equipped passive items.</p>
            )}
          </div>

          {combat?.warnings?.length ? (
            <div className="mt-2 space-y-1 text-xs text-amber-200">
              {combat.warnings.map((warning) => (
                <p key={warning}>- {warning}</p>
              ))}
            </div>
          ) : null}

          <div className="mt-2 text-sm text-slate-200">
            <p>
              {sectionLabels.domainCards ?? "Domain Cards"}:{" "}
              {domainCardLabels.length ? domainCardLabels.join(", ") : "-"}
            </p>
          </div>
        </article>
      )}

      {displaySettings.showConnections && isSectionVisible("connections") && (
        <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-4">
          <h3 className="mb-2 text-lg text-amber-200">
            {sectionLabels.connections ?? "Connections"}
          </h3>
          <div className="space-y-2 text-sm text-slate-300">
            {character.connections.length ? (
              character.connections.map((connection, index) => {
                const name =
                  typeof connection.name === "string"
                    ? connection.name
                    : typeof connection.target === "string"
                      ? connection.target
                      : `Connection ${index + 1}`;
                const description =
                  typeof connection.description === "string"
                    ? connection.description
                    : "No description provided.";

                return (
                  <p key={`connection-${index}`}>
                    <span className="text-slate-100">{name}:</span> {description}
                  </p>
                );
              })
            ) : (
              <p>No connections recorded.</p>
            )}
          </div>
        </article>
      )}

      {displaySettings.showInventory && isSectionVisible("inventory") && (
        <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-4">
          <h3 className="mb-2 text-lg text-amber-200">
            {sectionLabels.inventory ?? "Inventory"}
          </h3>
          <div className="space-y-2 text-sm text-slate-300">
            {inventoryEntries.length ? (
              inventoryEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-md border border-slate-700/45 bg-slate-950/50 px-2 py-1"
                >
                  <p className="text-slate-100">
                    {entry.sourceName ?? entry.entityId} x{entry.quantity}
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    {entry.entityKind} | {entry.isEquipped ? labelForSlot(entry.equippedSlot) : "Carried"}
                    {entry.sourceArchived ? " | archived" : ""}
                  </p>
                  {entry.notes ? <p className="text-xs text-slate-300">{entry.notes}</p> : null}
                </div>
              ))
            ) : (
              <p>No inventory equipment listed.</p>
            )}
          </div>

          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p className="text-slate-100">Consumables</p>
            {consumableEntries.length ? (
              consumableEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-md border border-slate-700/45 bg-slate-950/50 px-2 py-1"
                >
                  <p className="text-slate-100">
                    {entry.sourceName ?? entry.entityId} x{entry.quantity}
                  </p>
                  {entry.notes ? <p className="text-xs text-slate-300">{entry.notes}</p> : null}
                </div>
              ))
            ) : (
              <p>No consumables listed.</p>
            )}
          </div>

          {supplementalEquipmentNotes.length > 0 && (
            <div className="mt-3 rounded-md border border-slate-700/45 bg-slate-950/50 p-2">
              <p className="text-xs text-slate-100">Supplemental Equipment Notes</p>
              {supplementalEquipmentNotes.map((note, index) => (
                <p key={`equipment-note-${index}`} className="mt-1 whitespace-pre-wrap text-xs text-slate-300">
                  {note}
                </p>
              ))}
            </div>
          )}

          {inventoryEntries.length === 0 &&
            consumableEntries.length === 0 &&
            supplementalEquipmentNotes.length === 0 && (
              <p className="mt-2 text-sm text-slate-300">No inventory items listed.</p>
            )}

          <div className="mt-2 text-xs text-slate-400">
            <p>Base Evasion: {character.baseEvasion}</p>
          </div>
        </article>
      )}

      {displaySettings.showGold && isSectionVisible("currency") && (
        <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-4">
          <h3 className="mb-2 text-lg text-amber-200">
            {sectionLabels.currency ?? "Currency"}
          </h3>
          {currencyRows.length ? (
            <div className="flex flex-wrap gap-2 text-sm text-slate-300">
              {currencyRows.map((row) => (
                <p key={row.id}>
                  {row.label}: {row.value}
                  {row.abbreviation ? ` (${row.abbreviation})` : ""}
                </p>
              ))}
              {currency?.debtEnabled && <p>{currency.debtLabel}: {character.debt}</p>}
            </div>
          ) : fallbackCurrencyRows.length ? (
            <div className="flex flex-wrap gap-2 text-sm text-slate-300">
              {fallbackCurrencyRows.map((row) => (
                <p key={row.id}>
                  {row.label}: {row.value}
                </p>
              ))}
              <p>Debt: {character.debt}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-300">
              Gold: {character.gold} | Handfuls: {character.handfuls} | Bags: {character.bags} | Debt: {character.debt}
            </p>
          )}
        </article>
      )}

      {isSectionVisible("background") &&
        Boolean(character.backgroundQuestions && Object.keys(character.backgroundQuestions).length) && (
        <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-4">
          <h3 className="mb-2 text-lg text-amber-200">
            {sectionLabels.backgroundQuestions ?? "Background Questions"}
          </h3>
          <div className="space-y-2 text-sm text-slate-300">
            {Object.entries(character.backgroundQuestions).map(([question, answer]) => (
              <p key={question}>
                <span className="text-slate-100">{question}:</span> {answer}
              </p>
            ))}
          </div>
        </article>
      )}

      {isSectionVisible("narrative") && character.narrativeBackstory && (
        <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-4">
          <h3 className="mb-2 text-lg text-amber-200">
            {sectionLabels.narrativeBackstory ?? "Narrative Backstory"}
          </h3>
          <p className="whitespace-pre-wrap text-sm text-slate-300">{character.narrativeBackstory}</p>
        </article>
      )}
    </section>
  );
}
