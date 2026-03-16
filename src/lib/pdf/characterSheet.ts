import { PDFDocument, StandardFonts, type PDFPage, rgb } from "pdf-lib";
import type {
  CharacterRuleConfiguration,
  ConditionDefinition,
  CurrencyConfiguration,
  CustomFieldDefinition,
  LabelOverrides,
  LayoutConfiguration,
  ResourceDefinition,
} from "@/lib/campaign-metadata";
import type {
  RuntimeConditionStateStore,
  RuntimeCurrencyStore,
  RuntimeCustomFieldStore,
  RuntimeResourceStore,
} from "@/lib/characters";
import type { ResolvedCharacterCombat, ResolvedInventoryEntry } from "@/lib/equipment";
import { getLevelUpOptionCost, getLevelUpOptionLabel } from "@/lib/constants/leveling";
import type {
  CharacterCompanionState,
  CharacterCraftingState,
  CharacterDruidFormState,
  CompanionRulesConfiguration,
  CraftingRulesConfiguration,
  DruidFormRulesConfiguration,
} from "@/lib/optional-systems";

export type CharacterSheetData = {
  id: number;
  name: string;
  class: string;
  subclass: string;
  heritage: string;
  level: number;
  pronouns?: string | null;
  traits: Record<string, number>;
  hpCurrent?: number | null;
  hpMax?: number | null;
  stressCurrent?: number | null;
  stressMax?: number | null;
  hopeCurrent?: number | null;
  hopeMax?: number | null;
  experienceCurrent?: number | null;
  experienceMax?: number | null;
  proficiency?: number | null;
  rallyDie?: string | null;
  domainCards?: string[];
  narrativeBackstory?: string | null;
  backgroundQuestions?: Record<string, string>;
  connections?: Array<Record<string, unknown>>;
  gold?: number;
  handfuls?: number;
  bags?: number;
  debt?: number;
  resourceValues?: RuntimeResourceStore;
  conditionStates?: RuntimeConditionStateStore;
  currencyValues?: RuntimeCurrencyStore;
  customFieldValues?: RuntimeCustomFieldStore;
  advancementSelections?: Record<string, string[]>;
  baseEvasion?: number;
  inventory?: ResolvedInventoryEntry[];
  resolvedCombat?: ResolvedCharacterCombat | null;
  craftingState?: CharacterCraftingState;
  druidFormState?: CharacterDruidFormState;
  companionState?: CharacterCompanionState;
};

export type CharacterSheetPdfConfig = {
  resources?: ResourceDefinition[];
  currency?: CurrencyConfiguration;
  labels?: LabelOverrides;
  layout?: LayoutConfiguration;
  conditions?: ConditionDefinition[];
  customFields?: CustomFieldDefinition[];
  characterRules?: CharacterRuleConfiguration;
  craftingRules?: CraftingRulesConfiguration;
  druidFormRules?: DruidFormRulesConfiguration;
  companionRules?: CompanionRulesConfiguration;
};

function drawHeading(page: PDFPage, text: string, x: number, y: number) {
  page.drawText(text, {
    x,
    y,
    size: 13,
    color: rgb(0.58, 0.39, 0.04),
  });
}

function drawBody(page: PDFPage, text: string, x: number, y: number) {
  page.drawText(text, {
    x,
    y,
    size: 10,
    color: rgb(0.12, 0.15, 0.2),
  });
}

function writeWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number
) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let cursorY = y;

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    const tooWide = next.length > Math.floor(width / 5.3);
    if (tooWide && line) {
      drawBody(page, line, x, cursorY);
      cursorY -= lineHeight;
      line = word;
      continue;
    }

    line = next;
  }

  if (line) {
    drawBody(page, line, x, cursorY);
    cursorY -= lineHeight;
  }

  return cursorY;
}

function sectionVisible(layout: LayoutConfiguration | undefined, sectionId: string) {
  const section = layout?.sections.find((item) => item.id === sectionId);
  if (!section) return true;
  return section.visible && section.showOnPdf;
}

function formatCustomFieldValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export async function createCharacterSheetPdf(
  character: CharacterSheetData,
  config?: CharacterSheetPdfConfig
) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const titleFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica);

  const sectionLabels = config?.labels?.sections ?? {};
  const resourceLabels = config?.labels?.resources ?? {};

  const runtimeResources: RuntimeResourceStore = {
    hp: { current: character.hpCurrent ?? 0, max: character.hpMax ?? null },
    stress: { current: character.stressCurrent ?? 0, max: character.stressMax ?? null },
    hope: { current: character.hopeCurrent ?? 0, max: character.hopeMax ?? null },
    experience: {
      current: character.experienceCurrent ?? 0,
      max: character.experienceMax ?? null,
    },
    ...(character.resourceValues ?? {}),
  };

  const resourceRows = config?.resources?.length
    ? config.resources
        .filter((resource) => resource.visibleOn.pdf)
        .map((resource) => {
          const value = runtimeResources[resource.id] ?? {
            current: resource.defaultCurrent,
            max:
              resource.format === "single" || resource.format === "checkbox"
                ? null
                : resource.defaultMax,
          };

          return {
            label: resourceLabels[resource.id] ?? resource.label,
            current: value.current,
            max: value.max,
            format: resource.format,
          };
        })
    : Object.entries(runtimeResources).map(([resourceId, value]) => ({
        label: resourceLabels[resourceId] ?? resourceId,
        current: value.current,
        max: value.max,
        format: value.max === null ? ("single" as const) : ("current_max" as const),
      }));

  const runtimeCurrencyValues: RuntimeCurrencyStore = {
    gold: character.gold ?? 0,
    handfuls: character.handfuls ?? 0,
    bags: character.bags ?? 0,
    ...(character.currencyValues ?? {}),
  };

  const currencyRows = config?.currency?.denominations?.length
    ? config.currency.denominations
        .filter((denomination) => denomination.visible)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((denomination) => ({
          label: denomination.label,
          value: runtimeCurrencyValues[denomination.id] ?? denomination.defaultAmount,
          abbreviation: denomination.abbreviation,
        }))
    : [
        { label: "Gold", value: runtimeCurrencyValues.gold ?? 0, abbreviation: "" },
        { label: "Handfuls", value: runtimeCurrencyValues.handfuls ?? 0, abbreviation: "" },
        { label: "Bags", value: runtimeCurrencyValues.bags ?? 0, abbreviation: "" },
      ];

  const conditionRows = (config?.conditions ?? []).map((condition) => ({
    name: condition.name,
    active: Boolean(character.conditionStates?.[condition.id]),
  }));

  const customFieldRows = [...(config?.customFields ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((field) => ({
      name: field.name,
      value: formatCustomFieldValue(character.customFieldValues?.[field.id]),
    }));
  const craftingMaterialRows = Object.entries(character.craftingState?.materials ?? {})
    .filter(([, amount]) => Number(amount) > 0)
    .slice(0, 4)
    .map(([materialId, amount]) => `${materialId}: ${amount}`);
  const craftingProfessions = character.craftingState?.professions ?? [];
  const activeFormId = character.druidFormState?.activeFormId ?? null;
  const companion = character.companionState;
  const levelUpPointsPerLevel = Math.max(1, config?.characterRules?.levelUpPointsPerLevel ?? 2);
  const advancementRows = Object.entries(character.advancementSelections ?? {})
    .map(([level, options]) => ({
      level: Number(level),
      options,
    }))
    .filter((entry) => Number.isFinite(entry.level) && entry.level >= 2 && entry.options.length > 0)
    .sort((left, right) => left.level - right.level);

  const inventoryRows = (character.inventory ?? [])
    .filter((entry) => entry.entityKind !== "consumable")
    .slice(0, 8)
    .map((entry) => {
      const name = entry.sourceName ?? entry.entityId;
      const status = entry.isEquipped
        ? entry.equippedSlot === "primary_weapon"
          ? "Primary"
          : entry.equippedSlot === "secondary_weapon"
            ? "Secondary"
            : entry.equippedSlot === "armor"
              ? "Armor"
              : "Equipped"
        : "Carried";
      return `${name} x${entry.quantity} (${status})`;
    });

  const consumableRows = (character.inventory ?? [])
    .filter((entry) => entry.entityKind === "consumable")
    .slice(0, 6)
    .map((entry) => `${entry.sourceName ?? entry.entityId} x${entry.quantity}`);

  const combat = character.resolvedCombat;
  const evasion = combat?.finalEvasion ?? character.baseEvasion ?? 0;
  const armorScore = combat?.armorScore ?? 0;
  const majorThreshold = combat?.majorThreshold ?? Math.max(0, character.level);
  const severeThreshold = combat?.severeThreshold ?? Math.max(0, character.level * 2);
  const primaryName =
    character.inventory?.find((entry) => entry.entityId === combat?.primaryAttack?.sourceId)
      ?.sourceName ??
    combat?.primaryAttack?.sourceId ??
    "-";
  const secondaryName =
    character.inventory?.find((entry) => entry.entityId === combat?.secondaryAttack?.sourceId)
      ?.sourceName ??
    combat?.secondaryAttack?.sourceId ??
    "-";

  page.setFont(titleFont);
  page.drawText("Daggerheart Character Sheet", {
    x: 40,
    y: 800,
    size: 20,
    color: rgb(0.32, 0.23, 0.08),
  });

  page.setFont(bodyFont);
  drawBody(page, `Name: ${character.name}`, 40, 772);
  drawBody(page, `Class: ${character.class} (${character.subclass})`, 40, 756);
  drawBody(page, `Heritage: ${character.heritage}`, 40, 740);
  drawBody(page, `Level: ${character.level}`, 40, 724);
  if (character.pronouns) {
    drawBody(page, `Pronouns: ${character.pronouns}`, 220, 724);
  }

  drawHeading(page, sectionLabels.traits ?? "Traits", 40, 690);
  let y = 672;
  for (const [trait, value] of Object.entries(character.traits ?? {})) {
    drawBody(page, `${trait}: ${value >= 0 ? `+${value}` : value}`, 40, y);
    y -= 14;
  }

  if (sectionVisible(config?.layout, "resources")) {
    drawHeading(page, sectionLabels.resources ?? "Resources", 220, 690);
    let resourceY = 672;
    for (const resource of resourceRows.slice(0, 6)) {
      const valueText =
        resource.format === "single" || resource.format === "checkbox"
          ? `${resource.current ?? "-"}`
          : `${resource.current ?? "-"} / ${resource.max ?? "-"}`;
      drawBody(page, `${resource.label}: ${valueText}`, 220, resourceY);
      resourceY -= 14;
    }
    drawBody(page, `Proficiency: ${character.proficiency ?? "-"}`, 220, resourceY);
    drawBody(page, `Rally Die: ${character.rallyDie ?? "-"}`, 220, resourceY - 14);
  }

  if (sectionVisible(config?.layout, "currency")) {
    drawHeading(page, sectionLabels.currency ?? "Currency", 420, 690);
    let currencyY = 672;
    for (const row of currencyRows.slice(0, 6)) {
      drawBody(
        page,
        `${row.label}: ${row.value}${row.abbreviation ? ` (${row.abbreviation})` : ""}`,
        420,
        currencyY
      );
      currencyY -= 14;
    }

    if (config?.currency?.debtEnabled ?? true) {
      drawBody(page, `${config?.currency?.debtLabel ?? "Debt"}: ${character.debt ?? 0}`, 420, currencyY);
    }
  }

  if (sectionVisible(config?.layout, "equipment")) {
    drawHeading(page, sectionLabels.equipment ?? "Combat & Equipment", 220, 586);
    let equipmentY = 568;
    drawBody(page, `Evasion: ${evasion}`, 220, equipmentY);
    equipmentY -= 14;
    drawBody(page, `Armor Score: ${armorScore}`, 220, equipmentY);
    equipmentY -= 14;
    drawBody(page, `Major / Severe: ${majorThreshold} / ${severeThreshold}`, 220, equipmentY);
    equipmentY -= 14;
    drawBody(
      page,
      `Primary: ${primaryName}`,
      220,
      equipmentY
    );
    equipmentY -= 14;
    drawBody(
      page,
      `Secondary: ${secondaryName}`,
      220,
      equipmentY
    );
    equipmentY -= 14;
    if (inventoryRows.length > 0) {
      for (const row of inventoryRows.slice(0, 3)) {
        drawBody(page, row, 220, equipmentY);
        equipmentY -= 12;
      }
    }
    if (consumableRows.length > 0) {
      drawBody(page, `Consumables: ${consumableRows.join(", ")}`, 220, equipmentY);
    }
  }

  if (advancementRows.length > 0) {
    drawHeading(page, "Advancement", 420, 586);
    let advancementY = 568;
    for (const row of advancementRows.slice(0, 4)) {
      const pointsSpent = row.options.reduce(
        (sum, optionId) => sum + getLevelUpOptionCost(optionId, config?.characterRules),
        0
      );
      const labels = row.options.map((optionId) => getLevelUpOptionLabel(optionId)).join(", ");
      drawBody(
        page,
        `L${row.level} (${pointsSpent}/${levelUpPointsPerLevel}): ${labels}`,
        420,
        advancementY
      );
      advancementY -= 14;
    }
  }

  if (conditionRows.length > 0) {
    drawHeading(page, "Conditions", 220, 500);
    let conditionY = 482;
    for (const row of conditionRows.slice(0, 5)) {
      drawBody(page, `${row.name}: ${row.active ? "Active" : "Inactive"}`, 220, conditionY);
      conditionY -= 14;
    }
  }

  if (customFieldRows.length > 0) {
    drawHeading(page, "Custom Fields", 390, 500);
    let customFieldY = 482;
    for (const row of customFieldRows.slice(0, 5)) {
      drawBody(page, `${row.name}: ${row.value}`, 390, customFieldY);
      customFieldY -= 14;
    }
  }

  if (config?.craftingRules?.enabled) {
    drawHeading(page, "Crafting", 390, 430);
    let craftingY = 412;
    drawBody(page, `Professions: ${craftingProfessions.join(", ") || "-"}`, 390, craftingY);
    craftingY -= 14;
    drawBody(page, `Gather Die: d${config.craftingRules.gatheringDie}`, 390, craftingY);
    craftingY -= 14;
    for (const row of craftingMaterialRows) {
      drawBody(page, row, 390, craftingY);
      craftingY -= 12;
    }
  }

  if (config?.druidFormRules?.enabled) {
    drawHeading(page, "Druid Form", 390, 360);
    drawBody(page, `Active: ${activeFormId ?? "None"}`, 390, 342);
  }

  if (config?.companionRules?.enabled && companion?.enabled) {
    drawHeading(page, "Companion", 390, 320);
    drawBody(page, `${companion.name || "Companion"} (${companion.species || "Unknown"})`, 390, 302);
    drawBody(page, `Evasion ${companion.evasion} | Stress ${companion.stressCurrent}/${companion.stressMax}`, 390, 288);
  }

  drawHeading(page, sectionLabels.domainCards ?? "Domain Cards", 40, 586);
  const domainText = (character.domainCards ?? []).join(", ") || "No domain cards selected.";
  y = writeWrappedText(page, domainText, 40, 568, 510, 12);

  if (sectionVisible(config?.layout, "background")) {
    drawHeading(page, sectionLabels.backgroundQuestions ?? "Background Questions", 40, y - 8);
    y -= 26;
    const questions = Object.entries(character.backgroundQuestions ?? {});
    if (!questions.length) {
      drawBody(page, "No background answers recorded.", 40, y);
      y -= 14;
    } else {
      for (const [question, answer] of questions) {
        y = writeWrappedText(page, `${question}: ${answer}`, 40, y, 510, 12);
        y -= 4;
      }
    }
  }

  if (sectionVisible(config?.layout, "connections")) {
    drawHeading(page, sectionLabels.connections ?? "Connections", 40, y - 8);
    y -= 26;
    if (!character.connections?.length) {
      drawBody(page, "No connections listed.", 40, y);
      y -= 14;
    } else {
      for (const connection of character.connections) {
        const title =
          typeof connection.name === "string"
            ? connection.name
            : typeof connection.target === "string"
              ? connection.target
              : "Connection";
        const description =
          typeof connection.description === "string"
            ? connection.description
            : JSON.stringify(connection);

        y = writeWrappedText(page, `${title}: ${description}`, 40, y, 510, 12);
        y -= 4;
      }
    }
  }

  if (sectionVisible(config?.layout, "narrative")) {
    drawHeading(page, sectionLabels.narrativeBackstory ?? "Narrative Backstory", 40, y - 8);
    y -= 26;
    writeWrappedText(
      page,
      character.narrativeBackstory?.trim() || "No narrative backstory provided.",
      40,
      y,
      510,
      12
    );
  }

  return doc.save();
}
