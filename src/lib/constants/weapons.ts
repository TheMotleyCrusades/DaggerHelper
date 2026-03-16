import type { TraitKey } from "@/lib/constants/classes";

export type WeaponDefinition = {
  id: string;
  campaignId: number | null;
  name: string;
  trait: TraitKey;
  rangeCategory: "melee" | "close" | "far";
  damageDice: string;
  damageType: "physical" | "magical";
  feature: string;
  isOfficial: boolean;
};

export const OFFICIAL_WEAPONS: WeaponDefinition[] = [
  {
    id: "weapon-longsword",
    campaignId: null,
    name: "Longsword",
    trait: "strength",
    rangeCategory: "melee",
    damageDice: "d8",
    damageType: "physical",
    feature: "Reliable edge that gains +1 damage when fighting one-on-one.",
    isOfficial: true,
  },
  {
    id: "weapon-warhammer",
    campaignId: null,
    name: "Warhammer",
    trait: "strength",
    rangeCategory: "melee",
    damageDice: "d10",
    damageType: "physical",
    feature: "Shattering blow can stagger armored targets.",
    isOfficial: true,
  },
  {
    id: "weapon-rapier",
    campaignId: null,
    name: "Rapier",
    trait: "finesse",
    rangeCategory: "melee",
    damageDice: "d8",
    damageType: "physical",
    feature: "Precise thrusts grant +1 against exposed enemies.",
    isOfficial: true,
  },
  {
    id: "weapon-shortbow",
    campaignId: null,
    name: "Shortbow",
    trait: "agility",
    rangeCategory: "far",
    damageDice: "d8",
    damageType: "physical",
    feature: "Quick draw lets you reposition before or after the shot.",
    isOfficial: true,
  },
  {
    id: "weapon-crossbow",
    campaignId: null,
    name: "Crossbow",
    trait: "agility",
    rangeCategory: "far",
    damageDice: "d10",
    damageType: "physical",
    feature: "High-impact bolt ignores minor cover.",
    isOfficial: true,
  },
  {
    id: "weapon-daggers",
    campaignId: null,
    name: "Twin Daggers",
    trait: "finesse",
    rangeCategory: "close",
    damageDice: "d6",
    damageType: "physical",
    feature: "Can be split between two adjacent targets.",
    isOfficial: true,
  },
  {
    id: "weapon-staff",
    campaignId: null,
    name: "Arcane Staff",
    trait: "knowledge",
    rangeCategory: "far",
    damageDice: "d8",
    damageType: "magical",
    feature: "Channeling focus lets you reroll one low die each turn.",
    isOfficial: true,
  },
  {
    id: "weapon-sigil-orb",
    campaignId: null,
    name: "Sigil Orb",
    trait: "presence",
    rangeCategory: "far",
    damageDice: "d6",
    damageType: "magical",
    feature: "Marks a foe; allies gain +1 when attacking that target.",
    isOfficial: true,
  },
];
