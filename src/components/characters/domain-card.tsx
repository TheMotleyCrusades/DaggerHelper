"use client";

import type { DomainCardDefinition } from "@/lib/constants/domains";

export function DomainCard({
  card,
  selected,
  onSelect,
  actionLabel,
}: {
  card: DomainCardDefinition;
  selected?: boolean;
  onSelect?: (card: DomainCardDefinition) => void;
  actionLabel?: string;
}) {
  const isSrdCard = Boolean(card.isOfficial && card.sourceCardId);
  const metaLeft = card.domain ? `${card.domain} Domain` : card.class;
  const levelLabel =
    card.level && card.level > 0 ? `Level ${card.level}` : `Tier ${card.tier}`;
  const typeLabel = card.cardType ? card.cardType.toUpperCase() : null;
  const stressLabel =
    typeof card.stressCost === "number" ? `Stress ${card.stressCost}` : null;
  const showFullCardImage = Boolean(card.imageUrl);
  const showTextDetails = !showFullCardImage || !isSrdCard;

  return (
    <article
      className={`rounded-xl border p-3 transition ${
        selected
          ? "border-amber-400/60 bg-amber-950/30"
          : "border-slate-700/50 bg-slate-900/65"
      }`}
    >
      {showFullCardImage && (
        <div className="mb-2 p-1">
          <div
            className="h-[23rem] w-full rounded-lg border border-slate-700/60 bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${card.imageUrl})` }}
          />
        </div>
      )}

      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h4 className="text-sm text-amber-200">{card.name}</h4>
          <p className="text-[11px] text-slate-400">
            {metaLeft} | {levelLabel}
          </p>
          <p className="text-[11px] text-slate-500">
            {[typeLabel, stressLabel].filter(Boolean).join(" | ") || "Custom card"}
          </p>
        </div>
        {!isSrdCard && (
          <span className="rounded-md border border-slate-600 px-2 py-0.5 text-[11px] text-slate-200">
            EVA {card.evasion}
          </span>
        )}
      </div>

      {showTextDetails ? (
        <p className="mb-2 whitespace-pre-wrap text-xs text-slate-300">{card.description}</p>
      ) : (
        <p className="mb-2 text-[11px] text-slate-400">
          Full SRD rules text is shown directly on the card image.
        </p>
      )}

      {Object.keys(card.traitBonuses ?? {}).length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {Object.entries(card.traitBonuses ?? {}).map(([trait, value]) => (
            <span
              key={`${card.id}-${trait}`}
              className="rounded-md border border-amber-700/40 px-1.5 py-0.5 text-[11px] text-amber-100"
            >
              {trait} {value > 0 ? `+${value}` : value}
            </span>
          ))}
        </div>
      )}

      {!isSrdCard && (
        <>
          <p className="text-[11px] text-slate-400">Move: {card.moveAbility || "-"}</p>
          <p className="mt-1 text-[11px] text-slate-400">Fragile: {card.fragileText || "-"}</p>
          <p className="mt-1 text-[11px] text-slate-300">Feature: {card.featureText || "-"}</p>
        </>
      )}

      {onSelect && (
        <button
          className="btn-outline mt-3 min-h-11 w-full px-3 py-2 text-xs"
          onClick={() => onSelect(card)}
          type="button"
        >
          {actionLabel ?? "Select"}
        </button>
      )}
    </article>
  );
}
