"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CharacterList } from "@/components/characters/character-list";
import type { CharacterRecord } from "@/lib/characters";

export default function DashboardCharactersPage() {
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
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Failed to delete character");
      return;
    }

    setCharacters((current) => current.filter((item) => item.id !== id));
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl text-amber-300">Characters</h2>
          <p className="text-sm text-slate-300">
            Character management is now integrated with export and sharing tools.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/characters" className="btn-outline min-h-11 px-3 py-2 text-sm">
            Open Full Page
          </Link>
          <Link href="/characters/create" className="btn-primary min-h-11 px-3 py-2 text-sm">
            Launch Wizard
          </Link>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-300">Loading characters...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && characters.length > 0 && (
        <CharacterList characters={characters} onDelete={deleteCharacter} />
      )}

      {!loading && !characters.length && (
        <p className="text-sm text-slate-300">No characters yet. Launch the wizard to create one.</p>
      )}
    </section>
  );
}
