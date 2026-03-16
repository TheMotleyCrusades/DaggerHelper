import type { ArmorDefinition } from "@/lib/constants/armor";
import type { DomainCardDefinition } from "@/lib/constants/domains";
import type { WeaponDefinition } from "@/lib/constants/weapons";
import {
  DEFAULT_COMPANION_RULES,
  DEFAULT_CRAFTING_RULES,
  DEFAULT_DRUID_FORM_RULES,
  type CompanionRulesConfiguration,
  type CraftingRulesConfiguration,
  type DruidFormDefinition,
  type DruidFormRulesConfiguration,
} from "@/lib/optional-systems";

export type CustomFieldDefinition = {
  id: string;
  name: string;
  type: "text" | "number" | "checkbox" | "select";
  required: boolean;
  position: number;
};

export type DomainCardTemplate = {
  showTraitBonuses: boolean;
  showEvasion: boolean;
  showMoveAbility: boolean;
  showFragile: boolean;
  showFeature: boolean;
  customSections: Array<{
    id: string;
    name: string;
    label: string;
    type: "text" | "number" | "list";
  }>;
};

export type VisibilitySurface = {
  builder: boolean;
  sheet: boolean;
  editor: boolean;
  pdf: boolean;
  share: boolean;
};

export type ResourceDefinition = {
  id: string;
  label: string;
  defaultCurrent: number;
  defaultMax: number;
  min: number;
  max: number;
  format: "current_max" | "single" | "checkbox";
  playerEditable: boolean;
  allowPermanentShift: boolean;
  allowTemporaryModifiers: boolean;
  visibleOn: VisibilitySurface;
};

export type CurrencyDenomination = {
  id: string;
  label: string;
  abbreviation: string;
  defaultAmount: number;
  exchangeRate: number;
  sortOrder: number;
  visible: boolean;
  allowFraction: boolean;
};

export type CurrencyConfiguration = {
  mode: "abstract" | "coin" | "hybrid";
  denominations: CurrencyDenomination[];
  debtEnabled: boolean;
  debtLabel: string;
  autoConvert: boolean;
  showTotals: boolean;
  showBreakdown: boolean;
};

export type LabelOverrides = {
  resources: Record<string, string>;
  sections: Record<string, string>;
  helperText: Record<string, string>;
};

export type LayoutSectionConfiguration = {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  description: string;
  showOnShare: boolean;
  showOnPdf: boolean;
  collapseWhenEmpty: boolean;
};

export type LayoutConfiguration = {
  mode: "compact" | "standard" | "print";
  sections: LayoutSectionConfiguration[];
  touchAlwaysExpandDetails: boolean;
};

export type SkillDefinition = {
  id: string;
  label: string;
  traits: string[];
  helperText: string;
};

export type CharacterRuleConfiguration = {
  requiredFields: string[];
  classAllowlist: string[];
  ancestryAllowlist: string[];
  communityAllowlist: string[];
  disableClassDomainGating: boolean;
  expandedDomainsByClass: Record<string, string[]>;
  startingEquipmentByClass: Record<string, string>;
  levelUpPointsPerLevel: number;
  proficiencyAdvancementCost: number;
  multiclassMinLevel: number;
  allowMulticlass: boolean;
};

export type ConditionDefinition = {
  id: string;
  name: string;
  description: string;
  playerToggle: boolean;
  visibleToPlayers: boolean;
};

export type ImportExportConfiguration = {
  applyLabelsToShare: boolean;
  applyLabelsToPdf: boolean;
  includeRulesInJson: boolean;
  allowCopyFromCampaign: boolean;
};

export type HomebrewEntityDefinition = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  isOfficial: boolean;
};

export type CharacterSheetCustomization = {
  baseHp: number;
  baseStress: number;
  baseHope: number;
  maxDomainCards: number;
  experiencesPerLevel: Record<string, number>;
  startingEquipmentByClass: Record<string, string>;
  resources: ResourceDefinition[];
  currency: CurrencyConfiguration;
  labels: LabelOverrides;
  layout: LayoutConfiguration;
  skills: SkillDefinition[];
  characterRules: CharacterRuleConfiguration;
  conditions: ConditionDefinition[];
  displaySettings: {
    showGold: boolean;
    showInventory: boolean;
    showConnections: boolean;
    customFields: CustomFieldDefinition[];
  };
  domainCardTemplate: DomainCardTemplate | null;
  importExport: ImportExportConfiguration;
  craftingRules: CraftingRulesConfiguration;
  druidFormRules: DruidFormRulesConfiguration;
  companionRules: CompanionRulesConfiguration;
};

export type CampaignHomebrewCollections = {
  classes: HomebrewEntityDefinition[];
  subclasses: HomebrewEntityDefinition[];
  ancestries: HomebrewEntityDefinition[];
  communities: HomebrewEntityDefinition[];
  domainCards: DomainCardDefinition[];
  weapons: WeaponDefinition[];
  armor: ArmorDefinition[];
  items: HomebrewEntityDefinition[];
  conditions: ConditionDefinition[];
  skills: SkillDefinition[];
  resourceTemplates: ResourceDefinition[];
};

export type CampaignMetadata = {
  settings?: Partial<CharacterSheetCustomization>;
  homebrew?: Partial<CampaignHomebrewCollections>;
};

