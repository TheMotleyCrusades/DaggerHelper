import type { TraitKey } from "@/lib/constants/classes";
import { SRD_DOMAIN_CARDS } from "@/lib/srd-cards";

export type DomainCardDefinition = {
  id: string;
  campaignId: number | null;
  name: string;
  class: string;
  tier: number;
  description: string;
  traitBonuses: Partial<Record<TraitKey, number>>;
  evasion: number;
  moveAbility: string;
  fragileText: string;
  featureText: string;
  imageUrl: string | null;
  colorScheme: "ember" | "verdant" | "tide" | "steel" | "arcane" | "dusk" | "default";
  isOfficial: boolean;
  domain?: string;
  level?: number;
  stressCost?: number;
  cardType?: "ability" | "spell" | "grimoire";
  sourceCardId?: string;
};

export type DomainGatingOptions = {
  disableClassDomainGating?: boolean;
  expandedDomainsByClass?: Record<string, string[]>;
};

function normalizeClassKey(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeDomainKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDomainLabel(domainKey: string) {
  const normalized = normalizeDomainKey(domainKey);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

const domainKeySet = new Set(SRD_DOMAIN_CARDS.map((card) => normalizeDomainKey(card.domain)));
export const SRD_DOMAIN_KEYS = Array.from(domainKeySet).sort();

export const CLASS_DOMAIN_BASELINE: Record<string, string[]> = {
  bard: ["codex", "grace"],
  druid: ["arcana", "sage"],
  guardian: ["blade", "valor"],
  ranger: ["bone", "sage"],
  rogue: ["grace", "midnight"],
  seraph: ["splendor", "valor"],
  sorcerer: ["arcana", "midnight"],
  warrior: ["blade", "bone"],
  wizard: ["codex", "splendor"],
};

function expandedDomainsForClass(
  expandedDomainsByClass: Record<string, string[]> | undefined,
  classKey: string
) {
  if (!expandedDomainsByClass) return [];

  const direct = expandedDomainsByClass[classKey];
  if (Array.isArray(direct)) return direct;

  for (const [rawKey, domains] of Object.entries(expandedDomainsByClass)) {
    if (normalizeClassKey(rawKey) === classKey && Array.isArray(domains)) {
      return domains;
    }
  }

  return [];
}

export function resolveAllowedDomainsForClass(
  classId: string,
  options?: DomainGatingOptions
) {
  if (options?.disableClassDomainGating) {
    return null;
  }

  const classKey = normalizeClassKey(classId);
  const baseDomains = CLASS_DOMAIN_BASELINE[classKey] ?? [];
  const expandedDomains = expandedDomainsForClass(
    options?.expandedDomainsByClass,
    classKey
  );

  const merged = [...baseDomains, ...expandedDomains]
    .map((domain) => normalizeDomainKey(domain))
    .filter((domain) => domainKeySet.has(domain));

  if (merged.length > 0) {
    return Array.from(new Set(merged));
  }

  return [...SRD_DOMAIN_KEYS];
}

export function isDomainAllowedForClass(
  domain: string,
  classId: string,
  options?: DomainGatingOptions
) {
  const allowed = resolveAllowedDomainsForClass(classId, options);
  if (!allowed) return true;

  return allowed.includes(normalizeDomainKey(domain));
}

function tierFromLevel(level: number) {
  if (level <= 2) return 1;
  if (level <= 4) return 2;
  if (level <= 7) return 3;
  return 4;
}

function toColorScheme(domain: string): DomainCardDefinition["colorScheme"] {
  const normalized = normalizeDomainKey(domain);
  if (normalized === "arcana") return "arcane";
  if (normalized === "blade") return "steel";
  if (normalized === "bone") return "dusk";
  if (normalized === "codex") return "tide";
  if (normalized === "grace") return "ember";
  if (normalized === "midnight") return "dusk";
  if (normalized === "sage") return "verdant";
  if (normalized === "splendor") return "ember";
  if (normalized === "valor") return "steel";
  return "default";
}

function titleCase(value: string) {
  return value
    .split(/[\s-]+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

export const OFFICIAL_DOMAIN_CARDS: DomainCardDefinition[] = SRD_DOMAIN_CARDS.map((card) => {
  const level = Number.isFinite(card.level) ? card.level : 1;
  const stressCost = Number.isFinite(card.stressCost) ? card.stressCost : 0;
  return {
    id: card.id,
    campaignId: null,
    name: card.title,
    class: normalizeDomainKey(card.domain),
    tier: tierFromLevel(level),
    description: card.description,
    traitBonuses: {},
    evasion: 0,
    moveAbility: "",
    fragileText: "",
    featureText: `${titleCase(card.type)} card from ${card.domain} domain.`,
    imageUrl: card.asset.publicPath,
    colorScheme: toColorScheme(card.domain),
    isOfficial: true,
    domain: card.domain,
    level,
    stressCost,
    cardType: card.type,
    sourceCardId: card.id,
  };
});
