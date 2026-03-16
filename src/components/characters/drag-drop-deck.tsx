"use client";

import { useState } from "react";
import type { DomainCardDefinition } from "@/lib/constants/domains";

export function DragDropDeck({
  cards,
  maxCards,
  onMove,
  onRemove,
}: {
  cards: DomainCardDefinition[];
  maxCards: number;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (cardId: string) => void;
}) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  return (
    <section className="space-y-3 rounded-xl border border-slate-700/50 bg-slate-900/65 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg text-amber-200">Deck</h3>
        <span className="text-xs text-slate-300">
          {cards.length}/{maxCards}
        </span>
      </div>

      <div className="space-y-2">
        {cards.map((card, index) => (
          <article
            key={card.id}
            draggable
            onDragStart={() => setDraggingIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggingIndex === null || draggingIndex === index) return;
              onMove(draggingIndex, index);
              setDraggingIndex(null);
            }}
            className="rounded-lg border border-slate-700/60 bg-slate-950/60 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-amber-100">{card.name}</p>
                <p className="text-[11px] text-slate-400">
                  {card.domain ? `${card.domain} Domain` : card.class} |{" "}
                  {card.level ? `Level ${card.level}` : `Tier ${card.tier}`}
                </p>
              </div>
              <button
                className="rounded-md border border-red-400/45 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/30"
                onClick={() => onRemove(card.id)}
                type="button"
              >
                Remove
              </button>
            </div>

            <div className="mt-2 flex gap-2">
              <button
                className="btn-outline min-h-11 flex-1 px-2 py-1 text-[11px]"
                disabled={index === 0}
                onClick={() => onMove(index, Math.max(0, index - 1))}
                type="button"
              >
                Move Up
              </button>
              <button
                className="btn-outline min-h-11 flex-1 px-2 py-1 text-[11px]"
                disabled={index === cards.length - 1}
                onClick={() => onMove(index, Math.min(cards.length - 1, index + 1))}
                type="button"
              >
                Move Down
              </button>
            </div>
          </article>
        ))}
      </div>

      {!cards.length && (
        <p className="rounded-md border border-dashed border-slate-600 p-3 text-sm text-slate-300">
          No cards in deck. Add cards from the browser.
        </p>
      )}
    </section>
  );
}
