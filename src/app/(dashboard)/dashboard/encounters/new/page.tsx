"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EncounterForm,
  type EncounterFormValue,
} from "@/components/encounters/encounter-form";

type CampaignOption = { id: number; name: string };

export default function NewEncounterPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCampaigns() {
      const response = await fetch("/api/campaigns", { cache: "no-store" });
      const data = await response.json();
      if (cancelled) return;
      if (!response.ok) {
        setError(data.error ?? "Failed to load campaigns");
        setLoading(false);
        return;
      }

      setCampaigns((Array.isArray(data) ? data : []).map((item) => ({ id: item.id, name: item.name })));
      setError(null);
      setLoading(false);
    }

    void loadCampaigns();
    return () => {
      cancelled = true;
    };
  }, []);

  async function createEncounter(value: EncounterFormValue) {
    const response = await fetch("/api/encounters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.formErrors?.join(", ") ?? data.error ?? "Failed to create encounter");
    }

    router.push(`/dashboard/encounters/${data.id}`);
    router.refresh();
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl text-amber-300">Create Encounter</h2>
          <p className="text-sm text-slate-300">Assemble adversaries and tune encounter pressure.</p>
        </div>
        <Link href="/dashboard/encounters" className="btn-outline px-3 py-2 text-sm">
          Back
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-300">Loading campaigns...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !campaigns.length && (
        <p className="text-sm text-slate-300">Create a campaign first before building encounters.</p>
      )}

      {!loading && campaigns.length > 0 && (
        <EncounterForm
          campaignOptions={campaigns}
          submitLabel="Create Encounter"
          pendingLabel="Creating..."
          onSubmit={createEncounter}
        />
      )}
    </section>
  );
}
