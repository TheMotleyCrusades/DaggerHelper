"use client";

import { useMemo, useState } from "react";
import { DomainCardBrowser } from "@/components/characters/domain-card-browser";
import { DragDropDeck } from "@/components/characters/drag-drop-deck";
import type { DomainCardDefinition } from "@/lib/constants/domains";

type Props = {
  campaignId: number | null;
  className: string;
  level: number;
  maxCards: number;
  domainCards: string[];
  onChange: (next: string[]) => void;
};

export function DomainCardsStep({
  campaignId,
  className,
  level,
  maxCards,
  domainCards,
  onChange,
}: Props) {
  const [knownCards, setKnownCards] = useState<DomainCardDefinition[]>([]);

  const cardsById = useMemo(() => {
    return new Map(knownCards.map((card) => [card.id, card]));
  }, [knownCards]);

  const deckCards = useMemo(() => {
    return domainCards.map((cardId) => {
      const card = cardsById.get(cardId);
      if (card) return card;

      return {
        id: cardId,
        campaignId,
        name: cardId,
        class: className || "unknown",
        tier: 1,
        description: "Card metadata unavailable in current filter.",
        traitBonuses: {},
        evasion: 0,
        moveAbility: "",
        fragileText: "",
        featureText: "",
        imageUrl: null,
        colorScheme: "default",
        isOfficial: false,
      } satisfies DomainCardDefinition;
    });
  }, [campaignId, cardsById, className, domainCards]);

  function toggleCard(card: DomainCardDefinition) {
    if (domainCards.includes(card.id)) {
      onChange(domainCards.filter((item) => item !== card.id));
      return;
    }

    if (domainCards.length >= maxCards) {
      return;
    }

    onChange([...domainCards, card.id]);
  }

  function moveCard(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;

    const next = [...domainCards];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  }

  function removeCard(cardId: string) {
    onChange(domainCards.filter((item) => item !== cardId));
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl text-amber-300">Step 5 - Domain Cards</h2>
        <p className="text-sm text-slate-300">
          Build your deck by adding cards from the browser. Available cards follow campaign class-domain gating rules unless your GM has disabled those restrictions.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <DomainCardBrowser
          campaignId={campaignId}
          className={className}
          level={level}
          selectedIds={domainCards}
          onToggle={toggleCard}
          onCardsLoaded={setKnownCards}
        />

        <DragDropDeck cards={deckCards} maxCards={maxCards} onMove={moveCard} onRemove={removeCard} />
      </div>

      <p className="text-xs text-slate-400">
        Deck limit is controlled by campaign settings. Current: {domainCards.length}/{maxCards}.
      </p>
    </section>
  );
}
