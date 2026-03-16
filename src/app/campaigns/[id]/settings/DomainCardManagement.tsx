"use client";

import { FormEvent, useMemo, useState } from "react";
import type { DomainCardDefinition } from "@/lib/constants/domains";

type NewCardForm = {
  name: string;
  class: string;
  tier: number;
  description: string;
  featureText: string;
};

const EMPTY_FORM: NewCardForm = {
  name: "",
  class: "",
  tier: 1,
  description: "",
  featureText: "",
};

export function DomainCardManagement({
  campaignId,
  cards,
  onRefresh,
}: {
  campaignId: number;
  cards: DomainCardDefinition[];
  onRefresh: () => Promise<void> | void;
}) {
  const [form, setForm] = useState<NewCardForm>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [showOfficial, setShowOfficial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCards = useMemo(() => {
    const baseCards = showOfficial
      ? cards
      : cards.filter((card) => !card.isOfficial || card.campaignId === campaignId);
    const normalized = search.trim().toLowerCase();
    if (!normalized) return baseCards;

    return baseCards.filter((card) => {
      return (
        card.name.toLowerCase().includes(normalized) ||
        card.class.toLowerCase().includes(normalized) ||
        card.featureText.toLowerCase().includes(normalized) ||
        card.domain?.toLowerCase().includes(normalized)
      );
    });
  }, [campaignId, cards, search, showOfficial]);

  async function createCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const response = await fetch("/api/domain-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        name: form.name,
        class: form.class,
        tier: form.tier,
        description: form.description,
        featureText: form.featureText,
        fragileText: "",
        moveAbility: "",
        traitBonuses: {},
        evasion: 0,
        colorScheme: "default",
      }),
    });

    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to create domain card");
      return;
    }

    setForm(EMPTY_FORM);
    setError(null);
    await onRefresh();
  }

  async function deleteCard(cardId: string) {
    if (!confirm("Delete this custom domain card?")) return;

    const response = await fetch(`/api/domain-cards/${cardId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Failed to delete domain card");
      return;
    }

    await onRefresh();
  }

  async function editCard(card: DomainCardDefinition) {
    const nextName = prompt("Update card name", card.name);
    if (!nextName) return;
    const nextFeature = prompt("Update feature text", card.featureText) ?? card.featureText;

    const response = await fetch(`/api/domain-cards/${card.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nextName,
        featureText: nextFeature,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Failed to update domain card");
      return;
    }

    await onRefresh();
  }

  return (
    <section className="space-y-4">
      <h3 className="text-lg text-amber-200">Domain Card Management</h3>

      <form className="grid gap-2 rounded-xl border border-slate-700/50 bg-slate-900/65 p-3 sm:grid-cols-2" onSubmit={createCard}>
        <label className="text-xs text-slate-300">
          Name
          <input
            className="field mt-1"
            required
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </label>
        <label className="text-xs text-slate-300">
          Class
          <input
            className="field mt-1"
            required
            value={form.class}
            onChange={(event) => setForm((current) => ({ ...current, class: event.target.value }))}
          />
        </label>
        <label className="text-xs text-slate-300">
          Tier
          <input
            className="field mt-1"
            type="number"
            min={1}
            max={4}
            value={form.tier}
            onChange={(event) =>
              setForm((current) => ({ ...current, tier: Number(event.target.value) || 1 }))
            }
          />
        </label>
        <label className="text-xs text-slate-300 sm:col-span-2">
          Description
          <input
            className="field mt-1"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
          />
        </label>
        <label className="text-xs text-slate-300 sm:col-span-2">
          Feature Text
          <textarea
            className="field mt-1 min-h-20"
            value={form.featureText}
            onChange={(event) =>
              setForm((current) => ({ ...current, featureText: event.target.value }))
            }
          />
        </label>

        <button className="btn-primary min-h-11 px-3 py-2 text-xs sm:col-span-2" disabled={saving}>
          {saving ? "Creating..." : "Create Custom Domain Card"}
        </button>
      </form>

      <input
        className="field"
        placeholder="Search cards"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={showOfficial}
          onChange={(event) => setShowOfficial(event.target.checked)}
        />
        Show official SRD cards ({cards.filter((card) => card.isOfficial).length})
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {filteredCards.map((card) => {
          const isCustom = !card.isOfficial && card.campaignId === campaignId;
          return (
            <article key={card.id} className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3">
              <p className="text-sm text-amber-100">{card.name}</p>
              <p className="text-xs text-slate-400">
                {card.class} | Tier {card.tier} | {card.isOfficial ? "Official" : "Custom"}
              </p>
              <p className="mt-1 text-xs text-slate-300">{card.featureText}</p>
              {isCustom && (
                <div className="mt-2 flex gap-2">
                  <button
                    className="rounded-md border border-slate-500/45 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                    onClick={() => editCard(card)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-md border border-red-400/45 px-2 py-1 text-xs text-red-300 hover:bg-red-950/30"
                    onClick={() => deleteCard(card.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {!filteredCards.length && <p className="text-sm text-slate-300">No domain cards available.</p>}
    </section>
  );
}
