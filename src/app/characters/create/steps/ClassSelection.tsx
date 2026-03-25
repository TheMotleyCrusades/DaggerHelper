"use client";

import { useMemo } from "react";
import { getClassDefinition } from "@/lib/constants/classes";
import { SRD_SUBCLASS_CARDS, type SrdSubclassCard } from "@/lib/srd-cards";
import type {
  HomebrewEntityRecord,
  HomebrewSubclassRecord,
} from "@/lib/homebrew-library";

type Props = {
  className: string;
  subclass: string;
  allowedClassIds: string[];
  classOptions: HomebrewEntityRecord[];
  subclassOptions: HomebrewSubclassRecord[];
  loadingIdentityOptions: boolean;
  identityOptionsError: string | null;
  showHeader?: boolean;
  showStatus?: boolean;
  onChange: (data: { class: string; subclass: string }) => void;
};

type FoundationCard = {
  id: string;
  subclassName: string;
  summary: string;
  description: string;
  spellcastTrait: string | null;
  image: string;
};

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function summarizeLine(value: string, fallback: string) {
  const firstLine = value.split("\n")[0]?.trim();
  if (!firstLine) return fallback;
  return firstLine.length > 160 ? `${firstLine.slice(0, 157)}...` : firstLine;
}

function hashHue(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) % 360;
  }
  return hash;
}

function classGradient(value: string) {
  const hue = hashHue(value || "class");
  const secondaryHue = (hue + 38) % 360;
  const tertiaryHue = (hue + 115) % 360;
  return `linear-gradient(140deg, hsla(${hue}, 72%, 46%, 0.3), hsla(${secondaryHue}, 68%, 34%, 0.22), hsla(${tertiaryHue}, 62%, 16%, 0.9))`;
}

function formatDomainLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function collectTopTraitFocus(values: Record<string, number>) {
  return Object.entries(values)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([trait, value]) => `${formatDomainLabel(trait)} ${value >= 0 ? `+${value}` : value}`);
}

function buildFoundationCard(
  record: HomebrewSubclassRecord,
  srdLookup: Map<string, SrdSubclassCard>
) {
  const classKey = normalizeToken(record.classId);
  const fallback = SRD_SUBCLASS_CARDS.find(
    (card) =>
      card.tier === "foundation" &&
      normalizeToken(card.className) === classKey &&
      card.subclassName === record.name
  );
  const card = srdLookup.get(record.id) ?? fallback;

  return {
    id: record.id,
    subclassName: record.name,
    summary: card?.summary ?? summarizeLine(record.description, "Subclass details unavailable."),
    description: record.description || card?.description || "",
    spellcastTrait: record.spellcastTrait ?? card?.spellcastTrait ?? null,
    image: card?.asset.publicPath ?? "",
  } satisfies FoundationCard;
}

