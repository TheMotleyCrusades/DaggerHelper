import {
  OFFICIAL_DOMAIN_CARDS,
  normalizeDomainKey,
  resolveAllowedDomainsForClass,
  type DomainCardDefinition,
} from "@/lib/constants/domains";

type DomainValidationOptions = {
  classId: string;
  domainCardIds: string[];
  customCards?: DomainCardDefinition[];
  disableClassDomainGating?: boolean;
  expandedDomainsByClass?: Record<string, string[]>;
};

export function validateDomainCardSelection(options: DomainValidationOptions) {
  const classId = options.classId.trim().toLowerCase();
  const disableClassDomainGating = Boolean(options.disableClassDomainGating);
  const allowedDomains = resolveAllowedDomainsForClass(classId, {
    disableClassDomainGating,
    expandedDomainsByClass: options.expandedDomainsByClass,
  });

  const officialById = new Map(OFFICIAL_DOMAIN_CARDS.map((card) => [card.id, card]));
  const customById = new Map((options.customCards ?? []).map((card) => [card.id, card]));

  const unknownCards: string[] = [];
  const restrictedCards: string[] = [];

  for (const cardId of options.domainCardIds) {
    const card = officialById.get(cardId) ?? customById.get(cardId);
    if (!card) {
      unknownCards.push(cardId);
      continue;
    }

    if (disableClassDomainGating) {
      continue;
    }

    if (card.isOfficial) {
      const domainKey = normalizeDomainKey(card.domain ?? "");
      if (allowedDomains && !allowedDomains.includes(domainKey)) {
        restrictedCards.push(card.name);
      }
      continue;
    }

    if (card.class.trim().toLowerCase() !== classId) {
      restrictedCards.push(card.name);
    }
  }

  if (unknownCards.length > 0) {
    return {
      valid: false as const,
      error: `Unknown domain card ids: ${unknownCards.slice(0, 5).join(", ")}`,
    };
  }

  if (restrictedCards.length > 0) {
    return {
      valid: false as const,
      error: `Domain cards restricted by current class-domain rules: ${restrictedCards
        .slice(0, 5)
        .join(", ")}`,
    };
  }

  return { valid: true as const };
}
