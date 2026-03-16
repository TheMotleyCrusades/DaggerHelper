import { SRD_ANCESTRY_CARDS, SRD_COMMUNITY_CARDS } from "@/lib/srd-cards";

export type IdentityChoiceCard = {
  id: string;
  label: string;
  summary: string;
  details: string;
  image: string;
  topTrait: string;
  bottomTrait: string;
  srdCardId: string;
};

const NOISE_MARKERS = [
  "CORE MECHANICS FLOW OF THE GAME",
  "PLAYER PRINCIPLES",
  "BEST PRACTICES",
  "Core Gameplay Loop",
  "The Spotlight",
] as const;

function toCardId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripNoise(value: string) {
  let cleaned = value.replace(/\r\n/g, "\n").trim();
  for (const marker of NOISE_MARKERS) {
    const markerIndex = cleaned.indexOf(marker);
    if (markerIndex > -1) {
      cleaned = cleaned.slice(0, markerIndex).trim();
    }
  }
  return cleaned;
}

function firstSentence(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";
  const match = normalized.match(/^[^.!?]+[.!?]?/);
  return match?.[0]?.trim() ?? normalized;
}

function extractTraitLines(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const traitMatches = [...normalized.matchAll(/([A-Z][A-Za-z' -]{1,40}:\s*[^.?!]+[.?!]?)/g)].map(
    (match) => match[1].trim()
  );

  if (traitMatches.length > 0) {
    return traitMatches;
  }

  return normalized
    .split(/(?<=[.?!])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function mapDescription(description: string) {
  const cleaned = stripNoise(description);
  const [intro = "", ...rest] = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const traits = extractTraitLines(rest.join(" "));
  return {
    summary: firstSentence(intro || cleaned),
    details: cleaned,
    topTrait: traits[0] ?? "No trait text available.",
    bottomTrait: traits[1] ?? "See full card text for additional details.",
  };
}

export const ANCESTRY_CARDS: IdentityChoiceCard[] = SRD_ANCESTRY_CARDS.map((card) => {
  const parsed = mapDescription(card.description);
  return {
    id: toCardId(card.ancestryName),
    label: card.ancestryName,
    summary: parsed.summary,
    details: parsed.details,
    image: card.asset.publicPath,
    topTrait: parsed.topTrait,
    bottomTrait: parsed.bottomTrait,
    srdCardId: card.id,
  };
});

export const COMMUNITY_CARDS: IdentityChoiceCard[] = SRD_COMMUNITY_CARDS.map((card) => {
  const parsed = mapDescription(card.description);
  const personalityWords = card.personalityWords.filter(Boolean).join(", ");
  return {
    id: toCardId(card.communityName),
    label: card.communityName,
    summary: parsed.summary,
    details: parsed.details,
    image: card.asset.publicPath,
    topTrait: parsed.topTrait,
    bottomTrait: parsed.bottomTrait.includes("See full card text")
      ? personalityWords
        ? `Personality words: ${personalityWords}`
        : parsed.bottomTrait
      : parsed.bottomTrait,
    srdCardId: card.id,
  };
});
