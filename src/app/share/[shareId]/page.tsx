"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CharacterSheet } from "@/components/characters/character-sheet";
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
import type {
  CompanionRulesConfiguration,
  CraftingRulesConfiguration,
  DruidFormRulesConfiguration,
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

export default function SharedCharacterPage() {
  const params = useParams<{ shareId: string }>();
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setDisplaySettings(DEFAULT_DISPLAY);
      setResources([]);
      setCurrency(undefined);
      setConditions([]);
      setCustomFields([]);
      setLabels(undefined);
      setLayout(undefined);
      setCharacterRules(DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.characterRules);
      setCraftingRules(DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.craftingRules);
      setDruidFormRules(DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.druidFormRules);
      setCompanionRules(DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.companionRules);

      const response = await fetch(`/api/share/${params.shareId}`, { cache: "no-store" });
      const data = await response.json();
      if (cancelled) return;

      if (!response.ok) {
        setError(data.error ?? "Share link is unavailable");
        setLoading(false);
        return;
      }

      setCharacter(data.character ?? null);
      const sheetConfig = data.sheetConfig;
      if (sheetConfig && typeof sheetConfig === "object") {
        setDisplaySettings({
          showGold: Boolean(sheetConfig.displaySettings?.showGold ?? true),
          showInventory: Boolean(sheetConfig.displaySettings?.showInventory ?? true),
          showConnections: Boolean(sheetConfig.displaySettings?.showConnections ?? true),
        });
        setResources(Array.isArray(sheetConfig.resources) ? sheetConfig.resources : []);
        setCurrency(sheetConfig.currency ?? undefined);
        setConditions(Array.isArray(sheetConfig.conditions) ? sheetConfig.conditions : []);
        setCustomFields(Array.isArray(sheetConfig.customFields) ? sheetConfig.customFields : []);
        setLabels(sheetConfig.labels ?? undefined);
        setLayout(sheetConfig.layout ?? undefined);
        setCharacterRules(
          sheetConfig.characterRules && typeof sheetConfig.characterRules === "object"
            ? {
                ...DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.characterRules,
                ...(sheetConfig.characterRules as Partial<CharacterRuleConfiguration>),
              }
            : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.characterRules
        );
        setCraftingRules(
          sheetConfig.craftingRules && typeof sheetConfig.craftingRules === "object"
            ? {
                ...DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.craftingRules,
                ...(sheetConfig.craftingRules as Partial<CraftingRulesConfiguration>),
              }
            : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.craftingRules
        );
        setDruidFormRules(
          sheetConfig.druidFormRules && typeof sheetConfig.druidFormRules === "object"
            ? {
                ...DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.druidFormRules,
                ...(sheetConfig.druidFormRules as Partial<DruidFormRulesConfiguration>),
              }
            : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.druidFormRules
        );
        setCompanionRules(
          sheetConfig.companionRules && typeof sheetConfig.companionRules === "object"
            ? {
                ...DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.companionRules,
                ...(sheetConfig.companionRules as Partial<CompanionRulesConfiguration>),
              }
            : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.companionRules
        );
      }
      setError(null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [params.shareId]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl text-amber-300">Shared Character</h1>
        <Link href="/" className="btn-outline min-h-11 px-3 py-2 text-sm">
          Home
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-300">Loading shared character...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {character && (
        <CharacterSheet
          character={character}
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
          surface="share"
          title="Shared Character Sheet"
        />
      )}
    </main>
  );
}
