export type WorldKindSlug =
  | "adversaries"
  | "weapons"
  | "armor"
  | "items"
  | "consumables"
  | "classes"
  | "subclasses"
  | "ancestries"
  | "communities"
  | "skills"
  | "conditions"
  | "resource-templates";

export type WorldKindConfig = {
  slug: WorldKindSlug;
  entityKind: string;
  label: string;
  description: string;
};

export const WORLD_KIND_CONFIGS: WorldKindConfig[] = [
  {
    slug: "adversaries",
    entityKind: "adversary",
    label: "Adversaries",
    description: "Custom threats and stat blocks for encounters.",
  },
  {
    slug: "weapons",
    entityKind: "weapon",
    label: "Weapons",
    description: "Homebrew weapons and attack profiles for your packs.",
  },
  {
    slug: "armor",
    entityKind: "armor",
    label: "Armor",
    description: "Threshold and armor-score options for custom settings.",
  },
  {
    slug: "items",
    entityKind: "item",
    label: "Items",
    description: "Reusable utility, relic, and upgrade-style inventory entries.",
  },
  {
    slug: "consumables",
    entityKind: "consumable",
    label: "Consumables",
    description: "One-use effects and stackable consumables.",
  },
  {
    slug: "classes",
    entityKind: "class",
    label: "Classes",
    description: "Class-level frameworks and progression variants.",
  },
  {
    slug: "subclasses",
    entityKind: "subclass",
    label: "Subclasses",
    description: "Subclass forks and identity features.",
  },
  {
    slug: "ancestries",
    entityKind: "ancestry",
    label: "Ancestries",
    description: "Ancestry cards and ancestry-specific options.",
  },
  {
    slug: "communities",
    entityKind: "community",
    label: "Communities",
    description: "Community identity cards and campaign variants.",
  },
  {
    slug: "skills",
    entityKind: "skill",
    label: "Skills",
    description: "Custom skills and trait-adjacent tools.",
  },
  {
    slug: "conditions",
    entityKind: "condition",
    label: "Conditions",
    description: "Condition definitions and effect descriptors.",
  },
  {
    slug: "resource-templates",
    entityKind: "resource_template",
    label: "Resource Templates",
    description: "Custom resource tracks and economy templates.",
  },
];

const CONFIG_BY_SLUG = new Map(WORLD_KIND_CONFIGS.map((config) => [config.slug, config]));

export function getWorldKindConfigBySlug(slug: string) {
  return CONFIG_BY_SLUG.get(slug as WorldKindSlug) ?? null;
}
