"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CharacterEditor,
  type CharacterEditorValue,
} from "@/components/characters/character-editor";
import type { CharacterRecord } from "@/lib/characters";

type CampaignOption = {
  id: number;
  name: string;
};

export default function CharacterEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [character, setCharacter] = useState<CharacterRecord | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [characterResponse, campaignResponse] = await Promise.all([
        fetch(`/api/characters/${params.id}`, { cache: "no-store" }),
        fetch("/api/campaigns", { cache: "no-store" }),
      ]);

      const characterData = await characterResponse.json();
      const campaignData = await campaignResponse.json();
      if (cancelled) return;

      if (!characterResponse.ok) {
        setError(characterData.error ?? "Failed to load character");
        setLoading(false);
        return;
      }

      setCharacter(characterData);
      setCampaigns(
        (Array.isArray(campaignData) ? campaignData : []).map((item) => ({
          id: item.id as number,
          name: item.name as string,
        }))
      );
      setError(null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function onSubmit(value: CharacterEditorValue) {
    const response = await fetch(`/api/characters/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.formErrors?.join(", ") ?? data.error ?? "Failed to update character");
    }

    setCharacter(data);
    router.push(`/characters/${params.id}`);
    router.refresh();
  }

  async function onDelete() {
    if (!confirm("Delete this character? This cannot be undone.")) return;

    const response = await fetch(`/api/characters/${params.id}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Failed to delete character");
      return;
    }

    router.push("/characters");
    router.refresh();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl text-amber-300">Edit Character</h1>
        <div className="flex gap-2">
          <Link href={`/characters/${params.id}`} className="btn-outline min-h-11 px-3 py-2 text-sm">
            Cancel
          </Link>
          <button
            className="rounded-md border border-red-400/45 px-3 py-2 text-sm text-red-300 hover:bg-red-950/30"
            onClick={onDelete}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>

      {loading && <p className="text-slate-300">Loading character...</p>}
      {error && <p className="mb-3 text-red-400">{error}</p>}

      {!loading && character && (
        <CharacterEditor
          initial={character}
          campaignOptions={campaigns}
          submitLabel="Save Changes"
          pendingLabel="Saving..."
          onSubmit={onSubmit}
        />
      )}
    </main>
  );
}
