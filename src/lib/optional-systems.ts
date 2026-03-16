import type { TraitKey } from "@/lib/constants/classes";
import type { AttackProfile } from "@/lib/equipment";
import type { ResolvedCharacterCombat } from "@/lib/equipment";

export type CraftingProfessionDefinition = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
};

export type CraftingMaterialDefinition = {
  id: string;
  label: string;
  description: string;
  maxStack: number;
};

export type CraftingRecipeCost = {
  materialId: string;
  amount: number;
};

export type CraftingRecipeDefinition = {
  id: string;
  name: string;
  targetKind: "weapon" | "armor" | "item" | "consumable" | "custom";
  targetId: string | null;
  targetName: string;
  resourceCosts: CraftingRecipeCost[];
  goldCost: number;
  notes: string;
  enabled: boolean;
};

export type CraftingRulesConfiguration = {
  enabled: boolean;
  gatheringDie: 4 | 6 | 8 | 10 | 12;
  maxProfessionsPerCharacter: number;
  professions: CraftingProfessionDefinition[];
  materialTypes: CraftingMaterialDefinition[];
  recipes: CraftingRecipeDefinition[];
};

export type DruidFormFeature = {
  id: string;
  label: string;
  text: string;
};

export type DruidFormDefinition = {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4;
  examples: string[];
  traitBonus: {
    trait: TraitKey;
    amount: number;
  };
  evasionBonus: number;
  attack: AttackProfile;
  advantages: string[];
  features: DruidFormFeature[];
  drawbacks: DruidFormFeature[];
};

export type DruidFormRulesConfiguration = {
  enabled: boolean;
  allowNonDruid: boolean;
  allowedClassIds: string[];
  disabledFormIds: string[];
  customForms: DruidFormDefinition[];
};

export type CompanionLevelUpOption = {
  id: string;
  label: string;
  description: string;
};

export type CompanionRulesConfiguration = {
  enabled: boolean;
  allowNonBeastbound: boolean;
  allowedClassIds: string[];
  allowedSubclassIds: string[];
  startingEvasion: number;
  startingStressSlots: number;
  startingDamageDie: string;
  startingRangeBand: AttackProfile["rangeBand"];
  levelUpOptions: CompanionLevelUpOption[];
};

export type CharacterCraftingState = {
  professions: string[];
  materials: Record<string, number>;
  notes: string;
};

export type CharacterDruidFormState = {
  knownFormIds: string[];
  activeFormId: string | null;
};

export type CompanionExperienceState = {
  id: string;
  label: string;
  value: number;
};

export type CharacterCompanionState = {
  enabled: boolean;
  name: string;
  species: string;
  evasion: number;
  stressCurrent: number;
  stressMax: number;
  attackName: string;
  attackProfile: AttackProfile;
  experiences: CompanionExperienceState[];
  upgrades: string[];
  notes: string;
};

