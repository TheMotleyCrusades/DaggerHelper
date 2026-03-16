"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BasicIdentityStep } from "@/app/characters/create/steps/BasicIdentity";
import { IdentityCardsStep } from "@/app/characters/create/steps/IdentityCards";
import { TraitAssignmentStep } from "@/app/characters/create/steps/TraitAssignment";
import { useCharacterWizard } from "@/app/characters/create/hooks/useCharacterWizard";
import { parseHeritageToIdentity } from "@/lib/character-identity";
import { TRAIT_KEYS, getClassDefinition, type TraitMap } from "@/lib/constants/classes";
import {
  DEFAULT_LEVELING_RULES,
  baseLevelUpOptionId,
  type LevelingRuleSettings,
} from "@/lib/constants/leveling";
import type {
  HomebrewEntityRecord,
  HomebrewSubclassRecord,
} from "@/lib/homebrew-library";
import { canAdvanceWizardStep } from "@/lib/character-wizard";

const WeaponsArmorStep = dynamic(
  () => import("@/app/characters/create/steps/WeaponsArmor").then((mod) => mod.WeaponsArmorStep),
  { loading: () => <p className="text-sm text-slate-300">Loading equipment step...</p> }
);

const DomainCardsStep = dynamic(
  () => import("@/app/characters/create/steps/DomainCards").then((mod) => mod.DomainCardsStep),
  { loading: () => <p className="text-sm text-slate-300">Loading domain card step...</p> }
);

const LevelUpStep = dynamic(
  () => import("@/app/characters/create/steps/LevelUp").then((mod) => mod.LevelUpStep),
  { loading: () => <p className="text-sm text-slate-300">Loading level-up step...</p> }
);

const BackgroundStoryStep = dynamic(
  () => import("@/app/characters/create/steps/BackgroundStory").then((mod) => mod.BackgroundStoryStep),
  { loading: () => <p className="text-sm text-slate-300">Loading story step...</p> }
);

const EquipmentStep = dynamic(
  () => import("@/app/characters/create/steps/Equipment").then((mod) => mod.EquipmentStep),
  { loading: () => <p className="text-sm text-slate-300">Loading equipment details...</p> }
);

const ReviewFinalizeStep = dynamic(
  () => import("@/app/characters/create/steps/ReviewFinalize").then((mod) => mod.ReviewFinalizeStep),
  { loading: () => <p className="text-sm text-slate-300">Loading review step...</p> }
);

type CampaignOption = {
  id: number;
  name: string;
};

type CraftingProfessionOption = {
  id: string;
  label: string;
  description?: string;
};

type StepDefinition = {
  id: number;
  label: string;
  isLevelUp?: boolean;
};

function mergeTraits(current: TraitMap, patch: Partial<TraitMap>) {
  return TRAIT_KEYS.reduce(
    (acc, key) => {
      acc[key] = patch[key] ?? current[key];
      return acc;
    },
    {} as TraitMap
  );
}

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeLevelingRules(value: unknown): LevelingRuleSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_LEVELING_RULES;
  }

  const raw = value as {
    levelUpPointsPerLevel?: unknown;
    proficiencyAdvancementCost?: unknown;
    multiclassMinLevel?: unknown;
    allowMulticlass?: unknown;
  };

  const levelUpPointsPerLevel = Number(raw.levelUpPointsPerLevel);
  const proficiencyAdvancementCost = Number(raw.proficiencyAdvancementCost);
  const multiclassMinLevel = Number(raw.multiclassMinLevel);

  return {
    levelUpPointsPerLevel: Number.isFinite(levelUpPointsPerLevel)
      ? Math.max(1, Math.min(10, Math.round(levelUpPointsPerLevel)))
      : DEFAULT_LEVELING_RULES.levelUpPointsPerLevel,
    proficiencyAdvancementCost: Number.isFinite(proficiencyAdvancementCost)
      ? Math.max(1, Math.min(10, Math.round(proficiencyAdvancementCost)))
      : DEFAULT_LEVELING_RULES.proficiencyAdvancementCost,
    multiclassMinLevel: Number.isFinite(multiclassMinLevel)
      ? Math.max(1, Math.min(10, Math.round(multiclassMinLevel)))
      : DEFAULT_LEVELING_RULES.multiclassMinLevel,
    allowMulticlass:
      typeof raw.allowMulticlass === "boolean"
        ? raw.allowMulticlass
        : DEFAULT_LEVELING_RULES.allowMulticlass,
  };
}

