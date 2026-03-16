"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CLASS_DEFINITIONS, TRAIT_KEYS } from "@/lib/constants/classes";
import {
  CLASS_DOMAIN_BASELINE,
  SRD_DOMAIN_KEYS,
  formatDomainLabel,
  normalizeDomainKey,
} from "@/lib/constants/domains";
import { ANCESTRY_CARDS, COMMUNITY_CARDS } from "@/lib/constants/identityCards";
import type {
  CharacterRuleConfiguration,
  ConditionDefinition,
  CurrencyConfiguration,
  ImportExportConfiguration,
  LabelOverrides,
  LayoutConfiguration,
  ResourceDefinition,
  SkillDefinition,
} from "@/lib/campaign-metadata";
import type { HomebrewResourceTemplateRecord } from "@/lib/homebrew-library";
import {
  formTierForLevel,
  OFFICIAL_DRUID_FORMS,
  resolveDruidForms,
  type CompanionRulesConfiguration,
  type CraftingRulesConfiguration,
  type CraftingRecipeDefinition,
  type DruidFormRulesConfiguration,
} from "@/lib/optional-systems";

export type SettingsModule =
  | "overview"
  | "resources"
  | "currency"
  | "labels"
  | "layout"
  | "skills"
  | "characterRules"
  | "crafting"
  | "druidForms"
  | "companion"
  | "conditions"
  | "exportSharing";

export type CampaignSettingsForm = {
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
  importExport: ImportExportConfiguration;
  craftingRules: CraftingRulesConfiguration;
  druidFormRules: DruidFormRulesConfiguration;
  companionRules: CompanionRulesConfiguration;
  showGold: boolean;
  showInventory: boolean;
  showConnections: boolean;
  customFields: Array<{
    id: string;
    name: string;
    type: "text" | "number" | "checkbox" | "select";
    required: boolean;
    position: number;
  }>;
};

export type RuleEntityOption = {
  id: string;
  name: string;
  isOfficial: boolean;
};

type CraftingTargetOption = {
  id: string;
  name: string;
  kind: "weapon" | "armor" | "item" | "consumable";
  scope: string;
};

const DEFAULT_CLASS_OPTIONS: RuleEntityOption[] = CLASS_DEFINITIONS.map((item) => ({
  id: item.id,
  name: item.label,
  isOfficial: true,
}));

const DEFAULT_ANCESTRY_OPTIONS: RuleEntityOption[] = ANCESTRY_CARDS.map((item) => ({
  id: item.id,
  name: item.label,
  isOfficial: true,
}));

const DEFAULT_COMMUNITY_OPTIONS: RuleEntityOption[] = COMMUNITY_CARDS.map((item) => ({
  id: item.id,
  name: item.label,
  isOfficial: true,
}));