export const OFFICIAL_DRUID_FORMS: DruidFormDefinition[] = [
  {
    id: "agile-scout",
    name: "Agile Scout",
    tier: 1,
    examples: ["Fox", "Mouse", "Weasel"],
    traitBonus: { trait: "agility", amount: 1 },
    evasionBonus: 2,
    attack: {
      label: "Agile Scout Strike",
      traitMode: "agility",
      rangeBand: "melee",
      damageFormula: "d4",
      damageType: "physical",
    },
    advantages: ["deceive", "locate", "sneak"],
    features: [
      {
        id: "agile",
        label: "Agile",
        text: "Movement is silent; spend Hope to move up to Far range without rolling.",
      },
    ],
    drawbacks: [
      {
        id: "fragile",
        label: "Fragile",
        text: "Drop out of Beastform when taking Major or greater damage.",
      },
    ],
  },
  {
    id: "household-friend",
    name: "Household Friend",
    tier: 1,
    examples: ["Cat", "Dog", "Rabbit"],
    traitBonus: { trait: "instinct", amount: 1 },
    evasionBonus: 2,
    attack: {
      label: "Companion Bite",
      traitMode: "instinct",
      rangeBand: "melee",
      damageFormula: "d6",
      damageType: "physical",
    },
    advantages: ["climb", "locate", "protect"],
    features: [
      {
        id: "companion-help",
        label: "Companion",
        text: "When you Help an Ally, you can roll a d8 as your advantage die.",
      },
    ],
    drawbacks: [
      {
        id: "fragile",
        label: "Fragile",
        text: "Drop out of Beastform when taking Major or greater damage.",
      },
    ],
  },
  {
    id: "nimble-grazer",
    name: "Nimble Grazer",
    tier: 1,
    examples: ["Deer", "Gazelle", "Goat"],
    traitBonus: { trait: "agility", amount: 1 },
    evasionBonus: 3,
    attack: {
      label: "Nimble Strike",
      traitMode: "agility",
      rangeBand: "melee",
      damageFormula: "d6",
      damageType: "physical",
    },
    advantages: ["leap", "sneak", "sprint"],
    features: [
      {
        id: "elusive-prey",
        label: "Elusive Prey",
        text: "Mark Stress to roll d4 and add it to Evasion against a triggering attack.",
      },
    ],
    drawbacks: [
      {
        id: "fragile",
        label: "Fragile",
        text: "Drop out of Beastform when taking Major or greater damage.",
      },
    ],
  },
  {
    id: "pack-predator",
    name: "Pack Predator",
    tier: 1,
    examples: ["Coyote", "Hyena", "Wolf"],
    traitBonus: { trait: "strength", amount: 2 },
    evasionBonus: 1,
    attack: {
      label: "Pack Maul",
      traitMode: "strength",
      rangeBand: "melee",
      damageFormula: "d8+2",
      damageType: "physical",
    },
    advantages: ["attack", "sprint", "track"],
    features: [
      {
        id: "hobbling-strike",
        label: "Hobbling Strike",
        text: "On a successful Melee attack, mark Stress to make the target temporarily Vulnerable.",
      },
      {
        id: "pack-hunting",
        label: "Pack Hunting",
        text: "If you hit a target attacked by an ally immediately before you, add d8 to damage.",
      },
    ],
    drawbacks: [],
  },
  {
    id: "aquatic-scout",
    name: "Aquatic Scout",
    tier: 1,
    examples: ["Eel", "Fish", "Octopus"],
    traitBonus: { trait: "agility", amount: 1 },
    evasionBonus: 2,
    attack: {
      label: "Aquatic Strike",
      traitMode: "agility",
      rangeBand: "melee",
      damageFormula: "d4",
      damageType: "physical",
    },
    advantages: ["navigate", "sneak", "swim"],
    features: [
      {
        id: "aquatic",
        label: "Aquatic",
        text: "You can breathe and move naturally underwater.",
      },
    ],
    drawbacks: [
      {
        id: "fragile",
        label: "Fragile",
        text: "Drop out of Beastform when taking Major or greater damage.",
      },
    ],
  },
  {
    id: "stalking-arachnid",
    name: "Stalking Arachnid",
    tier: 1,
    examples: ["Tarantula", "Wolf Spider"],
    traitBonus: { trait: "finesse", amount: 1 },
    evasionBonus: 2,
    attack: {
      label: "Venomous Bite",
      traitMode: "finesse",
      rangeBand: "melee",
      damageFormula: "d6+1",
      damageType: "physical",
    },
    advantages: ["attack", "climb", "sneak"],
    features: [
      {
        id: "venomous-bite",
        label: "Venomous Bite",
        text: "Successful attacks can temporarily Poison targets.",
      },
      {
        id: "webslinger",
        label: "Webslinger",
        text: "Can create strong web material and restrain targets within Close range.",
      },
    ],
    drawbacks: [],
  },
  {
    id: "armored-sentry",
    name: "Armored Sentry",
    tier: 2,
    examples: ["Armadillo", "Pangolin", "Turtle"],
    traitBonus: { trait: "strength", amount: 1 },
    evasionBonus: 1,
    attack: {
      label: "Armored Bash",
      traitMode: "strength",
      rangeBand: "melee",
      damageFormula: "d8+2",
      damageType: "physical",
    },
    advantages: ["dig", "locate", "protect"],
    features: [
      {
        id: "armored-shell",
        label: "Armored Shell",
        text: "Gain resistance to physical damage and can retract into shell as a defensive posture.",
      },
      {
        id: "cannonball",
        label: "Cannonball",
        text: "Mark Stress to be launched at targets for splash physical damage.",
      },
    ],
    drawbacks: [],
  },
  {
    id: "powerful-beast",
    name: "Powerful Beast",
    tier: 2,
    examples: ["Bear", "Bull", "Moose"],
    traitBonus: { trait: "strength", amount: 3 },
    evasionBonus: 1,
    attack: {
      label: "Rampage Strike",
      traitMode: "strength",
      rangeBand: "melee",
      damageFormula: "d10+4",
      damageType: "physical",
    },
    advantages: ["navigate", "protect", "scare"],
    features: [
      {
        id: "rampage",
        label: "Rampage",
        text: "Damage spikes can chain; mark Stress before attack for +1 Proficiency.",
      },
      {
        id: "thick-hide",
        label: "Thick Hide",
        text: "+2 bonus to damage thresholds while transformed.",
      },
    ],
    drawbacks: [],
  },
  {
    id: "mighty-strider",
    name: "Mighty Strider",
    tier: 2,
    examples: ["Camel", "Horse", "Zebra"],
    traitBonus: { trait: "agility", amount: 1 },
    evasionBonus: 2,
    attack: {
      label: "Trample",
      traitMode: "agility",
      rangeBand: "melee",
      damageFormula: "d8+1",
      damageType: "physical",
    },
    advantages: ["leap", "navigate", "sprint"],
    features: [
      {
        id: "carrier",
        label: "Carrier",
        text: "Can carry up to two willing allies while moving.",
      },
      {
        id: "trample",
        label: "Trample",
        text: "Mark Stress to charge and attack all targets along a line; can apply Vulnerable.",
      },
    ],
    drawbacks: [],
  },
  {
    id: "striking-serpent",
    name: "Striking Serpent",
    tier: 2,
    examples: ["Cobra", "Rattlesnake", "Viper"],
    traitBonus: { trait: "finesse", amount: 1 },
    evasionBonus: 2,
    attack: {
      label: "Venomous Strike",
      traitMode: "finesse",
      rangeBand: "very_close",
      damageFormula: "d8+4",
      damageType: "physical",
    },
    advantages: ["climb", "deceive", "sprint"],
    features: [
      {
        id: "venomous-strike",
        label: "Venomous Strike",
        text: "Can strike multiple targets in Very Close range and apply Poison.",
      },
      {
        id: "warning-hiss",
        label: "Warning Hiss",
        text: "Mark Stress to force nearby targets to move back to Very Close range.",
      },
    ],
    drawbacks: [],
  },
  {
    id: "pouncing-predator",
    name: "Pouncing Predator",
    tier: 2,
    examples: ["Cheetah", "Lion", "Panther"],
    traitBonus: { trait: "instinct", amount: 1 },
    evasionBonus: 3,
    attack: {
      label: "Takedown Pounce",
      traitMode: "instinct",
      rangeBand: "melee",
      damageFormula: "d8+6",
      damageType: "physical",
    },
    advantages: ["attack", "climb", "sneak"],
    features: [
      {
        id: "fleet",
        label: "Fleet",
        text: "Spend Hope to move up to Far range without rolling.",
      },
      {
        id: "takedown",
        label: "Takedown",
        text: "Mark Stress to leap into melee with +2 Proficiency and force Stress on hit.",
      },
    ],
    drawbacks: [],
  },
  {
    id: "winged-beast",
    name: "Winged Beast",
    tier: 2,
    examples: ["Hawk", "Owl", "Raven"],
    traitBonus: { trait: "finesse", amount: 1 },
    evasionBonus: 3,
    attack: {
      label: "Aerial Talon",
      traitMode: "finesse",
      rangeBand: "melee",
      damageFormula: "d4+2",
      damageType: "physical",
    },
    advantages: ["deceive", "locate", "scare"],
    features: [
      {
        id: "birds-eye-view",
        label: "Bird's-Eye View",
        text: "Can fly at will and gather scene intel that grants advantage to allies.",
      },
    ],
    drawbacks: [
      {
        id: "hollow-bones",
        label: "Hollow Bones",
        text: "-2 penalty to damage thresholds while transformed.",
      },
    ],
  },
  {
    id: "great-predator",
    name: "Great Predator",
    tier: 3,
    examples: ["Dire Wolf", "Velociraptor", "Sabertooth Tiger"],
    traitBonus: { trait: "strength", amount: 2 },
    evasionBonus: 2,
    attack: {
      label: "Vicious Maul",
      traitMode: "strength",
      rangeBand: "melee",
      damageFormula: "d12+8",
      damageType: "physical",
    },
    advantages: ["attack", "sneak", "sprint"],
    features: [
      {
        id: "carrier",
        label: "Carrier",
        text: "Can carry up to two willing allies while moving.",
      },
      {
        id: "vicious-maul",
        label: "Vicious Maul",
        text: "Spend Hope on hit to apply Vulnerable and +1 Proficiency.",
      },
    ],
    drawbacks: [],
  },
  {
    id: "mighty-lizard",
    name: "Mighty Lizard",
    tier: 3,
    examples: ["Alligator", "Crocodile", "Gila Monster"],
    traitBonus: { trait: "instinct", amount: 2 },
    evasionBonus: 1,
    attack: {
      label: "Snapping Strike",
      traitMode: "instinct",
      rangeBand: "melee",
      damageFormula: "d10+7",
      damageType: "physical",
    },
    advantages: ["attack", "sneak", "track"],
    features: [
      {
        id: "physical-defense",
        label: "Physical Defense",
        text: "+3 bonus to damage thresholds while transformed.",
      },
      {
        id: "snapping-strike",
        label: "Snapping Strike",
        text: "Spend Hope on hit to restrain and make target Vulnerable.",
      },
    ],
    drawbacks: [],
  },
  {
    id: "great-winged-beast",
    name: "Great Winged Beast",
    tier: 3,
    examples: ["Giant Eagle", "Great Falcon"],
    traitBonus: { trait: "finesse", amount: 2 },
    evasionBonus: 3,
    attack: {
      label: "Great Talon Strike",
      traitMode: "finesse",
      rangeBand: "melee",
      damageFormula: "d8+6",
      damageType: "physical",
    },
    advantages: ["deceive", "distract", "locate"],
    features: [
      {
        id: "birds-eye-view",
        label: "Bird's-Eye View",
        text: "Can fly and gather tactical intel for party advantage.",
      },
      {
        id: "carrier",
        label: "Carrier",
        text: "Can carry up to two willing allies.",
      },
    ],
    drawbacks: [],
  },
  {
    id: "aquatic-predator",
    name: "Aquatic Predator",
    tier: 3,
    examples: ["Dolphin", "Orca", "Shark"],
    traitBonus: { trait: "agility", amount: 2 },
    evasionBonus: 4,
    attack: {
      label: "Aquatic Maul",
      traitMode: "agility",
      rangeBand: "melee",
      damageFormula: "d10+6",
      damageType: "physical",
    },
    advantages: ["attack", "swim", "track"],
    features: [
      {
        id: "aquatic",
        label: "Aquatic",
        text: "You can breathe and move naturally underwater.",
      },
      {
        id: "vicious-maul",
        label: "Vicious Maul",
        text: "Spend Hope on hit to apply Vulnerable and +1 Proficiency.",
      },
    ],
    drawbacks: [],
  },
  {
    id: "massive-behemoth",
    name: "Massive Behemoth",
    tier: 4,
    examples: ["Elephant", "Mammoth", "Rhinoceros"],
    traitBonus: { trait: "strength", amount: 3 },
    evasionBonus: 1,
    attack: {
      label: "Demolish Charge",
      traitMode: "strength",
      rangeBand: "melee",
      damageFormula: "d12+12",
      damageType: "physical",
    },
    advantages: ["locate", "protect", "scare", "sprint"],
    features: [
      {
        id: "carrier",
        label: "Carrier",
        text: "Can carry up to four willing allies.",
      },
      {
        id: "demolish",
        label: "Demolish",
        text: "Spend Hope to charge in a line and strike all targets; applies Vulnerable.",
      },
      {
        id: "undaunted",
        label: "Undaunted",
        text: "+2 bonus to all damage thresholds.",
      },
    ],
    drawbacks: [],
  },
  {
    id: "terrible-lizard",
    name: "Terrible Lizard",
    tier: 4,
    examples: ["Brachiosaurus", "Tyrannosaurus"],
    traitBonus: { trait: "strength", amount: 3 },
    evasionBonus: 2,
    attack: {
      label: "Devastating Strike",
      traitMode: "strength",
      rangeBand: "melee",
      damageFormula: "d12+10",
      damageType: "physical",
    },
    advantages: ["attack", "deceive", "scare", "track"],
    features: [
      {
        id: "devastating-strikes",
        label: "Devastating Strikes",
        text: "On Severe damage, mark Stress to force an additional Hit Point mark.",
      },
      {
        id: "massive-stride",
        label: "Massive Stride",
        text: "Move up to Far range without rolling and ignore many rough-terrain limits.",
      },
    ],
    drawbacks: [],
  },
  {
    id: "mythic-aerial-hunter",
    name: "Mythic Aerial Hunter",
    tier: 4,
    examples: ["Dragon", "Roc", "Wyvern"],
    traitBonus: { trait: "finesse", amount: 3 },
    evasionBonus: 4,
    attack: {
      label: "Deadly Raptor Assault",
      traitMode: "finesse",
      rangeBand: "melee",
      damageFormula: "d10+11",
      damageType: "physical",
    },
    advantages: ["attack", "deceive", "locate", "navigate"],
    features: [
      {
        id: "carrier",
        label: "Carrier",
        text: "Can carry up to three willing allies.",
      },
      {
        id: "deadly-raptor",
        label: "Deadly Raptor",
        text: "Can fly and make high-speed dive attacks with low-die damage rerolls.",
      },
    ],
    drawbacks: [],
  },
  {
    id: "epic-aquatic-beast",
    name: "Epic Aquatic Beast",
    tier: 4,
    examples: ["Giant Squid", "Whale"],
    traitBonus: { trait: "agility", amount: 3 },
    evasionBonus: 3,
    attack: {
      label: "Ocean Master Strike",
      traitMode: "agility",
      rangeBand: "melee",
      damageFormula: "d10+10",
      damageType: "physical",
    },
    advantages: ["locate", "protect", "scare", "track"],
    features: [
      {
        id: "ocean-master",
        label: "Ocean Master",
        text: "Breathe/move underwater and restrain targets on hit.",
      },
      {
        id: "unyielding",
        label: "Unyielding",
        text: "Can reduce incoming severity via defensive roll without always marking armor.",
      },
    ],
    drawbacks: [],
  },
];

