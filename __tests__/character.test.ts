import { describe, expect, it } from "vitest";
import { mapCharacterRow, toCharacterInsert, toCharacterUpdate } from "../src/lib/characters";
import { DEFAULT_CHARACTER_SHEET_CUSTOMIZATION } from "../src/lib/campaign-metadata";
import {
  DEFAULT_CHARACTER_COMPANION_STATE,
  DEFAULT_CHARACTER_CRAFTING_STATE,
  DEFAULT_CHARACTER_DRUID_FORM_STATE,
} from "../src/lib/optional-systems";

describe("character mapping", () => {
  it("creates db payload with defaults and maps back to api shape", () => {
    const payload = toCharacterInsert(
      {
        campaignId: 12,
        name: "Ash",
        pronouns: "they/them",
        heritage: "Human",
        class: "guardian",
        subclass: "Sentinel",
        level: 2,
        traits: {
          agility: 1,
          strength: 2,
          finesse: 0,
          instinct: 0,
          presence: 0,
          knowledge: -1,
        },
        baseEvasion: 0,
        proficiency: 1,
        rallyDie: "d6",
        domainCards: ["domain-guardian-anchor-stance"],
        inventoryItems: [],
        gold: 4,
        handfuls: 0,
        bags: 0,
        debt: 0,
        backgroundQuestions: { origin: "Saved by a stranger" },
        connections: [{ id: "c1", name: "Milo", description: "Sibling" }],
        narrativeBackstory: "A scarred defender from the north.",
        advancementSelections: {},
        resourceValues: {},
        conditionStates: {},
        currencyValues: {},
        customFieldValues: {},
        craftingState: DEFAULT_CHARACTER_CRAFTING_STATE,
        druidFormState: DEFAULT_CHARACTER_DRUID_FORM_STATE,
        companionState: DEFAULT_CHARACTER_COMPANION_STATE,
      },
      {
        ...DEFAULT_CHARACTER_SHEET_CUSTOMIZATION,
        baseHp: 13,
        baseStress: 7,
        baseHope: 3,
        maxDomainCards: 5,
        experiencesPerLevel: { "1": 1, "2": 2 },
      }
    );

    expect(payload.campaign_id).toBe(12);
    expect(payload.name).toBe("Ash");

    const mapped = mapCharacterRow({
      id: 55,
      user_id: 99,
      campaign_id: payload.campaign_id,
      name: payload.name,
      ancestry: payload.ancestry,
      class: payload.class,
      level: payload.level,
      description: payload.description,
      created_at: "2026-03-14T00:00:00.000Z",
      updated_at: "2026-03-14T00:00:00.000Z",
    });

    expect(mapped.id).toBe(55);
    expect(mapped.playerId).toBe(99);
    expect(mapped.heritage).toBe("Human");
    expect(mapped.class).toBe("guardian");
    expect(mapped.subclass).toBe("Sentinel");
    expect(mapped.domainCards).toEqual(["domain-guardian-anchor-stance"]);
    expect(mapped.backgroundQuestions.origin).toContain("Saved by a stranger");
  });

  it("merges character updates without dropping existing metadata", () => {
    const existing = {
      id: 10,
      user_id: 1,
      campaign_id: 3,
      name: "Mira",
      ancestry: "Elf",
      class: "sorcerer",
      level: 3,
      description: toCharacterInsert(
        {
          campaignId: 3,
          name: "Mira",
          pronouns: "she/her",
          heritage: "Elf",
          class: "sorcerer",
          subclass: "Voidborn",
          level: 3,
          traits: {
            agility: 0,
            strength: -1,
            finesse: 0,
            instinct: 1,
            presence: 1,
            knowledge: 2,
          },
          baseEvasion: 0,
          proficiency: 2,
          rallyDie: "d6",
          domainCards: ["domain-sorcerer-arc-flux"],
          inventoryItems: [],
          gold: 0,
          handfuls: 0,
          bags: 0,
          debt: 0,
          backgroundQuestions: {},
          connections: [],
          narrativeBackstory: "",
          advancementSelections: {},
          resourceValues: {},
          conditionStates: {},
          currencyValues: {},
          customFieldValues: {},
          craftingState: DEFAULT_CHARACTER_CRAFTING_STATE,
          druidFormState: DEFAULT_CHARACTER_DRUID_FORM_STATE,
          companionState: DEFAULT_CHARACTER_COMPANION_STATE,
        },
        undefined
      ).description,
    };

    const updated = toCharacterUpdate(existing, {
      level: 4,
      narrativeBackstory: "Now haunted by the void lattice.",
    });

    const mapped = mapCharacterRow({
      ...existing,
      ...updated,
      updated_at: "2026-03-14T00:00:00.000Z",
      created_at: "2026-03-14T00:00:00.000Z",
    });

    expect(mapped.level).toBe(4);
    expect(mapped.subclass).toBe("Voidborn");
    expect(mapped.domainCards).toEqual(["domain-sorcerer-arc-flux"]);
    expect(mapped.narrativeBackstory).toContain("void lattice");
  });
});
