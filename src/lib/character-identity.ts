import { ANCESTRY_CARDS, COMMUNITY_CARDS } from "@/lib/constants/identityCards";

export type ParsedIdentity = {
  ancestries: string[];
  community: string;
};

const ANCESTRY_ALIASES: Record<string, string> = {
  giantkin: "giant",
};

const COMMUNITY_ALIASES: Record<string, string> = {
  highborn: "highborne",
};

function normalizeValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCaseToken(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function findAncestryId(labelOrId: string) {
  const normalized = ANCESTRY_ALIASES[normalizeValue(labelOrId)] ?? normalizeValue(labelOrId);
  if (!normalized) return "";
  const found = ANCESTRY_CARDS.find((item) => {
    return item.id === normalized || normalizeValue(item.label) === normalized;
  });
  return found?.id ?? normalized;
}

function findCommunityId(labelOrId: string) {
  const normalized = COMMUNITY_ALIASES[normalizeValue(labelOrId)] ?? normalizeValue(labelOrId);
  if (!normalized) return "";
  const found = COMMUNITY_CARDS.find((item) => {
    return item.id === normalized || normalizeValue(item.label) === normalized;
  });
  return found?.id ?? normalized;
}

function toLabel(id: string, type: "ancestry" | "community") {
  const collection = type === "ancestry" ? ANCESTRY_CARDS : COMMUNITY_CARDS;
  const found = collection.find((item) => item.id === id);
  return found?.label ?? (titleCaseToken(id) || id);
}

export function formatIdentityToHeritage(ancestries: string[], community: string) {
  const normalizedAncestries = ancestries
    .map((item) => findAncestryId(item))
    .filter(Boolean)
    .slice(0, 2);
  const normalizedCommunity = findCommunityId(community);

  const ancestryLabel = normalizedAncestries.map((item) => toLabel(item, "ancestry")).join(" + ");

  if (!ancestryLabel && !normalizedCommunity) {
    return "";
  }

  if (!normalizedCommunity) {
    return ancestryLabel;
  }

  if (!ancestryLabel) {
    return `${toLabel(normalizedCommunity, "community")} Community`;
  }

  return `${ancestryLabel} | ${toLabel(normalizedCommunity, "community")} Community`;
}

export function parseHeritageToIdentity(heritage: string): ParsedIdentity {
  const trimmed = heritage.trim();
  if (!trimmed) {
    return {
      ancestries: [],
      community: "",
    };
  }

  const [left, right] = trimmed.split("|").map((item) => item.trim());

  const ancestrySource = left || trimmed;
  const ancestries = ancestrySource
    .split("+")
    .map((item) => item.replace(/community$/i, "").trim())
    .map((item) => findAncestryId(item))
    .filter(Boolean)
    .slice(0, 2);

  const communitySource = right
    ? right.replace(/community$/i, "").trim()
    : trimmed.toLowerCase().includes("community")
      ? trimmed.replace(/community$/i, "").trim()
      : "";

  const community = findCommunityId(communitySource);

  return {
    ancestries,
    community,
  };
}

export function describeIdentityFromHeritage(heritage: string) {
  const parsed = parseHeritageToIdentity(heritage);
  return {
    ancestryCards: parsed.ancestries
      .map((id) => ANCESTRY_CARDS.find((item) => item.id === id) ?? null)
      .filter((item): item is (typeof ANCESTRY_CARDS)[number] => Boolean(item)),
    communityCard: COMMUNITY_CARDS.find((item) => item.id === parsed.community) ?? null,
  };
}