const META_PREFIX = "[[DAGGERHELPER_CAMPAIGN_META]]";
const META_VERSION = 1;

const DEFAULT_VISIBILITY_SURFACE: VisibilitySurface = {
  builder: true,
  sheet: true,
  editor: true,
  pdf: true,
  share: true,
};

function cloneVisibilitySurface(surface: VisibilitySurface): VisibilitySurface {
  return {
    builder: surface.builder,
    sheet: surface.sheet,
    editor: surface.editor,
    pdf: surface.pdf,
    share: surface.share,
  };
}

function defaultResourceDefinitions(baseHp: number, baseStress: number, baseHope: number): ResourceDefinition[] {
  return [
    {
      id: "hp",
      label: "HP",
      defaultCurrent: baseHp,
      defaultMax: baseHp,
      min: 0,
      max: 999,
      format: "current_max",
      playerEditable: true,
      allowPermanentShift: true,
      allowTemporaryModifiers: true,
      visibleOn: cloneVisibilitySurface(DEFAULT_VISIBILITY_SURFACE),
    },
    {
      id: "stress",
      label: "Stress",
      defaultCurrent: baseStress,
      defaultMax: baseStress,
      min: 0,
      max: 99,
      format: "current_max",
      playerEditable: true,
      allowPermanentShift: true,
      allowTemporaryModifiers: true,
      visibleOn: cloneVisibilitySurface(DEFAULT_VISIBILITY_SURFACE),
    },
    {
      id: "hope",
      label: "Hope",
      defaultCurrent: baseHope,
      defaultMax: baseHope,
      min: 0,
      max: 99,
      format: "current_max",
      playerEditable: true,
      allowPermanentShift: true,
      allowTemporaryModifiers: true,
      visibleOn: cloneVisibilitySurface(DEFAULT_VISIBILITY_SURFACE),
    },
    {
      id: "experience",
      label: "Experience",
      defaultCurrent: 0,
      defaultMax: 1,
      min: 0,
      max: 99,
      format: "current_max",
      playerEditable: true,
      allowPermanentShift: false,
      allowTemporaryModifiers: false,
      visibleOn: cloneVisibilitySurface(DEFAULT_VISIBILITY_SURFACE),
    },
  ];
}

const DEFAULT_LAYOUT_SECTIONS: LayoutSectionConfiguration[] = [
  {
    id: "identity",
    label: "Identity",
    visible: true,
    order: 1,
    description: "Name, class, heritage, and presentation details.",
    showOnShare: true,
    showOnPdf: true,
    collapseWhenEmpty: false,
  },
  {
    id: "traits",
    label: "Traits",
    visible: true,
    order: 2,
    description: "Core stat lines and trait bonuses.",
    showOnShare: true,
    showOnPdf: true,
    collapseWhenEmpty: false,
  },
  {
    id: "resources",
    label: "Resources",
    visible: true,
    order: 3,
    description: "HP, Stress, Hope, Experience, and custom resources.",
    showOnShare: true,
    showOnPdf: true,
    collapseWhenEmpty: false,
  },
  {
    id: "equipment",
    label: "Equipment",
    visible: true,
    order: 4,
    description: "Weapons, armor, and key starting gear.",
    showOnShare: true,
    showOnPdf: true,
    collapseWhenEmpty: false,
  },
  {
    id: "domains",
    label: "Domain Cards",
    visible: true,
    order: 5,
    description: "Selected active domain cards and notes.",
    showOnShare: true,
    showOnPdf: true,
    collapseWhenEmpty: false,
  },
  {
    id: "connections",
    label: "Connections",
    visible: true,
    order: 6,
    description: "Relationships and party ties.",
    showOnShare: true,
    showOnPdf: true,
    collapseWhenEmpty: true,
  },
  {
    id: "inventory",
    label: "Inventory",
    visible: true,
    order: 7,
    description: "Inventory entries and campaign-specific item notes.",
    showOnShare: true,
    showOnPdf: true,
    collapseWhenEmpty: true,
  },
  {
    id: "currency",
    label: "Currency",
    visible: true,
    order: 8,
    description: "Campaign currency model and denominations.",
    showOnShare: true,
    showOnPdf: true,
    collapseWhenEmpty: true,
  },
  {
    id: "background",
    label: "Background Questions",
    visible: true,
    order: 9,
    description: "Guided backstory prompts and answers.",
    showOnShare: true,
    showOnPdf: true,
    collapseWhenEmpty: true,
  },
  {
    id: "narrative",
    label: "Narrative Backstory",
    visible: true,
    order: 10,
    description: "Free-form character narrative.",
    showOnShare: true,
    showOnPdf: true,
    collapseWhenEmpty: true,
  },
];

const DEFAULT_CURRENCY: CurrencyConfiguration = {
  mode: "abstract",
  denominations: [
    {
      id: "gold",
      label: "Gold",
      abbreviation: "gp",
      defaultAmount: 0,
      exchangeRate: 1,
      sortOrder: 1,
      visible: true,
      allowFraction: false,
    },
    {
      id: "handfuls",
      label: "Handfuls",
      abbreviation: "hf",
      defaultAmount: 0,
      exchangeRate: 1,
      sortOrder: 2,
      visible: true,
      allowFraction: false,
    },
    {
      id: "bags",
      label: "Bags",
      abbreviation: "bg",
      defaultAmount: 0,
      exchangeRate: 1,
      sortOrder: 3,
      visible: true,
      allowFraction: false,
    },
  ],
  debtEnabled: true,
  debtLabel: "Debt",
  autoConvert: false,
  showTotals: true,
  showBreakdown: true,
};

