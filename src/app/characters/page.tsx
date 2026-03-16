"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CharacterList } from "@/components/characters/character-list";
import type { CharacterRecord } from "@/lib/characters";

export default function CharactersPage() {
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch("/api/characters", { cache: "no-store" });
      const data = await response.json();
      if (cancelled) return;

      if (!response.ok) {
        setError(data.error ?? "Failed to load characters");
        setLoading(false);
        return;
      }

      setCharacters(Array.isArray(data) ? data : []);
      setError(null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function deleteCharacter(id: number) {
    if (!confirm("Delete this character?")) return;

    const response = await fetch(`/api/characters/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Failed to delete character");
      return;
    }

    setCharacters((current) => current.filter((character) => character.id !== id));
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl text-amber-300">Characters</h1>
          <p className="text-sm text-slate-300">
            Manage campaign characters, export sheets, and share build links.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/characters" className="btn-outline min-h-11 px-3 py-2 text-sm">
            Dashboard View
          </Link>
          <Link href="/characters/create" className="btn-primary min-h-11 px-4 py-2 text-sm">
            New Character
          </Link>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-300">Loading characters...</p>}
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {!loading && characters.length > 0 && (
        <CharacterList characters={characters} onDelete={deleteCharacter} />
      )}

      {!loading && !characters.length && (
        <p className="text-sm text-slate-300">No characters yet. Start with the guided wizard.</p>
      )}
    </main>
  );
}
