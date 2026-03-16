"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  EncounterForm,
  type EncounterFormValue,
} from "@/components/encounters/encounter-form";

type CampaignOption = { id: number; name: string };

type EncounterResponse = {
  id: number;
  campaignId: number;
  name: string;
  description?: string | null;
  difficulty?: string | null;
  adversaries: Array<{
    adversaryId: number;
    quantity: number;
  }>;
};

export default function EncounterDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  const [encounter, setEncounter] = useState<EncounterResponse | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) return;
    let cancelled = false;

    async function load() {
      const [encounterResponse, campaignResponse] = await Promise.all([
        fetch(`/api/encounters/${id}`, { cache: "no-store" }),
        fetch("/api/campaigns", { cache: "no-store" }),
      ]);
      const encounterData = await encounterResponse.json();
      const campaignData = await campaignResponse.json();
      if (cancelled) return;

      if (!encounterResponse.ok) {
        setError(encounterData.error ?? "Failed to load encounter");
        setLoading(false);
        return;
      }

      setEncounter(encounterData);
      setCampaigns((Array.isArray(campaignData) ? campaignData : []).map((item) => ({ id: item.id, name: item.name })));
      setError(null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const initial = useMemo<Partial<EncounterFormValue> | undefined>(() => {
    if (!encounter) return undefined;
    return {
      campaignId: encounter.campaignId,
      name: encounter.name,
      description: encounter.description ?? undefined,
      adversaries: encounter.adversaries.map((item) => ({
        adversaryId: item.adversaryId,
        quantity: item.quantity,
      })),
      partySize: 4,
      difficultyAdjustment: 0,
    };
  }, [encounter]);

  async function updateEncounter(value: EncounterFormValue) {
    const response = await fetch(`/api/encounters/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.formErrors?.join(", ") ?? data.error ?? "Failed to update encounter");
    }

    setEncounter((current) =>
      current
        ? {
            ...current,
            name: data.name,
            description: data.description,
            campaignId: data.campaignId,
            adversaries: value.adversaries,
          }
        : current
    );
  }

  async function deleteEncounter() {
    if (!confirm("Delete this encounter?")) return;
    const response = await fetch(`/api/encounters/${id}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/dashboard/encounters");
      router.refresh();
    }
  }

  if (!Number.isInteger(id) || id <= 0) {
    return <p className="text-red-400">Invalid encounter id.</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl text-amber-300">Encounter Details</h2>
          <p className="text-sm text-slate-300">Adjust composition, quantities, and pressure profile.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/encounters" className="btn-outline px-3 py-2 text-sm">
            Back
          </Link>
          {encounter?.campaignId ? (
            <Link href={`/campaigns/${encounter.campaignId}/hud?encounterId=${encounter.id}`} className="btn-outline px-3 py-2 text-sm">
              Launch GM HUD
            </Link>
          ) : null}
          <button
            className="rounded-md border border-red-400/45 px-3 py-2 text-sm text-red-300 hover:bg-red-950/30"
            onClick={deleteEncounter}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-300">Loading encounter...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && encounter && initial && (
        <EncounterForm
          campaignOptions={campaigns}
          initial={initial}
          submitLabel="Save Encounter"
          pendingLabel="Saving..."
          onSubmit={updateEncounter}
        />
      )}
    </section>
  );
}