const DEFAULT_LABELS: LabelOverrides = {
  resources: {
    hp: "HP",
    stress: "Stress",
    hope: "Hope",
    experience: "Experience",
  },
  sections: {
    connections: "Connections",
    inventory: "Inventory",
    backgroundQuestions: "Background Questions",
    narrativeBackstory: "Narrative Backstory",
    domainCards: "Domain Cards",
    currency: "Currency",
    resources: "Resources",
  },
  helperText: {
    builderIntro: "Configure your character using campaign rules.",
    sheetRules: "Values shown here follow campaign-specific settings.",
  },
};

const DEFAULT_LAYOUT: LayoutConfiguration = {
  mode: "standard",
  sections: DEFAULT_LAYOUT_SECTIONS,
  touchAlwaysExpandDetails: false,
};

const DEFAULT_CHARACTER_RULES: CharacterRuleConfiguration = {
  requiredFields: [],
  classAllowlist: [],
  ancestryAllowlist: [],
  communityAllowlist: [],
  disableClassDomainGating: false,
  expandedDomainsByClass: {},
  startingEquipmentByClass: {},
  levelUpPointsPerLevel: 2,
  proficiencyAdvancementCost: 2,
  multiclassMinLevel: 5,
  allowMulticlass: true,
};

const DEFAULT_IMPORT_EXPORT: ImportExportConfiguration = {
  applyLabelsToShare: true,
  applyLabelsToPdf: true,
  includeRulesInJson: true,
  allowCopyFromCampaign: true,
};

function cloneResource(resource: ResourceDefinition): ResourceDefinition {
  return {
    ...resource,
    visibleOn: cloneVisibilitySurface(resource.visibleOn),
  };
}

function cloneCurrency(config: CurrencyConfiguration): CurrencyConfiguration {
  return {
    ...config,
    denominations: config.denominations.map((item) => ({ ...item })),
  };
}

function cloneLabels(labels: LabelOverrides): LabelOverrides {
  return {
    resources: { ...labels.resources },
    sections: { ...labels.sections },
    helperText: { ...labels.helperText },
  };
}

function cloneLayout(layout: LayoutConfiguration): LayoutConfiguration {
  return {
    mode: layout.mode,
    touchAlwaysExpandDetails: layout.touchAlwaysExpandDetails,
    sections: layout.sections.map((section) => ({ ...section })),
  };
}

function cloneSkills(skills: SkillDefinition[]): SkillDefinition[] {
  return skills.map((skill) => ({
    ...skill,
    traits: [...skill.traits],
  }));
}

function cloneCharacterRules(rules: CharacterRuleConfiguration): CharacterRuleConfiguration {
  return {
    ...rules,
    requiredFields: [...rules.requiredFields],
    classAllowlist: [...rules.classAllowlist],
    ancestryAllowlist: [...rules.ancestryAllowlist],
    communityAllowlist: [...rules.communityAllowlist],
    disableClassDomainGating: rules.disableClassDomainGating,
    expandedDomainsByClass: Object.fromEntries(
      Object.entries(rules.expandedDomainsByClass).map(([classId, domains]) => [
        classId,
        [...domains],
      ])
    ),
    startingEquipmentByClass: { ...rules.startingEquipmentByClass },
    levelUpPointsPerLevel: rules.levelUpPointsPerLevel,
    proficiencyAdvancementCost: rules.proficiencyAdvancementCost,
    multiclassMinLevel: rules.multiclassMinLevel,
    allowMulticlass: rules.allowMulticlass,
  };
}

function cloneConditions(conditions: ConditionDefinition[]): ConditionDefinition[] {
  return conditions.map((condition) => ({ ...condition }));
}

function cloneImportExport(value: ImportExportConfiguration): ImportExportConfiguration {
  return { ...value };
}

function isCraftingRulesConfiguration(value: unknown): value is CraftingRulesConfiguration {
  if (!isObjectLike(value)) return false;
  const rules = value as CraftingRulesConfiguration;
  return (
    typeof rules.enabled === "boolean" &&
    Number.isFinite(rules.gatheringDie) &&
    Number.isFinite(rules.maxProfessionsPerCharacter) &&
    Array.isArray(rules.professions) &&
    Array.isArray(rules.materialTypes) &&
    Array.isArray(rules.recipes)
  );
}

function isDruidFormDefinition(value: unknown): value is DruidFormDefinition {
  if (!isObjectLike(value)) return false;
  const form = value as DruidFormDefinition;
  return (
    typeof form.id === "string" &&
    typeof form.name === "string" &&
    Number.isFinite(form.tier) &&
    Array.isArray(form.examples) &&
    isObjectLike(form.traitBonus) &&
    typeof form.traitBonus.trait === "string" &&
    Number.isFinite(form.traitBonus.amount) &&
    Number.isFinite(form.evasionBonus) &&
    isObjectLike(form.attack) &&
    Array.isArray(form.advantages) &&
    Array.isArray(form.features) &&
    Array.isArray(form.drawbacks)
  );
}