function isCraftingAdvancementSelection(optionId: string) {
  const baseId = baseLevelUpOptionId(optionId);
  return (
    baseId === "crafting_profession" ||
    baseId === "crafting_mastery" ||
    baseId === "crafting_specialization"
  );
}

export default function CharacterCreatePage() {
  const router = useRouter();
  const wizard = useCharacterWizard();
  const selectedCampaignId = wizard.character.campaignId;
  const selectedClassName = wizard.character.class;
  const selectedSubclassName = wizard.character.subclass;
  const currentStep = wizard.currentStep;
  const goToStep = wizard.goToStep;
  const updateCharacter = wizard.updateCharacter;

  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [campaignLoading, setCampaignLoading] = useState(true);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [maxDomainCards, setMaxDomainCards] = useState(5);
  const [startingEquipmentByClass, setStartingEquipmentByClass] = useState<Record<string, string>>(
    {}
  );
  const [levelingRules, setLevelingRules] =
    useState<LevelingRuleSettings>(DEFAULT_LEVELING_RULES);
  const [craftingEnabled, setCraftingEnabled] = useState(false);
  const [craftingProfessionOptions, setCraftingProfessionOptions] = useState<
    CraftingProfessionOption[]
  >([]);
  const [classAllowlist, setClassAllowlist] = useState<string[]>([]);
  const [ancestryAllowlist, setAncestryAllowlist] = useState<string[]>([]);
  const [communityAllowlist, setCommunityAllowlist] = useState<string[]>([]);
  const [classOptions, setClassOptions] = useState<HomebrewEntityRecord[]>([]);
  const [subclassOptions, setSubclassOptions] = useState<HomebrewSubclassRecord[]>([]);
  const [ancestryOptions, setAncestryOptions] = useState<HomebrewEntityRecord[]>([]);
  const [communityOptions, setCommunityOptions] = useState<HomebrewEntityRecord[]>([]);
  const [loadingIdentityOptions, setLoadingIdentityOptions] = useState(false);
  const [identityOptionsError, setIdentityOptionsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCampaigns() {
      const response = await fetch("/api/campaigns", { cache: "no-store" });
      const data = await response.json();
      if (cancelled) return;

      if (!response.ok) {
        setCampaignError(data.error ?? "Failed to load campaigns");
        setCampaignLoading(false);
        return;
      }

      const options = (Array.isArray(data) ? data : []).map((item) => ({
        id: item.id as number,
        name: item.name as string,
      }));

      setCampaignOptions(options);
      if (!selectedCampaignId && options.length > 0) {
        updateCharacter({ campaignId: options[0].id });
      }
      setCampaignError(null);
      setCampaignLoading(false);
    }

    void loadCampaigns();
    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId, updateCharacter]);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      if (!selectedCampaignId) {
        setMaxDomainCards(5);
        setStartingEquipmentByClass({});
        setLevelingRules(DEFAULT_LEVELING_RULES);
        setCraftingEnabled(false);
        setCraftingProfessionOptions([]);
        setClassAllowlist([]);
        setAncestryAllowlist([]);
        setCommunityAllowlist([]);
        return;
      }

      const response = await fetch(`/api/campaigns/${selectedCampaignId}/settings`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (cancelled) return;

      if (response.ok && Number.isFinite(data.maxDomainCards)) {
        setMaxDomainCards(Number(data.maxDomainCards));
        setStartingEquipmentByClass(
          data.startingEquipmentByClass && typeof data.startingEquipmentByClass === "object"
            ? (data.startingEquipmentByClass as Record<string, string>)
            : {}
        );
        setLevelingRules(normalizeLevelingRules(data.characterRules));
        setCraftingEnabled(Boolean(data.craftingRules?.enabled));
        setCraftingProfessionOptions(
          Array.isArray(data.craftingRules?.professions)
            ? data.craftingRules.professions
                .filter(
                  (entry: unknown): entry is { id: string; label?: string; description?: string; enabled?: boolean } =>
                    Boolean(entry) &&
                    typeof entry === "object" &&
                    typeof (entry as { id?: unknown }).id === "string" &&
                    ((entry as { enabled?: unknown }).enabled ?? true) !== false
                )
                .map((entry: { id: string; label?: string; description?: string }) => ({
                  id: entry.id,
                  label: typeof entry.label === "string" && entry.label.trim() ? entry.label : entry.id,
                  description: typeof entry.description === "string" ? entry.description : "",
                }))
            : []
        );
        setClassAllowlist(
          Array.isArray(data.characterRules?.classAllowlist)
            ? (data.characterRules.classAllowlist as string[])
            : []
        );
        setAncestryAllowlist(
          Array.isArray(data.characterRules?.ancestryAllowlist)
            ? (data.characterRules.ancestryAllowlist as string[])
            : []
        );
        setCommunityAllowlist(
          Array.isArray(data.characterRules?.communityAllowlist)
            ? (data.characterRules.communityAllowlist as string[])
            : []
        );
        return;
      }

      setMaxDomainCards(5);
      setStartingEquipmentByClass({});
      setLevelingRules(DEFAULT_LEVELING_RULES);
      setCraftingEnabled(false);
      setCraftingProfessionOptions([]);
      setClassAllowlist([]);
      setAncestryAllowlist([]);
      setCommunityAllowlist([]);
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId]);

  useEffect(() => {
    if (!selectedClassName.trim()) return;

    const classKey = normalizeToken(selectedClassName);
    const candidateSubclasses = subclassOptions
      .filter((item) => normalizeToken(item.classId) === classKey)
      .sort((left, right) => left.name.localeCompare(right.name));

    if (!candidateSubclasses.length) {
      if (!selectedSubclassName.trim()) {
        updateCharacter({ subclass: "Foundation Path" });
      }
      return;
    }

    const hasCurrentSubclass = candidateSubclasses.some(
      (item) => item.name === selectedSubclassName
    );
    if (hasCurrentSubclass) return;

    updateCharacter({ subclass: candidateSubclasses[0].name });
  }, [selectedClassName, selectedSubclassName, subclassOptions, updateCharacter]);

  useEffect(() => {
    let cancelled = false;

    async function loadIdentityOptions() {
      if (!selectedCampaignId) {
        setClassOptions([]);
        setSubclassOptions([]);
        setAncestryOptions([]);
        setCommunityOptions([]);
        setIdentityOptionsError(null);
        return;
      }

      setLoadingIdentityOptions(true);
      const query = `?campaignId=${selectedCampaignId}`;
      const [classesResponse, subclassesResponse, ancestriesResponse, communitiesResponse] =
        await Promise.all([
          fetch(`/api/classes${query}`, { cache: "no-store" }),
          fetch(`/api/subclasses${query}`, { cache: "no-store" }),
          fetch(`/api/ancestries${query}`, { cache: "no-store" }),
          fetch(`/api/communities${query}`, { cache: "no-store" }),
        ]);

      const [classesData, subclassesData, ancestriesData, communitiesData] = await Promise.all([
        classesResponse.json(),
        subclassesResponse.json(),
        ancestriesResponse.json(),
        communitiesResponse.json(),
      ]);

      if (cancelled) return;

      if (!classesResponse.ok) {
        setIdentityOptionsError(classesData.error ?? "Failed to load class options");
        setLoadingIdentityOptions(false);
        return;
      }
      if (!subclassesResponse.ok) {
        setIdentityOptionsError(subclassesData.error ?? "Failed to load subclass options");
        setLoadingIdentityOptions(false);
        return;
      }
      if (!ancestriesResponse.ok) {
        setIdentityOptionsError(ancestriesData.error ?? "Failed to load ancestry options");
        setLoadingIdentityOptions(false);
        return;
      }
      if (!communitiesResponse.ok) {
        setIdentityOptionsError(communitiesData.error ?? "Failed to load community options");
        setLoadingIdentityOptions(false);
        return;
      }

      setClassOptions(Array.isArray(classesData) ? classesData : []);
      setSubclassOptions(Array.isArray(subclassesData) ? subclassesData : []);
      setAncestryOptions(Array.isArray(ancestriesData) ? ancestriesData : []);
      setCommunityOptions(Array.isArray(communitiesData) ? communitiesData : []);
      setIdentityOptionsError(null);
      setLoadingIdentityOptions(false);
    }

    void loadIdentityOptions();
    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId]);

  useEffect(() => {
    const maxLevel = Math.max(1, wizard.character.level);
    const pruned = Object.fromEntries(
      Object.entries(wizard.character.advancementSelections)
        .map(([level, selections]) => {
          const numericLevel = Number(level);
          if (!Number.isFinite(numericLevel) || numericLevel < 2 || numericLevel > maxLevel) {
            return null;
          }

          const nextSelections = craftingEnabled
            ? selections
            : selections.filter((optionId) => !isCraftingAdvancementSelection(optionId));
          if (!nextSelections.length) return null;
          return [level, nextSelections] as const;
        })
        .filter((entry): entry is readonly [string, string[]] => Boolean(entry))
    );

    const currentKeys = Object.keys(wizard.character.advancementSelections).sort().join("|");
    const prunedKeys = Object.keys(pruned).sort().join("|");
    const currentValue = JSON.stringify(wizard.character.advancementSelections);
    const prunedValue = JSON.stringify(pruned);
    if (currentKeys !== prunedKeys || currentValue !== prunedValue) {
      updateCharacter({ advancementSelections: pruned });
    }
  }, [
    craftingEnabled,
    updateCharacter,
    wizard.character.advancementSelections,
    wizard.character.level,
  ]);

  async function handleSave() {
    const result = await wizard.saveCharacter();
    router.push(`/characters/${result.id}`);
    router.refresh();
  }

  function handleClassSelection(data: { class: string; subclass: string }) {
    const selectedClass = getClassDefinition(data.class);
    const classChanged = wizard.character.class !== data.class;
    const patch: Partial<typeof wizard.character> = {
      class: data.class,
      subclass: data.subclass,
    };

    if (selectedClass) {
      patch.baseEvasion = selectedClass.startingEvasion;
      if (classChanged || wizard.character.hpMax == null || wizard.character.hpMax <= 0) {
        patch.hpMax = selectedClass.startingHp;
        patch.hpCurrent = selectedClass.startingHp;
      }
    }

    wizard.updateCharacter(patch);
  }

  function resolveDefaultSubclassForClass(nextClassId: string, currentSubclass: string) {
    const classKey = normalizeToken(nextClassId);
    const foundations = subclassOptions
      .filter((item) => normalizeToken(item.classId) === classKey)
      .sort((left, right) => left.name.localeCompare(right.name));

    if (
      currentSubclass.trim() &&
      foundations.some((item) => item.name === currentSubclass.trim())
    ) {
      return currentSubclass.trim();
    }

    return foundations[0]?.name ?? "Foundation Path";
  }

  function handleClassSelectionFromIdentity(classId: string) {
    const keepCurrentSubclass = wizard.character.class === classId ? wizard.character.subclass : "";
    const defaultSubclass = resolveDefaultSubclassForClass(classId, keepCurrentSubclass);
    handleClassSelection({
      class: classId,
      subclass: defaultSubclass,
    });
  }

  const includeLevelUp = wizard.character.level > 1;
  const effectiveMaxDomainCards =
    wizard.character.level <= 1 ? Math.min(maxDomainCards, 2) : maxDomainCards;

  const stepDefinitions = useMemo<StepDefinition[]>(
    () =>
      includeLevelUp
        ? [
            { id: 1, label: "Identity & Class" },
            { id: 2, label: "Ancestry & Community" },
            { id: 3, label: "Traits" },
            { id: 4, label: "Loadout" },
            { id: 5, label: "Domain Cards" },
            { id: 6, label: "Level Up", isLevelUp: true },
            { id: 7, label: "Equipment Notes" },
            { id: 8, label: "Background & Story" },
            { id: 9, label: "Review & Finalize" },
          ]
        : [
            { id: 1, label: "Identity & Class" },
            { id: 2, label: "Ancestry & Community" },
            { id: 3, label: "Traits" },
            { id: 4, label: "Loadout" },
            { id: 5, label: "Domain Cards" },
            { id: 7, label: "Equipment Notes" },
            { id: 8, label: "Background & Story" },
            { id: 9, label: "Review & Finalize" },
          ],
    [includeLevelUp]
  );

  const visibleStepIds = stepDefinitions.map((step) => step.id);
  const currentVisibleIndex = visibleStepIds.indexOf(currentStep);
  const currentVisibleStep = currentVisibleIndex === -1 ? 0 : currentVisibleIndex + 1;
  const isLastVisibleStep = currentVisibleIndex === visibleStepIds.length - 1;

  useEffect(() => {
    if (!includeLevelUp && currentStep === 6) {
      goToStep(7);
    }
  }, [currentStep, goToStep, includeLevelUp]);

  const canAdvanceCurrentStep = canAdvanceWizardStep(
    currentStep,
    wizard.character,
    effectiveMaxDomainCards
  );
  const canGoNext = currentVisibleIndex > -1 && !isLastVisibleStep && canAdvanceCurrentStep;

  const hasClassSelection = Boolean(
    wizard.character.class.trim()
  );
  const parsedIdentity = parseHeritageToIdentity(wizard.character.heritage);
  const hasIdentitySelection = Boolean(
    parsedIdentity.ancestries.length > 0 && parsedIdentity.community
  );

  function goToNextVisibleStep() {
    if (!canGoNext || currentVisibleIndex === -1) return;
    goToStep(visibleStepIds[currentVisibleIndex + 1]);
  }

  function goToPreviousVisibleStep() {
    if (currentVisibleIndex <= 0) return;
    goToStep(visibleStepIds[currentVisibleIndex - 1]);
  }

  const handleSetTraits = useCallback(
    (traits: TraitMap) => {
      updateCharacter({ traits });
    },
    [updateCharacter]
  );

  const handleSetTrait = useCallback(
    (trait: keyof TraitMap, value: number) => {
      updateCharacter({
        traits: mergeTraits(wizard.character.traits, { [trait]: value }),
      });
    },
    [updateCharacter, wizard.character.traits]
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-8">
      <div className="mb-5 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl text-amber-300">Character Builder Wizard</h1>
          <p className="text-sm text-slate-300">Guided flow with mobile-friendly navigation.</p>
        </div>
        <Link href="/characters" className="btn-outline min-h-11 px-3 py-2 text-sm">
          Back to Characters
        </Link>
      </div>

      <div className="mb-4 grid gap-2 rounded-lg border border-slate-700/50 bg-slate-900/60 p-3 sm:grid-cols-3 lg:grid-cols-5">
        {stepDefinitions.map((step) => {
          const active = currentStep === step.id;
          const disabled =
            (step.id > 1 && !hasClassSelection) || (step.id > 2 && !hasIdentitySelection);
          return (
            <button
              key={step.label}
              className={`min-h-11 rounded-md px-2 py-2 text-left text-xs ${
                active ? "bg-amber-700/35 text-amber-100" : "bg-slate-800/70 text-slate-300"
              } ${disabled ? "cursor-not-allowed opacity-40" : ""} ${
                step.isLevelUp ? "font-semibold uppercase tracking-wide" : ""
              }`}
              disabled={disabled}
              onClick={() => goToStep(step.id)}
              type="button"
            >
              {step.id}. {step.label}
            </button>
          );
        })}
      </div>

      {!hasClassSelection && (
        <p className="mb-4 text-xs text-amber-200">
          Complete class and foundation path in Step 1 to unlock the rest of the builder.
        </p>
      )}

      {hasClassSelection && !hasIdentitySelection && (
        <p className="mb-4 text-xs text-amber-200">
          Complete ancestry/community card picks in Step 2 to unlock later steps.
        </p>
      )}

      <div className="panel rounded-xl p-4">
        {currentStep === 1 && (
          <BasicIdentityStep
            campaignId={wizard.character.campaignId}
            campaignOptions={campaignOptions}
            loadingCampaigns={campaignLoading}
            campaignError={campaignError}
            name={wizard.character.name}
            pronouns={wizard.character.pronouns}
            level={wizard.character.level}
            className={wizard.character.class}
            subclass={wizard.character.subclass}
            allowedClassIds={classAllowlist}
            classOptions={classOptions}
            subclassOptions={subclassOptions}
            loadingIdentityOptions={loadingIdentityOptions}
            identityOptionsError={identityOptionsError}
            onSelectClass={handleClassSelectionFromIdentity}
            onSelectFoundation={handleClassSelection}
            onChange={(data) => wizard.updateCharacter(data)}
          />
        )}

        {currentStep === 2 && (
          <IdentityCardsStep
            heritage={wizard.character.heritage}
            allowedAncestryIds={ancestryAllowlist}
            allowedCommunityIds={communityAllowlist}
            ancestryOptions={ancestryOptions}
            communityOptions={communityOptions}
            loadingIdentityOptions={loadingIdentityOptions}
            identityOptionsError={identityOptionsError}
            onChange={(nextHeritage) => wizard.updateCharacter({ heritage: nextHeritage })}
          />
        )}

        {currentStep === 3 && (
          <TraitAssignmentStep
            className={wizard.character.class}
            traits={wizard.character.traits}
            pointsTotal={wizard.pointsTotal}
            onSetTraits={handleSetTraits}
            onSetTrait={handleSetTrait}
          />
        )}

        {currentStep === 4 && (
          <WeaponsArmorStep
            campaignId={wizard.character.campaignId}
            className={wizard.character.class}
            baseEvasion={wizard.character.baseEvasion}
            inventoryItems={wizard.character.inventoryItems}
            onChange={(patch) => wizard.updateCharacter(patch)}
          />
        )}

        {currentStep === 5 && (
          <DomainCardsStep
            campaignId={wizard.character.campaignId}
            className={wizard.character.class}
            level={wizard.character.level}
            maxCards={effectiveMaxDomainCards}
            domainCards={wizard.character.domainCards}
            onChange={(domainCards) => wizard.updateCharacter({ domainCards })}
          />
        )}

        {currentStep === 6 && includeLevelUp && (
          <LevelUpStep
            level={wizard.character.level}
            className={wizard.character.class}
            classOptions={classOptions}
            advancementSelections={wizard.character.advancementSelections}
            rules={levelingRules}
            craftingEnabled={craftingEnabled}
            professionOptions={craftingProfessionOptions}
            onChange={(advancementSelections) => wizard.updateCharacter({ advancementSelections })}
          />
        )}

        {currentStep === 7 && (
          <EquipmentStep
            className={wizard.character.class}
            equipmentNotes={wizard.character.equipmentNotes}
            startingEquipmentByClass={startingEquipmentByClass}
            onChange={(equipmentNotes) => wizard.updateCharacter({ equipmentNotes })}
          />
        )}

        {currentStep === 8 && (
          <BackgroundStoryStep
            className={wizard.character.class}
            backgroundQuestions={wizard.character.backgroundQuestions}
            connections={wizard.character.connections}
            narrativeBackstory={wizard.character.narrativeBackstory}
            onChange={(patch) => wizard.updateCharacter(patch)}
          />
        )}

        {currentStep === 9 && (
          <ReviewFinalizeStep
            character={wizard.character}
            maxDomainCards={effectiveMaxDomainCards}
          />
        )}
      </div>

      {wizard.error && <p className="mt-3 text-sm text-red-400">{wizard.error}</p>}

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          className="btn-outline min-h-11 px-4 py-2 text-sm"
          disabled={currentVisibleIndex <= 0}
          onClick={goToPreviousVisibleStep}
          type="button"
        >
          Back
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300">
            Step {currentVisibleStep} / {visibleStepIds.length}
          </span>
          {!isLastVisibleStep && (
            <button
              className="btn-primary min-h-11 px-4 py-2 text-sm"
              disabled={!canGoNext}
              onClick={goToNextVisibleStep}
              type="button"
            >
              Next
            </button>
          )}
          {isLastVisibleStep && (
            <button
              className="btn-primary min-h-11 px-4 py-2 text-sm"
              disabled={wizard.isSaving}
              onClick={handleSave}
              type="button"
            >
              {wizard.isSaving ? "Saving..." : "Save Character"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
