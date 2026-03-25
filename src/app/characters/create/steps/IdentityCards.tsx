"use client";

import { useMemo } from "react";
import {
  ANCESTRY_CARDS,
  COMMUNITY_CARDS,
  type IdentityChoiceCard,
} from "@/lib/constants/identityCards";
import {
  formatIdentityToHeritage,
  parseHeritageToIdentity,
} from "@/lib/character-identity";
import type { HomebrewEntityRecord } from "@/lib/homebrew-library";

type Props = {
  heritage: string;
  allowedAncestryIds: string[];
  allowedCommunityIds: string[];
  ancestryOptions: HomebrewEntityRecord[];
  communityOptions: HomebrewEntityRecord[];
  loadingIdentityOptions: boolean;
  identityOptionsError: string | null;
  onChange: (nextHeritage: string) => void;
};

type IdentityCardOption = {
  id: string;
  label: string;
  summary: string;
  topTrait: string;
  bottomTrait: string;
  image: string;
};

const COMMUNITY_ALLOWLIST_ALIASES: Record<string, string[]> = {
  highborne: ["highborn"],
};

const ANCESTRY_ALLOWLIST_ALIASES: Record<string, string[]> = {
  giant: ["giantkin"],
};

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function summarizeDescription(value: string, fallback: string) {
  const firstLine = value.split("\n")[0]?.trim();
  if (!firstLine) return fallback;
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine;
}

function cardMatchesAllowlist(
  card: { id: string; label: string },
  allowlist: string[],
  aliases: string[] = []
) {
  if (allowlist.length === 0) return true;
  const normalizedAllowlist = new Set(allowlist.map(normalizeToken));
  const candidates = [card.id, card.label, ...aliases].map(normalizeToken);
  return candidates.some((candidate) => normalizedAllowlist.has(candidate));
}

function buildIdentityOption(
  record: HomebrewEntityRecord,
  officialLookup: Map<string, IdentityChoiceCard>
): IdentityCardOption {
  const official = officialLookup.get(record.id);
  if (official) {
    return {
      id: official.id,
      label: official.label,
      summary: official.summary,
      topTrait: official.topTrait,
      bottomTrait: official.bottomTrait,
      image: official.image,
    };
  }

  return {
    id: record.id,
    label: record.name,
    summary: summarizeDescription(record.description, "Custom option"),
    topTrait: record.tags[0] ? `Tag: ${record.tags[0]}` : "Custom option",
    bottomTrait:
      record.tags[1] || summarizeDescription(record.description, "Defined by campaign GM."),
    image: "",
  };
}

