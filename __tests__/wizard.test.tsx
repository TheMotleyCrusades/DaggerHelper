import { describe, expect, it } from "vitest";
import { canAdvanceWizardStep } from "../src/lib/character-wizard";
import type { CharacterWizardData } from "../src/app/characters/create/hooks/useCharacterWizard";

const baseCharacter: CharacterWizardData = {
  campaignId: 4,
  name: "Keira",
  pronouns: "she/her",
  heritage: "Human | Loreborne Community",
  class: "rogue",
  subclass: "Trickster",
  level: 1,
  traits: {
    agility: 2,
    strength: -1,
    finesse: 1,
    instinct: 1,
    presence: 0,
    knowledge: 0,
  },
  baseEvasion: 0,
  proficiency: 1,
  rallyDie: "d6",
  primaryWeaponId: "weapon-daggers",
  secondaryWeaponId: "weapon-shortbow",
  armorId: "armor-travel-leathers",
  domainCards: ["domain-rogue-smoke-dance"],
  backgroundQuestions: {},
  connections: [],
  narrativeBackstory: "",
  advancementSelections: {},
  inventoryItems: [
    {
      entityKind: "weapon",
      entityId: "weapon-daggers",
      quantity: 1,
      isEquipped: true,
      equippedSlot: "primary_weapon",
      notes: "",
      sortOrder: 0,
    },
    {
      entityKind: "armor",
      entityId: "armor-travel-leathers",
      quantity: 1,
      isEquipped: true,
      equippedSlot: "armor",
      notes: "",
      sortOrder: 1,
    },
  ],
  equipmentNotes: "",
  gold: 0,
  handfuls: 0,
  bags: 0,
  debt: 0,
};

describe("wizard step progression", () => {
  it("requires identity fields before leaving step 1", () => {
    expect(canAdvanceWizardStep(1, { ...baseCharacter, name: "" }, 5)).toBe(false);
    expect(canAdvanceWizardStep(1, baseCharacter, 5)).toBe(true);
  });

  it("requires equipment before leaving step 4", () => {
    expect(canAdvanceWizardStep(4, { ...baseCharacter, inventoryItems: [] }, 5)).toBe(false);
    expect(canAdvanceWizardStep(4, baseCharacter, 5)).toBe(true);
  });

  it("enforces domain card limits on step 5", () => {
    expect(canAdvanceWizardStep(5, { ...baseCharacter, domainCards: [] }, 5)).toBe(false);
    expect(canAdvanceWizardStep(5, baseCharacter, 5)).toBe(true);
    expect(
      canAdvanceWizardStep(
        5,
        {
          ...baseCharacter,
          domainCards: ["a", "b", "c", "d", "e", "f"],
        },
        5
      )
    ).toBe(false);
  });
});
