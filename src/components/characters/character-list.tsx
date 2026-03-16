"use client";

import Link from "next/link";
import type { CharacterRecord } from "@/lib/characters";

export function CharacterList({
  characters,
  onDelete,
}: {
  characters: CharacterRecord[];
  onDelete?: (id: number) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {characters.map((character) => (
        <article
          key={character.id}
          className="rounded-xl border border-slate-700/50 bg-slate-900/65 p-4"
        >
          <h3 className="text-lg text-amber-200">{character.name}</h3>
          <p className="text-xs text-slate-300">
            Level {character.level} {character.class} ({character.subclass})
          </p>
          <p className="text-xs text-slate-400">Campaign #{character.campaignId ?? "-"}</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Link href={`/characters/${character.id}`} className="btn-outline min-h-11 px-3 py-2 text-xs">
              View
            </Link>
            <Link
              href={`/characters/${character.id}/edit`}
              className="btn-outline min-h-11 px-3 py-2 text-xs"
            >
              Edit
            </Link>
            <a
              href={`/api/characters/${character.id}/export/pdf`}
              className="btn-outline min-h-11 px-3 py-2 text-center text-xs"
            >
              Export PDF
            </a>
            <a
              href={`/api/characters/${character.id}/export/json`}
              className="btn-outline min-h-11 px-3 py-2 text-center text-xs"
            >
              Export JSON
            </a>
          </div>

          {onDelete && (
            <button
              className="mt-2 w-full rounded-md border border-red-400/45 px-3 py-2 text-xs text-red-300 hover:bg-red-950/30"
              onClick={() => onDelete(character.id)}
              type="button"
            >
              Delete
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
