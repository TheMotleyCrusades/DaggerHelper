"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  CharacterSheetCustomization,
  type CampaignSettingsForm,
  type RuleEntityOption,
  type SettingsModule,
} from "./CharacterSheetCustomization";
import { DomainCardManagement } from "./DomainCardManagement";
import { HomebrewLibraryManagement } from "./HomebrewLibraryManagement";
import { EquipmentLibraryManager } from "@/components/equipment/library-manager";
import type { DomainCardDefinition } from "@/lib/constants/domains";
import { DEFAULT_CHARACTER_SHEET_CUSTOMIZATION } from "@/lib/campaign-metadata";
import type { HomebrewResourceTemplateRecord } from "@/lib/homebrew-library";

const DEFAULT_SETTINGS: CampaignSettingsForm = {
  baseHp: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.baseHp,
  baseStress: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.baseStress,
  baseHope: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.baseHope,
  maxDomainCards: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.maxDomainCards,
  experiencesPerLevel: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.experiencesPerLevel,
  startingEquipmentByClass: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.startingEquipmentByClass,
  resources: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.resources,
  currency: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.currency,
  labels: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.labels,
  layout: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.layout,
  skills: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.skills,
  characterRules: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.characterRules,
  conditions: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.conditions,
  importExport: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.importExport,
  craftingRules: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.craftingRules,
  druidFormRules: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.druidFormRules,
  companionRules: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.companionRules,
  showGold: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.displaySettings.showGold,
  showInventory: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.displaySettings.showInventory,
  showConnections: DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.displaySettings.showConnections,
  customFields: [],
};

type CampaignCopyOption = {
  id: number;
  name: string;
  isOwner: boolean;
};

function mapSettingsPayloadToForm(
  settingsData: Record<string, unknown>,
  fallback: CampaignSettingsForm
): CampaignSettingsForm {
  const startingEquipmentByClass =
    (settingsData.startingEquipmentByClass as Record<string, string> | undefined) ??
    fallback.startingEquipmentByClass;
  const payloadCharacterRules =
    (settingsData.characterRules as CampaignSettingsForm["characterRules"] | undefined) ?? null;
  const characterRules = payloadCharacterRules
    ? {
        ...fallback.characterRules,
        ...payloadCharacterRules,
        startingEquipmentByClass:
          payloadCharacterRules.startingEquipmentByClass ?? startingEquipmentByClass,
      }
    : {
        ...fallback.characterRules,
        startingEquipmentByClass,
      };

  return {
    baseHp: Number(settingsData.baseHp ?? fallback.baseHp),
    baseStress: Number(settingsData.baseStress ?? fallback.baseStress),
    baseHope: Number(settingsData.baseHope ?? fallback.baseHope),
    maxDomainCards: Number(settingsData.maxDomainCards ?? fallback.maxDomainCards),
    experiencesPerLevel:
      (settingsData.experiencesPerLevel as Record<string, number> | undefined) ??
      fallback.experiencesPerLevel,
    startingEquipmentByClass,
    resources: Array.isArray(settingsData.resources)
      ? (settingsData.resources as CampaignSettingsForm["resources"])
      : fallback.resources,
    currency:
      (settingsData.currency as CampaignSettingsForm["currency"] | undefined) ??
      fallback.currency,
    labels:
      (settingsData.labels as CampaignSettingsForm["labels"] | undefined) ??
      fallback.labels,
    layout:
      (settingsData.layout as CampaignSettingsForm["layout"] | undefined) ??
      fallback.layout,
    skills: Array.isArray(settingsData.skills)
      ? (settingsData.skills as CampaignSettingsForm["skills"])
      : fallback.skills,
    characterRules,
    conditions: Array.isArray(settingsData.conditions)
      ? (settingsData.conditions as CampaignSettingsForm["conditions"])
      : fallback.conditions,
    importExport:
      (settingsData.importExport as CampaignSettingsForm["importExport"] | undefined) ??
      fallback.importExport,
    craftingRules:
      (settingsData.craftingRules as CampaignSettingsForm["craftingRules"] | undefined) ??
      fallback.craftingRules,
    druidFormRules:
      (settingsData.druidFormRules as CampaignSettingsForm["druidFormRules"] | undefined) ??
      fallback.druidFormRules,
    companionRules:
      (settingsData.companionRules as CampaignSettingsForm["companionRules"] | undefined) ??
      fallback.companionRules,
    showGold: Boolean(settingsData.showGold ?? fallback.showGold),
    showInventory: Boolean(settingsData.showInventory ?? fallback.showInventory),
    showConnections: Boolean(settingsData.showConnections ?? fallback.showConnections),
    customFields: Array.isArray(settingsData.customFields)
      ? (settingsData.customFields as CampaignSettingsForm["customFields"])
      : fallback.customFields,
  };
}