function IdentityCard({
  card,
  selected,
  onSelect,
}: {
  card: IdentityCardOption;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const hasImage = Boolean(card.image);

  return (
    <button
      type="button"
      onClick={() => onSelect(card.id)}
      className={`w-full overflow-hidden rounded-xl border text-left transition touch-manipulation sm:w-72 sm:shrink-0 ${
        selected
          ? "border-amber-500/80 bg-amber-950/35"
          : "border-slate-700/50 bg-slate-900/70 hover:border-amber-500/45"
      }`}
    >
      {hasImage ? (
        <div className="p-2">
          <div
            className="h-64 w-full rounded-lg border border-slate-700/60 bg-contain bg-center bg-no-repeat sm:h-[25rem]"
            style={{
              backgroundImage: `url(${card.image})`,
            }}
          />
          <span className="sr-only">{card.label}</span>
        </div>
      ) : (
        <div className="space-y-1 p-3">
          <p className="text-base text-amber-100">{card.label}</p>
          <p className="text-xs text-slate-300">{card.summary}</p>
          <div className="rounded-md border border-slate-700/60 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-300">
            <p>{card.topTrait}</p>
            <p className="mt-1">{card.bottomTrait}</p>
          </div>
        </div>
      )}
    </button>
  );
}

function CardTrayCard({
  card,
  slot,
}: {
  card: IdentityCardOption;
  slot: string;
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/70 p-2">
      {card.image ? (
        <div
          className="h-64 w-full rounded-md border border-slate-700/60 bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${card.image})` }}
        />
      ) : (
        <div className="rounded-md border border-slate-700/60 bg-slate-950/60 px-2 py-2">
          <p className="text-sm text-amber-100">{card.label}</p>
          <p className="mt-1 text-xs text-slate-300">{card.summary}</p>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-300">
        {slot}: <span className="text-amber-100">{card.label}</span>
      </p>
    </article>
  );
}

export function IdentityCardsStep({
  heritage,
  allowedAncestryIds,
  allowedCommunityIds,
  ancestryOptions,
  communityOptions,
  loadingIdentityOptions,
  identityOptionsError,
  onChange,
}: Props) {
  const officialAncestryById = useMemo(
    () => new Map(ANCESTRY_CARDS.map((item) => [item.id, item])),
    []
  );
  const officialCommunityById = useMemo(
    () => new Map(COMMUNITY_CARDS.map((item) => [item.id, item])),
    []
  );

  const availableAncestries = useMemo(() => {
    const mapped = ancestryOptions.map((item) => buildIdentityOption(item, officialAncestryById));
    return mapped.filter((item) =>
      cardMatchesAllowlist(item, allowedAncestryIds, ANCESTRY_ALLOWLIST_ALIASES[item.id] ?? [])
    );
  }, [allowedAncestryIds, ancestryOptions, officialAncestryById]);

  const availableCommunities = useMemo(() => {
    const mapped = communityOptions.map((item) =>
      buildIdentityOption(item, officialCommunityById)
    );
    return mapped.filter((item) =>
      cardMatchesAllowlist(item, allowedCommunityIds, COMMUNITY_ALLOWLIST_ALIASES[item.id] ?? [])
    );
  }, [allowedCommunityIds, communityOptions, officialCommunityById]);

  const ancestryById = useMemo(
    () => new Map(availableAncestries.map((item) => [item.id, item])),
    [availableAncestries]
  );
  const communityById = useMemo(
    () => new Map(availableCommunities.map((item) => [item.id, item])),
    [availableCommunities]
  );

  const parsedIdentity = useMemo(() => parseHeritageToIdentity(heritage), [heritage]);

  const selectedAncestryCards = useMemo(() => {
    return parsedIdentity.ancestries
      .map((id) => ancestryById.get(id) ?? null)
      .filter((item): item is IdentityCardOption => Boolean(item));
  }, [ancestryById, parsedIdentity.ancestries]);

  const selectedCommunityCard = useMemo(() => {
    if (!parsedIdentity.community) return null;
    return communityById.get(parsedIdentity.community) ?? null;
  }, [communityById, parsedIdentity.community]);

  function setIdentity(ancestries: string[], community: string) {
    onChange(formatIdentityToHeritage(ancestries, community));
  }

  function toggleAncestry(cardId: string) {
    const current = parsedIdentity.ancestries;
    if (current.includes(cardId)) {
      setIdentity(
        current.filter((item) => item !== cardId),
        parsedIdentity.community
      );
      return;
    }

    if (current.length >= 2) {
      setIdentity([current[0], cardId], parsedIdentity.community);
      return;
    }

    setIdentity([...current, cardId], parsedIdentity.community);
  }

  function selectCommunity(cardId: string) {
    if (parsedIdentity.community === cardId) {
      setIdentity(parsedIdentity.ancestries, "");
      return;
    }

    setIdentity(parsedIdentity.ancestries, cardId);
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl text-amber-300">Step 2 - Ancestry & Community</h2>
        <p className="text-sm text-slate-300">
          Choose ancestry and community cards after class/foundation path selection.
        </p>
      </div>

      {loadingIdentityOptions && (
        <p className="text-xs text-slate-400">Loading ancestry/community card options...</p>
      )}
      {identityOptionsError && <p className="text-xs text-red-400">{identityOptionsError}</p>}

      <article className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-900/65 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg text-amber-200">Ancestry Cards</h3>
          <p className="text-xs text-slate-400">
            Mixed heritage supported: select up to 2 ancestries.
          </p>
        </div>
        <div className="sm:overflow-x-auto sm:pb-1">
          <div className="grid gap-3 sm:flex sm:min-w-max">
            {availableAncestries.map((card) => (
              <IdentityCard
                key={card.id}
                card={card}
                selected={parsedIdentity.ancestries.includes(card.id)}
                onSelect={toggleAncestry}
              />
            ))}
          </div>
        </div>
      </article>

      <article className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-900/65 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg text-amber-200">Community Cards</h3>
          <p className="text-xs text-slate-400">Pick one community card to complete identity.</p>
        </div>
        <div className="sm:overflow-x-auto sm:pb-1">
          <div className="grid gap-3 sm:flex sm:min-w-max">
            {availableCommunities.map((card) => (
              <IdentityCard
                key={card.id}
                card={card}
                selected={parsedIdentity.community === card.id}
                onSelect={selectCommunity}
              />
            ))}
          </div>
        </div>
      </article>

      <article className="space-y-3 rounded-xl border border-amber-700/35 bg-amber-950/20 p-3">
        <h3 className="text-lg text-amber-200">Card Tray</h3>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-700/50 bg-slate-950/60 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">Ancestry Slot</p>
            {selectedAncestryCards.length ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {selectedAncestryCards.map((card) => (
                  <CardTrayCard key={card.id} card={card} slot="Ancestry" />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">Select one or two ancestry cards.</p>
            )}
          </div>

          <div className="rounded-lg border border-slate-700/50 bg-slate-950/60 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">Community Slot</p>
            {selectedCommunityCard ? (
              <div className="mt-2">
                <CardTrayCard card={selectedCommunityCard} slot="Community" />
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">Select one community card.</p>
            )}
          </div>
        </div>

        <p className="rounded-md border border-slate-700/50 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
          Heritage Preview: {heritage || "Incomplete identity selection"}
        </p>
      </article>
    </section>
  );
}