function isDruidFormRulesConfiguration(value: unknown): value is DruidFormRulesConfiguration {
  if (!isObjectLike(value)) return false;
  const rules = value as DruidFormRulesConfiguration;
  return (
    typeof rules.enabled === "boolean" &&
    typeof rules.allowNonDruid === "boolean" &&
    Array.isArray(rules.allowedClassIds) &&
    Array.isArray(rules.disabledFormIds) &&
    Array.isArray(rules.customForms)
  );
}

function isCompanionRulesConfiguration(value: unknown): value is CompanionRulesConfiguration {
  if (!isObjectLike(value)) return false;
  const rules = value as CompanionRulesConfiguration;
  return (
    typeof rules.enabled === "boolean" &&
    typeof rules.allowNonBeastbound === "boolean" &&
    Array.isArray(rules.allowedClassIds) &&
    Array.isArray(rules.allowedSubclassIds) &&
    Number.isFinite(rules.startingEvasion) &&
    Number.isFinite(rules.startingStressSlots) &&
    typeof rules.startingDamageDie === "string" &&
    typeof rules.startingRangeBand === "string" &&
    Array.isArray(rules.levelUpOptions)
  );
}

function cloneCraftingRules(value: CraftingRulesConfiguration): CraftingRulesConfiguration {
  return {
    enabled: value.enabled,
    gatheringDie: value.gatheringDie,
    maxProfessionsPerCharacter: value.maxProfessionsPerCharacter,
    professions: value.professions.map((profession) => ({ ...profession })),
    materialTypes: value.materialTypes.map((material) => ({ ...material })),
    recipes: value.recipes.map((recipe) => ({
      ...recipe,
      resourceCosts: recipe.resourceCosts.map((cost) => ({ ...cost })),
    })),
  };
}

function cloneDruidForm(form: DruidFormDefinition): DruidFormDefinition {
  return {
    ...form,
    examples: [...form.examples],
    traitBonus: { ...form.traitBonus },
    attack: { ...form.attack },
    advantages: [...form.advantages],
    features: form.features.map((feature) => ({ ...feature })),
    drawbacks: form.drawbacks.map((feature) => ({ ...feature })),
  };
}

function cloneDruidFormRules(value: DruidFormRulesConfiguration): DruidFormRulesConfiguration {
  return {
    enabled: value.enabled,
    allowNonDruid: value.allowNonDruid,
    allowedClassIds: [...value.allowedClassIds],
    disabledFormIds: [...value.disabledFormIds],
    customForms: value.customForms.map((form) => cloneDruidForm(form)),
  };
}

function cloneCompanionRules(value: CompanionRulesConfiguration): CompanionRulesConfiguration {
  return {
    enabled: value.enabled,
    allowNonBeastbound: value.allowNonBeastbound,
    allowedClassIds: [...value.allowedClassIds],
    allowedSubclassIds: [...value.allowedSubclassIds],
    startingEvasion: value.startingEvasion,
    startingStressSlots: value.startingStressSlots,
    startingDamageDie: value.startingDamageDie,
    startingRangeBand: value.startingRangeBand,
    levelUpOptions: value.levelUpOptions.map((option) => ({ ...option })),
  };
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function coerceNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function coerceBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function coerceRecordInt(value: unknown, fallback: Record<string, number>) {
  if (!value || typeof value !== "object") return fallback;

  const next: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!key.trim()) continue;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) continue;
    next[key] = Math.max(0, Math.round(parsed));
  }

  return Object.keys(next).length ? next : fallback;
}

function coerceRecordString(value: unknown, fallback: Record<string, string>) {
  if (!value || typeof value !== "object") return fallback;

  const next: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!key.trim() || typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    next[key.trim()] = trimmed;
  }

  return Object.keys(next).length ? next : fallback;
}

function coerceRecordStringArray(value: unknown, fallback: Record<string, string[]>) {
  if (!value || typeof value !== "object") return fallback;

  const next: Record<string, string[]> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!key.trim() || !Array.isArray(raw)) continue;

    const normalized = raw
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);

    if (normalized.length === 0) continue;
    next[key.trim()] = Array.from(new Set(normalized));
  }

  return Object.keys(next).length ? next : fallback;
}

function coerceArray<T>(value: unknown, predicate: (item: unknown) => item is T): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(predicate);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecordStringArray(value: unknown): value is Record<string, string[]> {
  if (!isObjectLike(value)) return false;
  return Object.values(value).every((entry) => isStringArray(entry));
}

function isCustomFieldDefinition(value: unknown): value is CustomFieldDefinition {
  if (!isObjectLike(value)) return false;
  const field = value as CustomFieldDefinition;
  return (
    typeof field.id === "string" &&
    typeof field.name === "string" &&
    (field.type === "text" ||
      field.type === "number" ||
      field.type === "checkbox" ||
      field.type === "select") &&
    typeof field.required === "boolean" &&
    Number.isFinite(field.position)
  );
}

function isDomainCardTemplate(value: unknown): value is DomainCardTemplate {
  if (!isObjectLike(value)) return false;
  const template = value as DomainCardTemplate;
  return (
    typeof template.showTraitBonuses === "boolean" &&
    typeof template.showEvasion === "boolean" &&
    typeof template.showMoveAbility === "boolean" &&
    typeof template.showFragile === "boolean" &&
    typeof template.showFeature === "boolean" &&
    Array.isArray(template.customSections)
  );
}