export const OFFICIAL_COMPANION_LEVEL_UP_OPTIONS: CompanionLevelUpOption[] = [
  {
    id: "intelligent",
    label: "Intelligent",
    description: "Gain a permanent +1 bonus to one Companion Experience.",
  },
  {
    id: "light-in-the-dark",
    label: "Light in the Dark",
    description: "Add an extra Hope slot your character can mark.",
  },
  {
    id: "creature-comfort",
    label: "Creature Comfort",
    description: "Once per rest, gain Hope or both clear Stress during a quiet bond moment.",
  },
  {
    id: "armored",
    label: "Armored",
    description: "Mark one of your Armor Slots instead of one companion Stress when they take damage.",
  },
  {
    id: "vicious",
    label: "Vicious",
    description: "Increase companion damage die or range by one step.",
  },
  {
    id: "resilient",
    label: "Resilient",
    description: "Companion gains an additional Stress slot.",
  },
  {
    id: "bonded",
    label: "Bonded",
    description: "Emergency rescue feature when you mark your last Hit Point.",
  },
  {
    id: "aware",
    label: "Aware",
    description: "Companion gains a permanent +2 Evasion bonus.",
  },
];

export const DEFAULT_CRAFTING_RULES: CraftingRulesConfiguration = {
  enabled: false,
  gatheringDie: 8,
  maxProfessionsPerCharacter: 2,
  professions: [
    {
      id: "forager",
      label: "Forager",
      description: "Gather natural reagents, fibers, and ingredients.",
      enabled: true,
    },
    {
      id: "skinner",
      label: "Skinner",
      description: "Harvest hide, bone, and monster components from defeated foes.",
      enabled: true,
    },
    {
      id: "prospector",
      label: "Prospector",
      description: "Recover ore, crystal, and rare mineral components.",
      enabled: true,
    },
  ],
  materialTypes: [
    {
      id: "salvage",
      label: "Salvage",
      description: "General monster and battlefield salvage.",
      maxStack: 999,
    },
  ],
  recipes: [],
};

