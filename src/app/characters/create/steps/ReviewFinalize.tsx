"use client";

import { useMemo } from "react";
import { CharacterSheet } from "@/components/characters/character-sheet";
import type { CharacterWizardData } from "@/app/characters/create/hooks/useCharacterWizard";
import { describeIdentityFromHeritage } from "@/lib/character-identity";
import { OFFICIAL_DOMAIN_CARDS } from "@/lib/constants/domains";
import {
  DEFAULT_CHARACTER_COMPANION_STATE,
  DEFAULT_CHARACTER_CRAFTING_STATE,
  DEFAULT_CHARACTER_DRUID_FORM_STATE,
} from "@/lib/optional-systems";
import { SRD_SUBCLASS_CARDS } from "@/lib/srd-cards";

type ReviewCard = {
  id: string;
  label: string;
  kind: "foundation" | "ancestry" | "community" | "domain";
  image: string | null;
};

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cardKindLabel(kind: ReviewCard["kind"]) {
  if (kind === "foundation") return "Foundation";
  if (kind === "ancestry") return "Ancestry";
  if (kind === "community") return "Community";
  return "Domain";
}

function ExportButtons({ previewCharacter }: { previewCharacter: Record<string, unknown> }) {
  function exportJson() {
    const blob = new Blob([JSON.stringify(previewCharacter, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "character-preview.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    window.print();
  }

  return (
    <article className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-3">
      <h3 className="mb-2 text-sm text-amber-200">Export Options</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <button className="btn-outline min-h-11 px-3 py-2 text-xs" onClick={exportJson} type="button">
          Export JSON (Preview)
        </button>
        <button className="btn-outline min-h-11 px-3 py-2 text-xs" onClick={exportPdf} type="button">
          Export PDF (Print)
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        These are preview exports during creation. After save, full API exports are available on the character page.
      </p>
    </article>
  );
}

function CardTray({ cards }: { cards: ReviewCard[] }) {
  return (
    <article className="space-y-3 rounded-xl border border-amber-700/35 bg-amber-950/20 p-3">
      <h3 className="text-lg text-amber-200">Card Tray</h3>
      {cards.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.id}
              className="overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/70 p-2"
            >
              {card.image ? (
                <div
                  className="h-[20rem] w-full rounded-md border border-slate-700/60 bg-contain bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${card.image})` }}
                />
              ) : (
                <div className="h-[20rem] rounded-md border border-slate-700/60 bg-slate-950/65 px-2 py-2">
                  <p className="text-sm text-amber-100">{card.label}</p>
                  <p className="mt-1 text-xs text-slate-300">
                    No card art available for this selection.
                  </p>
                </div>
              )}
              <p className="mt-2 text-xs text-slate-300">
                {cardKindLabel(card.kind)}: <span className="text-amber-100">{card.label}</span>
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-300">No cards selected yet.</p>
      )}
    </article>
  );
}

export function ReviewFinalizeStep({
  character,
  maxDomainCards,
}: {
  character: CharacterWizardData;
  maxDomainCards: number;
}) {
  const previewInventory = character.equipmentNotes.trim()
    ? [
        {
          kind: "starting-equipment",
          text: character.equipmentNotes.trim(),
        },
        ...character.inventoryItems.filter((item) => item.kind !== "starting-equipment"),
      ]
    : character.inventoryItems.filter((item) => item.kind !== "starting-equipment");

  const previewCharacter = {
    id: 0,
    campaignId: character.campaignId,
    playerId: 0,
    name: character.name || "Unnamed Character",
    pronouns: character.pronouns || null,
    heritage: character.heritage || "Unknown",
    class: character.class || "Adventurer",
    subclass: character.subclass || "Generalist",
    level: character.level,
    traits: character.traits,
    baseEvasion: character.baseEvasion ?? 0,
    hpCurrent: character.hpCurrent ?? 0,
    hpMax: character.hpMax ?? 0,
    stressCurrent: character.stressCurrent ?? 0,
    stressMax: character.stressMax ?? 0,
    hopeCurrent: character.hopeCurrent ?? 0,
    hopeMax: character.hopeMax ?? 0,
    experienceCurrent: character.experienceCurrent ?? 0,
    experienceMax: character.experienceMax ?? 0,
    proficiency: character.proficiency,
    rallyDie: character.rallyDie,
    primaryWeaponId: character.primaryWeaponId ?? null,
    secondaryWeaponId: character.secondaryWeaponId ?? null,
    armorId: character.armorId ?? null,
    domainCards: character.domainCards,
    inventoryItems: previewInventory,
    gold: character.gold,
    handfuls: character.handfuls,
    bags: character.bags,
    debt: character.debt,
    backgroundQuestions: character.backgroundQuestions,
    connections: character.connections,
    narrativeBackstory: character.narrativeBackstory || null,
    advancementSelections: character.advancementSelections,
    resourceValues: {
      hp: {
        current: character.hpCurrent ?? 0,
        max: character.hpMax ?? null,
      },
      stress: {
        current: character.stressCurrent ?? 0,
        max: character.stressMax ?? null,
      },
      hope: {
        current: character.hopeCurrent ?? 0,
        max: character.hopeMax ?? null,
      },
      experience: {
        current: character.experienceCurrent ?? 0,
        max: character.experienceMax ?? null,
      },
    },
    conditionStates: {},
    currencyValues: {
      gold: character.gold,
      handfuls: character.handfuls,
      bags: character.bags,
    },
    customFieldValues: {},
    craftingState: DEFAULT_CHARACTER_CRAFTING_STATE,
    druidFormState: DEFAULT_CHARACTER_DRUID_FORM_STATE,
    companionState: DEFAULT_CHARACTER_COMPANION_STATE,
    inventory: [],
    resolvedCombat: null,
    createdAt: null,
    updatedAt: null,
    lastModifiedBy: null,
  };

  const trayCards = useMemo(() => {
    const cards: ReviewCard[] = [];
    const identity = describeIdentityFromHeritage(character.heritage);
    const foundationCard = SRD_SUBCLASS_CARDS.find((card) => {
      return (
        card.tier === "foundation" &&
        normalizeToken(card.className) === normalizeToken(character.class) &&
        card.subclassName === character.subclass
      );
    });

    if (foundationCard) {
      cards.push({
        id: foundationCard.id,
        label: foundationCard.subclassName,
        kind: "foundation",
        image: foundationCard.asset.publicPath,
      });
    } else if (character.subclass.trim()) {
      cards.push({
        id: `foundation-${character.subclass}`,
        label: character.subclass,
        kind: "foundation",
        image: null,
      });
    }

    for (const card of identity.ancestryCards) {
      cards.push({
        id: card.id,
        label: card.label,
        kind: "ancestry",
        image: card.image,
      });
    }

    if (identity.communityCard) {
      cards.push({
        id: identity.communityCard.id,
        label: identity.communityCard.label,
        kind: "community",
        image: identity.communityCard.image,
      });
    }

    const domainById = new Map(OFFICIAL_DOMAIN_CARDS.map((card) => [card.id, card]));
    for (const domainId of character.domainCards) {
      const card = domainById.get(domainId);
      cards.push({
        id: domainId,
        label: card?.name ?? domainId,
        kind: "domain",
        image: card?.imageUrl ?? null,
      });
    }

    return cards;
  }, [character.class, character.domainCards, character.heritage, character.subclass]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl text-amber-300">Step 9 - Review & Finalize</h2>
        <p className="text-sm text-slate-300">
          Confirm your build, check your card tray, and export a preview before saving.
        </p>
      </div>

      <p className="rounded-md border border-slate-700/50 bg-slate-900/65 px-3 py-2 text-xs text-slate-300">
        Domain Deck: {character.domainCards.length}/{maxDomainCards} cards selected.
      </p>

      <p className="rounded-md border border-slate-700/50 bg-slate-900/65 px-3 py-2 text-xs text-slate-300">
        Starting Equipment: {character.equipmentNotes?.trim() ? "Configured" : "Not configured"}
      </p>

      <CharacterSheet
        character={previewCharacter}
        title="Review Preview"
        showIdentityCards={false}
        currency={{
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
          debtEnabled: false,
          debtLabel: "Debt",
          autoConvert: false,
          showTotals: true,
          showBreakdown: true,
        }}
      />

      <CardTray cards={trayCards} />
      <ExportButtons previewCharacter={previewCharacter} />
    </section>
  );
}
