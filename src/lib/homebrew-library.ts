import type {
  ConditionDefinition,
  HomebrewEntityDefinition,
  ResourceDefinition,
  SkillDefinition,
} from "@/lib/campaign-metadata";
import { CLASS_DEFINITIONS } from "@/lib/constants/classes";
import { ANCESTRY_CARDS, COMMUNITY_CARDS } from "@/lib/constants/identityCards";
import { SRD_SUBCLASS_CARDS } from "@/lib/srd-cards";

export type HomebrewEntityRecord = HomebrewEntityDefinition & {
  campaignId: number | null;
};

export type HomebrewSubclassRecord = HomebrewEntityRecord & {
  classId: string;
  className: string;
  spellcastTrait: string | null;
};

export type HomebrewConditionRecord = ConditionDefinition & {
  campaignId: number | null;
  isOfficial: boolean;
};

export type HomebrewSkillRecord = SkillDefinition & {
  campaignId: number | null;
  isOfficial: boolean;
};

export type HomebrewResourceTemplateRecord = ResourceDefinition & {
  campaignId: number | null;
  isOfficial: boolean;
};

export function normalizeClassToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function extractSubclassClassId(entry: HomebrewEntityDefinition) {
  const explicit = entry.tags.find((tag) => tag.startsWith("class:"));
  if (explicit) {
    return normalizeClassToken(explicit.slice("class:".length));
  }
  return "";
}

export function toOfficialClassRecords(): HomebrewEntityRecord[] {
  return CLASS_DEFINITIONS.map((item) => ({
    id: item.id,
    name: item.label,
    description: item.description,
    tags: ["official"],
    isOfficial: true,
    campaignId: null,
  }));
}

export function toOfficialSubclassRecords(): HomebrewSubclassRecord[] {
  const foundations = SRD_SUBCLASS_CARDS.filter((card) => card.tier === "foundation");
  return foundations.map((card) => ({
    id: card.id,
    name: card.subclassName,
    description: card.description,
    tags: ["official", `class:${normalizeClassToken(card.className)}`],
    isOfficial: true,
    campaignId: null,
    classId: normalizeClassToken(card.className),
    className: card.className,
    spellcastTrait: card.spellcastTrait,
  }));
}

export function toOfficialAncestryRecords(): HomebrewEntityRecord[] {
  return ANCESTRY_CARDS.map((item) => ({
    id: item.id,
    name: item.label,
    description: item.details,
    tags: ["official"],
    isOfficial: true,
    campaignId: null,
  }));
}

export function toOfficialCommunityRecords(): HomebrewEntityRecord[] {
  return COMMUNITY_CARDS.map((item) => ({
    id: item.id,
    name: item.label,
    description: item.details,
    tags: ["official"],
    isOfficial: true,
    campaignId: null,
  }));
}
