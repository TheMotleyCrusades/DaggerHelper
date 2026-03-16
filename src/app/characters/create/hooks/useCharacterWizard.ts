"use client";

import { useCallback, useMemo, useState } from "react";
import { TRAIT_KEYS, type TraitMap } from "@/lib/constants/classes";

const TOTAL_STEPS = 9;

const EMPTY_TRAITS: TraitMap = {
  agility: 0,
  strength: 0,
  finesse: 0,
  instinct: 0,
  presence: 0,
  knowledge: 0,
};

export type CharacterWizardData = {
  id?: number;
  campaignId: number | null;
  name: string;
  pronouns: string;
  heritage: string;
  class: string;
  subclass: string;
  level: number;
  traits: TraitMap;
  baseEvasion: number;
  hpCurrent?: number;
  hpMax?: number;
  stressCurrent?: number;
  stressMax?: number;
  hopeCurrent?: number;
  hopeMax?: number;
  experienceCurrent?: number;
  experienceMax?: number;
  proficiency: number;
  rallyDie: string;
  primaryWeaponId?: string;
  secondaryWeaponId?: string;
  armorId?: string;
  domainCards: string[];
  backgroundQuestions: Record<string, string>;
  connections: Record<string, unknown>[];
  narrativeBackstory: string;
  advancementSelections: Record<string, string[]>;
  inventoryItems: Record<string, unknown>[];
  equipmentNotes: string;
  gold: number;
  handfuls: number;
  bags: number;
  debt: number;
};

type SaveResult = {
  id: number;
};

export function useCharacterWizard(initialCampaignId: number | null = null) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [character, setCharacter] = useState<CharacterWizardData>({
    campaignId: initialCampaignId,
    name: "",
    pronouns: "",
    heritage: "",
    class: "",
    subclass: "",
    level: 1,
    traits: EMPTY_TRAITS,
    baseEvasion: 0,
    proficiency: 1,
    rallyDie: "d6",
    domainCards: [],
    backgroundQuestions: {},
    connections: [],
    narrativeBackstory: "",
    advancementSelections: {},
    inventoryItems: [],
    equipmentNotes: "",
    gold: 0,
    handfuls: 0,
    bags: 0,
    debt: 0,
  });

  const updateCharacter = useCallback((data: Partial<CharacterWizardData>) => {
    setCharacter((current) => ({ ...current, ...data }));
  }, []);

  const updateTrait = useCallback((trait: keyof TraitMap, value: number) => {
    setCharacter((current) => ({
      ...current,
      traits: {
        ...current.traits,
        [trait]: value,
      },
    }));
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((current) => Math.min(TOTAL_STEPS, current + 1));
  }, []);

  const previousStep = useCallback(() => {
    setCurrentStep((current) => Math.max(1, current - 1));
  }, []);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(Math.max(1, Math.min(TOTAL_STEPS, step)));
  }, []);

  const saveCharacter = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    const structuredInventory = character.inventoryItems
      .filter((item) => {
        const kind = item.entityKind;
        const entityId = item.entityId;
        return (
          (kind === "weapon" || kind === "armor" || kind === "item" || kind === "consumable") &&
          typeof entityId === "string" &&
          entityId.trim().length > 0
        );
      })
      .map((item, index) => ({
        id: typeof item.id === "string" ? item.id : `wizard-entry-${index + 1}`,
        entityKind: item.entityKind,
        entityId: String(item.entityId),
        quantity:
          typeof item.quantity === "number" && Number.isFinite(item.quantity)
            ? Math.max(1, Math.round(item.quantity))
            : 1,
        isEquipped: Boolean(item.isEquipped),
        equippedSlot:
          item.equippedSlot === "primary_weapon" ||
          item.equippedSlot === "secondary_weapon" ||
          item.equippedSlot === "armor"
            ? item.equippedSlot
            : null,
        notes: typeof item.notes === "string" ? item.notes : "",
        sortOrder:
          typeof item.sortOrder === "number" && Number.isFinite(item.sortOrder)
            ? Math.max(0, Math.round(item.sortOrder))
            : index,
      }));

    const primaryWeaponId =
      structuredInventory.find(
        (entry) =>
          entry.entityKind === "weapon" &&
          entry.isEquipped &&
          entry.equippedSlot === "primary_weapon"
      )?.entityId ?? character.primaryWeaponId;

    const secondaryWeaponId =
      structuredInventory.find(
        (entry) =>
          entry.entityKind === "weapon" &&
          entry.isEquipped &&
          entry.equippedSlot === "secondary_weapon"
      )?.entityId ?? character.secondaryWeaponId;

    const armorId =
      structuredInventory.find(
        (entry) =>
          entry.entityKind === "armor" &&
          entry.isEquipped &&
          entry.equippedSlot === "armor"
      )?.entityId ?? character.armorId;

    const startingEquipment = character.equipmentNotes.trim();
    const payload = {
      ...character,
      subclass: character.subclass.trim() || "Foundation Path",
      primaryWeaponId,
      secondaryWeaponId,
      armorId,
      inventoryItems: startingEquipment
        ? [...structuredInventory, { kind: "starting-equipment", text: startingEquipment }]
        : structuredInventory,
    };

    const response = await fetch("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as SaveResult & { error?: string };
    setIsSaving(false);

    if (!response.ok) {
      const message =
        typeof data.error === "string"
          ? data.error
          : "Unable to save character. Check required fields.";
      setError(message);
      throw new Error(message);
    }

    return data;
  }, [character]);

  const pointsTotal = useMemo(() => {
    return TRAIT_KEYS.reduce((sum, key) => sum + character.traits[key], 0);
  }, [character.traits]);

  return {
    currentStep,
    totalSteps: TOTAL_STEPS,
    character,
    isSaving,
    error,
    pointsTotal,
    nextStep,
    previousStep,
    goToStep,
    updateCharacter,
    updateTrait,
    saveCharacter,
  };
}
