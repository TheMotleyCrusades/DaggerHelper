"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CharacterSheet } from "@/components/characters/character-sheet";
import { CharacterEquipmentPanel } from "@/components/characters/character-equipment-panel";
import { CharacterOptionalSystemsPanel } from "@/components/characters/character-optional-systems-panel";
import { ExportMenu } from "@/components/characters/export-menu";
import type {
  CharacterRuleConfiguration,
  ConditionDefinition,
  CurrencyConfiguration,
  CustomFieldDefinition,
  LabelOverrides,
  LayoutConfiguration,
  ResourceDefinition,
} from "@/lib/campaign-metadata";
import type { CharacterRecord } from "@/lib/characters";
import { DEFAULT_CHARACTER_SHEET_CUSTOMIZATION } from "@/lib/campaign-metadata";
import {
  applyDruidFormToCombat,
  applyDruidFormToTraits,
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

const DEFAULT_DISPLAY: DisplaySettings = {
  showGold: true,
  showInventory: true,
  showConnections: true,
};

export default function CharacterDetailPage() {
  const params = useParams<{ id: string }>();
  const [character, setCharacter] = useState<CharacterRecord | null>(null);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(DEFAULT_DISPLAY);
  const [resources, setResources] = useState<ResourceDefinition[]>([]);
  const [currency, setCurrency] = useState<CurrencyConfiguration | undefined>(undefined);
  const [characterRules, setCharacterRules] = useState<CharacterRuleConfiguration>(
    DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.characterRules
  );
  const [craftingRules, setCraftingRules] = useState<CraftingRulesConfiguration>(
    DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.craftingRules
  );
  const [druidFormRules, setDruidFormRules] = useState<DruidFormRulesConfiguration>(
    DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.druidFormRules
  );
  const [companionRules, setCompanionRules] = useState<CompanionRulesConfiguration>(
    DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.companionRules
  );
  const [conditions, setConditions] = useState<ConditionDefinition[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [labels, setLabels] = useState<LabelOverrides | undefined>(undefined);
  const [layout, setLayout] = useState<LayoutConfiguration | undefined>(undefined);
  const [pendingConditionIds, setPendingConditionIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch(`/api/characters/${params.id}`, { cache: "no-store" });
      const data = await response.json();
      if (cancelled) return;

      if (!response.ok) {
        setError(data.error ?? "Failed to load character");
        setLoading(false);
        return;
      }

      setCharacter(data);
      setError(null);
      setLoading(false);

      if (data.campaignId) {
        const settingsResponse = await fetch(`/api/campaigns/${data.campaignId}/settings`, {
          cache: "no-store",
        });

        if (settingsResponse.ok) {
          const settings = await settingsResponse.json();
          if (cancelled) return;
          setDisplaySettings({
            showGold: Boolean(settings.showGold ?? true),
            showInventory: Boolean(settings.showInventory ?? true),
            showConnections: Boolean(settings.showConnections ?? true),
          });
          setResources(Array.isArray(settings.resources) ? settings.resources : []);
          setCurrency(settings.currency ?? undefined);
          setConditions(Array.isArray(settings.conditions) ? settings.conditions : []);
          setCustomFields(Array.isArray(settings.customFields) ? settings.customFields : []);
          setLabels(settings.labels ?? undefined);
          setLayout(settings.layout ?? undefined);
          setCharacterRules(
            settings.characterRules && typeof settings.characterRules === "object"
              ? {
                  ...DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.characterRules,
                  ...(settings.characterRules as Partial<CharacterRuleConfiguration>),
                }
              : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.characterRules
          );
          setCraftingRules(
            settings.craftingRules && typeof settings.craftingRules === "object"
              ? {
                  ...DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.craftingRules,
                  ...(settings.craftingRules as Partial<CraftingRulesConfiguration>),
                }
              : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.craftingRules
          );
          setDruidFormRules(
            settings.druidFormRules && typeof settings.druidFormRules === "object"
              ? {
                  ...DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.druidFormRules,
                  ...(settings.druidFormRules as Partial<DruidFormRulesConfiguration>),
                }
              : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.druidFormRules
          );
          setCompanionRules(
            settings.companionRules && typeof settings.companionRules === "object"
              ? {
                  ...DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.companionRules,
                  ...(settings.companionRules as Partial<CompanionRulesConfiguration>),
                }
              : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.companionRules
          );
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function updateCharacterPatch(patch: Record<string, unknown>) {
    const response = await fetch(`/api/characters/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to update character");
    }
    setCharacter(data);
    setError(null);
    return data as CharacterRecord;
  }

  async function toggleConditionState(conditionId: string, nextValue: boolean) {
    if (!character) return;
    const previousState = {
      ...character.conditionStates,
    };

    setCharacter({
      ...character,
      conditionStates: {
        ...character.conditionStates,
        [conditionId]: nextValue,
      },
    });
    setPendingConditionIds((current) =>
      current.includes(conditionId) ? current : [...current, conditionId]
    );

    try {
      await updateCharacterPatch({
        conditionStates: {
          [conditionId]: nextValue,
        },
      });
    } catch (conditionError) {
      setCharacter((current) =>
        current
          ? {
              ...current,
              conditionStates: previousState,
            }
          : current
      );
      setError(conditionError instanceof Error ? conditionError.message : "Failed to update condition");
    } finally {
      setPendingConditionIds((current) => current.filter((id) => id !== conditionId));
    }
  }

  const activeForm = useMemo(() => {
    if (!character) return null;
    return resolveActiveDruidForm(
      character.level,
      character.class,
      character.druidFormState,
      druidFormRules
    );
  }, [character, druidFormRules]);

  const sheetCharacter = useMemo(() => {
    if (!character) return null;
    if (!activeForm) return character;
    return {
      ...character,
      traits: applyDruidFormToTraits(character.traits, activeForm),
      resolvedCombat: applyDruidFormToCombat(
        character.resolvedCombat,
        character.baseEvasion ?? 0,
        activeForm
      ),
    };
  }, [activeForm, character]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl text-amber-300">Character Sheet</h1>
        <div className="flex gap-2">
          <Link href="/characters" className="btn-outline min-h-11 px-3 py-2 text-sm">
            Back
          </Link>
          <Link
            href={`/characters/${params.id}/edit`}
            className="btn-primary min-h-11 px-3 py-2 text-sm"
          >
            Edit
          </Link>
        </div>
      </div>

      {loading && <p className="text-slate-300">Loading character...</p>}
      {error && <p className="text-red-400">{error}</p>}

      {character && sheetCharacter && (
        <section className="space-y-4">
          <ExportMenu characterId={character.id} />
          <CharacterOptionalSystemsPanel
            character={character}
            craftingRules={craftingRules}
            druidFormRules={druidFormRules}
            companionRules={companionRules}
            onCharacterPatch={updateCharacterPatch}
            onCharacterHydrate={(next) => setCharacter(next)}
          />
          <CharacterEquipmentPanel
            character={character}
            onCharacterChange={(next) => setCharacter(next)}
          />
          <CharacterSheet
            character={sheetCharacter}
            displaySettings={displaySettings}
            resources={resources}
            currency={currency}
            characterRules={characterRules}
            craftingRules={craftingRules}
            druidFormRules={druidFormRules}
            companionRules={companionRules}
            conditions={conditions}
            customFields={customFields}
            labels={labels}
            layout={layout}
            onConditionToggle={toggleConditionState}
            conditionPendingIds={pendingConditionIds}
          />
        </section>
      )}
    </main>
  );
}