export const DEFAULT_DRUID_FORM_RULES: DruidFormRulesConfiguration = {
  enabled: true,
  allowNonDruid: false,
  allowedClassIds: ["druid"],
  disabledFormIds: [],
  customForms: [],
};

export const DEFAULT_COMPANION_RULES: CompanionRulesConfiguration = {
  enabled: true,
  allowNonBeastbound: false,
  allowedClassIds: ["ranger"],
  allowedSubclassIds: ["beastbound"],
  startingEvasion: 10,
  startingStressSlots: 3,
  startingDamageDie: "d6",
  startingRangeBand: "melee",
  levelUpOptions: OFFICIAL_COMPANION_LEVEL_UP_OPTIONS,
};

export const DEFAULT_CHARACTER_CRAFTING_STATE: CharacterCraftingState = {
  professions: [],
  materials: {},
  notes: "",
};

export const DEFAULT_CHARACTER_DRUID_FORM_STATE: CharacterDruidFormState = {
  knownFormIds: [],
  activeFormId: null,
};

export const DEFAULT_CHARACTER_COMPANION_STATE: CharacterCompanionState = {
  enabled: false,
  name: "",
  species: "",
  evasion: DEFAULT_COMPANION_RULES.startingEvasion,
  stressCurrent: 0,
  stressMax: DEFAULT_COMPANION_RULES.startingStressSlots,
  attackName: "Companion Attack",
  attackProfile: {
    label: "Companion Attack",
    traitMode: "instinct",
    rangeBand: DEFAULT_COMPANION_RULES.startingRangeBand,
    damageFormula: DEFAULT_COMPANION_RULES.startingDamageDie,
    damageType: "physical",
  },
  experiences: [],
  upgrades: [],
  notes: "",
};