function isVisibilitySurface(value: unknown): value is VisibilitySurface {
  if (!isObjectLike(value)) return false;
  const surface = value as VisibilitySurface;
  return (
    typeof surface.builder === "boolean" &&
    typeof surface.sheet === "boolean" &&
    typeof surface.editor === "boolean" &&
    typeof surface.pdf === "boolean" &&
    typeof surface.share === "boolean"
  );
}

function isResourceDefinition(value: unknown): value is ResourceDefinition {
  if (!isObjectLike(value)) return false;
  const resource = value as ResourceDefinition;
  return (
    typeof resource.id === "string" &&
    typeof resource.label === "string" &&
    Number.isFinite(resource.defaultCurrent) &&
    Number.isFinite(resource.defaultMax) &&
    Number.isFinite(resource.min) &&
    Number.isFinite(resource.max) &&
    (resource.format === "current_max" ||
      resource.format === "single" ||
      resource.format === "checkbox") &&
    typeof resource.playerEditable === "boolean" &&
    typeof resource.allowPermanentShift === "boolean" &&
    typeof resource.allowTemporaryModifiers === "boolean" &&
    isVisibilitySurface(resource.visibleOn)
  );
}

function isCurrencyDenomination(value: unknown): value is CurrencyDenomination {
  if (!isObjectLike(value)) return false;
  const denomination = value as CurrencyDenomination;
  return (
    typeof denomination.id === "string" &&
    typeof denomination.label === "string" &&
    typeof denomination.abbreviation === "string" &&
    Number.isFinite(denomination.defaultAmount) &&
    Number.isFinite(denomination.exchangeRate) &&
    Number.isFinite(denomination.sortOrder) &&
    typeof denomination.visible === "boolean" &&
    typeof denomination.allowFraction === "boolean"
  );
}

function isCurrencyConfiguration(value: unknown): value is CurrencyConfiguration {
  if (!isObjectLike(value)) return false;
  const config = value as CurrencyConfiguration;
  return (
    (config.mode === "abstract" || config.mode === "coin" || config.mode === "hybrid") &&
    Array.isArray(config.denominations) &&
    config.denominations.every((item) => isCurrencyDenomination(item)) &&
    typeof config.debtEnabled === "boolean" &&
    typeof config.debtLabel === "string" &&
    typeof config.autoConvert === "boolean" &&
    typeof config.showTotals === "boolean" &&
    typeof config.showBreakdown === "boolean"
  );
}

function isLabelOverrides(value: unknown): value is LabelOverrides {
  if (!isObjectLike(value)) return false;
  const labels = value as LabelOverrides;
  return (
    isObjectLike(labels.resources) &&
    isObjectLike(labels.sections) &&
    isObjectLike(labels.helperText)
  );
}

function isLayoutSectionConfiguration(value: unknown): value is LayoutSectionConfiguration {
  if (!isObjectLike(value)) return false;
  const section = value as LayoutSectionConfiguration;
  return (
    typeof section.id === "string" &&
    typeof section.label === "string" &&
    typeof section.visible === "boolean" &&
    Number.isFinite(section.order) &&
    typeof section.description === "string" &&
    typeof section.showOnShare === "boolean" &&
    typeof section.showOnPdf === "boolean" &&
    typeof section.collapseWhenEmpty === "boolean"
  );
}

function isLayoutConfiguration(value: unknown): value is LayoutConfiguration {
  if (!isObjectLike(value)) return false;
  const layout = value as LayoutConfiguration;
  return (
    (layout.mode === "compact" || layout.mode === "standard" || layout.mode === "print") &&
    Array.isArray(layout.sections) &&
    layout.sections.every((section) => isLayoutSectionConfiguration(section)) &&
    typeof layout.touchAlwaysExpandDetails === "boolean"
  );
}

function isSkillDefinition(value: unknown): value is SkillDefinition {
  if (!isObjectLike(value)) return false;
  const skill = value as SkillDefinition;
  return (
    typeof skill.id === "string" &&
    typeof skill.label === "string" &&
    isStringArray(skill.traits) &&
    typeof skill.helperText === "string"
  );
}

function isCharacterRuleConfiguration(value: unknown): value is CharacterRuleConfiguration {
  if (!isObjectLike(value)) return false;
  const rules = value as Partial<CharacterRuleConfiguration>;
  return (
    isStringArray(rules.requiredFields) &&
    isStringArray(rules.classAllowlist) &&
    isStringArray(rules.ancestryAllowlist) &&
    isStringArray(rules.communityAllowlist) &&
    isObjectLike(rules.startingEquipmentByClass) &&
    (rules.levelUpPointsPerLevel === undefined ||
      Number.isFinite(rules.levelUpPointsPerLevel)) &&
    (rules.proficiencyAdvancementCost === undefined ||
      Number.isFinite(rules.proficiencyAdvancementCost)) &&
    (rules.multiclassMinLevel === undefined ||
      Number.isFinite(rules.multiclassMinLevel)) &&
    (rules.allowMulticlass === undefined || typeof rules.allowMulticlass === "boolean") &&
    (rules.disableClassDomainGating === undefined ||
      typeof rules.disableClassDomainGating === "boolean") &&
    (rules.expandedDomainsByClass === undefined ||
      isRecordStringArray(rules.expandedDomainsByClass))
  );
}