const REQUIRED_FIELD_OPTIONS = [
  { id: "name", label: "Character Name" },
  { id: "class", label: "Class" },
  { id: "subclass", label: "Subclass" },
  { id: "heritage", label: "Ancestry + Community" },
  { id: "pronouns", label: "Pronouns" },
  { id: "background", label: "Background Questions" },
];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeUniqueId(baseId: string, existingIds: string[], fallbackPrefix = "resource") {
  const normalizedBase = slugify(baseId) || fallbackPrefix;
  const used = new Set(existingIds.map((id) => id.toLowerCase()));
  let candidate = normalizedBase;
  let suffix = 2;

  while (used.has(candidate.toLowerCase())) {
    candidate = `${normalizedBase}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function numericInput(value: string, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function decimalInput(value: string, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function isDomainExpandedForClass(
  rules: CharacterRuleConfiguration,
  classId: string,
  domainKey: string
) {
  const normalized = normalizeDomainKey(domainKey);
  return (rules.expandedDomainsByClass[classId] ?? [])
    .map((domain) => normalizeDomainKey(domain))
    .includes(normalized);
}

function sortedExperienceEntries(experiencesPerLevel: Record<string, number>) {
  return Object.entries(experiencesPerLevel)
    .map(([level, value]) => [level, value] as const)
    .sort((a, b) => Number(a[0]) - Number(b[0]));
}

function sortRuleOptions(options: RuleEntityOption[]) {
  return [...options].sort((left, right) => left.name.localeCompare(right.name));
}

function mergeRuleOptions(
  baseOptions: RuleEntityOption[],
  extraIds: string[]
) {
  const byId = new Map<string, RuleEntityOption>();
  for (const option of baseOptions) {
    byId.set(option.id, option);
  }

  for (const rawId of extraIds) {
    const id = rawId.trim();
    if (!id || byId.has(id)) continue;
    byId.set(id, {
      id,
      name: `${id} (custom)`,
      isOfficial: false,
    });
  }

  return sortRuleOptions(Array.from(byId.values()));
}

function ModuleTitle({ module }: { module: SettingsModule }) {
  const title = {
    overview: "Overview",
    resources: "Resource Rules Console",
    currency: "Currency Rules Console",
    labels: "Labels And Terminology Console",
    layout: "Sheet Layout And Visibility Console",
    skills: "Traits, Skills, And Check Rules Console",
    characterRules: "Character Creation Rules Console",
    crafting: "Crafting And Professions Console",
    druidForms: "Druid Beastform Console",
    companion: "Hunter Companion Console",
    conditions: "Conditions And Temporary Effects Console",
    exportSharing: "Export, Share, And Import Controls",
  }[module];

  return <h3 className="text-lg text-amber-200">{title}</h3>;
}

type ModuleGuide = {
  summary: string;
  capabilities: string[];
  tableAdvice: string;
  setupOrder: string[];
};

const MODULE_GUIDES: Record<SettingsModule, ModuleGuide> = {
  overview: {
    summary:
      "Use this tab as your campaign rules audit. It shows how much you have customized and what major systems are active.",
    capabilities: [
      "Summarizes resource, currency, skill, and condition complexity at a glance.",
      "Highlights high-impact settings like domain caps and required creation fields.",
      "Gives you a fast pre-session check before players build or level characters.",
    ],
    tableAdvice:
      "Revisit Overview before session zero and again after big rules changes so player-facing expectations stay aligned with the configured system.",
    setupOrder: [
      "Confirm your campaign identity and intended complexity level.",
      "Check counts and spot modules that still need setup.",
      "Open each rules tab in order and save after major edits.",
    ],
  },
  resources: {
    summary:
      "Resources define the moment-to-moment trackers on sheets (HP, Stress, Hope, Experience, and any custom pools).",
    capabilities: [
      "Controls default values, ranges, format (current/max, single, checkbox), and edit permissions.",
      "Sets where each tracker appears (builder, sheet, editor, PDF, share views).",
      "Supports importing reusable resource templates to speed campaign setup.",
    ],
    tableAdvice:
      "Only add a new resource if players will reference it frequently during play. Extra trackers increase cognitive load and slow turns.",
    setupOrder: [
      "Keep core resources clean and stable first.",
      "Add only campaign-specific resources that matter every session.",
      "Set visibility and player edit permissions before launch.",
    ],
  },
  currency: {
    summary:
      "Currency rules control wealth tracking style and denomination behavior across character sheets and exports.",
    capabilities: [
      "Supports abstract, coin-based, and hybrid currency models.",
      "Configures denominations, exchange rates, debt, conversion behavior, and display preferences.",
      "Lets you tune economy readability without changing sheet code.",
    ],
    tableAdvice:
      "Pick one economy style and keep it consistent for at least a story arc so players can plan purchases and crafting with confidence.",
    setupOrder: [
      "Choose currency mode that matches campaign tone.",
      "Define denominations and exchange logic.",
      "Set debt/visibility rules and test with one sample character.",
    ],
  },
  labels: {
    summary:
      "Labels and terminology let you localize wording and adapt language to your setting without changing mechanics.",
    capabilities: [
      "Overrides names for resources, sections, and helper text across sheet surfaces.",
      "Keeps your homebrew vocabulary consistent in UI, share links, and exports.",
      "Supports table-specific language conventions for accessibility and immersion.",
    ],
    tableAdvice:
      "Avoid frequent terminology changes mid-campaign. Stable labels help players build shared mental models and reduce confusion.",
    setupOrder: [
      "Rename only the terms your players see often.",
      "Review section labels for consistency with your lore.",
      "Check a character sheet preview before saving final wording.",
    ],
  },
  layout: {
    summary:
      "Layout controls where information appears and what is visible on sheet, share, and PDF surfaces.",
    capabilities: [
      "Reorders sections and toggles visibility per section.",
      "Controls share/PDF inclusion and collapse behavior when data is empty.",
      "Supports compact, standard, and print-first presentation styles.",
    ],
    tableAdvice:
      "Put combat-critical information near the top and narrative/reference information lower. This keeps turns fast and still supports deep roleplay.",
    setupOrder: [
      "Arrange section order by in-session usage frequency.",
      "Hide low-value sections from share/PDF if needed.",
      "Validate desktop and mobile readability after changes.",
    ],
  },
  skills: {
    summary:
      "Skills define optional check vocabulary and trait mapping to support campaign-specific action language.",
    capabilities: [
      "Creates and edits skill entries with linked trait tags and helper text.",
      "Allows custom skill libraries beyond default class/trait assumptions.",
      "Feeds consistent guidance into character-facing check references.",
    ],
    tableAdvice:
      "Prefer fewer, clearer skills with strong trait identity. Overly granular skill lists can cause debate and slow adjudication.",
    setupOrder: [
      "Define your core skill list first.",
      "Map each skill to likely traits and add concise helper text.",
      "Remove or merge overlapping skills before players begin.",
    ],
  },
  characterRules: {
    summary:
      "Character rules define what players can choose in creation and how advancement options are budgeted.",
    capabilities: [
      "Sets required fields, class/ancestry/community allowlists, and domain gating behavior.",
      "Controls starting equipment defaults and leveling point economics.",
      "Supports multiclass constraints and campaign-specific build restrictions.",
    ],
    tableAdvice:
      "If you tighten class or ancestry access, explain your campaign fiction reason early so restrictions feel intentional, not arbitrary.",
    setupOrder: [
      "Finalize player options and required fields first.",
      "Tune leveling costs and multiclass policy to desired power curve.",
      "Set class domain/equipment defaults and communicate them pre-session.",
    ],
  },
  crafting: {
    summary:
      "Crafting adds profession progression, gatherable resources, and recipe-driven item creation to character runtime.",
    capabilities: [
      "Enables crafting tools on character sheets with live resource tracking.",
      "Supports profession definitions, material ledgers, and gold/material recipe costs.",
      "Unlocks crafting-related level-up options when active.",
    ],
    tableAdvice:
      "Decide gather cadence and rarity expectations up front so crafting feels rewarding without overshadowing loot and quest rewards.",
    setupOrder: [
      "Enable crafting and set gather/profession limits.",
      "Define professions and material types your world supports.",
      "Publish recipes and align access with campaign progression.",
    ],
  },
  druidForms: {
    summary:
      "Druid Beastform rules manage form availability, class access, and per-form tuning at campaign scope.",
    capabilities: [
      "Controls whether forms are enabled and who can access them.",
      "Lets you disable official forms and configure custom form entries.",
      "Respects level-based tier access and runtime form selection.",
    ],
    tableAdvice:
      "When homebrewing forms, keep offense/defense tradeoffs clear so each form has a role instead of one universally best option.",
    setupOrder: [
      "Set access policy (druid-only or broader).",
      "Curate allowed forms and disable out-of-scope options.",
      "Playtest one combat with sample forms before campaign lock-in.",
    ],
  },
  companion: {
    summary:
      "Companion settings control Beastbound/Hunter companion runtime behavior and progression options.",
    capabilities: [
      "Defines companion access rules and baseline combat stats.",
      "Configures level-up option vocabulary for companion growth.",
      "Supports campaign-specific companion identity and upgrade pacing.",
    ],
    tableAdvice:
      "Keep companion complexity proportional to group size. In larger parties, simpler companion options keep spotlight and turn flow balanced.",
    setupOrder: [
      "Set which classes/subclasses can use companions.",
      "Tune baseline companion stats to your campaign threat level.",
      "Curate a small, meaningful upgrade list for clear choices.",
    ],
  },
  conditions: {
    summary:
      "Conditions provide reusable status/effect tracking with explicit player visibility and toggle permissions.",
    capabilities: [
      "Defines condition names, descriptions, and who can toggle them.",
      "Controls whether each condition is shown to players.",
      "Keeps combat and narrative status effects standardized across sheets.",
    ],
    tableAdvice:
      "Write condition text as short, actionable effect language. Players should be able to resolve a condition in seconds without rules lookup.",
    setupOrder: [
      "Create your core condition list with clear wording.",
      "Set player visibility and toggle authority per condition.",
      "Remove redundant or overlapping conditions before go-live.",
    ],
  },
  exportSharing: {
    summary:
      "Export and sharing settings define how campaign labels/rules appear in JSON, PDF, and share surfaces.",
    capabilities: [
      "Controls label application across export/share formats.",
      "Toggles rule inclusion in JSON payloads and campaign copy behaviors.",
      "Helps maintain consistent presentation for player handouts and backups.",
    ],
    tableAdvice:
      "Run one full export test before each major arc so your archival and handout format still matches active campaign rules.",
    setupOrder: [
      "Choose how much rules context should travel with exports.",
      "Verify share/PDF output readability with one sample character.",
      "Lock settings once the campaign begins to avoid format drift.",
    ],
  },
};

function ModuleSupportGuide({ module }: { module: SettingsModule }) {
  const guide = MODULE_GUIDES[module];
  if (!guide) return null;

  return (
    <article className="rounded-lg border border-amber-700/35 bg-amber-950/20 p-3">
      <h4 className="text-sm text-amber-100">Guided Setup Support</h4>
      <p className="mt-1 text-xs text-slate-300">{guide.summary}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-slate-700/50 bg-slate-900/65 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-amber-200">Capabilities Live Now</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-300">
            {guide.capabilities.map((item) => (
              <li key={`${module}-capability-${item}`}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border border-slate-700/50 bg-slate-900/65 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-amber-200">Table Advice</p>
          <p className="mt-1 text-xs text-slate-300">{guide.tableAdvice}</p>
        </div>
        <div className="rounded-md border border-slate-700/50 bg-slate-900/65 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-amber-200">Suggested Flow</p>
          <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs text-slate-300">
            {guide.setupOrder.map((item) => (
              <li key={`${module}-step-${item}`}>{item}</li>
            ))}
          </ol>
        </div>
      </div>
    </article>
  );
}

export function CharacterSheetCustomization({
  value,
  onSave,
  saving,
  module,
  campaignId,
  classOptions,
  ancestryOptions,
  communityOptions,
  resourceTemplateOptions,
}: {
  value: CampaignSettingsForm;
  onSave: (next: CampaignSettingsForm) => Promise<void> | void;
  saving: boolean;
  module: SettingsModule;
  campaignId: number;
  classOptions: RuleEntityOption[];
  ancestryOptions: RuleEntityOption[];
  communityOptions: RuleEntityOption[];
  resourceTemplateOptions: HomebrewResourceTemplateRecord[];
}) {
  const [form, setForm] = useState<CampaignSettingsForm>(value);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [craftingTargetOptions, setCraftingTargetOptions] = useState<CraftingTargetOption[]>([]);
  const [loadingCraftingTargets, setLoadingCraftingTargets] = useState(false);

  const experienceRows = useMemo(
    () => sortedExperienceEntries(form.experiencesPerLevel),
    [form.experiencesPerLevel]
  );

  const classRuleOptions = useMemo(() => {
    const provided = classOptions.length ? classOptions : DEFAULT_CLASS_OPTIONS;
    const unknownIds = [
      ...form.characterRules.classAllowlist,
      ...Object.keys(form.characterRules.expandedDomainsByClass),
      ...Object.keys(form.characterRules.startingEquipmentByClass),
      ...Object.keys(form.startingEquipmentByClass),
    ];
    return mergeRuleOptions(provided, unknownIds);
  }, [
    classOptions,
    form.characterRules.classAllowlist,
    form.characterRules.expandedDomainsByClass,
    form.characterRules.startingEquipmentByClass,
    form.startingEquipmentByClass,
  ]);

  const ancestryRuleOptions = useMemo(() => {
    const provided = ancestryOptions.length ? ancestryOptions : DEFAULT_ANCESTRY_OPTIONS;
    return mergeRuleOptions(provided, form.characterRules.ancestryAllowlist);
  }, [ancestryOptions, form.characterRules.ancestryAllowlist]);

  const communityRuleOptions = useMemo(() => {
    const provided = communityOptions.length ? communityOptions : DEFAULT_COMMUNITY_OPTIONS;
    return mergeRuleOptions(provided, form.characterRules.communityAllowlist);
  }, [communityOptions, form.characterRules.communityAllowlist]);

  useEffect(() => {
    let cancelled = false;

    async function loadCraftingTargets() {
      if (!campaignId || campaignId <= 0) {
        setCraftingTargetOptions([]);
        setLoadingCraftingTargets(false);
        return;
      }

      setLoadingCraftingTargets(true);

      const query = `scope=available&campaignId=${campaignId}`;
      const [weaponsResponse, armorResponse, itemsResponse, consumablesResponse] = await Promise.all([
        fetch(`/api/weapons?${query}`, { cache: "no-store" }),
        fetch(`/api/armor?${query}`, { cache: "no-store" }),
        fetch(`/api/items?${query}`, { cache: "no-store" }),
        fetch(`/api/consumables?${query}`, { cache: "no-store" }),
      ]);

      const [weaponsData, armorData, itemsData, consumablesData] = await Promise.all([
        weaponsResponse.json(),
        armorResponse.json(),
        itemsResponse.json(),
        consumablesResponse.json(),
      ]);

      if (cancelled) return;
      if (!weaponsResponse.ok || !armorResponse.ok || !itemsResponse.ok || !consumablesResponse.ok) {
        setLoadingCraftingTargets(false);
        return;
      }

      const nextOptions: CraftingTargetOption[] = [
        ...(Array.isArray(weaponsData) ? weaponsData : []).map((item) => ({
          id: String(item.id),
          name: typeof item.name === "string" ? item.name : String(item.id),
          kind: "weapon" as const,
          scope: typeof item.scope === "string" ? item.scope : "unknown",
        })),
        ...(Array.isArray(armorData) ? armorData : []).map((item) => ({
          id: String(item.id),
          name: typeof item.name === "string" ? item.name : String(item.id),
          kind: "armor" as const,
          scope: typeof item.scope === "string" ? item.scope : "unknown",
        })),
        ...(Array.isArray(itemsData) ? itemsData : []).map((item) => ({
          id: String(item.id),
          name: typeof item.name === "string" ? item.name : String(item.id),
          kind: "item" as const,
          scope: typeof item.scope === "string" ? item.scope : "unknown",
        })),
        ...(Array.isArray(consumablesData) ? consumablesData : []).map((item) => ({
          id: String(item.id),
          name: typeof item.name === "string" ? item.name : String(item.id),
          kind: "consumable" as const,
          scope: typeof item.scope === "string" ? item.scope : "unknown",
        })),
      ].sort((left, right) => left.name.localeCompare(right.name));

      setCraftingTargetOptions(nextOptions);
      setLoadingCraftingTargets(false);
    }

    if (module === "crafting") {
      void loadCraftingTargets();
    }

    return () => {
      cancelled = true;
    };
  }, [campaignId, module]);

  const druidFormsPreview = useMemo(
    () => resolveDruidForms(form.druidFormRules),
    [form.druidFormRules]
  );

  function updateResource(index: number, patch: Partial<ResourceDefinition>) {
    setForm((current) => {
      const resources = current.resources.map((resource, currentIndex) => {
        if (currentIndex !== index) return resource;
        return {
          ...resource,
          ...patch,
          visibleOn: {
            ...resource.visibleOn,
            ...(patch.visibleOn ?? {}),
          },
        };
      });

      const hp = resources.find((resource) => resource.id === "hp");
      const stress = resources.find((resource) => resource.id === "stress");
      const hope = resources.find((resource) => resource.id === "hope");

      return {
        ...current,
        resources,
        baseHp: hp ? hp.defaultMax : current.baseHp,
        baseStress: stress ? stress.defaultMax : current.baseStress,
        baseHope: hope ? hope.defaultMax : current.baseHope,
      };
    });
  }

  function addResource() {
    setForm((current) => ({
      ...current,
      resources: [
        ...current.resources,
        {
          id: makeUniqueId(
            `resource-${current.resources.length + 1}`,
            current.resources.map((resource) => resource.id)
          ),
          label: "New Resource",
          defaultCurrent: 0,
          defaultMax: 0,
          min: 0,
          max: 99,
          format: "current_max",
          playerEditable: true,
          allowPermanentShift: false,
          allowTemporaryModifiers: true,
          visibleOn: {
            builder: true,
            sheet: true,
            editor: true,
            pdf: true,
            share: true,
          },
        },
      ],
    }));
  }

  function importTemplateAsResource() {
    if (!selectedTemplateId) return;
    const selectedTemplate = resourceTemplateOptions.find(
      (template) => template.id === selectedTemplateId
    );
    if (!selectedTemplate) return;

    setForm((current) => {
      const resourceId = makeUniqueId(
        selectedTemplate.label || selectedTemplate.id,
        current.resources.map((resource) => resource.id)
      );
      const resourceLabel = selectedTemplate.label.trim() || "Imported Resource";

      return {
        ...current,
        resources: [
          ...current.resources,
          {
            ...selectedTemplate,
            id: resourceId,
            label: resourceLabel,
            visibleOn: { ...selectedTemplate.visibleOn },
          },
        ],
        labels: {
          ...current.labels,
          resources: {
            ...current.labels.resources,
            [resourceId]: current.labels.resources[resourceId] ?? resourceLabel,
          },
        },
      };
    });

    setSelectedTemplateId("");
  }

  function removeResource(id: string) {
    setForm((current) => ({
      ...current,
      resources: current.resources.filter((resource) => resource.id !== id),
      labels: {
        ...current.labels,
        resources: Object.fromEntries(
          Object.entries(current.labels.resources).filter(([key]) => key !== id)
        ),
      },
    }));
  }

  function updateCurrencyDenomination(
    index: number,
    patch: Partial<CurrencyConfiguration["denominations"][number]>
  ) {
    setForm((current) => ({
      ...current,
      currency: {
        ...current.currency,
        denominations: current.currency.denominations.map((denomination, currentIndex) =>
          currentIndex === index ? { ...denomination, ...patch } : denomination
        ),
      },
    }));
  }

  function addCurrencyDenomination() {
    setForm((current) => ({
      ...current,
      currency: {
        ...current.currency,
        denominations: [
          ...current.currency.denominations,
          {
            id: `denomination-${current.currency.denominations.length + 1}`,
            label: "New Denomination",
            abbreviation: "nd",
            defaultAmount: 0,
            exchangeRate: 1,
            sortOrder: current.currency.denominations.length + 1,
            visible: true,
            allowFraction: false,
          },
        ],
      },
    }));
  }

  function removeCurrencyDenomination(id: string) {
    setForm((current) => ({
      ...current,
      currency: {
        ...current.currency,
        denominations: current.currency.denominations.filter((item) => item.id !== id),
      },
    }));
  }

  function updateSkill(index: number, patch: Partial<SkillDefinition>) {
    setForm((current) => ({
      ...current,
      skills: current.skills.map((skill, currentIndex) =>
        currentIndex === index ? { ...skill, ...patch } : skill
      ),
    }));
  }

  function addSkill() {
    setForm((current) => ({
      ...current,
      skills: [
        ...current.skills,
        {
          id: `skill-${current.skills.length + 1}`,
          label: "New Skill",
          traits: ["instinct"],
          helperText: "",
        },
      ],
    }));
  }

  function removeSkill(id: string) {
    setForm((current) => ({
      ...current,
      skills: current.skills.filter((skill) => skill.id !== id),
    }));
  }

  function updateCondition(index: number, patch: Partial<ConditionDefinition>) {
    setForm((current) => ({
      ...current,
      conditions: current.conditions.map((condition, currentIndex) =>
        currentIndex === index ? { ...condition, ...patch } : condition
      ),
    }));
  }

  function addCondition() {
    setForm((current) => ({
      ...current,
      conditions: [
        ...current.conditions,
        {
          id: `condition-${current.conditions.length + 1}`,
          name: "New Condition",
          description: "",
          playerToggle: true,
          visibleToPlayers: true,
        },
      ],
    }));
  }

  function removeCondition(id: string) {
    setForm((current) => ({
      ...current,
      conditions: current.conditions.filter((condition) => condition.id !== id),
    }));
  }

  function updateExperienceLevel(oldLevel: string, nextLevel: string, valueForLevel: number) {
    setForm((current) => {
      const next: Record<string, number> = {};
      for (const [level, amount] of Object.entries(current.experiencesPerLevel)) {
        if (level !== oldLevel) {
          next[level] = amount;
        }
      }
      next[nextLevel] = valueForLevel;

      return {
        ...current,
        experiencesPerLevel: next,
      };
    });
  }

  function addExperienceLevel() {
    setForm((current) => {
      const levels = Object.keys(current.experiencesPerLevel).map((item) => Number(item));
      const maxLevel = levels.length ? Math.max(...levels) : 0;
      const nextLevel = String(Math.min(10, maxLevel + 1));
      return {
        ...current,
        experiencesPerLevel: {
          ...current.experiencesPerLevel,
          [nextLevel]: current.experiencesPerLevel[nextLevel] ?? 1,
        },
      };
    });
  }

  function removeExperienceLevel(level: string) {
    setForm((current) => ({
      ...current,
      experiencesPerLevel: Object.fromEntries(
        Object.entries(current.experiencesPerLevel).filter(([key]) => key !== level)
      ),
    }));
  }

  function setStartingEquipment(classId: string, text: string) {
    setForm((current) => ({
      ...current,
      startingEquipmentByClass: {
        ...current.startingEquipmentByClass,
        [classId]: text,
      },
      characterRules: {
        ...current.characterRules,
        startingEquipmentByClass: {
          ...current.characterRules.startingEquipmentByClass,
          [classId]: text,
        },
      },
    }));
  }

  function toggleExpandedDomain(classId: string, domainKey: string) {
    setForm((current) => {
      const normalizedDomainKey = normalizeDomainKey(domainKey);
      const currentExpanded = current.characterRules.expandedDomainsByClass[classId] ?? [];
      const nextExpanded = toggleValue(
        currentExpanded.map((domain) => normalizeDomainKey(domain)),
        normalizedDomainKey
      );
      const nextExpandedByClass = { ...current.characterRules.expandedDomainsByClass };

      if (nextExpanded.length > 0) {
        nextExpandedByClass[classId] = nextExpanded;
      } else {
        delete nextExpandedByClass[classId];
      }

      return {
        ...current,
        characterRules: {
          ...current.characterRules,
          expandedDomainsByClass: nextExpandedByClass,
        },
      };
    });
  }

  function addCraftingProfession() {
    setForm((current) => ({
      ...current,
      craftingRules: {
        ...current.craftingRules,
        professions: [
          ...current.craftingRules.professions,
          {
            id: makeUniqueId(
              `profession-${current.craftingRules.professions.length + 1}`,
              current.craftingRules.professions.map((profession) => profession.id),
              "profession"
            ),
            label: "New Profession",
            description: "",
            enabled: true,
          },
        ],
      },
    }));
  }

  function addCraftingMaterial() {
    setForm((current) => ({
      ...current,
      craftingRules: {
        ...current.craftingRules,
        materialTypes: [
          ...current.craftingRules.materialTypes,
          {
            id: makeUniqueId(
              `material-${current.craftingRules.materialTypes.length + 1}`,
              current.craftingRules.materialTypes.map((material) => material.id),
              "material"
            ),
            label: "New Material",
            description: "",
            maxStack: 999,
          },
        ],
      },
    }));
  }

  function addCraftingRecipe() {
    setForm((current) => ({
      ...current,
      craftingRules: {
        ...current.craftingRules,
        recipes: [
          ...current.craftingRules.recipes,
          {
            id: makeUniqueId(
              `recipe-${current.craftingRules.recipes.length + 1}`,
              current.craftingRules.recipes.map((recipe) => recipe.id),
              "recipe"
            ),
            name: "New Recipe",
            targetKind: "custom",
            targetId: null,
            targetName: "Custom Entry",
            resourceCosts: [],
            goldCost: 0,
            notes: "",
            enabled: true,
          },
        ],
      },
    }));
  }

  function updateCraftingRecipe(index: number, patch: Partial<CraftingRecipeDefinition>) {
    setForm((current) => ({
      ...current,
      craftingRules: {
        ...current.craftingRules,
        recipes: current.craftingRules.recipes.map((recipe, currentIndex) => {
          if (currentIndex !== index) return recipe;
          return {
            ...recipe,
            ...patch,
            resourceCosts: patch.resourceCosts
              ? [...patch.resourceCosts]
              : recipe.resourceCosts.map((cost) => ({ ...cost })),
          };
        }),
      },
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const hp = form.resources.find((resource) => resource.id === "hp");
    const stress = form.resources.find((resource) => resource.id === "stress");
    const hope = form.resources.find((resource) => resource.id === "hope");

    const normalized: CampaignSettingsForm = {
      ...form,
      baseHp: hp ? hp.defaultMax : form.baseHp,
      baseStress: stress ? stress.defaultMax : form.baseStress,
      baseHope: hope ? hope.defaultMax : form.baseHope,
      characterRules: {
        ...form.characterRules,
        startingEquipmentByClass: { ...form.characterRules.startingEquipmentByClass },
      },
      startingEquipmentByClass: { ...form.characterRules.startingEquipmentByClass },
      currency: {
        ...form.currency,
        denominations: [...form.currency.denominations].sort((a, b) => a.sortOrder - b.sortOrder),
      },
      layout: {
        ...form.layout,
        sections: [...form.layout.sections].sort((a, b) => a.order - b.order),
      },
    };

    try {
      setError(null);
      await onSave(normalized);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save settings");
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <ModuleTitle module={module} />
      <ModuleSupportGuide module={module} />

      {module === "overview" && (
        <section className="space-y-3">
          <p className="text-sm text-slate-300">
            This campaign currently exposes {form.resources.length} resources, {form.currency.denominations.length} currency denominations,{" "}
            {form.skills.length} custom skills, and {form.conditions.length} conditions.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-slate-700/50 bg-slate-900/65 px-3 py-2 text-sm text-slate-200">
              Max Domain Cards: {form.maxDomainCards}
            </div>
            <div className="rounded-md border border-slate-700/50 bg-slate-900/65 px-3 py-2 text-sm text-slate-200">
              Currency Mode: {form.currency.mode}
            </div>
            <div className="rounded-md border border-slate-700/50 bg-slate-900/65 px-3 py-2 text-sm text-slate-200">
              Layout Mode: {form.layout.mode}
            </div>
            <div className="rounded-md border border-slate-700/50 bg-slate-900/65 px-3 py-2 text-sm text-slate-200">
              Required Creation Fields: {form.characterRules.requiredFields.length}
            </div>
          </div>
        </section>
      )}

      {module === "resources" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-sm text-slate-300">Configure resource labels, defaults, caps, and player visibility.</p>
            <div className="flex flex-wrap items-end gap-2">
              {resourceTemplateOptions.length > 0 && (
                <>
                  <label className="min-w-60 text-xs text-slate-300">
                    Import Resource Template
                    <select
                      className="field mt-1"
                      value={selectedTemplateId}
                      onChange={(event) => setSelectedTemplateId(event.target.value)}
                    >
                      <option value="">Select template</option>
                      {resourceTemplateOptions.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="btn-outline min-h-11 px-3 py-2 text-xs"
                    onClick={importTemplateAsResource}
                    type="button"
                    disabled={!selectedTemplateId}
                  >
                    Import Template
                  </button>
                </>
              )}
              <button className="btn-outline min-h-11 px-3 py-2 text-xs" onClick={addResource} type="button">
                Add Custom Resource
              </button>
            </div>
          </div>

          {form.resources.map((resource, index) => {
            const isBuiltIn = ["hp", "stress", "hope", "experience"].includes(resource.id);
            return (
              <article key={resource.id} className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
                <div className="grid gap-2 lg:grid-cols-5">
                  <label className="text-xs text-slate-300">
                    Resource ID
                    <input
                      className="field mt-1"
                      value={resource.id}
                      disabled={isBuiltIn}
                      onChange={(event) =>
                        updateResource(index, {
                          id: slugify(event.target.value) || resource.id,
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    Label
                    <input
                      className="field mt-1"
                      value={resource.label}
                      onChange={(event) =>
                        updateResource(index, {
                          label: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    Default Current
                    <input
                      className="field mt-1"
                      type="number"
                      value={resource.defaultCurrent}
                      onChange={(event) =>
                        updateResource(index, {
                          defaultCurrent: numericInput(event.target.value, resource.defaultCurrent),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    Default Max
                    <input
                      className="field mt-1"
                      type="number"
                      value={resource.defaultMax}
                      onChange={(event) =>
                        updateResource(index, {
                          defaultMax: numericInput(event.target.value, resource.defaultMax),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    Format
                    <select
                      className="field mt-1"
                      value={resource.format}
                      onChange={(event) =>
                        updateResource(index, {
                          format: event.target.value as ResourceDefinition["format"],
                        })
                      }
                    >
                      <option value="current_max">Current / Max</option>
                      <option value="single">Single Value</option>
                      <option value="checkbox">Checkbox Slots</option>
                    </select>
                  </label>
                </div>

                <div className="mt-2 grid gap-2 lg:grid-cols-4">
                  <label className="text-xs text-slate-300">
                    Min
                    <input
                      className="field mt-1"
                      type="number"
                      value={resource.min}
                      onChange={(event) =>
                        updateResource(index, {
                          min: numericInput(event.target.value, resource.min),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    Max
                    <input
                      className="field mt-1"
                      type="number"
                      value={resource.max}
                      onChange={(event) =>
                        updateResource(index, {
                          max: numericInput(event.target.value, resource.max),
                        })
                      }
                    />
                  </label>
                  <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={resource.playerEditable}
                      onChange={(event) =>
                        updateResource(index, {
                          playerEditable: event.target.checked,
                        })
                      }
                    />
                    Player Editable
                  </label>
                  <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={resource.allowPermanentShift}
                      onChange={(event) =>
                        updateResource(index, {
                          allowPermanentShift: event.target.checked,
                        })
                      }
                    />
                    Permanent Slot Shift
                  </label>
                  <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300 lg:col-span-2">
                    <input
                      type="checkbox"
                      checked={resource.allowTemporaryModifiers}
                      onChange={(event) =>
                        updateResource(index, {
                          allowTemporaryModifiers: event.target.checked,
                        })
                      }
                    />
                    Temporary Modifiers Enabled
                  </label>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-5">
                  {(
                    [
                      ["builder", "Builder"],
                      ["sheet", "Sheet"],
                      ["editor", "Editor"],
                      ["pdf", "PDF"],
                      ["share", "Share"],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={`${resource.id}-${key}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={resource.visibleOn[key]}
                        onChange={(event) =>
                          updateResource(index, {
                            visibleOn: {
                              ...resource.visibleOn,
                              [key]: event.target.checked,
                            },
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>

                {!isBuiltIn && (
                  <div className="mt-2">
                    <button
                      className="rounded-md border border-red-400/45 px-2 py-2 text-xs text-red-300 hover:bg-red-950/30"
                      onClick={() => removeResource(resource.id)}
                      type="button"
                    >
                      Remove Resource
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {module === "currency" && (
        <section className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-slate-300">
              Currency Mode
              <select
                className="field mt-1"
                value={form.currency.mode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    currency: {
                      ...current.currency,
                      mode: event.target.value as CurrencyConfiguration["mode"],
                    },
                  }))
                }
              >
                <option value="abstract">Abstract</option>
                <option value="coin">Coin-Based</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
            <label className="text-xs text-slate-300">
              Debt Label
              <input
                className="field mt-1"
                value={form.currency.debtLabel}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    currency: {
                      ...current.currency,
                      debtLabel: event.target.value,
                    },
                  }))
                }
              />
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.currency.debtEnabled}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    currency: {
                      ...current.currency,
                      debtEnabled: event.target.checked,
                    },
                  }))
                }
              />
              Enable Debt
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.currency.autoConvert}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    currency: {
                      ...current.currency,
                      autoConvert: event.target.checked,
                    },
                  }))
                }
              />
              Auto Convert
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.currency.showTotals}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    currency: {
                      ...current.currency,
                      showTotals: event.target.checked,
                    },
                  }))
                }
              />
              Show Totals
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.currency.showBreakdown}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    currency: {
                      ...current.currency,
                      showBreakdown: event.target.checked,
                    },
                  }))
                }
              />
              Show Breakdown
            </label>
          </div>

          <div className="flex items-center justify-between">
            <h4 className="text-sm text-amber-100">Denominations</h4>
            <button className="btn-outline min-h-11 px-3 py-2 text-xs" onClick={addCurrencyDenomination} type="button">
              Add Denomination
            </button>
          </div>

          {form.currency.denominations.map((denomination, index) => (
            <article key={denomination.id} className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
              <div className="grid gap-2 lg:grid-cols-6">
                <label className="text-xs text-slate-300">
                  ID
                  <input
                    className="field mt-1"
                    value={denomination.id}
                    onChange={(event) =>
                      updateCurrencyDenomination(index, {
                        id: slugify(event.target.value) || denomination.id,
                      })
                    }
                  />
                </label>
                <label className="text-xs text-slate-300">
                  Label
                  <input
                    className="field mt-1"
                    value={denomination.label}
                    onChange={(event) =>
                      updateCurrencyDenomination(index, {
                        label: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="text-xs text-slate-300">
                  Abbreviation
                  <input
                    className="field mt-1"
                    value={denomination.abbreviation}
                    onChange={(event) =>
                      updateCurrencyDenomination(index, {
                        abbreviation: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="text-xs text-slate-300">
                  Default Amount
                  <input
                    className="field mt-1"
                    type="number"
                    value={denomination.defaultAmount}
                    onChange={(event) =>
                      updateCurrencyDenomination(index, {
                        defaultAmount: numericInput(event.target.value, denomination.defaultAmount),
                      })
                    }
                  />
                </label>
                <label className="text-xs text-slate-300">
                  Exchange Rate
                  <input
                    className="field mt-1"
                    type="number"
                    step="0.01"
                    min={0.01}
                    value={denomination.exchangeRate}
                    onChange={(event) =>
                      updateCurrencyDenomination(index, {
                        exchangeRate: decimalInput(event.target.value, denomination.exchangeRate),
                      })
                    }
                  />
                </label>
                <label className="text-xs text-slate-300">
                  Sort Order
                  <input
                    className="field mt-1"
                    type="number"
                    value={denomination.sortOrder}
                    onChange={(event) =>
                      updateCurrencyDenomination(index, {
                        sortOrder: numericInput(event.target.value, denomination.sortOrder),
                      })
                    }
                  />
                </label>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={denomination.visible}
                    onChange={(event) =>
                      updateCurrencyDenomination(index, {
                        visible: event.target.checked,
                      })
                    }
                  />
                  Visible
                </label>
                <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={denomination.allowFraction}
                    onChange={(event) =>
                      updateCurrencyDenomination(index, {
                        allowFraction: event.target.checked,
                      })
                    }
                  />
                  Allow Fractions
                </label>
                <button
                  className="rounded-md border border-red-400/45 px-2 py-2 text-xs text-red-300 hover:bg-red-950/30"
                  onClick={() => removeCurrencyDenomination(denomination.id)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {module === "labels" && (
        <section className="space-y-3">
          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <h4 className="mb-2 text-sm text-amber-100">Section Labels</h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(form.labels.sections).map(([key, label]) => (
                <label key={key} className="text-xs text-slate-300">
                  {key}
                  <input
                    className="field mt-1"
                    value={label}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        labels: {
                          ...current.labels,
                          sections: {
                            ...current.labels.sections,
                            [key]: event.target.value,
                          },
                        },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <h4 className="mb-2 text-sm text-amber-100">Resource Labels</h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {form.resources.map((resource) => (
                <label key={resource.id} className="text-xs text-slate-300">
                  {resource.id}
                  <input
                    className="field mt-1"
                    value={form.labels.resources[resource.id] ?? resource.label}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        labels: {
                          ...current.labels,
                          resources: {
                            ...current.labels.resources,
                            [resource.id]: event.target.value,
                          },
                        },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <h4 className="mb-2 text-sm text-amber-100">Helper Text</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(form.labels.helperText).map(([key, helper]) => (
                <label key={key} className="text-xs text-slate-300">
                  {key}
                  <textarea
                    className="field mt-1 min-h-20"
                    value={helper}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        labels: {
                          ...current.labels,
                          helperText: {
                            ...current.labels.helperText,
                            [key]: event.target.value,
                          },
                        },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </article>
        </section>
      )}

      {module === "layout" && (
        <section className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-slate-300">
              Layout Mode
              <select
                className="field mt-1"
                value={form.layout.mode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    layout: {
                      ...current.layout,
                      mode: event.target.value as LayoutConfiguration["mode"],
                    },
                  }))
                }
              >
                <option value="compact">Compact</option>
                <option value="standard">Standard</option>
                <option value="print">Print-Friendly</option>
              </select>
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.layout.touchAlwaysExpandDetails}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    layout: {
                      ...current.layout,
                      touchAlwaysExpandDetails: event.target.checked,
                    },
                  }))
                }
              />
              Expand Details On Touch
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.showInventory}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    showInventory: event.target.checked,
                  }))
                }
              />
              Show Inventory
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.showConnections}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    showConnections: event.target.checked,
                  }))
                }
              />
              Show Connections
            </label>
          </div>

          {form.layout.sections
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((section) => (
              <article key={section.id} className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
                <div className="grid gap-2 lg:grid-cols-4">
                  <label className="text-xs text-slate-300">
                    Section Label
                    <input
                      className="field mt-1"
                      value={section.label}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          layout: {
                            ...current.layout,
                            sections: current.layout.sections.map((item) =>
                              item.id === section.id
                                ? {
                                    ...item,
                                    label: event.target.value,
                                  }
                                : item
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    Order
                    <input
                      className="field mt-1"
                      type="number"
                      value={section.order}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          layout: {
                            ...current.layout,
                            sections: current.layout.sections.map((item) =>
                              item.id === section.id
                                ? {
                                    ...item,
                                    order: numericInput(event.target.value, item.order),
                                  }
                                : item
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={section.visible}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          layout: {
                            ...current.layout,
                            sections: current.layout.sections.map((item) =>
                              item.id === section.id
                                ? {
                                    ...item,
                                    visible: event.target.checked,
                                  }
                                : item
                            ),
                          },
                        }))
                      }
                    />
                    Visible
                  </label>
                  <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={section.collapseWhenEmpty}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          layout: {
                            ...current.layout,
                            sections: current.layout.sections.map((item) =>
                              item.id === section.id
                                ? {
                                    ...item,
                                    collapseWhenEmpty: event.target.checked,
                                  }
                                : item
                            ),
                          },
                        }))
                      }
                    />
                    Collapse When Empty
                  </label>
                  <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={section.showOnShare}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          layout: {
                            ...current.layout,
                            sections: current.layout.sections.map((item) =>
                              item.id === section.id
                                ? {
                                    ...item,
                                    showOnShare: event.target.checked,
                                  }
                                : item
                            ),
                          },
                        }))
                      }
                    />
                    Show On Share
                  </label>
                  <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={section.showOnPdf}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          layout: {
                            ...current.layout,
                            sections: current.layout.sections.map((item) =>
                              item.id === section.id
                                ? {
                                    ...item,
                                    showOnPdf: event.target.checked,
                                  }
                                : item
                            ),
                          },
                        }))
                      }
                    />
                    Show On PDF
                  </label>
                </div>
              </article>
            ))}
        </section>
      )}

      {module === "skills" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-300">Define custom skills and trait mappings.</p>
            <button className="btn-outline min-h-11 px-3 py-2 text-xs" onClick={addSkill} type="button">
              Add Skill
            </button>
          </div>

          {form.skills.map((skill, index) => (
            <article key={skill.id} className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs text-slate-300">
                  Skill ID
                  <input
                    className="field mt-1"
                    value={skill.id}
                    onChange={(event) =>
                      updateSkill(index, {
                        id: slugify(event.target.value) || skill.id,
                      })
                    }
                  />
                </label>
                <label className="text-xs text-slate-300">
                  Skill Label
                  <input
                    className="field mt-1"
                    value={skill.label}
                    onChange={(event) =>
                      updateSkill(index, {
                        label: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="text-xs text-slate-300 lg:col-span-2">
                  Helper Text
                  <input
                    className="field mt-1"
                    value={skill.helperText}
                    onChange={(event) =>
                      updateSkill(index, {
                        helperText: event.target.value,
                      })
                    }
                  />
                </label>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {TRAIT_KEYS.map((trait) => (
                  <label
                    key={`${skill.id}-${trait}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs capitalize text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={skill.traits.includes(trait)}
                      onChange={() =>
                        updateSkill(index, {
                          traits: toggleValue(skill.traits, trait),
                        })
                      }
                    />
                    {trait}
                  </label>
                ))}
              </div>

              <div className="mt-2">
                <button
                  className="rounded-md border border-red-400/45 px-2 py-2 text-xs text-red-300 hover:bg-red-950/30"
                  onClick={() => removeSkill(skill.id)}
                  type="button"
                >
                  Remove Skill
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {module === "characterRules" && (
        <section className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-slate-300">
              Max Domain Cards
              <input
                className="field mt-1"
                type="number"
                min={1}
                max={20}
                value={form.maxDomainCards}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    maxDomainCards: numericInput(event.target.value, current.maxDomainCards),
                  }))
                }
              />
            </label>
            <label className="text-xs text-slate-300">
              Base HP
              <input
                className="field mt-1"
                type="number"
                min={1}
                max={999}
                value={form.baseHp}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    baseHp: numericInput(event.target.value, current.baseHp),
                  }))
                }
              />
            </label>
            <label className="text-xs text-slate-300">
              Base Stress
              <input
                className="field mt-1"
                type="number"
                min={0}
                max={99}
                value={form.baseStress}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    baseStress: numericInput(event.target.value, current.baseStress),
                  }))
                }
              />
            </label>
            <label className="text-xs text-slate-300">
              Base Hope
              <input
                className="field mt-1"
                type="number"
                min={0}
                max={99}
                value={form.baseHope}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    baseHope: numericInput(event.target.value, current.baseHope),
                  }))
                }
              />
            </label>
          </div>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <h4 className="mb-2 text-sm text-amber-100">Level-Up Advancement Rules</h4>
            <p className="mb-2 text-xs text-slate-400">
              Controls how many advancement points are available at each level-up and how costly advanced picks are.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-slate-300">
                Points Per Level-Up
                <input
                  className="field mt-1"
                  type="number"
                  min={1}
                  max={10}
                  value={form.characterRules.levelUpPointsPerLevel}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      characterRules: {
                        ...current.characterRules,
                        levelUpPointsPerLevel: Math.max(
                          1,
                          Math.min(10, numericInput(event.target.value, current.characterRules.levelUpPointsPerLevel))
                        ),
                      },
                    }))
                  }
                />
              </label>

              <label className="text-xs text-slate-300">
                Proficiency Cost
                <input
                  className="field mt-1"
                  type="number"
                  min={1}
                  max={10}
                  value={form.characterRules.proficiencyAdvancementCost}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      characterRules: {
                        ...current.characterRules,
                        proficiencyAdvancementCost: Math.max(
                          1,
                          Math.min(
                            10,
                            numericInput(
                              event.target.value,
                              current.characterRules.proficiencyAdvancementCost
                            )
                          )
                        ),
                      },
                    }))
                  }
                />
              </label>

              <label className="text-xs text-slate-300">
                Multiclass Min Level
                <input
                  className="field mt-1"
                  type="number"
                  min={1}
                  max={10}
                  value={form.characterRules.multiclassMinLevel}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      characterRules: {
                        ...current.characterRules,
                        multiclassMinLevel: Math.max(
                          1,
                          Math.min(10, numericInput(event.target.value, current.characterRules.multiclassMinLevel))
                        ),
                      },
                    }))
                  }
                />
              </label>

              <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={form.characterRules.allowMulticlass}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      characterRules: {
                        ...current.characterRules,
                        allowMulticlass: event.target.checked,
                      },
                    }))
                  }
                />
                Allow Multiclass Option
              </label>
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm text-amber-100">Experiences Per Level</h4>
              <button className="btn-outline min-h-11 px-3 py-2 text-xs" onClick={addExperienceLevel} type="button">
                Add Level Row
              </button>
            </div>
            {experienceRows.map(([level, valueForLevel]) => (
              <div key={level} className="mb-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <label className="text-xs text-slate-300">
                  Level
                  <input
                    className="field mt-1"
                    type="number"
                    min={1}
                    max={10}
                    value={level}
                    onChange={(event) =>
                      updateExperienceLevel(
                        level,
                        String(Math.max(1, Math.min(10, numericInput(event.target.value, Number(level))))),
                        valueForLevel
                      )
                    }
                  />
                </label>
                <label className="text-xs text-slate-300">
                  Experiences
                  <input
                    className="field mt-1"
                    type="number"
                    min={0}
                    max={20}
                    value={valueForLevel}
                    onChange={(event) =>
                      updateExperienceLevel(
                        level,
                        level,
                        Math.max(0, numericInput(event.target.value, valueForLevel))
                      )
                    }
                  />
                </label>
                <button
                  className="self-end rounded-md border border-red-400/45 px-2 py-2 text-xs text-red-300 hover:bg-red-950/30"
                  onClick={() => removeExperienceLevel(level)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <h4 className="mb-2 text-sm text-amber-100">Required Fields During Creation</h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {REQUIRED_FIELD_OPTIONS.map((field) => (
                <label
                  key={field.id}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={form.characterRules.requiredFields.includes(field.id)}
                    onChange={() =>
                      setForm((current) => ({
                        ...current,
                        characterRules: {
                          ...current.characterRules,
                          requiredFields: toggleValue(current.characterRules.requiredFields, field.id),
                        },
                      }))
                    }
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <h4 className="mb-2 text-sm text-amber-100">Class Allowlist</h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {classRuleOptions.map((item) => (
                <label
                  key={item.id}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={form.characterRules.classAllowlist.includes(item.id)}
                    onChange={() =>
                      setForm((current) => ({
                        ...current,
                        characterRules: {
                          ...current.characterRules,
                          classAllowlist: toggleValue(current.characterRules.classAllowlist, item.id),
                        },
                      }))
                    }
                  />
                  {item.name}
                </label>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <h4 className="mb-2 text-sm text-amber-100">Domain Gating</h4>
            <p className="mb-2 text-xs text-slate-400">
              By default, each class only sees its baseline SRD domains. Enable extra domains per class or disable class-based gating completely.
            </p>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.characterRules.disableClassDomainGating}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    characterRules: {
                      ...current.characterRules,
                      disableClassDomainGating: event.target.checked,
                    },
                  }))
                }
              />
              Disable class-based domain restrictions (all domains available)
            </label>

            <div className="mt-3 space-y-3">
              {classRuleOptions.map((item) => {
                const normalizedClassId = normalizeDomainKey(item.id);
                const baseDomains = (CLASS_DOMAIN_BASELINE[normalizedClassId] ?? []).map((domain) =>
                  normalizeDomainKey(domain)
                );
                const expandedDomains =
                  form.characterRules.expandedDomainsByClass[item.id] ?? [];

                return (
                  <article
                    key={`domain-gating-${item.id}`}
                    className="rounded-md border border-slate-700/50 bg-slate-950/50 p-2"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-amber-100">{item.name}</p>
                      <p className="text-[11px] text-slate-400">
                        Base:{" "}
                        {baseDomains.length
                          ? baseDomains.map((domain) => formatDomainLabel(domain)).join(", ")
                          : item.isOfficial
                            ? "No default mapping"
                            : "Custom class (no official baseline)"}
                      </p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                      {SRD_DOMAIN_KEYS.map((domainKey) => {
                        const normalizedDomain = normalizeDomainKey(domainKey);
                        const isBase = baseDomains.includes(normalizedDomain);
                        const isExpanded = isDomainExpandedForClass(
                          form.characterRules,
                          item.id,
                          normalizedDomain
                        );
                        return (
                          <label
                            key={`${item.id}-${normalizedDomain}`}
                            className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                              isBase
                                ? "border-amber-500/40 bg-amber-950/25 text-amber-100"
                                : "border-slate-700/50 text-slate-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={isBase}
                              checked={isBase || isExpanded}
                              onChange={() => toggleExpandedDomain(item.id, normalizedDomain)}
                            />
                            {formatDomainLabel(normalizedDomain)}
                          </label>
                        );
                      })}
                    </div>

                    {expandedDomains.length > 0 && (
                      <p className="mt-2 text-[11px] text-slate-400">
                        Expanded domains:{" "}
                        {expandedDomains
                          .map((domain) => formatDomainLabel(domain))
                          .join(", ")}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <h4 className="mb-2 text-sm text-amber-100">Ancestry Allowlist</h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ancestryRuleOptions.map((item) => (
                <label
                  key={item.id}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={form.characterRules.ancestryAllowlist.includes(item.id)}
                    onChange={() =>
                      setForm((current) => ({
                        ...current,
                        characterRules: {
                          ...current.characterRules,
                          ancestryAllowlist: toggleValue(current.characterRules.ancestryAllowlist, item.id),
                        },
                      }))
                    }
                  />
                  {item.name}
                </label>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <h4 className="mb-2 text-sm text-amber-100">Community Allowlist</h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {communityRuleOptions.map((item) => (
                <label
                  key={item.id}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={form.characterRules.communityAllowlist.includes(item.id)}
                    onChange={() =>
                      setForm((current) => ({
                        ...current,
                        characterRules: {
                          ...current.characterRules,
                          communityAllowlist: toggleValue(current.characterRules.communityAllowlist, item.id),
                        },
                      }))
                    }
                  />
                  {item.name}
                </label>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <h4 className="mb-2 text-sm text-amber-100">Starting Equipment Packages By Class</h4>
            <div className="space-y-2">
              {classRuleOptions.map((item) => (
                <label key={item.id} className="block text-xs text-slate-300">
                  {item.name}
                  <textarea
                    className="field mt-1 min-h-24"
                    value={form.characterRules.startingEquipmentByClass[item.id] ?? ""}
                    onChange={(event) => setStartingEquipment(item.id, event.target.value)}
                    placeholder="One item per line"
                  />
                </label>
              ))}
            </div>
          </article>
        </section>
      )}

      {module === "crafting" && (
        <section className="space-y-3">
          <article className="rounded-lg border border-amber-700/35 bg-amber-950/20 p-3">
            <h4 className="text-sm text-amber-100">How This Crafting System Works</h4>
            <p className="mt-1 text-xs text-slate-300">
              This console powers the live crafting workflow on player character sheets. It tracks selected
              professions, material quantities, gather rolls, and recipe crafting costs.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <p className="rounded-md border border-slate-700/50 bg-slate-900/65 px-3 py-2 text-xs text-slate-300">
                In app: players can roll gather, update materials, and craft from enabled recipes.
              </p>
              <p className="rounded-md border border-slate-700/50 bg-slate-900/65 px-3 py-2 text-xs text-slate-300">
                Linked recipes auto-add crafted weapons/armor/items/consumables to inventory.
              </p>
              <p className="rounded-md border border-slate-700/50 bg-slate-900/65 px-3 py-2 text-xs text-slate-300">
                Custom recipes are supported, but custom outputs are narrative/manual (not auto-inventoried).
              </p>
              <p className="rounded-md border border-slate-700/50 bg-slate-900/65 px-3 py-2 text-xs text-slate-300">
                Enabling crafting also unlocks crafting advancement picks in character level-up.
              </p>
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <div className="mb-2">
              <h4 className="text-sm text-amber-100">Step 1 - Turn On Crafting And Set Campaign Pace</h4>
              <p className="mt-1 text-xs text-slate-300">
                Configure whether crafting is active, how large gather results are, and how many professions a
                character can maintain.
              </p>
              <p className="mt-1 rounded-md border border-slate-700/50 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                Table advice: decide when gather checks happen before play (after encounters, during travel, or
                downtime) so players understand when they can earn materials.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={form.craftingRules.enabled}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      craftingRules: {
                        ...current.craftingRules,
                        enabled: event.target.checked,
                      },
                    }))
                  }
                />
                Enable Crafting
              </label>
              <label className="text-xs text-slate-300">
                Gathering Die
                <select
                  className="field mt-1"
                  value={form.craftingRules.gatheringDie}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      craftingRules: {
                        ...current.craftingRules,
                        gatheringDie: Number(event.target.value) as 4 | 6 | 8 | 10 | 12,
                      },
                    }))
                  }
                >
                  <option value={4}>d4</option>
                  <option value={6}>d6</option>
                  <option value={8}>d8</option>
                  <option value={10}>d10</option>
                  <option value={12}>d12</option>
                </select>
              </label>
              <label className="text-xs text-slate-300">
                Max Professions
                <input
                  className="field mt-1"
                  type="number"
                  min={1}
                  max={10}
                  value={form.craftingRules.maxProfessionsPerCharacter}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      craftingRules: {
                        ...current.craftingRules,
                        maxProfessionsPerCharacter: Math.max(
                          1,
                          Math.min(
                            10,
                            numericInput(event.target.value, current.craftingRules.maxProfessionsPerCharacter)
                          )
                        ),
                      },
                    }))
                  }
                />
              </label>
              <p className="rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                Players gather {`1d${form.craftingRules.gatheringDie}`} resources on success.
              </p>
            </div>
            {!form.craftingRules.enabled && (
              <p className="mt-2 rounded-md border border-amber-700/45 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
                Crafting is currently disabled. Players will not see crafting tools or crafting level-up options
                until this is enabled and saved.
              </p>
            )}
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <div className="mb-2 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm text-amber-100">Step 2 - Define Professions</h4>
                <button className="btn-outline min-h-11 px-3 py-2 text-xs" onClick={addCraftingProfession} type="button">
                  Add Profession
                </button>
              </div>
              <p className="text-xs text-slate-300">
                Profession labels and descriptions are shown to players when choosing professions and selecting
                crafting level-up options.
              </p>
              <p className="rounded-md border border-slate-700/50 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                Table advice: keep profession names broad and easy to remember so players can quickly agree whether
                a defeated adversary yields relevant components.
              </p>
            </div>
            <div className="mb-2 flex items-center justify-between">
              <h5 className="text-xs uppercase tracking-wide text-amber-200">Profession List</h5>
            </div>
            <div className="space-y-2">
              {form.craftingRules.professions.map((profession, index) => (
                <div key={profession.id} className="grid gap-2 rounded-md border border-slate-700/50 bg-slate-950/50 p-2 sm:grid-cols-[1fr_2fr_auto]">
                  <input
                    className="field"
                    value={profession.label}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        craftingRules: {
                          ...current.craftingRules,
                          professions: current.craftingRules.professions.map((item, currentIndex) =>
                            currentIndex === index ? { ...item, label: event.target.value } : item
                          ),
                        },
                      }))
                    }
                    placeholder="Profession name"
                  />
                  <input
                    className="field"
                    value={profession.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        craftingRules: {
                          ...current.craftingRules,
                          professions: current.craftingRules.professions.map((item, currentIndex) =>
                            currentIndex === index ? { ...item, description: event.target.value } : item
                          ),
                        },
                      }))
                    }
                    placeholder="What this profession gathers"
                  />
                  <button
                    className="rounded-md border border-red-400/45 px-2 py-2 text-xs text-red-300 hover:bg-red-950/30"
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        craftingRules: {
                          ...current.craftingRules,
                          professions: current.craftingRules.professions.filter((item) => item.id !== profession.id),
                        },
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <div className="mb-2 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm text-amber-100">Step 3 - Build Your Material Ledger</h4>
                <button className="btn-outline min-h-11 px-3 py-2 text-xs" onClick={addCraftingMaterial} type="button">
                  Add Material
                </button>
              </div>
              <p className="text-xs text-slate-300">
                Materials are the shared crafting currency. Players store amounts on their sheets and spend them
                when crafting recipes.
              </p>
              <p className="rounded-md border border-slate-700/50 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                Table advice: start with 3-6 material types and tie each one to obvious encounter/region themes.
                Fewer material types keeps tracking fast during live sessions.
              </p>
            </div>
            <div className="mb-2 flex items-center justify-between">
              <h5 className="text-xs uppercase tracking-wide text-amber-200">Material Types</h5>
            </div>
            <div className="space-y-2">
              {form.craftingRules.materialTypes.map((material, index) => (
                <div key={material.id} className="grid gap-2 rounded-md border border-slate-700/50 bg-slate-950/50 p-2 sm:grid-cols-[1fr_2fr_120px_auto]">
                  <input
                    className="field"
                    value={material.label}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        craftingRules: {
                          ...current.craftingRules,
                          materialTypes: current.craftingRules.materialTypes.map((item, currentIndex) =>
                            currentIndex === index ? { ...item, label: event.target.value } : item
                          ),
                        },
                      }))
                    }
                    placeholder="Material"
                  />
                  <input
                    className="field"
                    value={material.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        craftingRules: {
                          ...current.craftingRules,
                          materialTypes: current.craftingRules.materialTypes.map((item, currentIndex) =>
                            currentIndex === index ? { ...item, description: event.target.value } : item
                          ),
                        },
                      }))
                    }
                    placeholder="Description"
                  />
                  <input
                    className="field"
                    type="number"
                    min={1}
                    max={9999}
                    value={material.maxStack}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        craftingRules: {
                          ...current.craftingRules,
                          materialTypes: current.craftingRules.materialTypes.map((item, currentIndex) =>
                            currentIndex === index
                              ? { ...item, maxStack: Math.max(1, numericInput(event.target.value, item.maxStack)) }
                              : item
                          ),
                        },
                      }))
                    }
                  />
                  <button
                    className="rounded-md border border-red-400/45 px-2 py-2 text-xs text-red-300 hover:bg-red-950/30"
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        craftingRules: {
                          ...current.craftingRules,
                          materialTypes: current.craftingRules.materialTypes.filter((item) => item.id !== material.id),
                        },
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <div className="mb-2 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm text-amber-100">Step 4 - Configure Crafting Recipes</h4>
                <button className="btn-outline min-h-11 px-3 py-2 text-xs" onClick={addCraftingRecipe} type="button">
                  Add Recipe
                </button>
              </div>
              <p className="text-xs text-slate-300">
                Recipes spend material costs and optional gold cost. Link to catalog gear when possible so crafted
                outputs are added to character inventory automatically.
              </p>
              <p className="rounded-md border border-slate-700/50 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                Table advice: publish recipes early, but gate rare ones behind quests, faction favors, or story
                milestones to make crafting feel earned.
              </p>
            </div>
            <div className="mb-2 flex items-center justify-between">
              <h5 className="text-xs uppercase tracking-wide text-amber-200">Recipe List</h5>
            </div>
            {loadingCraftingTargets && (
              <p className="mb-2 text-xs text-slate-400">Loading equipment targets...</p>
            )}
            {!loadingCraftingTargets && craftingTargetOptions.length === 0 && (
              <p className="mb-2 rounded-md border border-slate-700/50 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                No linked equipment targets available yet. You can still create recipes with custom outputs.
              </p>
            )}
            <div className="space-y-2">
              {form.craftingRules.recipes.map((recipe, recipeIndex) => (
                <article key={recipe.id} className="rounded-md border border-slate-700/50 bg-slate-950/50 p-2">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <input
                      className="field"
                      value={recipe.name}
                      onChange={(event) => updateCraftingRecipe(recipeIndex, { name: event.target.value })}
                      placeholder="Recipe name"
                    />
                    <select
                      className="field"
                      value={recipe.targetKind}
                      onChange={(event) =>
                        updateCraftingRecipe(recipeIndex, {
                          targetKind: event.target.value as CraftingRecipeDefinition["targetKind"],
                          targetId: null,
                        })
                      }
                    >
                      <option value="weapon">Weapon</option>
                      <option value="armor">Armor</option>
                      <option value="item">Item</option>
                      <option value="consumable">Consumable</option>
                      <option value="custom">Custom</option>
                    </select>
                    <input
                      className="field"
                      type="number"
                      min={0}
                      max={999999}
                      value={recipe.goldCost}
                      onChange={(event) =>
                        updateCraftingRecipe(recipeIndex, {
                          goldCost: Math.max(0, numericInput(event.target.value, recipe.goldCost)),
                        })
                      }
                      placeholder="Gold cost"
                    />
                    <button
                      className="rounded-md border border-red-400/45 px-2 py-2 text-xs text-red-300 hover:bg-red-950/30"
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          craftingRules: {
                            ...current.craftingRules,
                            recipes: current.craftingRules.recipes.filter((item) => item.id !== recipe.id),
                          },
                        }))
                      }
                    >
                      Remove Recipe
                    </button>
                  </div>

                  {recipe.targetKind !== "custom" && (
                    <select
                      className="field mt-2"
                      value={recipe.targetId ?? ""}
                      onChange={(event) => {
                        const selected = craftingTargetOptions.find((option) => option.id === event.target.value);
                        updateCraftingRecipe(recipeIndex, {
                          targetId: event.target.value || null,
                          targetName: selected ? selected.name : recipe.targetName,
                        });
                      }}
                    >
                      <option value="">Select linked {recipe.targetKind}</option>
                      {craftingTargetOptions
                        .filter((option) => option.kind === recipe.targetKind)
                        .map((option) => (
                          <option key={`${recipe.id}-${option.id}`} value={option.id}>
                            {option.name} ({option.scope})
                          </option>
                        ))}
                    </select>
                  )}
                  <input
                    className="field mt-2"
                    value={recipe.targetName}
                    onChange={(event) =>
                      updateCraftingRecipe(recipeIndex, { targetName: event.target.value })
                    }
                    placeholder="Display name"
                  />
                  {recipe.targetKind === "custom" && (
                    <p className="mt-2 text-xs text-slate-400">
                      Custom outputs are narrative/manual rewards and are not auto-added to inventory.
                    </p>
                  )}

                  <div className="mt-2 rounded-md border border-slate-700/50 p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs text-amber-100">Material Costs</p>
                      <button
                        className="btn-outline min-h-11 px-3 py-2 text-xs"
                        type="button"
                        onClick={() => {
                          const fallbackMaterialId = form.craftingRules.materialTypes[0]?.id ?? "salvage";
                          updateCraftingRecipe(recipeIndex, {
                            resourceCosts: [
                              ...recipe.resourceCosts,
                              { materialId: fallbackMaterialId, amount: 1 },
                            ],
                          });
                        }}
                      >
                        Add Cost
                      </button>
                    </div>
                    {recipe.resourceCosts.map((cost, costIndex) => (
                      <div
                        key={`${recipe.id}-cost-${costIndex}`}
                        className="mb-2 grid gap-2 sm:grid-cols-[1fr_120px_auto]"
                      >
                        <select
                          className="field"
                          value={cost.materialId}
                          onChange={(event) => {
                            const nextCosts = recipe.resourceCosts.map((entry, index) =>
                              index === costIndex
                                ? { ...entry, materialId: event.target.value }
                                : entry
                            );
                            updateCraftingRecipe(recipeIndex, { resourceCosts: nextCosts });
                          }}
                        >
                          {form.craftingRules.materialTypes.map((material) => (
                            <option key={`${recipe.id}-${material.id}`} value={material.id}>
                              {material.label}
                            </option>
                          ))}
                        </select>
                        <input
                          className="field"
                          type="number"
                          min={1}
                          max={9999}
                          value={cost.amount}
                          onChange={(event) => {
                            const nextCosts = recipe.resourceCosts.map((entry, index) =>
                              index === costIndex
                                ? {
                                    ...entry,
                                    amount: Math.max(1, numericInput(event.target.value, entry.amount)),
                                  }
                                : entry
                            );
                            updateCraftingRecipe(recipeIndex, { resourceCosts: nextCosts });
                          }}
                        />
                        <button
                          className="rounded-md border border-red-400/45 px-2 py-2 text-xs text-red-300 hover:bg-red-950/30"
                          type="button"
                          onClick={() => {
                            const nextCosts = recipe.resourceCosts.filter(
                              (_, index) => index !== costIndex
                            );
                            updateCraftingRecipe(recipeIndex, { resourceCosts: nextCosts });
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {!recipe.resourceCosts.length && (
                      <p className="text-xs text-slate-400">No material costs configured.</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>
      )}

      {module === "druidForms" && (
        <section className="space-y-3">
          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={form.druidFormRules.enabled}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      druidFormRules: {
                        ...current.druidFormRules,
                        enabled: event.target.checked,
                      },
                    }))
                  }
                />
                Enable Druid Forms
              </label>
              <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={form.druidFormRules.allowNonDruid}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      druidFormRules: {
                        ...current.druidFormRules,
                        allowNonDruid: event.target.checked,
                      },
                    }))
                  }
                />
                Allow Non-Druid Access
              </label>
              <p className="rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                Tier Ramp: L1={formTierForLevel(1)} L2={formTierForLevel(2)} L5={formTierForLevel(5)} L8={formTierForLevel(8)}
              </p>
              <p className="rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                Active Form Pool: {druidFormsPreview.length}
              </p>
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <h4 className="mb-2 text-sm text-amber-100">Allowed Classes</h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {classRuleOptions.map((item) => (
                <label
                  key={`forms-class-${item.id}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={form.druidFormRules.allowedClassIds.includes(item.id)}
                    onChange={() =>
                      setForm((current) => ({
                        ...current,
                        druidFormRules: {
                          ...current.druidFormRules,
                          allowedClassIds: toggleValue(current.druidFormRules.allowedClassIds, item.id),
                        },
                      }))
                    }
                  />
                  {item.name}
                </label>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <h4 className="mb-2 text-sm text-amber-100">Official Forms</h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {OFFICIAL_DRUID_FORMS.map((formOption) => {
                const disabled = form.druidFormRules.disabledFormIds.includes(formOption.id);
                return (
                  <label
                    key={`official-form-${formOption.id}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={!disabled}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          druidFormRules: {
                            ...current.druidFormRules,
                            disabledFormIds: disabled
                              ? current.druidFormRules.disabledFormIds.filter((id) => id !== formOption.id)
                              : [...current.druidFormRules.disabledFormIds, formOption.id],
                          },
                        }))
                      }
                    />
                    T{formOption.tier} {formOption.name}
                  </label>
                );
              })}
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm text-amber-100">Custom Form Overrides</h4>
              <button
                className="btn-outline min-h-11 px-3 py-2 text-xs"
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    druidFormRules: {
                      ...current.druidFormRules,
                      customForms: [
                        ...current.druidFormRules.customForms,
                        {
                          ...OFFICIAL_DRUID_FORMS[0],
                          id: makeUniqueId(
                            OFFICIAL_DRUID_FORMS[0]?.id ?? "custom-form",
                            current.druidFormRules.customForms.map((item) => item.id),
                            "custom-form"
                          ),
                          name: "Custom Form",
                        },
                      ],
                    },
                  }))
                }
              >
                Add Custom Form
              </button>
            </div>
            <div className="space-y-2">
              {form.druidFormRules.customForms.map((customForm, index) => (
                <article key={customForm.id} className="rounded-md border border-slate-700/50 bg-slate-950/50 p-2">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <input
                      className="field"
                      value={customForm.id}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          druidFormRules: {
                            ...current.druidFormRules,
                            customForms: current.druidFormRules.customForms.map((item, currentIndex) =>
                              currentIndex === index ? { ...item, id: slugify(event.target.value) || item.id } : item
                            ),
                          },
                        }))
                      }
                      placeholder="form id"
                    />
                    <input
                      className="field"
                      value={customForm.name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          druidFormRules: {
                            ...current.druidFormRules,
                            customForms: current.druidFormRules.customForms.map((item, currentIndex) =>
                              currentIndex === index ? { ...item, name: event.target.value } : item
                            ),
                          },
                        }))
                      }
                      placeholder="Form name"
                    />
                    <select
                      className="field"
                      value={customForm.tier}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          druidFormRules: {
                            ...current.druidFormRules,
                            customForms: current.druidFormRules.customForms.map((item, currentIndex) =>
                              currentIndex === index
                                ? { ...item, tier: Number(event.target.value) as 1 | 2 | 3 | 4 }
                                : item
                            ),
                          },
                        }))
                      }
                    >
                      <option value={1}>Tier 1</option>
                      <option value={2}>Tier 2</option>
                      <option value={3}>Tier 3</option>
                      <option value={4}>Tier 4</option>
                    </select>
                    <button
                      className="rounded-md border border-red-400/45 px-2 py-2 text-xs text-red-300 hover:bg-red-950/30"
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          druidFormRules: {
                            ...current.druidFormRules,
                            customForms: current.druidFormRules.customForms.filter((item) => item.id !== customForm.id),
                          },
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <label className="text-xs text-slate-300">
                      Trait Bonus
                      <input
                        className="field mt-1"
                        type="number"
                        min={-3}
                        max={10}
                        value={customForm.traitBonus.amount}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            druidFormRules: {
                              ...current.druidFormRules,
                              customForms: current.druidFormRules.customForms.map((item, currentIndex) =>
                                currentIndex === index
                                  ? {
                                      ...item,
                                      traitBonus: {
                                        ...item.traitBonus,
                                        amount: numericInput(event.target.value, item.traitBonus.amount),
                                      },
                                    }
                                  : item
                              ),
                            },
                          }))
                        }
                      />
                    </label>
                    <label className="text-xs text-slate-300">
                      Evasion Bonus
                      <input
                        className="field mt-1"
                        type="number"
                        min={-20}
                        max={30}
                        value={customForm.evasionBonus}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            druidFormRules: {
                              ...current.druidFormRules,
                              customForms: current.druidFormRules.customForms.map((item, currentIndex) =>
                                currentIndex === index
                                  ? { ...item, evasionBonus: numericInput(event.target.value, item.evasionBonus) }
                                  : item
                              ),
                            },
                          }))
                        }
                      />
                    </label>
                    <label className="text-xs text-slate-300">
                      Attack Damage
                      <input
                        className="field mt-1"
                        value={customForm.attack.damageFormula}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            druidFormRules: {
                              ...current.druidFormRules,
                              customForms: current.druidFormRules.customForms.map((item, currentIndex) =>
                                currentIndex === index
                                  ? {
                                      ...item,
                                      attack: { ...item.attack, damageFormula: event.target.value },
                                    }
                                  : item
                              ),
                            },
                          }))
                        }
                      />
                    </label>
                  </div>
                </article>
              ))}
              {!form.druidFormRules.customForms.length && (
                <p className="text-xs text-slate-400">No custom forms configured.</p>
              )}
            </div>
          </article>
        </section>
      )}

      {module === "companion" && (
        <section className="space-y-3">
          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={form.companionRules.enabled}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      companionRules: {
                        ...current.companionRules,
                        enabled: event.target.checked,
                      },
                    }))
                  }
                />
                Enable Companion Rules
              </label>
              <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={form.companionRules.allowNonBeastbound}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      companionRules: {
                        ...current.companionRules,
                        allowNonBeastbound: event.target.checked,
                      },
                    }))
                  }
                />
                Allow Non-Beastbound
              </label>
              <label className="text-xs text-slate-300">
                Starting Evasion
                <input
                  className="field mt-1"
                  type="number"
                  min={0}
                  max={99}
                  value={form.companionRules.startingEvasion}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      companionRules: {
                        ...current.companionRules,
                        startingEvasion: Math.max(
                          0,
                          numericInput(event.target.value, current.companionRules.startingEvasion)
                        ),
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs text-slate-300">
                Starting Stress Slots
                <input
                  className="field mt-1"
                  type="number"
                  min={0}
                  max={99}
                  value={form.companionRules.startingStressSlots}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      companionRules: {
                        ...current.companionRules,
                        startingStressSlots: Math.max(
                          0,
                          numericInput(event.target.value, current.companionRules.startingStressSlots)
                        ),
                      },
                    }))
                  }
                />
              </label>
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <h4 className="mb-2 text-sm text-amber-100">Allowed Classes</h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {classRuleOptions.map((item) => (
                <label
                  key={`companion-class-${item.id}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={form.companionRules.allowedClassIds.includes(item.id)}
                    onChange={() =>
                      setForm((current) => ({
                        ...current,
                        companionRules: {
                          ...current.companionRules,
                          allowedClassIds: toggleValue(current.companionRules.allowedClassIds, item.id),
                        },
                      }))
                    }
                  />
                  {item.name}
                </label>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <label className="text-xs text-slate-300">
              Allowed Subclass IDs (comma separated)
              <input
                className="field mt-1"
                value={form.companionRules.allowedSubclassIds.join(", ")}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    companionRules: {
                      ...current.companionRules,
                      allowedSubclassIds: Array.from(
                        new Set(
                          event.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean)
                        )
                      ),
                    },
                  }))
                }
              />
            </label>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <h4 className="mb-2 text-sm text-amber-100">Companion Baseline Attack</h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs text-slate-300">
                Starting Damage Die
                <input
                  className="field mt-1"
                  value={form.companionRules.startingDamageDie}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      companionRules: {
                        ...current.companionRules,
                        startingDamageDie: event.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs text-slate-300">
                Starting Range
                <select
                  className="field mt-1"
                  value={form.companionRules.startingRangeBand}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      companionRules: {
                        ...current.companionRules,
                        startingRangeBand: event.target.value as CompanionRulesConfiguration["startingRangeBand"],
                      },
                    }))
                  }
                >
                  <option value="melee">Melee</option>
                  <option value="very_close">Very Close</option>
                  <option value="close">Close</option>
                  <option value="far">Far</option>
                  <option value="very_far">Very Far</option>
                </select>
              </label>
            </div>
          </article>

          <article className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm text-amber-100">Level-Up Options</h4>
              <button
                className="btn-outline min-h-11 px-3 py-2 text-xs"
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    companionRules: {
                      ...current.companionRules,
                      levelUpOptions: [
                        ...current.companionRules.levelUpOptions,
                        {
                          id: makeUniqueId(
                            `companion-option-${current.companionRules.levelUpOptions.length + 1}`,
                            current.companionRules.levelUpOptions.map((option) => option.id),
                            "companion-option"
                          ),
                          label: "New Option",
                          description: "",
                        },
                      ],
                    },
                  }))
                }
              >
                Add Option
              </button>
            </div>
            <div className="space-y-2">
              {form.companionRules.levelUpOptions.map((option, index) => (
                <div key={option.id} className="grid gap-2 rounded-md border border-slate-700/50 bg-slate-950/50 p-2 sm:grid-cols-[220px_1fr_auto]">
                  <input
                    className="field"
                    value={option.label}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        companionRules: {
                          ...current.companionRules,
                          levelUpOptions: current.companionRules.levelUpOptions.map((item, currentIndex) =>
                            currentIndex === index ? { ...item, label: event.target.value } : item
                          ),
                        },
                      }))
                    }
                  />
                  <input
                    className="field"
                    value={option.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        companionRules: {
                          ...current.companionRules,
                          levelUpOptions: current.companionRules.levelUpOptions.map((item, currentIndex) =>
                            currentIndex === index ? { ...item, description: event.target.value } : item
                          ),
                        },
                      }))
                    }
                  />
                  <button
                    className="rounded-md border border-red-400/45 px-2 py-2 text-xs text-red-300 hover:bg-red-950/30"
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        companionRules: {
                          ...current.companionRules,
                          levelUpOptions: current.companionRules.levelUpOptions.filter((item) => item.id !== option.id),
                        },
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}

      {module === "conditions" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-300">Define conditions and temporary effect toggles.</p>
            <button className="btn-outline min-h-11 px-3 py-2 text-xs" onClick={addCondition} type="button">
              Add Condition
            </button>
          </div>

          {form.conditions.map((condition, index) => (
            <article key={condition.id} className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs text-slate-300">
                  Condition ID
                  <input
                    className="field mt-1"
                    value={condition.id}
                    onChange={(event) =>
                      updateCondition(index, {
                        id: slugify(event.target.value) || condition.id,
                      })
                    }
                  />
                </label>
                <label className="text-xs text-slate-300">
                  Name
                  <input
                    className="field mt-1"
                    value={condition.name}
                    onChange={(event) =>
                      updateCondition(index, {
                        name: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={condition.playerToggle}
                    onChange={(event) =>
                      updateCondition(index, {
                        playerToggle: event.target.checked,
                      })
                    }
                  />
                  Player Can Toggle
                </label>
                <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={condition.visibleToPlayers}
                    onChange={(event) =>
                      updateCondition(index, {
                        visibleToPlayers: event.target.checked,
                      })
                    }
                  />
                  Visible To Players
                </label>
              </div>
              <label className="mt-2 block text-xs text-slate-300">
                Description
                <textarea
                  className="field mt-1 min-h-20"
                  value={condition.description}
                  onChange={(event) =>
                    updateCondition(index, {
                      description: event.target.value,
                    })
                  }
                />
              </label>
              <div className="mt-2">
                <button
                  className="rounded-md border border-red-400/45 px-2 py-2 text-xs text-red-300 hover:bg-red-950/30"
                  onClick={() => removeCondition(condition.id)}
                  type="button"
                >
                  Remove Condition
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {module === "exportSharing" && (
        <section className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.importExport.applyLabelsToShare}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    importExport: {
                      ...current.importExport,
                      applyLabelsToShare: event.target.checked,
                    },
                  }))
                }
              />
              Apply Labels To Share Pages
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.importExport.applyLabelsToPdf}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    importExport: {
                      ...current.importExport,
                      applyLabelsToPdf: event.target.checked,
                    },
                  }))
                }
              />
              Apply Labels To PDF Exports
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.importExport.includeRulesInJson}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    importExport: {
                      ...current.importExport,
                      includeRulesInJson: event.target.checked,
                    },
                  }))
                }
              />
              Include Campaign Rules In JSON Export
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.importExport.allowCopyFromCampaign}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    importExport: {
                      ...current.importExport,
                      allowCopyFromCampaign: event.target.checked,
                    },
                  }))
                }
              />
              Allow Copy-From-Campaign Presets
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.showGold}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    showGold: event.target.checked,
                  }))
                }
              />
              Show Currency Section
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.showInventory}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    showInventory: event.target.checked,
                  }))
                }
              />
              Show Inventory Section
            </label>
          </div>
        </section>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className="btn-primary min-h-11 px-4 py-2 text-sm" disabled={saving} type="submit">
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}