export function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formTierForLevel(level: number): 1 | 2 | 3 | 4 {
  if (level >= 8) return 4;
  if (level >= 5) return 3;
  if (level >= 2) return 2;
  return 1;
}

export function resolveDruidForms(rules: DruidFormRulesConfiguration) {
  const custom = rules.customForms ?? [];
  const disabled = new Set((rules.disabledFormIds ?? []).map((id) => normalizeToken(id)));
  const byId = new Map<string, DruidFormDefinition>();

  for (const form of OFFICIAL_DRUID_FORMS) {
    byId.set(normalizeToken(form.id), form);
  }

  // Custom forms override official forms when ids match.
  for (const form of custom) {
    const normalizedId = normalizeToken(form.id);
    if (!normalizedId) continue;
    byId.set(normalizedId, form);
  }

  return Array.from(byId.values())
    .filter((form) => !disabled.has(normalizeToken(form.id)))
    .sort((left, right) => {
      if (left.tier !== right.tier) return left.tier - right.tier;
      return left.name.localeCompare(right.name);
    });
}

export function isFormSelectionAllowed(
  classId: string,
  rules: DruidFormRulesConfiguration
) {
  if (!rules.enabled) return false;
  if (rules.allowNonDruid) return true;
  const normalizedClass = normalizeToken(classId);
  const allowed = rules.allowedClassIds.map((id) => normalizeToken(id));
  return allowed.includes(normalizedClass);
}