function isConditionDefinition(value: unknown): value is ConditionDefinition {
  if (!isObjectLike(value)) return false;
  const condition = value as ConditionDefinition;
  return (
    typeof condition.id === "string" &&
    typeof condition.name === "string" &&
    typeof condition.description === "string" &&
    typeof condition.playerToggle === "boolean" &&
    typeof condition.visibleToPlayers === "boolean"
  );
}

function isImportExportConfiguration(value: unknown): value is ImportExportConfiguration {
  if (!isObjectLike(value)) return false;
  const config = value as ImportExportConfiguration;
  return (
    typeof config.applyLabelsToShare === "boolean" &&
    typeof config.applyLabelsToPdf === "boolean" &&
    typeof config.includeRulesInJson === "boolean" &&
    typeof config.allowCopyFromCampaign === "boolean"
  );
}

function isHomebrewEntityDefinition(value: unknown): value is HomebrewEntityDefinition {
  if (!isObjectLike(value)) return false;
  const item = value as HomebrewEntityDefinition;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.description === "string" &&
    Array.isArray(item.tags) &&
    item.tags.every((tag) => typeof tag === "string") &&
    typeof item.isOfficial === "boolean"
  );
}

function isDomainCardDefinition(value: unknown): value is DomainCardDefinition {
  if (!isObjectLike(value)) return false;
  const card = value as DomainCardDefinition;
  return (
    typeof card.id === "string" &&
    typeof card.name === "string" &&
    typeof card.class === "string" &&
    Number.isFinite(card.tier) &&
    typeof card.featureText === "string" &&
    typeof card.fragileText === "string" &&
    typeof card.moveAbility === "string" &&
    typeof card.description === "string"
  );
}

function isWeaponDefinition(value: unknown): value is WeaponDefinition {
  if (!isObjectLike(value)) return false;
  const weapon = value as WeaponDefinition;
  return (
    typeof weapon.id === "string" &&
    typeof weapon.name === "string" &&
    typeof weapon.damageDice === "string" &&
    typeof weapon.feature === "string"
  );
}

function isArmorDefinition(value: unknown): value is ArmorDefinition {
  if (!isObjectLike(value)) return false;
  const armor = value as ArmorDefinition;
  return (
    typeof armor.id === "string" &&
    typeof armor.name === "string" &&
    Number.isFinite(armor.baseThresholds) &&
    Number.isFinite(armor.baseScore) &&
    typeof armor.feature === "string"
  );
}

export const DEFAULT_CHARACTER_SHEET_CUSTOMIZATION: CharacterSheetCustomization = {
  baseHp: 12,
  baseStress: 6,
  baseHope: 2,
  maxDomainCards: 5,
  experiencesPerLevel: {
    "1": 1,
    "3": 1,
    "5": 1,
    "8": 1,
    "10": 1,
  },
  startingEquipmentByClass: {},
  resources: defaultResourceDefinitions(12, 6, 2),
  currency: cloneCurrency(DEFAULT_CURRENCY),
  labels: cloneLabels(DEFAULT_LABELS),
  layout: cloneLayout(DEFAULT_LAYOUT),
  skills: [],
  characterRules: cloneCharacterRules(DEFAULT_CHARACTER_RULES),
  conditions: [],
  displaySettings: {
    showGold: true,
    showInventory: true,
    showConnections: true,
    customFields: [],
  },
  domainCardTemplate: null,
  importExport: cloneImportExport(DEFAULT_IMPORT_EXPORT),
  craftingRules: cloneCraftingRules(DEFAULT_CRAFTING_RULES),
  druidFormRules: cloneDruidFormRules(DEFAULT_DRUID_FORM_RULES),
  companionRules: cloneCompanionRules(DEFAULT_COMPANION_RULES),
};

