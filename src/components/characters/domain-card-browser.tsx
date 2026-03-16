"use client";

import { useEffect, useMemo, useState } from "react";
import { DomainCard } from "@/components/characters/domain-card";
import type { DomainCardDefinition } from "@/lib/constants/domains";

function tierFromLevel(level: number) {
  if (level <= 2) return 1;
  if (level <= 4) return 2;
  if (level <= 7) return 3;
  return 4;
}

export function DomainCardBrowser({
  campaignId,
  className,
  level,
  selectedIds,
  onToggle,
  onCardsLoaded,
}: {
  campaignId: number | null;
  className: string;
  level: number;
  selectedIds: string[];
  onToggle: (card: DomainCardDefinition) => void;
  onCardsLoaded?: (cards: DomainCardDefinition[]) => void;
}) {
  const [cards, setCards] = useState<DomainCardDefinition[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxTier = tierFromLevel(level);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!campaignId || !className) {
        setCards([]);
        onCardsLoaded?.([]);
        return;
      }

      setLoading(true);
      const params = new URLSearchParams();
      params.set("campaignId", campaignId.toString());
      params.set("class", className);

      const response = await fetch(`/api/domain-cards?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (cancelled) return;

      if (!response.ok) {
        setError(data.error ?? "Failed to load domain cards");
        setLoading(false);
        return;
      }

      setCards(Array.isArray(data) ? data : []);
      onCardsLoaded?.(Array.isArray(data) ? data : []);
      setError(null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [campaignId, className, onCardsLoaded]);

  const filteredCards = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return cards.filter((card) => {
      const tierAllowed =
        typeof card.level === "number" && Number.isFinite(card.level)
          ? card.level <= level
          : card.tier <= maxTier;
      if (!tierAllowed) return false;
      if (!normalizedSearch) return true;

      return (
        card.name.toLowerCase().includes(normalizedSearch) ||
        card.description.toLowerCase().includes(normalizedSearch) ||
        card.featureText.toLowerCase().includes(normalizedSearch) ||
        card.domain?.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [cards, level, maxTier, search]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg text-amber-200">Available Domain Cards</h3>
        <span className="text-xs text-slate-300">
          Class: {className || "-"} | Max Tier: {maxTier}
        </span>
      </div>

      <input
        className="field"
        placeholder="Search by name, text, or domain"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {loading && <p className="text-sm text-slate-300">Loading domain cards...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredCards.map((card) => {
          const selected = selectedIds.includes(card.id);
          return (
            <DomainCard
              key={card.id}
              card={card}
              selected={selected}
              onSelect={onToggle}
              actionLabel={selected ? "Remove" : "Add to Deck"}
            />
          );
        })}
      </div>

      {!loading && !filteredCards.length && (
        <p className="text-sm text-slate-300">No domain cards available for the current filters.</p>
      )}
    </section>
  );
}