export function isCompanionAllowed(
  classId: string,
  subclassName: string,
  rules: CompanionRulesConfiguration
) {
  if (!rules.enabled) return false;
  if (rules.allowNonBeastbound) return true;

  const normalizedClass = normalizeToken(classId);
  const normalizedSubclass = normalizeToken(subclassName);
  const allowedClasses = rules.allowedClassIds.map((id) => normalizeToken(id));
  const allowedSubclasses = rules.allowedSubclassIds.map((id) => normalizeToken(id));

  return allowedClasses.includes(normalizedClass) && allowedSubclasses.includes(normalizedSubclass);
}

export function clampGatheringDie(value: number): 4 | 6 | 8 | 10 | 12 {
  if (value <= 4) return 4;
  if (value <= 6) return 6;
  if (value <= 8) return 8;
  if (value <= 10) return 10;
  return 12;
}

export function rollGatheringResources(die: number) {
  const sides = clampGatheringDie(die);
  return Math.floor(Math.random() * sides) + 1;
}

export function resolveActiveDruidForm(
  level: number,
  classId: string,
  state: CharacterDruidFormState,
  rules: DruidFormRulesConfiguration
) {
  if (!isFormSelectionAllowed(classId, rules)) return null;
  if (!state.activeFormId) return null;

  const maxTier = formTierForLevel(level);
  const forms = resolveDruidForms(rules);
  return (
    forms.find(
      (form) => normalizeToken(form.id) === normalizeToken(state.activeFormId ?? "") && form.tier <= maxTier
    ) ?? null
  );
}