export function resolveCharacterSheetCustomization(metadata?: CampaignMetadata): CharacterSheetCustomization {
  const settings = metadata?.settings;

  const baseHp = Math.max(1, Math.round(coerceNumber(settings?.baseHp, DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.baseHp)));
  const baseStress = Math.max(
    0,
    Math.round(coerceNumber(settings?.baseStress, DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.baseStress))
  );
  const baseHope = Math.max(
    0,
    Math.round(coerceNumber(settings?.baseHope, DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.baseHope))
  );

  const maxDomainCards = Math.max(
    1,
    Math.round(coerceNumber(settings?.maxDomainCards, DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.maxDomainCards))
  );

  const experiencesPerLevel = coerceRecordInt(
    settings?.experiencesPerLevel,
    DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.experiencesPerLevel
  );

  const legacyStartingEquipmentByClass = coerceRecordString(
    settings?.startingEquipmentByClass,
    DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.startingEquipmentByClass
  );

  const parsedResources = coerceArray(settings?.resources, isResourceDefinition);
  const resources = parsedResources.length
    ? parsedResources.map((resource) => cloneResource(resource))
    : defaultResourceDefinitions(baseHp, baseStress, baseHope);

  const parsedCurrency = isCurrencyConfiguration(settings?.currency)
    ? settings?.currency
    : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.currency;
  const currency = cloneCurrency(parsedCurrency);

  const parsedLabels = isLabelOverrides(settings?.labels)
    ? settings?.labels
    : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.labels;
  const labels = cloneLabels(parsedLabels);

  const parsedLayout = isLayoutConfiguration(settings?.layout)
    ? settings?.layout
    : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.layout;
  const layout = cloneLayout(parsedLayout);

  const skills = cloneSkills(coerceArray(settings?.skills, isSkillDefinition));

  const parsedCharacterRules = isCharacterRuleConfiguration(settings?.characterRules)
    ? settings?.characterRules
    : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.characterRules;
  const expandedDomainsByClass = coerceRecordStringArray(
    settings?.characterRules?.expandedDomainsByClass,
    DEFAULT_CHARACTER_RULES.expandedDomainsByClass
  );
  const characterRules = cloneCharacterRules({
    ...DEFAULT_CHARACTER_RULES,
    requiredFields: [...parsedCharacterRules.requiredFields],
    classAllowlist: [...parsedCharacterRules.classAllowlist],
    ancestryAllowlist: [...parsedCharacterRules.ancestryAllowlist],
    communityAllowlist: [...parsedCharacterRules.communityAllowlist],
    disableClassDomainGating: coerceBoolean(
      settings?.characterRules?.disableClassDomainGating,
      DEFAULT_CHARACTER_RULES.disableClassDomainGating
    ),
    expandedDomainsByClass,
    startingEquipmentByClass: { ...parsedCharacterRules.startingEquipmentByClass },
    levelUpPointsPerLevel: Math.max(
      1,
      Math.round(
        coerceNumber(
          settings?.characterRules?.levelUpPointsPerLevel,
          DEFAULT_CHARACTER_RULES.levelUpPointsPerLevel
        )
      )
    ),
    proficiencyAdvancementCost: Math.max(
      1,
      Math.round(
        coerceNumber(
          settings?.characterRules?.proficiencyAdvancementCost,
          DEFAULT_CHARACTER_RULES.proficiencyAdvancementCost
        )
      )
    ),
    multiclassMinLevel: Math.max(
      1,
      Math.min(
        10,
        Math.round(
          coerceNumber(
            settings?.characterRules?.multiclassMinLevel,
            DEFAULT_CHARACTER_RULES.multiclassMinLevel
          )
        )
      )
    ),
    allowMulticlass: coerceBoolean(
      settings?.characterRules?.allowMulticlass,
      DEFAULT_CHARACTER_RULES.allowMulticlass
    ),
  });

  const normalizedStartingEquipment = Object.keys(legacyStartingEquipmentByClass).length
    ? legacyStartingEquipmentByClass
    : characterRules.startingEquipmentByClass;

  characterRules.startingEquipmentByClass = { ...normalizedStartingEquipment };

  const conditions = cloneConditions(coerceArray(settings?.conditions, isConditionDefinition));

  const displaySettings = {
    showGold: coerceBoolean(
      settings?.displaySettings?.showGold,
      DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.displaySettings.showGold
    ),
    showInventory: coerceBoolean(
      settings?.displaySettings?.showInventory,
      DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.displaySettings.showInventory
    ),
    showConnections: coerceBoolean(
      settings?.displaySettings?.showConnections,
      DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.displaySettings.showConnections
    ),
    customFields: coerceArray(settings?.displaySettings?.customFields, isCustomFieldDefinition),
  };

  const importExport = cloneImportExport(
    isImportExportConfiguration(settings?.importExport)
      ? settings?.importExport
      : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.importExport
  );

  const craftingRules = cloneCraftingRules(
    isCraftingRulesConfiguration(settings?.craftingRules)
      ? settings.craftingRules
      : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.craftingRules
  );

  const druidFormRules = cloneDruidFormRules(
    isDruidFormRulesConfiguration(settings?.druidFormRules)
      ? {
          ...settings.druidFormRules,
          customForms: settings.druidFormRules.customForms.filter((form) =>
            isDruidFormDefinition(form)
          ),
        }
      : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.druidFormRules
  );

  const companionRules = cloneCompanionRules(
    isCompanionRulesConfiguration(settings?.companionRules)
      ? settings.companionRules
      : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.companionRules
  );

  return {
    baseHp,
    baseStress,
    baseHope,
    maxDomainCards,
    experiencesPerLevel,
    startingEquipmentByClass: { ...normalizedStartingEquipment },
    resources,
    currency,
    labels,
    layout,
    skills,
    characterRules,
    conditions,
    displaySettings,
    domainCardTemplate: isDomainCardTemplate(settings?.domainCardTemplate)
      ? settings?.domainCardTemplate
      : DEFAULT_CHARACTER_SHEET_CUSTOMIZATION.domainCardTemplate,
    importExport,
    craftingRules,
    druidFormRules,
    companionRules,
  };
}

export function resolveCampaignHomebrew(metadata?: CampaignMetadata): CampaignHomebrewCollections {
  return {
    classes: coerceArray(metadata?.homebrew?.classes, isHomebrewEntityDefinition),
    subclasses: coerceArray(metadata?.homebrew?.subclasses, isHomebrewEntityDefinition),
    ancestries: coerceArray(metadata?.homebrew?.ancestries, isHomebrewEntityDefinition),
    communities: coerceArray(metadata?.homebrew?.communities, isHomebrewEntityDefinition),
    domainCards: coerceArray(metadata?.homebrew?.domainCards, isDomainCardDefinition),
    weapons: coerceArray(metadata?.homebrew?.weapons, isWeaponDefinition),
    armor: coerceArray(metadata?.homebrew?.armor, isArmorDefinition),
    items: coerceArray(metadata?.homebrew?.items, isHomebrewEntityDefinition),
    conditions: coerceArray(metadata?.homebrew?.conditions, isConditionDefinition),
    skills: coerceArray(metadata?.homebrew?.skills, isSkillDefinition),
    resourceTemplates: coerceArray(metadata?.homebrew?.resourceTemplates, isResourceDefinition),
  };
}

