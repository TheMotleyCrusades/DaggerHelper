export type LevelUpOptionId =
  | "trait_boost"
  | "hp_slot"
  | "stress_slot"
  | "experience_boost"
  | "domain_card"
  | "evasion_boost"
  | "subclass_card"
  | "proficiency_boost"
  | "multiclass"
  | "crafting_profession"
  | "crafting_mastery"
  | "crafting_specialization";

export type LevelingRuleSettings = {
  levelUpPointsPerLevel: number;
  proficiencyAdvancementCost: number;
  multiclassMinLevel: number;
  allowMulticlass: boolean;
};

export type LevelUpOptionDefinition = {
  id: LevelUpOptionId;
  label: string;
  description: string;
  impact: string;
  baseCost: number;
  minLevel?: number;
};

export const DEFAULT_LEVELING_RULES: LevelingRuleSettings = {
  levelUpPointsPerLevel: 2,
  proficiencyAdvancementCost: 2,
  multiclassMinLevel: 5,
  allowMulticlass: true,
};

export const LEVEL_UP_OPTIONS: LevelUpOptionDefinition[] = [
  {
    id: "trait_boost",
    label: "+1 to Two Traits",
    description: "Increase two unmarked traits by +1 until the next tier reset.",
    impact: "Improves checks, attacks, and class feature scaling.",
    baseCost: 1,
  },
  {
    id: "hp_slot",
    label: "+1 HP Slot",
    description: "Increase maximum HP by 1.",
    impact: "Increases survivability against direct damage.",
    baseCost: 1,
  },
  {
    id: "stress_slot",
    label: "+1 Stress Slot",
    description: "Increase maximum Stress by 1.",
    impact: "Improves endurance for stress-driven effects and reactions.",
    baseCost: 1,
  },
  {
    id: "experience_boost",
    label: "+1 to Two Experiences",
    description: "Increase two Experiences by +1.",
    impact: "Boosts narrative/action rolls tied to your specialties.",
    baseCost: 1,
  },
  {
    id: "domain_card",
    label: "Gain Domain Card",
    description: "Gain an additional domain card at or below your level.",
    impact: "Expands your available active or vaulted card toolkit.",
    baseCost: 1,
  },
  {
    id: "evasion_boost",
    label: "+1 Evasion",
    description: "Increase Evasion by 1.",
    impact: "Raises defense against incoming attacks.",
    baseCost: 1,
  },
  {
    id: "subclass_card",
    label: "Gain Subclass Card",
    description: "Take the next subclass card made available by tier.",
    impact: "Unlocks subclass power growth at tier breakpoints.",
    baseCost: 1,
  },
  {
    id: "proficiency_boost",
    label: "+1 Proficiency",
    description: "Increase proficiency by 1.",
    impact: "Improves damage and scales multiple offensive options.",
    baseCost: 2,
  },
  {
    id: "multiclass",
    label: "Multiclass",
    description: "Gain a foundation card from another class.",
    impact: "Adds cross-class identity and new feature combinations.",
    baseCost: 2,
    minLevel: 5,
  },
  {
    id: "crafting_profession",
    label: "Crafting Profession",
    description: "Learn a crafting profession and unlock its basic benefits.",
    impact: "Enables gathering/crafting progression for the chosen profession.",
    baseCost: 1,
    minLevel: 2,
  },
  {
    id: "crafting_mastery",
    label: "Crafting Mastery",
    description: "Advance a known crafting profession to mastery.",
    impact: "Unlocks stronger profession perks and advanced project reliability.",
    baseCost: 1,
    minLevel: 5,
  },
  {
    id: "crafting_specialization",
    label: "Crafting Specialization",
    description: "Advance a mastered profession to specialization.",
    impact: "Unlocks apex profession perks and minor combat crossover effects.",
    baseCost: 1,
    minLevel: 8,
  },
];

const LEVEL_UP_OPTION_BY_ID = new Map(LEVEL_UP_OPTIONS.map((option) => [option.id, option]));

function normalizeOptionId(optionId: string) {
  const [baseId] = optionId.split(":");
  return baseId;
}

function normalizePayloadToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function payloadLabel(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function baseLevelUpOptionId(optionId: string) {
  return normalizeOptionId(optionId);
}

export function levelUpOptionPayload(optionId: string) {
  const [, payload] = optionId.split(":");
  const normalized = normalizePayloadToken(payload ?? "");
  return normalized.length ? normalized : null;
}

function formatMulticlassLabel(optionId: string) {
  const [, classId] = optionId.split(":");
  if (!classId) return "Multiclass";
  const label = classId
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
  return `Multiclass (${label})`;
}

function mergedRules(rules?: Partial<LevelingRuleSettings>): LevelingRuleSettings {
  return {
    ...DEFAULT_LEVELING_RULES,
    ...(rules ?? {}),
  };
}

export function getLevelUpOption(optionId: string) {
  return LEVEL_UP_OPTION_BY_ID.get(normalizeOptionId(optionId) as LevelUpOptionId) ?? null;
}

export function getLevelUpOptionLabel(optionId: string) {
  if (optionId.startsWith("multiclass:")) {
    return formatMulticlassLabel(optionId);
  }
  if (optionId.startsWith("crafting_profession:")) {
    const payload = levelUpOptionPayload(optionId);
    return payload ? `Crafting Profession (${payloadLabel(payload)})` : "Crafting Profession";
  }
  if (optionId.startsWith("crafting_mastery:")) {
    const payload = levelUpOptionPayload(optionId);
    return payload ? `Crafting Mastery (${payloadLabel(payload)})` : "Crafting Mastery";
  }
  if (optionId.startsWith("crafting_specialization:")) {
    const payload = levelUpOptionPayload(optionId);
    return payload
      ? `Crafting Specialization (${payloadLabel(payload)})`
      : "Crafting Specialization";
  }
  return getLevelUpOption(optionId)?.label ?? optionId;
}

export function getLevelUpOptionCost(
  optionId: string,
  rules?: Partial<LevelingRuleSettings>
) {
  const normalizedId = normalizeOptionId(optionId);
  const resolvedRules = mergedRules(rules);
  if (normalizedId === "proficiency_boost") {
    return Math.max(1, resolvedRules.proficiencyAdvancementCost);
  }
  if (normalizedId === "multiclass") {
    return 2;
  }
  return getLevelUpOption(normalizedId)?.baseCost ?? 1;
}

export function isLevelUpOptionAvailable(
  optionId: string,
  level: number,
  rules?: Partial<LevelingRuleSettings>
) {
  const normalizedId = normalizeOptionId(optionId);
  const resolvedRules = mergedRules(rules);
  if (normalizedId === "multiclass") {
    if (!resolvedRules.allowMulticlass) return false;
    return level >= Math.max(1, resolvedRules.multiclassMinLevel);
  }

  const option = getLevelUpOption(normalizedId);
  if (!option?.minLevel) return true;
  return level >= option.minLevel;
}