export function ClassSelectionStep({
  className,
  subclass,
  allowedClassIds,
  classOptions,
  subclassOptions,
  loadingIdentityOptions,
  identityOptionsError,
  showHeader = true,
  showStatus = true,
  onChange,
}: Props) {
  const classAllowlist = useMemo(
    () => new Set(allowedClassIds.map(normalizeToken)),
    [allowedClassIds]
  );

  const availableClasses = useMemo(() => {
    const filtered = classAllowlist.size
      ? classOptions.filter((item) => classAllowlist.has(normalizeToken(item.id)))
      : classOptions;

    return [...filtered].sort((left, right) => left.name.localeCompare(right.name));
  }, [classAllowlist, classOptions]);

  const srdBySubclassId = useMemo(
    () => new Map(SRD_SUBCLASS_CARDS.map((card) => [card.id, card])),
    []
  );

  const foundationsByClass = useMemo(() => {
    const byClass = new Map<string, FoundationCard[]>();
    for (const record of subclassOptions) {
      const classId = normalizeToken(record.classId);
      const card = buildFoundationCard(record, srdBySubclassId);
      const current = byClass.get(classId) ?? [];
      current.push(card);
      byClass.set(classId, current);
    }

    for (const [classId, cards] of byClass.entries()) {
      byClass.set(
        classId,
        [...cards].sort((left, right) => left.subclassName.localeCompare(right.subclassName))
      );
    }

    return byClass;
  }, [srdBySubclassId, subclassOptions]);

  const selectedClass = useMemo(
    () =>
      availableClasses.find((item) => item.id === className) ??
      classOptions.find((item) => item.id === className) ??
      null,
    [availableClasses, className, classOptions]
  );

  const selectedClassId = useMemo(
    () => normalizeToken(selectedClass?.id ?? ""),
    [selectedClass]
  );

  const selectedFoundations = useMemo(() => {
    if (!selectedClass) return [];
    return foundationsByClass.get(selectedClassId) ?? [];
  }, [foundationsByClass, selectedClass, selectedClassId]);

  const selectedSubclass = useMemo(
    () =>
      selectedFoundations.find((item) => item.subclassName === subclass) ??
      selectedFoundations[0] ??
      null,
    [selectedFoundations, subclass]
  );

  const selectedClassDefinition = getClassDefinition(selectedClass?.id ?? "");

  const buildPathRows = useMemo(() => {
    if (selectedFoundations.length > 0) {
      return selectedFoundations.map((foundation) => ({
        title: foundation.subclassName,
        summary:
          foundation.summary ||
          summarizeLine(foundation.description, "Subclass details unavailable."),
      }));
    }

    if (selectedClassDefinition?.subclasses.length) {
      return selectedClassDefinition.subclasses.map((item) => ({
        title: item,
        summary: "Campaign or personal path details can be customized by your GM.",
      }));
    }

    return [
      {
        title: "Foundation Path",
        summary:
          "No predefined foundation paths are available for this class in the active campaign.",
      },
    ];
  }, [selectedClassDefinition, selectedFoundations]);

  const traitFocus = selectedClassDefinition
    ? collectTopTraitFocus(selectedClassDefinition.recommendedTraits)
    : [];

  return (
    <section className="space-y-4">
      {showHeader && (
        <div>
          <h2 className="text-2xl text-amber-300">Foundation Path</h2>
          <p className="text-sm text-slate-300">
            Pick your starting foundation path card for the selected class.
          </p>
        </div>
      )}

      {showStatus && loadingIdentityOptions && (
        <p className="text-xs text-slate-400">Loading class and subclass options...</p>
      )}
      {showStatus && identityOptionsError && (
        <p className="text-xs text-red-400">{identityOptionsError}</p>
      )}

      {!selectedClass && (
        <article className="rounded-xl border border-amber-600/35 bg-amber-950/20 p-3 text-sm text-amber-100">
          Select a class in Step 1 to unlock foundation path cards.
        </article>
      )}

      {selectedClass && (
        <article className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/70">
          <div
            className="space-y-1 border-b border-slate-700/50 px-4 py-4"
            style={{
              backgroundImage: classGradient(selectedClass.id),
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-200/75">
              Class Overview
            </p>
            <p className="text-2xl text-amber-100">{selectedClass.name}</p>
            <p className="max-w-3xl text-sm text-slate-200/85">{selectedClass.description}</p>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-2">
              {selectedClassDefinition ? (
                <div className="grid gap-2 text-xs text-slate-200 sm:grid-cols-2">
                  <p className="rounded-md border border-slate-700/50 bg-slate-950/60 px-2 py-1">
                    Starting HP: {selectedClassDefinition.startingHp}
                  </p>
                  <p className="rounded-md border border-slate-700/50 bg-slate-950/60 px-2 py-1">
                    Starting Evasion: {selectedClassDefinition.startingEvasion}
                  </p>
                  <p className="rounded-md border border-slate-700/50 bg-slate-950/60 px-2 py-1 sm:col-span-2">
                    Domains:{" "}
                    {selectedClassDefinition.classDomains
                      .map((item) => formatDomainLabel(item))
                      .join(" & ")}
                  </p>
                  <p className="rounded-md border border-slate-700/50 bg-slate-950/60 px-2 py-1 sm:col-span-2">
                    Hope Feature:{" "}
                    <span className="text-amber-100">
                      {selectedClassDefinition.hopeFeatureName}
                    </span>{" "}
                    - {selectedClassDefinition.hopeFeatureSummary}
                  </p>
                  <p className="rounded-md border border-slate-700/50 bg-slate-950/60 px-2 py-1 sm:col-span-2">
                    Class Feature:{" "}
                    <span className="text-amber-100">
                      {selectedClassDefinition.classFeatureName}
                    </span>{" "}
                    - {selectedClassDefinition.classFeatureSummary}
                  </p>
                  <p className="rounded-md border border-slate-700/50 bg-slate-950/60 px-2 py-1 sm:col-span-2">
                    Suggested trait lean: {traitFocus.join(", ")}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Custom class selected. Starting HP and Evasion can be tuned in later steps.
                </p>
              )}

              <div className="rounded-lg border border-slate-700/55 bg-slate-950/60 p-3">
                <p className="text-sm text-amber-200">Viable Build Paths</p>
                <ul className="mt-2 space-y-1 text-[11px] text-slate-300">
                  {buildPathRows.map((path) => (
                    <li
                      key={path.title}
                      className="rounded-md border border-slate-700/45 bg-slate-900/55 px-2 py-1"
                    >
                      <span className="text-amber-100">{path.title}:</span> {path.summary}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-lg border border-slate-700/55 bg-slate-950/60 p-3">
              <p className="text-sm text-amber-200">Class Artwork</p>
              <div className="mt-2 rounded-md border border-slate-700/50 bg-slate-900/65 p-2">
                <div
                  className="h-64 w-full rounded-md border border-slate-700/55 bg-contain bg-center bg-no-repeat sm:h-[24rem]"
                  style={{
                    backgroundImage: classGradient(selectedClass.id),
                  }}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Placeholder panel. Replace with official class art when assets are ready.
              </p>
            </div>
          </div>
        </article>
      )}

      {selectedClass && (
        <article className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-900/65 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg text-amber-200">Foundation Path Cards</h3>
            <p className="text-xs text-slate-400">
              Pick the card this character starts with.
            </p>
          </div>
          {selectedFoundations.length > 0 && (
            <label className="text-xs text-slate-300">
              Foundation Selector (mobile-safe fallback)
              <select
                className="field mt-1"
                value={subclass}
                onChange={(event) =>
                  onChange({ class: selectedClass.id, subclass: event.target.value })
                }
              >
                {selectedFoundations.map((card) => (
                  <option key={card.id} value={card.subclassName}>
                    {card.subclassName}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selectedFoundations.length > 0 ? (
            <div className="sm:overflow-x-auto sm:pb-1">
              <div className="grid gap-3 sm:flex sm:min-w-max">
                {selectedFoundations.map((card) => {
                  const selected = card.subclassName === subclass;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => onChange({ class: selectedClass.id, subclass: card.subclassName })}
                      className={`w-full overflow-hidden rounded-xl border text-left transition touch-manipulation sm:w-72 sm:shrink-0 ${
                        selected
                          ? "border-amber-500/80 bg-amber-950/35"
                          : "border-slate-700/50 bg-slate-900/70 hover:border-amber-500/45"
                      }`}
                    >
                      {card.image ? (
                        <div className="p-2">
                          <div
                            className="h-64 w-full rounded-lg border border-slate-700/60 bg-contain bg-center bg-no-repeat sm:h-[24rem]"
                            style={{
                              backgroundImage: `url(${card.image})`,
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          className="h-40 w-full border-b border-slate-700/50"
                          style={{
                            backgroundImage: classGradient(card.subclassName),
                          }}
                        />
                      )}
                      <div className="space-y-1 p-3">
                        <p className="text-sm text-amber-100">{card.subclassName}</p>
                        {card.spellcastTrait && (
                          <p className="text-[11px] text-slate-400">
                            Spellcast Trait: {card.spellcastTrait}
                          </p>
                        )}
                        <p className="line-clamp-3 text-xs text-slate-300">{card.summary}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              No predefined foundation path cards are available for this class in the active
              campaign.
            </p>
          )}
          {selectedSubclass && (
            <p className="text-xs text-amber-200">Selected path: {selectedSubclass.subclassName}</p>
          )}
        </article>
      )}
    </section>
  );
}