export function normalizeCampaignMetadata(metadata?: CampaignMetadata): CampaignMetadata {
  const resolvedSettings = resolveCharacterSheetCustomization(metadata);
  const resolvedHomebrew = resolveCampaignHomebrew(metadata);

  return {
    settings: resolvedSettings,
    homebrew: resolvedHomebrew,
  };
}

function hasNonDefaultSettings(settings: CharacterSheetCustomization) {
  const defaults = DEFAULT_CHARACTER_SHEET_CUSTOMIZATION;
  return (
    settings.baseHp !== defaults.baseHp ||
    settings.baseStress !== defaults.baseStress ||
    settings.baseHope !== defaults.baseHope ||
    settings.maxDomainCards !== defaults.maxDomainCards ||
    JSON.stringify(settings.experiencesPerLevel) !== JSON.stringify(defaults.experiencesPerLevel) ||
    JSON.stringify(settings.startingEquipmentByClass) !==
      JSON.stringify(defaults.startingEquipmentByClass) ||
    JSON.stringify(settings.resources) !== JSON.stringify(defaults.resources) ||
    JSON.stringify(settings.currency) !== JSON.stringify(defaults.currency) ||
    JSON.stringify(settings.labels) !== JSON.stringify(defaults.labels) ||
    JSON.stringify(settings.layout) !== JSON.stringify(defaults.layout) ||
    JSON.stringify(settings.skills) !== JSON.stringify(defaults.skills) ||
    JSON.stringify(settings.characterRules) !== JSON.stringify(defaults.characterRules) ||
    JSON.stringify(settings.conditions) !== JSON.stringify(defaults.conditions) ||
    JSON.stringify(settings.importExport) !== JSON.stringify(defaults.importExport) ||
    JSON.stringify(settings.craftingRules) !== JSON.stringify(defaults.craftingRules) ||
    JSON.stringify(settings.druidFormRules) !== JSON.stringify(defaults.druidFormRules) ||
    JSON.stringify(settings.companionRules) !== JSON.stringify(defaults.companionRules) ||
    settings.displaySettings.showGold !== defaults.displaySettings.showGold ||
    settings.displaySettings.showInventory !== defaults.displaySettings.showInventory ||
    settings.displaySettings.showConnections !== defaults.displaySettings.showConnections ||
    settings.displaySettings.customFields.length > 0 ||
    Boolean(settings.domainCardTemplate)
  );
}

function hasHomebrewContent(homebrew: CampaignHomebrewCollections) {
  return (
    homebrew.classes.length > 0 ||
    homebrew.subclasses.length > 0 ||
    homebrew.ancestries.length > 0 ||
    homebrew.communities.length > 0 ||
    homebrew.domainCards.length > 0 ||
    homebrew.weapons.length > 0 ||
    homebrew.armor.length > 0 ||
    homebrew.items.length > 0 ||
    homebrew.conditions.length > 0 ||
    homebrew.skills.length > 0 ||
    homebrew.resourceTemplates.length > 0
  );
}

export function parseCampaignDescription(rawDescription: unknown): {
  notes: string;
  metadata: CampaignMetadata;
} {
  if (typeof rawDescription !== "string" || rawDescription.trim() === "") {
    return { notes: "", metadata: {} };
  }

  const trimmed = rawDescription.trim();
  if (!trimmed.startsWith(META_PREFIX)) {
    return {
      notes: rawDescription,
      metadata: {},
    };
  }

  const payloadText = trimmed.slice(META_PREFIX.length).trim();
  if (!payloadText) {
    return { notes: "", metadata: {} };
  }

  try {
    const parsed = JSON.parse(payloadText) as {
      version?: number;
      notes?: unknown;
      metadata?: CampaignMetadata;
    };

    if (parsed.version !== META_VERSION || !parsed.metadata) {
      return { notes: "", metadata: {} };
    }

    return {
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      metadata: normalizeCampaignMetadata(parsed.metadata),
    };
  } catch {
    return {
      notes: rawDescription,
      metadata: {},
    };
  }
}

export function serializeCampaignDescription(notes: string, metadata?: CampaignMetadata) {
  const normalizedMetadata = normalizeCampaignMetadata(metadata);
  const normalizedNotes = notes.trim();

  const settings = resolveCharacterSheetCustomization(normalizedMetadata);
  const homebrew = resolveCampaignHomebrew(normalizedMetadata);
  if (!hasNonDefaultSettings(settings) && !hasHomebrewContent(homebrew)) {
    return normalizedNotes || null;
  }

  return `${META_PREFIX}${JSON.stringify({
    version: META_VERSION,
    notes: normalizedNotes,
    metadata: normalizedMetadata,
  })}`;
}

export function createBuilderEntityId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function upsertById<T extends { id: string }>(items: T[], next: T) {
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return [...items, next];
  }

  return items.map((item) => (item.id === next.id ? next : item));
}

export function removeById<T extends { id: string }>(items: T[], id: string) {
  return items.filter((item) => item.id !== id);
}