export function applyDruidFormToCombat(
  baseCombat: ResolvedCharacterCombat,
  baseEvasion: number,
  activeForm: DruidFormDefinition | null
): ResolvedCharacterCombat;
export function applyDruidFormToCombat(
  baseCombat: ResolvedCharacterCombat | null,
  baseEvasion: number,
  activeForm: DruidFormDefinition | null
): ResolvedCharacterCombat | null;
export function applyDruidFormToCombat(
  baseCombat: ResolvedCharacterCombat | null,
  baseEvasion: number,
  activeForm: DruidFormDefinition | null
): ResolvedCharacterCombat | null {
  if (!activeForm) return baseCombat;

  const baseline: ResolvedCharacterCombat = baseCombat ?? {
    baseEvasion,
    finalEvasion: baseEvasion,
    armorScore: 0,
    majorThreshold: 0,
    severeThreshold: 0,
    primaryAttack: null,
    secondaryAttack: null,
    equippedItems: [],
    warnings: [],
  };

  const nextPrimaryAttack = {
    sourceId: `druid-form:${activeForm.id}`,
    profile: { ...activeForm.attack },
    warnings: [] as string[],
  };

  return {
    ...baseline,
    finalEvasion: baseline.finalEvasion + activeForm.evasionBonus,
    primaryAttack: nextPrimaryAttack,
    warnings: Array.from(new Set([...baseline.warnings, `Active form: ${activeForm.name}`])),
  };
}

export function applyDruidFormToTraits(
  traits: Record<TraitKey, number>,
  activeForm: DruidFormDefinition | null
) {
  if (!activeForm) return { ...traits };
  const next = { ...traits };
  next[activeForm.traitBonus.trait] =
    (next[activeForm.traitBonus.trait] ?? 0) + activeForm.traitBonus.amount;
  return next;
}