export default function CampaignSettingsPage() {
  const params = useParams<{ id: string }>();
  const campaignId = Number(params.id);

  const [activeTab, setActiveTab] = useState<SettingsModule | "homebrew">("overview");
  const [settings, setSettings] = useState<CampaignSettingsForm>(DEFAULT_SETTINGS);
  const [cards, setCards] = useState<DomainCardDefinition[]>([]);
  const [classOptions, setClassOptions] = useState<RuleEntityOption[]>([]);
  const [ancestryOptions, setAncestryOptions] = useState<RuleEntityOption[]>([]);
  const [communityOptions, setCommunityOptions] = useState<RuleEntityOption[]>([]);
  const [resourceTemplateOptions, setResourceTemplateOptions] = useState<
    HomebrewResourceTemplateRecord[]
  >([]);
  const [copyCampaignOptions, setCopyCampaignOptions] = useState<CampaignCopyOption[]>([]);
  const [copySourceCampaignId, setCopySourceCampaignId] = useState<string>("");
  const [copyingSettings, setCopyingSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tabs: Array<{ id: SettingsModule | "homebrew"; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "resources", label: "Resources" },
    { id: "currency", label: "Currency" },
    { id: "labels", label: "Labels" },
    { id: "layout", label: "Layout" },
    { id: "skills", label: "Traits & Skills" },
    { id: "characterRules", label: "Character Rules" },
    { id: "crafting", label: "Crafting & Professions" },
    { id: "druidForms", label: "Druid Forms" },
    { id: "companion", label: "Hunter Companion" },
    { id: "homebrew", label: "Homebrew Library" },
    { id: "conditions", label: "Conditions & Effects" },
    { id: "exportSharing", label: "Export & Sharing" },
  ];

  useEffect(() => {
    if (!Number.isInteger(campaignId) || campaignId <= 0) return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function loadAll() {
    setLoading(true);

    const [
      settingsResponse,
      cardsResponse,
      classesResponse,
      ancestriesResponse,
      communitiesResponse,
      resourceTemplatesResponse,
      campaignsResponse,
    ] = await Promise.all([
      fetch(`/api/campaigns/${campaignId}/settings`, { cache: "no-store" }),
      fetch(`/api/domain-cards?campaignId=${campaignId}`, { cache: "no-store" }),
      fetch(`/api/classes?campaignId=${campaignId}`, { cache: "no-store" }),
      fetch(`/api/ancestries?campaignId=${campaignId}`, { cache: "no-store" }),
      fetch(`/api/communities?campaignId=${campaignId}`, { cache: "no-store" }),
      fetch(`/api/resource-templates?campaignId=${campaignId}`, { cache: "no-store" }),
      fetch("/api/campaigns", { cache: "no-store" }),
    ]);

    const settingsData = await settingsResponse.json();
    const cardsData = await cardsResponse.json();
    const classesData = await classesResponse.json();
    const ancestriesData = await ancestriesResponse.json();
    const communitiesData = await communitiesResponse.json();
    const resourceTemplatesData = await resourceTemplatesResponse.json();
    const campaignsData = await campaignsResponse.json();

    if (!settingsResponse.ok) {
      setError(settingsData.error ?? "Failed to load campaign settings");
      setLoading(false);
      return;
    }

    setSettings(mapSettingsPayloadToForm(settingsData, DEFAULT_SETTINGS));

    setCards(Array.isArray(cardsData) ? cardsData : []);
    setClassOptions(
      (Array.isArray(classesData) ? classesData : [])
        .map((item) => ({
          id: String(item.id),
          name: typeof item.name === "string" ? item.name : String(item.id),
          isOfficial: Boolean(item.isOfficial),
        }))
        .sort((left, right) => left.name.localeCompare(right.name))
    );
    setAncestryOptions(
      (Array.isArray(ancestriesData) ? ancestriesData : [])
        .map((item) => ({
          id: String(item.id),
          name: typeof item.name === "string" ? item.name : String(item.id),
          isOfficial: Boolean(item.isOfficial),
        }))
        .sort((left, right) => left.name.localeCompare(right.name))
    );
    setCommunityOptions(
      (Array.isArray(communitiesData) ? communitiesData : [])
        .map((item) => ({
          id: String(item.id),
          name: typeof item.name === "string" ? item.name : String(item.id),
          isOfficial: Boolean(item.isOfficial),
        }))
        .sort((left, right) => left.name.localeCompare(right.name))
    );
    setResourceTemplateOptions(
      (Array.isArray(resourceTemplatesData) ? resourceTemplatesData : [])
        .filter(
          (item) =>
            item &&
            typeof item === "object" &&
            typeof item.id === "string" &&
            typeof item.label === "string"
        )
        .sort((left, right) => String(left.label).localeCompare(String(right.label))) as HomebrewResourceTemplateRecord[]
    );
    setCopyCampaignOptions(
      (Array.isArray(campaignsData) ? campaignsData : [])
        .map((item) => ({
          id: Number(item.id),
          name: typeof item.name === "string" ? item.name : `Campaign ${item.id}`,
          isOwner: Boolean(item.isOwner),
        }))
        .filter((item) => Number.isInteger(item.id) && item.id > 0 && item.id !== campaignId)
        .sort((left, right) => left.name.localeCompare(right.name))
    );

    setError(null);
    setLoading(false);
  }

  async function saveSettings(next: CampaignSettingsForm) {
    setSavingSettings(true);

    const response = await fetch(`/api/campaigns/${campaignId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });

    const data = await response.json();
    setSavingSettings(false);

    if (!response.ok) {
      throw new Error(data.error ?? "Failed to save settings");
    }

    const startingEquipmentByClass = data.startingEquipmentByClass ?? next.startingEquipmentByClass;
    const characterRules = data.characterRules
      ? {
          ...data.characterRules,
          startingEquipmentByClass:
            data.characterRules.startingEquipmentByClass ?? startingEquipmentByClass,
        }
      : {
          ...next.characterRules,
          startingEquipmentByClass,
        };

    setSettings({
      ...next,
      experiencesPerLevel: data.experiencesPerLevel ?? next.experiencesPerLevel,
      startingEquipmentByClass,
      resources: data.resources ?? next.resources,
      currency: data.currency ?? next.currency,
      labels: data.labels ?? next.labels,
      layout: data.layout ?? next.layout,
      skills: data.skills ?? next.skills,
      characterRules,
      conditions: data.conditions ?? next.conditions,
      importExport: data.importExport ?? next.importExport,
      craftingRules: data.craftingRules ?? next.craftingRules,
      druidFormRules: data.druidFormRules ?? next.druidFormRules,
      companionRules: data.companionRules ?? next.companionRules,
    });
  }

  async function copySettingsFromCampaign() {
    const sourceId = Number(copySourceCampaignId);
    if (!Number.isInteger(sourceId) || sourceId <= 0) {
      setError("Select a campaign to copy from.");
      return;
    }

    setCopyingSettings(true);
    try {
      const response = await fetch(`/api/campaigns/${sourceId}/settings`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to load source campaign settings");
        return;
      }

      const copiedSettings = mapSettingsPayloadToForm(data, settings);
      await saveSettings(copiedSettings);
      setSettings(copiedSettings);
      setError(null);
    } catch (copyError) {
      setError(
        copyError instanceof Error
          ? copyError.message
          : "Failed to copy settings from selected campaign"
      );
    } finally {
      setCopyingSettings(false);
    }
  }

  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    return <p className="text-red-400">Invalid campaign id.</p>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl text-amber-300">Campaign Customization Console</h1>
          <p className="text-sm text-slate-300">
            Configure character-sheet rules and campaign-specific content.
          </p>
        </div>
        <Link href={`/dashboard/campaigns/${campaignId}`} className="btn-outline min-h-11 px-3 py-2 text-sm">
          Back to Campaign
        </Link>
        <Link href={`/campaigns/${campaignId}/hud`} className="btn-outline min-h-11 px-3 py-2 text-sm">
          Launch GM HUD
        </Link>
      </div>

      {!loading && settings.importExport.allowCopyFromCampaign && (
        <section className="mb-4 rounded-xl border border-slate-700/50 bg-slate-900/60 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-72 flex-1 text-sm text-slate-300">
              Copy settings from another campaign
              <select
                className="field mt-1"
                value={copySourceCampaignId}
                onChange={(event) => setCopySourceCampaignId(event.target.value)}
              >
                <option value="">Select source campaign</option>
                {copyCampaignOptions.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                    {campaign.isOwner ? "" : " (member)"}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn-outline min-h-11 px-3 py-2 text-sm"
              disabled={copyingSettings || !copySourceCampaignId}
              onClick={() => void copySettingsFromCampaign()}
              type="button"
            >
              {copyingSettings ? "Copying..." : "Copy Settings"}
            </button>
          </div>
          {!copyCampaignOptions.length && (
            <p className="mt-2 text-xs text-slate-400">
              No other campaigns available to copy from.
            </p>
          )}
        </section>
      )}

      <div className="mb-4 grid gap-2 rounded-lg border border-slate-700/50 bg-slate-900/60 p-2 sm:grid-cols-3 lg:grid-cols-5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`min-h-11 rounded-md px-3 py-2 text-sm ${
              activeTab === tab.id ? "bg-amber-700/35 text-amber-100" : "bg-slate-800/70 text-slate-300"
            }`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-300">Loading campaign console...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <section className="space-y-4">
          {activeTab !== "homebrew" && (
            <CharacterSheetCustomization
              key={JSON.stringify(settings)}
              value={settings}
              onSave={saveSettings}
              saving={savingSettings}
              module={activeTab}
              campaignId={campaignId}
              classOptions={classOptions}
              ancestryOptions={ancestryOptions}
              communityOptions={communityOptions}
              resourceTemplateOptions={resourceTemplateOptions}
            />
          )}

          {activeTab === "homebrew" && (
            <section className="space-y-4">
              <HomebrewLibraryManagement campaignId={campaignId} />
              <DomainCardManagement campaignId={campaignId} cards={cards} onRefresh={loadAll} />
              <EquipmentLibraryManager
                scope="campaign"
                campaignId={campaignId}
                title="Campaign Equipment Library"
                description="Manage campaign-scoped weapons, armor, items, and consumables. Clone from official, personal, or existing campaign entries."
                onChanged={loadAll}
              />
            </section>
          )}
        </section>
      )}
    </main>
  );
}
