import { describe, expect, it } from "vitest";
import {
  buildSourceMaps,
  collapseByLineage,
  getOfficialArmor,
  getOfficialItems,
  getOfficialWeapons,
  resolveCharacterCombat,
  type CharacterInventoryEntry,
} from "../src/lib/equipment";

const BASE_CHARACTER = {
  id: 1,
  class: "guardian",
  level: 3,
  baseEvasion: 2,
  traits: {
    agility: 0,
    strength: 2,
    finesse: 0,
    instinct: 1,
    presence: 0,
    knowledge: 0,
  },
};

function inventoryEntry(
  patch: Partial<CharacterInventoryEntry> & Pick<CharacterInventoryEntry, "entityKind" | "entityId">
): CharacterInventoryEntry {
  return {
    id: "entry-1",
    characterId: 1,
    entityKind: patch.entityKind,
    entityId: patch.entityId,
    quantity: patch.quantity ?? 1,
    isEquipped: patch.isEquipped ?? false,
    equippedSlot: patch.equippedSlot ?? null,
    notes: patch.notes ?? "",
    sortOrder: patch.sortOrder ?? 0,
  };
}

describe("equipment resolver", () => {
  it("uses unarmored defaults when no armor is equipped", () => {
    const maps = buildSourceMaps({
      weapons: getOfficialWeapons(),
      armor: getOfficialArmor(),
      items: getOfficialItems(),
      consumables: [],
    });

    const result = resolveCharacterCombat({
      character: BASE_CHARACTER,
      inventoryEntries: [],
      sourceMaps: maps,
    });

    expect(result.armorScore).toBe(0);
    expect(result.majorThreshold).toBe(BASE_CHARACTER.level);
    expect(result.severeThreshold).toBe(BASE_CHARACTER.level * 2);
    expect(result.finalEvasion).toBe(BASE_CHARACTER.baseEvasion);
  });

  it("applies equipped armor and weapon modifiers to derived combat", () => {
    const weapon = {
      ...getOfficialWeapons()[0],
      id: "weapon-test",
      sheetModifiers: { evasion: 1 },
    };
    const armor = {
      ...getOfficialArmor()[0],
      id: "armor-test",
      baseMajorThreshold: 6,
      baseSevereThreshold: 10,
      baseArmorScore: 2,
      sheetModifiers: { armorScore: 1, majorThreshold: 1 },
    };
    const maps = buildSourceMaps({
      weapons: [weapon],
      armor: [armor],
      items: [],
      consumables: [],
    });
    const inventory = [
      inventoryEntry({
        id: "w1",
        entityKind: "weapon",
        entityId: weapon.id,
        isEquipped: true,
        equippedSlot: "primary_weapon",
      }),
      inventoryEntry({
        id: "a1",
        entityKind: "armor",
        entityId: armor.id,
        isEquipped: true,
        equippedSlot: "armor",
      }),
    ];

    const result = resolveCharacterCombat({
      character: BASE_CHARACTER,
      inventoryEntries: inventory,
      sourceMaps: maps,
    });

    expect(result.finalEvasion).toBe(BASE_CHARACTER.baseEvasion + 1);
    expect(result.armorScore).toBe(3);
    expect(result.majorThreshold).toBe(7);
    expect(result.severeThreshold).toBe(10);
    expect(result.primaryAttack?.profile.damageFormula).toBe(weapon.defaultProfile.damageFormula);
  });

  it("keeps default weapon attack profile active even when alternate profiles exist", () => {
    const weapon = {
      ...getOfficialWeapons().find((entry) => entry.alternateProfiles.length > 0)!,
      id: "weapon-with-alternate",
    };
    const maps = buildSourceMaps({
      weapons: [weapon],
      armor: [],
      items: [],
      consumables: [],
    });
    const result = resolveCharacterCombat({
      character: BASE_CHARACTER,
      inventoryEntries: [
        inventoryEntry({
          entityKind: "weapon",
          entityId: weapon.id,
          isEquipped: true,
          equippedSlot: "primary_weapon",
        }),
      ],
      sourceMaps: maps,
    });

    expect(result.primaryAttack?.profile).toEqual(weapon.defaultProfile);
    expect(weapon.alternateProfiles.length).toBeGreaterThan(0);
  });

  it("collapses available scope by lineage with campaign > personal > official precedence", () => {
    const records = [
      {
        id: "official-1",
        lineageKey: "lineage-alpha",
        scope: "official" as const,
        updatedAt: "2026-03-01T00:00:00.000Z",
        createdAt: "2026-03-01T00:00:00.000Z",
        name: "Alpha Official",
      },
      {
        id: "personal-1",
        lineageKey: "lineage-alpha",
        scope: "personal" as const,
        updatedAt: "2026-03-02T00:00:00.000Z",
        createdAt: "2026-03-02T00:00:00.000Z",
        name: "Alpha Personal",
      },
      {
        id: "campaign-1",
        lineageKey: "lineage-alpha",
        scope: "campaign" as const,
        updatedAt: "2026-03-03T00:00:00.000Z",
        createdAt: "2026-03-03T00:00:00.000Z",
        name: "Alpha Campaign",
      },
    ];

    const resolved = collapseByLineage(records);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.id).toBe("campaign-1");
  });

  it("resolves archived equipped sources and surfaces warnings", () => {
    const archivedItem = {
      ...getOfficialItems()[0],
      id: "item-archived",
      isArchived: true,
      canEquip: true,
    };
    const maps = buildSourceMaps({
      weapons: [],
      armor: [],
      items: [archivedItem],
      consumables: [],
    });
    const result = resolveCharacterCombat({
      character: BASE_CHARACTER,
      inventoryEntries: [
        inventoryEntry({
          entityKind: "item",
          entityId: archivedItem.id,
          isEquipped: true,
        }),
      ],
      sourceMaps: maps,
    });

    expect(result.equippedItems).toHaveLength(1);
    expect(result.warnings.some((warning) => warning.toLowerCase().includes("archived"))).toBe(
      true
    );
  });
});

